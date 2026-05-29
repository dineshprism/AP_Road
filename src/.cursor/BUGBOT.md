# Frontend (React + Vite) — Bugbot rules

## Required patterns

- Auth via httpOnly cookies + `credentials: "include"` only (no `localStorage` tokens)
- Route guards (`ProtectedRoute`, `RoleRoute`) are UX only — never rely on them for security
- No `import.meta.env.VITE_*` for API keys or secrets

## Flag immediately

- `ReactMarkdown` / AI chat output without `rehype-sanitize`
- `dangerouslySetInnerHTML` with user-controlled or model-generated content
- Dead auth surfaces (`api.auth.signup`) calling endpoints that are not hardened
- Fetching absolute URLs for protected assets with credentials
- New pages wired in `App.tsx` without matching `RoleRoute` where roles matter

## Maps

- Do not add client-side Google Maps key loading; prefer server proxy or restricted keys
