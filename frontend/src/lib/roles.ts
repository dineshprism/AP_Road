/** District submitters and authorized administrators; excludes dgp/adgp/prism per security policy. */
export const SUBMISSION_WRITER_ROLES = ["user", "admin"] as const;
/** Always blocked from district submit flows even if they also hold admin/dgp. */
export const SUBMISSION_BLOCKED_ROLES = ["prism", "adgp", "dgp"] as const;
export const DISTRICT_DASHBOARD_DENIED_ROLES = ["prism", "adgp", "dgp", "admin"] as const;

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
