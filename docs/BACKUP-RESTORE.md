# Backup & restore (production only)

**All live data lives on production** (`https://roadsafety.prismappolice.in`). There is no separate “dev database” to back up — you protect production by **downloading a backup file from Prism** on a schedule.

| Schedule | Recommended for |
|----------|-----------------|
| **Weekly** | Normal operations (minimum) |
| **Daily** | Heavy data entry weeks or before/after important deadlines |

Store each file on your PC, Google Drive, or S3 with a date in the name (the download already includes a timestamp).

---

## Daily / weekly routine (production)

1. Log in as **Prism** on the live site.
2. Open **PRISM Dashboard**.
3. Click **Download full backup**.
4. Save the `.json` somewhere safe (do not leave only on the server).
5. Optional: note submission count in the toast / file size for your records.

No server SSH required for routine backups — the button does the same export as the CLI.

---

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

## Prism dashboard (use this every week)

1. Log in as **Prism** on **production**.
2. Open **PRISM Dashboard**.
3. Click **Download full backup**.
4. Save the `.json` off the server (PC / cloud storage).

Large sites may take 1–5 minutes; wait until the download starts.

Limit: **6 downloads per hour** (enough for daily manual backups).

---

## CLI on the server (optional fallback)

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

## When to back up

| When | Action |
|------|--------|
| **Every week** (minimum) | Prism → **Download full backup** on production |
| **Every day** (optional) | Same, if districts are submitting heavily |
| Before risky server work | Extra backup + optional `pg_dump` (WEBSITE-UPDATE.md §2.6) |
| After deploy | Not required if you already have a recent file; deploy does not replace DB |

You do **not** need backups from a local PC install — production Prism download is the source of truth.

---

## Notes

- Backup files contain **password hashes** and **signed PDFs** — treat as confidential.
- Very large signed-copy volumes may produce a multi‑GB JSON; use CLI export and copy `uploads/` separately if needed (see AWS_DATA_MIGRATION.md).
- Do **not** run `--replace` on production unless you intend to overwrite all data.
