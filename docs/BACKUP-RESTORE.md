# Backup & restore (production)

All live data is on **production** only. Whenever you want a backup, log in as **Prism** and click **Download full backup (all data)**.

## What each download contains

**Everything from zero to the moment you click** — not “today only” or “last week”:

| Included | Notes |
|----------|--------|
| All accident submissions | Every district, every field, from first entry to now |
| All signed-copy PDFs | Embedded in the JSON |
| Users, roles, profiles | Full account data |
| Feedback, login logs, CCTNS, RAG cache | Complete tables |

There is **no date filter**. Each file is a full snapshot you can use to restore the whole portal.

---

## How to back up (any time)

1. Open https://roadsafety.prismappolice.in  
2. Log in as **Prism**  
3. **PRISM Dashboard** → **Download full backup (all data)**  
4. Wait until the file downloads (can take a few minutes if many PDFs)  
5. Save the `.json` on your PC or cloud storage  

Click again next week, next month, or twice in one day — each click exports **all current data** again.

---

## Restore after disaster

Copy the backup file to the server, then:

```bash
cd /opt/road-accident-hub/app/server

npm run data:import:aws -- \
  --file /tmp/road-accident-backup.json \
  --replace \
  --restore-uploads \
  --use-default-env \
  --uploads-dir /opt/road-accident-hub/app/server/uploads
```

**Warning:** `--replace` clears the database before import. Use only for recovery.

Docker:

```bash
docker compose exec app sh -c 'cd /app/server && npm run data:import:aws -- --file /tmp/road-accident-backup.json --replace --restore-uploads --use-default-env --uploads-dir ./uploads'
```

---

## Optional: CLI on server

Same full export without the browser:

```bash
cd /opt/road-accident-hub/app/server
npm run data:backup -- --out /tmp/road-accident-backup.json
```

---

## Limits & security

- **6 downloads per hour** (abuse protection — enough for manual use anytime)  
- Files contain password hashes and PDFs — keep confidential  
- Very large sites: file may be big; wait for download to finish  

---

*See also `docs/WEBSITE-UPDATE.md` for deploy steps.*
