import { Response } from "express";
import { getRolesByUserId, getUserRolesAndDistrict } from "./db/access.repo.js";
import { AuthRequest } from "./auth.js";

export const STATE_VIEWER_ROLES = ["admin", "dgp", "adgp"] as const;
export const ELEVATED_ROLES = ["admin", "dgp", "adgp", "prism"] as const;
/** District submitters and state writers; excludes prism/adgp per security policy. */
export const SUBMISSION_WRITER_ROLES = ["user", "admin", "dgp"] as const;
/** Always blocked from district submit flows even if they also hold admin/dgp. */
export const SUBMISSION_BLOCKED_ROLES = ["prism", "adgp"] as const;
/** Roles that must not use the district user dashboard (/dashboard). */
export const DISTRICT_DASHBOARD_DENIED_ROLES = ["prism", "adgp", "dgp", "admin"] as const;
/** Roles that use the accident map UI and may receive a browser Maps API key. */
export const MAPS_BROWSER_KEY_ROLES = ["user", "admin", "dgp", "adgp"] as const;

export type UserAccess = {
  roles: string[];
  profileDistrict: string | null;
  isStateViewer: boolean;
  canViewAnySubmission: boolean;
};

export async function getUserRoles(userId: string): Promise<string[]> {
  return getRolesByUserId(userId);
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  const { roles, district } = await getUserRolesAndDistrict(userId);

  return {
    roles,
    profileDistrict: district,
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

export function canWriteSubmissions(roles: string[]): boolean {
  if (roles.some((role) => (SUBMISSION_BLOCKED_ROLES as readonly string[]).includes(role))) {
    return false;
  }
  return roles.some((role) => (SUBMISSION_WRITER_ROLES as readonly string[]).includes(role));
}

export function canAccessDistrictDashboard(roles: string[]): boolean {
  if (!roles.includes("user")) return false;
  return !roles.some((role) => (DISTRICT_DASHBOARD_DENIED_ROLES as readonly string[]).includes(role));
}

export async function requireSubmissionWriter(req: AuthRequest, res: Response): Promise<boolean> {
  const roles = await getUserRoles(req.user!.userId);
  if (!canWriteSubmissions(roles)) {
    res.status(403).json({ error: "Submission access denied" });
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
