# AWS Data Migration

This moves the live Road Accident Data Hub PostgreSQL data from the current GCP deployment into a new AWS PostgreSQL database.

The migration bundle exports every `public` table in the source database by default. For the current app this includes:

- users
- roles
- profiles
- accident submissions
- RAG cache
- auth activity logs
- feedback
- CCTNS hierarchy
- optional uploaded signed-copy files

Every exported table includes every column returned by PostgreSQL, so accident submission details are preserved with their original UUIDs, dates, JSON fields, signed-copy metadata, and user links.

## 1. Export From GCP

Run this on the current GCP VM from the server folder.

If the app uses Docker Compose with the repo defaults, the database is normally reachable on the host at port `5433`.

```bash
cd /opt/road-accident-hub/app/server

SOURCE_PGHOST=127.0.0.1 \
SOURCE_PGPORT=5433 \
SOURCE_PGUSER=postgres \
SOURCE_PGPASSWORD='YOUR_GCP_DB_PASSWORD' \
SOURCE_PGDATABASE=road_accident_db \
npm run data:export:gcp -- \
  --out /tmp/road-accident-data.json \
  --include-uploads \
  --uploads-dir /opt/road-accident-hub/app/server/uploads
```

Download `/tmp/road-accident-data.json` to your machine or copy it to the AWS server.

If the uploaded signed-copy files are very large, copy the `server/uploads` folder separately instead of embedding uploads in the JSON.

## 2. Import Into AWS

Run this from the AWS app server folder after the code is deployed and dependencies are installed.

Use `--replace` only when the AWS database should be made identical to the exported GCP data.

```bash
cd /opt/road-accident-hub/app/server

AWS_DATABASE_URL='postgres://USER:PASSWORD@AWS_HOST:5432/road_accident_db' \
npm run data:import:aws -- \
  --file /tmp/road-accident-data.json \
  --replace \
  --restore-uploads \
  --uploads-dir /opt/road-accident-hub/app/server/uploads
```

The importer runs the app database migration first, then inserts the exported rows while preserving UUIDs and relationships.
With `--replace`, it clears the target tables first using `TRUNCATE ... CASCADE`, then seeds them from the GCP export.

## 3. Verify Counts

Run these against AWS:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM accident_submissions;
SELECT COUNT(*) FROM feedback_messages;
SELECT COUNT(*) FROM cctns_hierarchy;
```

Compare the counts with the export logs.

## Notes

- Do not put database passwords or API keys in committed files.
- Keep the exported JSON private. It contains operational data, password hashes, auth logs, and uploaded documents when `--include-uploads` is used.
- If uploads are large, copy the `server/uploads` folder separately with `rsync` or `scp` and omit `--include-uploads`.
