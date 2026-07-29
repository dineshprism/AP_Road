# Server (Express + PostgreSQL) — Bugbot rules

## Required patterns

- All DB access via `pool.query` with bound parameters
- `authMiddleware` on every route except health and auth login/logout
- `requireAdmin` / `getAccessContext` for `/api/admin`, analytics exports, RAG batch
- `multer` uploads: `limits.fileSize` (e.g. 5MB), MIME allowlist + magic-byte check
- `express-rate-limit` on login; consider per-route limits on `/api/rag/*` and exports

## Flag immediately

- `district` taken from `req.body` on `POST /api/submissions` without matching `profiles.district`
- Missing `user_id` in `UPDATE`/`DELETE` for non-admin users
- `error.message` or stack traces in JSON error responses
- Default empty `PGPASSWORD` or weak `JWT_SECRET` allowed when `NODE_ENV=production`
- `trust proxy` without documented reverse-proxy requirement
- CORS `credentials: true` with permissive origin (`!origin` allowed) in production

## Env & secrets

- `JWT_SECRET` required in production (exit on weak/missing)
- `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY` only in server env — never in frontend bundle
