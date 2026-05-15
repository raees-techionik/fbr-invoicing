jest.mock("qrcode", () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn(() => "data:image/png;base64,AAAA"),
  },
}));

jest.mock("jspdf", () => {
  const textCalls = [];
  const addImageCalls = [];

  return {
  __mockTextCalls: textCalls,
  __mockAddImageCalls: addImageCalls,
  jsPDF: function () {
    this.addImage = (...args) => addImageCalls.push(args);
    this.addPage = jest.fn();
    this.getNumberOfPages = () => 1;
    this.line = jest.fn();
    this.output = () => new Blob(["pdf"], { type: "application/pdf" });
    this.rect = jest.fn();
    this.setFillColor = jest.fn();
    this.setFont = jest.fn();
    this.setFontSize = jest.fn();
    this.setLineWidth = jest.fn();
    this.setPage = jest.fn();
    this.setTextColor = jest.fn();
    this.splitTextToSize = (text) => [String(text)];
    this.text = (text) => textCalls.push(Array.isArray(text) ? text.join(" ") : String(text));
  },
};
});

const QRCode = require("qrcode").default;
const { __mockTextCalls: mockTextCalls, __mockAddImageCalls: mockAddImageCalls } = require("jspdf");
const { generateInvoicePdfFromRecord } = require("./generateInvoicePdf");

beforeEach(() => {
  mockTextCalls.length = 0;
  mockAddImageCalls.length = 0;
  QRCode.toDataURL.mockClear();
  QRCode.toDataURL.mockImplementation(() => "data:image/png;base64,AAAA");
});

test("generates Rule 150R print data with QR version/size and offline watermark", async () => {
  const blob = await generateInvoicePdfFromRecord({
    invoiceType: "Sale Invoice",
    invoiceDate: "2026-05-08",
    invoiceRefNo: "INV-150R-1-WITH-A-LONG-REFERENCE-FOR-WRAP-CHECK",
    fbrInvoiceNumber: "000001120526172455-0001-LONG-WRAP-CHECK",
    sellerBusinessName: "Codex Seller",
    sellerNTNCNIC: "1234567890123",
    sellerProvince: "Punjab",
    sellerAddress: "Seller address",
    buyerBusinessName: "Codex Buyer",
    buyerNTNCNIC: "9876543210987",
    buyerProvince: "Sindh",
    buyerAddress: "Buyer address",
    buyerRegistrationType: "Registered",
    status: "OFFLINE",
    items: [
      {
        hsCode: "0101.2100",
        productDescription: "Rule 150R test item",
        rate: "18%",
        uoM: "KG",
        quantity: 1,
        totalValues: 118,
        valueSalesExcludingST: 100,
        fixedNotifiedValueOrRetailPrice: 90,
        salesTaxApplicable: 18,
        salesTaxWithheldAtSource: 2,
        extraTax: 3,
        furtherTax: 4,
        fedPayable: 5,
        discount: 6,
        saleType: "Goods at standard rate",
        sroScheduleNo: "SRO-TEST",
        sroItemSerialNo: "50",
      },
    ],
  });

  expect(blob).toBeInstanceOf(Blob);
  expect(QRCode.toDataURL).toHaveBeenCalledWith(
    "000001120526172455-0001-LONG-WRAP-CHECK",
    expect.objectContaining({
      version: 2,
      width: 144,
      margin: 2,
      errorCorrectionLevel: "M",
    }),
  );
  expect(mockAddImageCalls).toContainEqual(
    expect.arrayContaining(["data:image/png;base64,AAAA", "PNG", expect.any(Number), expect.any(Number), 72, 72]),
  );

  const renderedText = mockTextCalls.join(" ");
  expect(renderedText).toContain("Powered by Techionik");
  expect(renderedText).toContain("FBR Invoice No:");
  expect(renderedText).toContain("000001120526172455-0001-LONG-WRAP-CHECK");
  expect(renderedText).toContain("Software Reg. No");
  expect(renderedText).toContain("Rule 150R");
  expect(renderedText).toContain("OFFLINE INVOICE - NOT YET SUBMITTED TO FBR");
  expect(renderedText).toContain("Sale Type: Goods at standard rate");
  expect(renderedText).toContain("SRO Schedule: SRO-TEST");
  expect(renderedText).toContain("SRO Item Serial: 50");
  expect(renderedText).toContain("Fixed/Notified/Retail: 90.00");
  expect(renderedText).toContain("ST Withheld: 2.00");
  expect(renderedText).toContain("Extra Tax: 3.00");
  expect(renderedText).toContain("Discount: 6.00");
  expect(renderedText).toContain("Total Sales Tax Withheld");
  expect(renderedText).toContain("Total Extra Tax");
});
