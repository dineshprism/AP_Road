# Website update guide — local IDE vs AWS VM

How to ship changes to **https://roadsafety.prismappolice.in** without losing database or uploaded files.

| Environment | Role |
|-------------|------|
| **Local IDE** (Windows/Mac) | Edit code, test, commit, push to GitHub |
| **AWS VM** (`/opt/road-accident-hub`) | Pull code, rebuild Docker, reload nginx — **production only** |

**Repository:** https://github.com/dineshprism/AP_Road.git  
**Production app path:** `/opt/road-accident-hub/app`  
**Production secrets:** `/opt/road-accident-hub/.env` (never commit this file)

---

## Golden rules

| Do | Don’t |
|----|--------|
| Push changes from your PC to `main` on GitHub | `git commit` on the AWS server |
| On server: `git reset --hard origin/main` | `git pull` if the server has local commits (e.g. `okk`) |
| `docker compose build` + `up -d --force-recreate app` | `docker compose down -v` (deletes DB volume) |
| Edit `.env` only on the VM when secrets/URLs change | Put `.env` in GitHub |
| **Weekly:** Prism → Download full backup (see `docs/BACKUP-RESTORE.md`) | Rely only on server disk without off-site backup files |
| Backup DB before risky changes | `npm run data:import:aws --replace` on production unless you intend to wipe data |

---

# Part 1 — Local IDE (your computer)

## 1.1 Prerequisites

- Node.js 20+
- Git
- Clone: `git clone https://github.com/dineshprism/AP_Road.git`
- Local env: copy `.env.example` → `.env` / `server/.env` for dev (not production secrets)

## 1.2 Develop and test locally

```bash
# From repo root
npm install
cd server && npm install && cd ..

# Terminal 1 — API (port 3000)
cd server
npm run dev

# Terminal 2 — Frontend (port 8081)
npm run dev
```

Open: http://localhost:8081

Optional: Docker locally

```bash
docker compose up -d --build
```

## 1.3 Before you push

- [ ] No secrets in committed files (`.env`, API keys, passwords)
- [ ] Changes tested locally (login, submit, upload signed copy, maps, analytics if touched)
- [ ] `npm audit` clean (optional): `npm audit` and `cd server && npm audit`

## 1.4 Push to GitHub

```bash
git status
git add <files>          # or git add -A if you mean everything
git commit -m "Describe what changed and why"
git push origin main
```

Confirm on GitHub: `main` shows your latest commit.

**You are done on the local side** until the next feature. Production is updated on the VM (Part 2).

---

# Part 2 — AWS VM (production server)

SSH as `ubuntu` (or `appuser`) to the instance (e.g. `13.53.171.144`).

## 2.1 One-time layout (already done if you deployed before)

| Path | Purpose |
|------|---------|
| `/opt/road-accident-hub/app` | Git clone of AP_Road |
| `/opt/road-accident-hub/.env` | Production secrets (DB, JWT, API keys, CORS) |
| `/etc/nginx/sites-available/roadsafety` | HTTPS reverse proxy → `127.0.0.1:3000` |

Symlinks (run from app dir when needed):

```bash
cd /opt/road-accident-hub/app
ln -sf /opt/road-accident-hub/.env .env
ln -sf /opt/road-accident-hub/.env .env.docker
```

---

## 2.2 Routine code update (most common)

Use this after every `git push origin main` from your IDE.

```bash
cd /opt/road-accident-hub/app

# 1) Get exact GitHub main (avoids server-only commits)
git fetch origin main
git reset --hard origin/main
git log -1 --oneline

# 2) Symlink env
ln -sf /opt/road-accident-hub/.env .env
ln -sf /opt/road-accident-hub/.env .env.docker

# 3) Rebuild and restart app only (DB + uploads volumes kept)
unset CORS_ORIGIN
env -u CORS_ORIGIN docker compose --env-file /opt/road-accident-hub/.env build --no-cache app
env -u CORS_ORIGIN docker compose --env-file /opt/road-accident-hub/.env up -d --force-recreate app

# 4) Check
docker compose ps
curl -s http://127.0.0.1:3000/api/health
docker compose logs app --tail 30
```

**Browser:** https://roadsafety.prismappolice.in — hard refresh `Ctrl+Shift+R`.

### Verify new frontend is live

```bash
docker compose exec app sh -c 'grep -o "index-[^\"]*\\.js" /app/dist/index.html | head -1'
```

Hash should change after each frontend deploy (not stuck on an old bundle like `index-BCnSdYc7.js`).

---

## 2.3 Update `.env` only (no code change)

When you change API keys, CORS, Gemini model, upload limits, etc.:

```bash
sudo nano /opt/road-accident-hub/.env
```

Example production values:

```env
CORS_ORIGIN=http://13.53.171.144,http://13.53.171.144:3000,http://roadsafety.prismappolice.in,https://roadsafety.prismappolice.in
GOOGLE_MAPS_API_KEY=your-browser-key
GOOGLE_MAPS_BROWSER_KEY=your-browser-key
GEMINI_API_KEY=your-gemini-key
DB_PASSWORD=...
JWT_SECRET=...
MAX_UPLOAD_MB=25
RAG_RATE_LIMIT_MAX=30
GLOBAL_RATE_LIMIT_MAX=400
```

Recreate app container (no rebuild required unless code also changed):

```bash
cd /opt/road-accident-hub/app
ln -sf /opt/road-accident-hub/.env .env
ln -sf /opt/road-accident-hub/.env .env.docker
unset CORS_ORIGIN
env -u CORS_ORIGIN docker compose --env-file /opt/road-accident-hub/.env up -d --force-recreate app
docker compose exec app printenv CORS_ORIGIN
docker compose exec app printenv MAX_UPLOAD_MB
```

**Never** export `CORS_ORIGIN` in your shell before `docker compose` — it can override `.env`.

---

## 2.4 Update nginx only

When upload size or TLS/proxy settings change:

```bash
sudo nano /etc/nginx/sites-available/roadsafety
```

HTTPS `server` block must include:

```nginx
client_max_body_size 25M;
```

Hide version (optional), in `/etc/nginx/nginx.conf` inside `http { }`:

```nginx
server_tokens off;
```

Apply:

```bash
sudo nginx -t
sudo systemctl reload nginx
grep client_max_body_size /etc/nginx/sites-available/roadsafety
```

No Docker rebuild needed for nginx-only changes.

---

## 2.5 Full update (code + `.env` + nginx)

Order:

1. Edit `/opt/road-accident-hub/.env` (if needed)  
2. Edit nginx (if needed) → `sudo nginx -t && sudo systemctl reload nginx`  
3. Run **§ 2.2** (git reset + docker build + recreate)

---

## 2.6 Production data backup (weekly / daily)

**Routine (no SSH):** Log in as **Prism** on https://roadsafety.prismappolice.in → **Download full backup** → save the JSON to your PC or cloud storage. Do this **at least weekly**; **daily** during busy submission periods.

Details and restore steps: **`docs/BACKUP-RESTORE.md`**

## 2.7 Optional: DB backup before big releases

```bash
cd /opt/road-accident-hub/app
docker compose exec -T db pg_dump -U postgres road_accident_db > ~/backup-$(date +%Y%m%d-%H%M).sql
ls -lh ~/backup-*.sql
```

---

## 2.8 Post-deploy checklist

| Check | Command / action |
|-------|------------------|
| Containers up | `docker compose ps` → `app` and `db` healthy |
| API health | `curl -s http://127.0.0.1:3000/api/health` → `{"status":"ok",...}` |
| Public HTTPS | Open https://roadsafety.prismappolice.in/ (no 500) |
| Login | District + DGP test accounts |
| Upload signed copy | File &lt; 25 MB succeeds; &gt; 25 MB rejected |
| Analytics buttons | DGP `/admin` → Analytics / analytics_new |
| Maps | Logged-in district/DGP; Google key referrer locked in GCP |

---

# Part 3 — What runs where

```
┌─────────────────────┐         git push          ┌──────────────────┐
│  Local IDE          │ ──────────────────────────► │  GitHub main     │
│  edit · test · push │                             │  dineshprism/    │
└─────────────────────┘                             │  AP_Road         │
                                                    └────────┬─────────┘
                                                             │ git fetch + reset
                                                             ▼
┌─────────────────────┐     HTTPS :443      ┌──────────────────────────┐
│  Browser (users)    │ ◄────────────────── │  AWS VM                  │
└─────────────────────┘                     │  nginx → 127.0.0.1:3000  │
                                            │  Docker: app + postgres  │
                                            │  volumes: pgdata, uploads│
                                            └──────────────────────────┘
```

---

# Part 4 — Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| UI unchanged after deploy | Old git on server or cached bundle | `git reset --hard origin/main`, rebuild `--no-cache`, hard refresh |
| `Internal Server Error` on `/` | CORS / old image | Deploy latest `main`; check `docker compose logs app` |
| Upload `413` | nginx `client_max_body_size` too low | Set `25M` on **443** server block, reload nginx |
| `git pull` doesn’t update | Server local commit | `git reset --hard origin/main` |
| Maps blank | Key / referrer / role | GCP referrer `https://roadsafety.prismappolice.in/*`; check `/api/maps/config` when logged in |
| Wrong CORS | Shell `CORS_ORIGIN` or bad `.env` | `unset CORS_ORIGIN`; use `--env-file /opt/road-accident-hub/.env` |

More: `docs/SECURITY-OPERATIONS.md`, `docs/SECURITY-PENTEST-ROADSAFETY-2026-05-29.md`, `deploy/nginx-roadsafety.conf.example`

---

# Part 5 — Quick reference cards

### Local IDE (each release)

```
edit → test locally → git commit → git push origin main
```

### AWS VM (each release)

```
cd /opt/road-accident-hub/app
git fetch && git reset --hard origin/main
env -u CORS_ORIGIN docker compose --env-file /opt/road-accident-hub/.env build --no-cache app
env -u CORS_ORIGIN docker compose --env-file /opt/road-accident-hub/.env up -d --force-recreate app
curl -s http://127.0.0.1:3000/api/health
```

### AWS VM (.env only)

```
sudo nano /opt/road-accident-hub/.env
env -u CORS_ORIGIN docker compose --env-file /opt/road-accident-hub/.env up -d --force-recreate app
```

### AWS VM (nginx only)

```
sudo nano /etc/nginx/sites-available/roadsafety   # client_max_body_size 25M;
sudo nginx -t && sudo systemctl reload nginx
```

---

*Last updated: 2026-05-29 — matches Docker Compose production setup on eu-north-1 EC2.*
