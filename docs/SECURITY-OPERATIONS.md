# Security operations checklist

> **Full VAPT report (black / white / grey box):** [`docs/VAPT-FULL-REPORT-ROADSAFETY.md`](./VAPT-FULL-REPORT-ROADSAFETY.md)

## Secret rotation (after any leak in chat, history, or commit)

1. **Google Cloud** — rotate Maps browser key; restrict HTTP referrers to `https://roadsafety.prismappolice.in/*` only; enable Maps JavaScript API only.
2. **Gemini** — create new API key; disable old key; set billing alerts.
3. **Application** — generate new `JWT_SECRET` (64+ hex chars); all users must log in again.
4. **Database** — change `DB_PASSWORD` in `/opt/road-accident-hub/.env`; update Postgres and recreate app container.
5. **Server** — `history -c` does not remove old entries; consider rotating keys even if history was cleared.

## nginx hardening

```nginx
# /etc/nginx/nginx.conf — inside http { }
server_tokens off;
```

```nginx
# Site block (HTTP + HTTPS)
client_max_body_size 25M;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Deploy hygiene

- Never `git commit` on the production server; use `git reset --hard origin/main`.
- Never commit `.env` to GitHub.
- Do not run `data:import:aws --replace` on production unless intentionally wiping data.
