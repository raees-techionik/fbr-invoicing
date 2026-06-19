import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getProfile, loginUser, registerUser, requestPasswordReset, verifyResetCode, resetPassword } from "../services/auth.service.js";

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Creates a user, a personal workspace company, and default membership (OWNER).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               fullName: { type: string }
 *               phone: { type: string }
 *               personalWorkspaceName: { type: string }
 *     responses:
 *       201:
 *         description: Created
 *       409:
 *         description: Email already registered
 */
authRouter.post("/register", async (req, res, next) => {
  try {
    const body = await registerUser(req.body);
    res.status(201).json(body);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Invalid credentials
 */
authRouter.post("/login", async (req, res, next) => {
  try {
    const body = await loginUser(req.body);
    res.json(body);
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current user and companies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Company-Id
 *         required: false
 *         schema: { type: string }
 *         description: Company to activate. Defaults to the user's default membership.
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 */
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const profile = await getProfile(req.auth!.userId);
    res.json({ ...profile, activeCompany: req.activeCompany });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (!email) { res.status(400).json({ error: "Email is required" }); return; }
    res.json(await requestPasswordReset(String(email)));
  } catch (e) { next(e); }
});

authRouter.post("/verify-reset-code", async (req, res, next) => {
  try {
    const { email, code } = req.body ?? {};
    if (!email || !code) { res.status(400).json({ error: "Email and code are required" }); return; }
    res.json(await verifyResetCode(String(email), String(code)));
  } catch (e) { next(e); }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body ?? {};
    if (!email || !resetToken || !newPassword) { res.status(400).json({ error: "email, resetToken and newPassword are required" }); return; }
    res.json(await resetPassword(String(email), String(resetToken), String(newPassword)));
  } catch (e) { next(e); }
});
