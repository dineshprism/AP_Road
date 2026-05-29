import { Request, Response, NextFunction } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.path === "/api/health" || req.path === "/api/auth/login") {
    next();
    return;
  }

  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    res.status(403).json({ error: "Invalid request" });
    return;
  }

  next();
}
