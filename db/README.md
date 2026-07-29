# Data (reference)

Files used by migrations, imports, or documentation — not runtime secrets.

| Path | Purpose |
|------|---------|
| `masterdata/CCTNS-Masterdata.csv` | CCTNS hierarchy import (`npm run` sync tool in `backend/tools`) |
| `schema/database-schema.sql` | PostgreSQL reference schema |
| `samples/sample-analytics-data.sql` | Optional analytics seed SQL |
| `dsr-csv/` | DSR worksheet CSV extracts (reference) |

Sensitive exports (e.g. `road-accident-data.json`) stay gitignored at repo root when present locally.
