# Security operations checklist

> **Full VAPT report (black / white / grey box):** [`docs/VAPT-FULL-REPORT-ROADSAFETY.md`](./VAPT-FULL-REPORT-ROADSAFETY.md)

## Remediation status (May 2026)

| Item | Status |
|------|--------|
| GCP API keys + HTTP referrer lock | **Done** on production |
| MFA for Prism / DGP / ADGP | **Not required** per project policy |
| `server_tokens off` in nginx | Add in `/etc/nginx/nginx.conf` → `http { server_tokens off; }` then `sudo nginx -t && sudo systemctl reload nginx` |
| Prism backup audit | **Done** — `event_type = backup_download` in `auth_activity_log` |
| Prism backup IP allowlist | Optional — set `PRISM_BACKUP_IP_ALLOWLIST=your.office.ip,another.ip` in `/opt/road-accident-hub/.env` |
| IDOR tests | **PASS** — see `docs/IDOR-TEST-RESULTS.md` |

## Secret rotation (after any leak in chat, history, or commit)

1. **Google Cloud** — Maps browser key should use HTTP referrers `https://roadsafety.prismappolice.in/*` only (confirmed done). Rotate again only after a new leak.
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
