import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, adminSettingsTable, usageTrackingTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Track usage for a user (or anonymous session)
export async function trackUsage(req: Request, action: string, processingTime?: number, sizeBytes?: number) {
  try {
    await db.insert(usageTrackingTable).values({
      userId: req.session?.userId ?? null,
      sessionId: req.sessionID ?? null,
      action: action as "upscale",
      ipAddress: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      processingTime: processingTime ? Math.round(processingTime) : null,
      sizeBytes: sizeBytes ?? null,
    });

    if (req.session?.userId) {
      const [user] = await db.select({ monthlyUsage: usersTable.monthlyUsage })
        .from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
      if (user) {
        await db.update(usersTable)
          .set({ monthlyUsage: user.monthlyUsage + 1, updatedAt: new Date() })
          .where(eq(usersTable.id, req.session.userId));
      }
    }
  } catch {
    // Non-fatal — don't break the request
  }
}

// Middleware: check if user is within their quota
export function checkQuota(action?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch settings
      const [settings] = await db.select({
        requireLoginForPro: adminSettingsTable.requireLoginForPro,
        proFeaturesEnabled: adminSettingsTable.proFeaturesEnabled,
        freeMonthlyLimit: adminSettingsTable.freeMonthlyLimit,
      }).from(adminSettingsTable).limit(1);

      const limit = settings?.freeMonthlyLimit ?? 500;

      // If user is logged in, check their monthly usage
      if (req.session?.userId) {
        const [user] = await db.select({
          monthlyUsage: usersTable.monthlyUsage,
          plan: usersTable.plan,
          usageResetAt: usersTable.usageResetAt,
        }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);

        if (user) {
          // Check if reset is needed
          const now = new Date();
          const resetDate = user.usageResetAt ? new Date(user.usageResetAt) : new Date(0);
          if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
            await db.update(usersTable).set({ monthlyUsage: 0, usageResetAt: now }).where(eq(usersTable.id, req.session.userId));
          } else if (user.plan === "free" && user.monthlyUsage >= limit) {
            res.status(429).json({
              error: "Monthly limit reached",
              message: `You've used ${user.monthlyUsage}/${limit} free operations this month. Upgrade to Pro for unlimited access.`,
              usage: user.monthlyUsage,
              limit,
              plan: user.plan,
            });
            return;
          }
        }
      }

      next();
    } catch {
      next(); // Don't block on DB errors
    }
  };
}
