import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userEmail?: string;
    userPlan?: string;
    userName?: string;
  }
}

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(80).optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const { email, password, name } = parsed.data;
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      name: name ?? email.split("@")[0],
      plan: "free",
    }).returning();

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userPlan = user.plan;
    req.session.userName = user.name;

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });
  } catch (err) {
    req.log.error({ err }, "Register failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Reset monthly usage if month has rolled over
    const now = new Date();
    const resetDate = user.usageResetAt ? new Date(user.usageResetAt) : new Date(0);
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      await db.update(usersTable).set({ monthlyUsage: 0, usageResetAt: now }).where(eq(usersTable.id, user.id));
    }

    await db.update(usersTable).set({ lastLoginAt: now }).where(eq(usersTable.id, user.id));

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userPlan = user.plan;
    req.session.userName = user.name;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("ebay_sid");
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      plan: usersTable.plan,
      monthlyUsage: usersTable.monthlyUsage,
    }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);

    if (!user) {
      req.session.destroy(() => {});
      res.json({ user: null });
      return;
    }
    res.json({ user });
  } catch (err) {
    req.log.error({ err }, "Auth me failed");
    res.json({ user: null });
  }
});

// GET /api/auth/usage
router.get("/auth/usage", async (req, res) => {
  if (!req.session.userId) {
    res.json({ usage: 0, limit: 500, plan: "free" });
    return;
  }
  try {
    const [user] = await db.select({
      monthlyUsage: usersTable.monthlyUsage,
      plan: usersTable.plan,
    }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);

    const { adminSettingsTable } = await import("@workspace/db");
    const [settings] = await db.select({
      freeMonthlyLimit: adminSettingsTable.freeMonthlyLimit,
    }).from(adminSettingsTable).limit(1);

    const limit = user?.plan === "free" ? (settings?.freeMonthlyLimit ?? 500) : 999999;
    res.json({ usage: user?.monthlyUsage ?? 0, limit, plan: user?.plan ?? "free" });
  } catch (err) {
    res.json({ usage: 0, limit: 500, plan: "free" });
  }
});

export default router;
