import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const authApi = axios.create({ baseURL: `${API_BASE_URL}/api/auth` });

export async function requestPasswordReset(email) {
  const res = await authApi.post("/forgot-password", { email });
  return res.data;
}

export async function verifyResetCode(email, code) {
  const res = await authApi.post("/verify-reset-code", { email, code });
  return res.data;
}

export async function resetPassword(email, resetToken, newPassword) {
  const res = await authApi.post("/reset-password", { email, resetToken, newPassword });
  return res.data;
}
