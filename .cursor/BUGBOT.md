# Road Accident Data Hub — Bugbot audit rules

Government accident investigation system (Andhra Pradesh). Treat all findings as security-sensitive: PII, FIR numbers, victim data, signed PDFs.

## Block merges on

- Hardcoded secrets, API keys, or passwords in source (use env vars only; never `VITE_*` for secrets)
- `eval`, `new Function`, or unsanitized `dangerouslySetInnerHTML` with user/model content
- SQL built from unvalidated user strings (must use parameterized queries `$1`, `$2`, …)
- New API routes without `authMiddleware` (except `/api/health`)
- Admin/state-wide data routes without explicit role checks (`admin`, `dgp`, `adgp`, `prism` — use a shared helper)
- Returning raw `GOOGLE_MAPS_API_KEY` or `GEMINI_API_KEY` to the browser
- Accepting `district` from client body for district-scoped users on create/update (must bind to `profiles.district` server-side)
- File uploads without `limits.fileSize`, magic-byte validation, and auth on download paths
- JWT in cookies without CSRF mitigation on state-changing POST/PUT/DELETE

## Auth & authorization

- Cookie auth: `httpOnly`, `secure` in production, `SameSite=strict` for production APIs
- `clearCookie` must use the same options as `authCookieOptions()`
- `GET /api/submissions/:id` must enforce district scope for non–state-wide roles
- Batch RAG/analytics: cap array lengths (e.g. max 20 IDs), reject if any ID is out of scope
- Centralize RBAC; do not duplicate inconsistent role lists across route files

## Data integrity

- Signed-copy filenames must include submission UUID (avoid `{district}_{fir}` collisions)
- Upload URLs returned to clients must match served path (`/api/uploads/...`)
- CSV exports: neutralize formula injection (`=`, `+`, `-`, `@` at cell start)

## AI / RAG

- Never log prompt text containing PII (FIR, names, locations)
- Return generic 500 messages to clients; log details server-side only
- AI markdown rendering must use `rehype-sanitize` and safe link handling

## Dependencies

- Run `npm audit` in root and `server/` before release
- Prefer upgrading `react-router-dom`, `vite`, `bcrypt` when advisories apply

## Tests

- New auth or submission logic should include or extend API/integration tests
- Do not remove rate limiting on `/api/auth/login`
