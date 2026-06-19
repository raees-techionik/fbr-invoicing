import { Buffer } from "node:buffer";
import net from "node:net";
import tls from "node:tls";

export type EmailDeliveryStatus = "SENT" | "FAILED" | "DEV_LOGGED";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailDeliveryResult {
  status: EmailDeliveryStatus;
  error?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  fromName: string;
  requireTls: boolean;
}

export function appBaseUrl() {
  return process.env.APP_BASE_URL || process.env.FRONTEND_BASE_URL || "http://localhost:3001";
}

export function makeInvitationLink(token: string) {
  return `${appBaseUrl().replace(/\/+$/, "")}/company-invitation/${token}`;
}

export async function sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
  const config = smtpConfig();
  if (!config) {
    console.info("[email:dev]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { status: "DEV_LOGGED" };
  }

  try {
    await sendSmtp(input, config);
    return { status: "SENT" };
  } catch (error) {
    return { status: "FAILED", error: error instanceof Error ? error.message : String(error) };
  }
}

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || "no-reply@techionik.com",
    fromName: process.env.EMAIL_FROM_NAME || "Techionik FBR Digital Invoicing",
    requireTls: process.env.SMTP_REQUIRE_TLS !== "false",
  };
}

async function sendSmtp(input: SendEmailInput, config: SmtpConfig) {
  const client = await SmtpClient.connect(config);
  try {
    await client.expectReady();
    const ehlo = await client.command(`EHLO ${smtpDomain()}`, [250]);
    const supportsStartTls = ehlo.some(line => line.toUpperCase().includes("STARTTLS"));

    if (!config.secure && config.requireTls && supportsStartTls) {
      await client.command("STARTTLS", [220]);
      await client.upgradeToTls(config.host);
      await client.command(`EHLO ${smtpDomain()}`, [250]);
    }

    if (config.user && config.pass) {
      const auth = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString("base64");
      await client.command(`AUTH PLAIN ${auth}`, [235]);
    }

    await client.command(`MAIL FROM:<${config.from}>`, [250]);
    await client.command(`RCPT TO:<${input.to}>`, [250, 251]);
    await client.command("DATA", [354]);
    await client.writeData(buildMessage(input, config));
    await client.command("QUIT", [221]);
  } finally {
    client.close();
  }
}

function buildMessage(input: SendEmailInput, config: SmtpConfig) {
  const boundary = `techionik-${Date.now().toString(36)}`;
  const headers = [
    `From: ${formatAddress(config.fromName, config.from)}`,
    `To: ${formatAddress("", input.to)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
    "",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
}

function formatAddress(name: string, email: string) {
  return name ? `"${name.replace(/"/g, "'")}" <${email}>` : `<${email}>`;
}

function encodeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function smtpDomain() {
  return process.env.SMTP_EHLO_DOMAIN || "localhost";
}

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = "";
  private pending?: {
    resolve: (lines: string[]) => void;
    reject: (error: Error) => void;
  };
  private readyLines: string[] | null = null;

  private constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    this.socket.setEncoding("utf8");
    this.socket.on("data", chunk => this.receive(String(chunk)));
    this.socket.on("error", error => this.fail(error));
  }

  static async connect(config: SmtpConfig) {
    const socket = config.secure
      ? tls.connect({ host: config.host, port: config.port, servername: config.host })
      : net.connect({ host: config.host, port: config.port });
    await new Promise<void>((resolve, reject) => {
      socket.once(config.secure ? "secureConnect" : "connect", resolve);
      socket.once("error", reject);
    });
    return new SmtpClient(socket);
  }

  async expectReady(consume = true) {
    if (!consume) return;
    const lines = await this.nextResponse();
    this.assertCode(lines, [220]);
  }

  async command(command: string, expectedCodes: number[]) {
    this.socket.write(`${command}\r\n`);
    const lines = await this.nextResponse();
    this.assertCode(lines, expectedCodes);
    return lines;
  }

  async writeData(message: string) {
    const escaped = message.replace(/^\./gm, "..");
    this.socket.write(`${escaped}\r\n.\r\n`);
    const lines = await this.nextResponse();
    this.assertCode(lines, [250]);
    return lines;
  }

  async upgradeToTls(host: string) {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket = tls.connect({ socket: this.socket, servername: host });
    await new Promise<void>((resolve, reject) => {
      this.socket.once("secureConnect", resolve);
      this.socket.once("error", reject);
    });
    this.socket.setEncoding("utf8");
    this.socket.on("data", chunk => this.receive(String(chunk)));
    this.socket.on("error", error => this.fail(error));
  }

  close() {
    this.socket.end();
  }

  private nextResponse() {
    if (this.readyLines) {
      const lines = this.readyLines;
      this.readyLines = null;
      return Promise.resolve(lines);
    }
    return new Promise<string[]>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.flush();
    });
  }

  private receive(chunk: string) {
    this.buffer += chunk;
    this.flush();
  }

  private flush() {
    const lines = this.buffer.split(/\r?\n/);
    if (!this.buffer.endsWith("\n")) return;
    this.buffer = "";
    const responseLines = lines.filter(Boolean);
    const last = responseLines[responseLines.length - 1];
    if (!last || !/^\d{3} /.test(last)) {
      this.buffer = `${responseLines.join("\r\n")}\r\n`;
      return;
    }
    if (this.pending) {
      this.pending.resolve(responseLines);
      this.pending = undefined;
    } else {
      this.readyLines = responseLines;
    }
  }

  private fail(error: Error) {
    if (this.pending) {
      this.pending.reject(error);
      this.pending = undefined;
    }
  }

  private assertCode(lines: string[], expectedCodes: number[]) {
    const code = Number(lines[0]?.slice(0, 3));
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP expected ${expectedCodes.join("/")} but received: ${lines.join(" | ")}`);
    }
  }
}
