# Backup & restore (Prism + CLI)

Full production backup in **one seed-ready JSON file** — same format as GCP→AWS migration.

## What is included

| Data | In backup file |
|------|----------------|
| District accident submissions (all fields, JSON victims, etc.) | Yes |
| Signed copy PDFs | Yes (embedded base64) |
| Users, roles, profiles | Yes |
| Feedback, login activity logs | Yes |
| CCTNS hierarchy, RAG cache | Yes |

The file header includes `restore.importCommand` with the exact import command.

---

## Option A — Prism dashboard (easiest)

1. Log in as **Prism**.
2. Open **PRISM Dashboard**.
3. Click **Download full backup**.
4. Save the `.json` file somewhere safe (USB, S3, your PC).

Large sites may take 1–5 minutes; wait until the download starts.

Limit: **6 downloads per hour** per server (abuse protection).

---

## Option B — CLI on the server

```bash
cd /opt/road-accident-hub/app/server

npm run data:export:gcp -- \
  --out /tmp/road-accident-backup.json \
  --include-uploads \
  --uploads-dir /app/server/uploads \
  --use-default-env
```

Inside Docker:

```bash
docker compose exec app sh -c 'cd /app/server && npm run data:export:gcp -- --out /tmp/backup.json --include-uploads --uploads-dir ./uploads --use-default-env'
docker compose cp app:/tmp/backup.json ./backup-$(date +%Y%m%d).json
```

---

## Restore / seed after disaster

**Warning:** `--replace` clears existing DB tables before import. Use only when recovering or cloning to a fresh database.

1. Copy `road-accident-backup-*.json` to the server (e.g. `/tmp/`).
2. From `app/server`:

```bash
cd /opt/road-accident-hub/app/server

npm run data:import:aws -- \
  --file /tmp/road-accident-backup.json \
  --replace \
  --restore-uploads \
  --use-default-env \
  --uploads-dir /opt/road-accident-hub/app/server/uploads
```

Docker:

```bash
docker compose exec app sh -c 'cd /app/server && npm run data:import:aws -- --file /tmp/road-accident-backup.json --replace --restore-uploads --use-default-env --uploads-dir ./uploads'
```

3. Recreate app if needed: `docker compose up -d --force-recreate app`
4. Verify counts:

```bash
docker compose exec db psql -U postgres road_accident_db -c "SELECT COUNT(*) FROM accident_submissions;"
```

---

## Quick schedule (recommended)

| When | Action |
|------|--------|
| Weekly | Prism → **Download full backup** |
| Before every deploy | Optional SQL dump: `pg_dump` (see WEBSITE-UPDATE.md §2.6) |
| After major data entry | Extra backup |

---

## Notes

- Backup files contain **password hashes** and **signed PDFs** — treat as confidential.
- Very large signed-copy volumes may produce a multi‑GB JSON; use CLI export and copy `uploads/` separately if needed (see AWS_DATA_MIGRATION.md).
- Do **not** run `--replace` on production unless you intend to overwrite all data.
