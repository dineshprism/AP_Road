import { Response } from "express";
import pool from "./db.js";
import { AuthRequest } from "./auth.js";

export const STATE_VIEWER_ROLES = ["admin", "dgp", "adgp"] as const;
export const ELEVATED_ROLES = ["admin", "dgp", "adgp", "prism"] as const;
/** Roles that use the accident map UI and may receive a browser Maps API key. */
export const MAPS_BROWSER_KEY_ROLES = ["user", "admin", "dgp", "adgp"] as const;

export type UserAccess = {
  roles: string[];
  profileDistrict: string | null;
  isStateViewer: boolean;
  canViewAnySubmission: boolean;
};

export async function getUserRoles(userId: string): Promise<string[]> {
  const roleResult = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]);
  return roleResult.rows.map((row) => String(row.role));
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  const [roleResult, profileResult] = await Promise.all([
    pool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]),
    pool.query("SELECT district FROM profiles WHERE user_id = $1", [userId]),
  ]);

  const roles = roleResult.rows.map((row) => String(row.role));
  const profileDistrict = profileResult.rows[0]?.district
    ? String(profileResult.rows[0].district)
    : null;

  return {
    roles,
    profileDistrict,
    isStateViewer: roles.some((role) => (STATE_VIEWER_ROLES as readonly string[]).includes(role)),
    canViewAnySubmission: roles.some((role) => (ELEVATED_ROLES as readonly string[]).includes(role)),
  };
}

export function canPickDistrict(access: UserAccess): boolean {
  return access.isStateViewer;
}

export function resolveDistrictForWrite(access: UserAccess, requestedDistrict: string): string | null {
  if (canPickDistrict(access)) {
    return requestedDistrict;
  }
  return access.profileDistrict;
}

export async function requireRoles(
  req: AuthRequest,
  res: Response,
  allowedRoles: readonly string[],
  message = "Access denied"
): Promise<boolean> {
  const roles = await getUserRoles(req.user!.userId);
  if (!roles.some((role) => allowedRoles.includes(role))) {
    res.status(403).json({ error: message });
    return false;
  }
  return true;
}

export async function requireStateViewer(req: AuthRequest, res: Response): Promise<boolean> {
  return requireRoles(req, res, STATE_VIEWER_ROLES, "State-level access required");
}

export async function requireElevated(req: AuthRequest, res: Response): Promise<boolean> {
  return requireRoles(req, res, ELEVATED_ROLES, "Elevated access required");
}
