# Repository layout

## Active application (production)

```
├── frontend/
│   ├── src/             # React frontend (pages, components, hooks)
│   ├── public/          # Static assets served by Vite
│   ├── memo_road_safety.pdf # G.O. memo linked from login page
│   ├── package.json     # Frontend dependencies & scripts
│   ├── vite.config.ts, tailwind.config.ts, tsconfig*.json, eslint.config.js
│   └── playwright.config.ts, vitest.config.ts
├── backend/
│   ├── src/             # Express API, auth, routes, migrations
│   │   └── db/          # Data-access repository layer (one module per domain)
│   ├── templates/       # Static templates used at runtime (e.g. DSR workbook)
│   ├── tools/           # Data migration, seeds, CCTNS sync
│   ├── uploads/         # Signed copies (gitignored, runtime)
│   └── package.json     # Backend dependencies & scripts
├── deploy/              # GCP / VM deployment scripts
├── docs/                # Current documentation
├── db/                  # Reference CSV/SQL — see db/README.md
├── docker-compose.yml
├── Dockerfile
├── README.md
└── REPO_LAYOUT.md       # This file
```

## Configuration

- `.env.example` (root, Docker/production), `backend/.env.example` — environment templates
- `frontend/vite.config.ts`, `frontend/tailwind.config.ts`, `frontend/tsconfig*.json`, `frontend/eslint.config.js`
- `frontend/playwright.config.ts`, `frontend/vitest.config.ts`
- `backend/tsconfig.json`

## Archive (non-production)

```
_archive/
├── docs/          # Old root *.md guides
├── dev-tests/     # HTML/JS experiments
├── logs/          # *.log from local dev
├── reports/       # audit / semgrep output
├── data-exports/  # Extra spreadsheets & JSON drafts
├── misc/          # Scratch folders & one-off SQL
├── server-dev/    # Deprecated server helpers
├── server/        # legacy-routes (old RAG experiments)
└── assets/        # Unused duplicate images
```

## Local-only (gitignored)

- `frontend/node_modules/`, `frontend/dist/`
- `backend/node_modules/`, `backend/dist/`
- `.env`, `backend/.env`, `road-accident-data.json`
- `backend/uploads/`, `*.xlsx`, `*.log`
