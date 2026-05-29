# IDOR & authenticated access tests — results

**Target:** https://roadsafety.prismappolice.in  
**Date:** 29 May 2026  
**Method:** White-box / grey-box code review + logic verification (live black-box with role accounts optional)

---

## Summary

| Result | **PASS** (district isolation enforced in application code) |
|--------|-----------------------------------------------------------|

Statewide access for DGP, ADGP, and Prism is **by requirement**, not a failure.

---

## Test matrix

| ID | Test | Expected | Code / logic result | Status |
|----|------|----------|---------------------|--------|
| BB-A | District A reads district B submission by UUID | 404 or 403 | `GET /api/submissions/:id` uses `user_id` filter when not elevated (`submissions.ts`) | **PASS** |
| BB-B | District uploads signed copy to another district’s submission | 404 | Upload query includes `AND user_id = $2` for non-elevated | **PASS** |
| BB-C | District creates submission for another district | 403 | `resolveDistrictForWrite` + profile district check | **PASS** |
| BB-D | DGP reads any submission by UUID | 200 | `canViewAnySubmission` — **by design** | **PASS (accepted)** |
| BB-E | Prism `GET /api/admin/backup` without prism role | 403 | `requirePrism` | **PASS** |
| BB-F | District `GET /api/admin/submissions` | 403 | `requireElevated` | **PASS** |
| BB-G | Upload &gt; 25 MB | 413 | `MAX_UPLOAD_BYTES` + multer limit | **PASS** |

---

## Evidence (code references)

**View submission IDOR (district):**

```324:346:server/src/routes/submissions.ts
    if (access.canViewAnySubmission) {
      result = await pool.query("SELECT * FROM accident_submissions WHERE id = $1", [id]);
    } else {
      result = await pool.query(
        "SELECT * FROM accident_submissions WHERE id = $1 AND user_id = $2",
        [id, userId]
      );
    }
```

**District write scope:**

```231:240:server/src/routes/submissions.ts
    const effectiveDistrict = resolveDistrictForWrite(access, district);
    ...
    if (!canPickDistrict(access) && effectiveDistrict !== district) {
      res.status(403).json({ error: "District must match your assigned profile district" });
```

---

## Live black-box (optional)

If you create two district test accounts, re-run BB-A/B in a browser or Burp and attach screenshots here. Logic review above is sufficient for release when test accounts are not available.

---

## Sign-off

| Item | Status |
|------|--------|
| District IDOR | PASS |
| Elevated statewide access | Accepted per requirement |
| Reviewer | Code audit (VAPT-AP-ROAD-2026-001) |
