import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["x-admin-token"];
  const adminPassword = process.env.ADMIN_PASSWORD || "teslatrack-admin-2026";
  if (!auth || auth !== adminPassword) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

