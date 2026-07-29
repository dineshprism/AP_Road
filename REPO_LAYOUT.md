# Repository layout

## Active application (production)

```
├── src/                 # React frontend (pages, components, hooks)
├── server/
│   ├── src/             # Express API, auth, routes, migrations
│   ├── templates/       # Static templates used at runtime (e.g. DSR workbook)
│   ├── tools/           # Data migration, seeds, CCTNS sync
│   └── uploads/         # Signed copies (gitignored, runtime)
├── public/              # Static assets served by Vite
├── deploy/              # GCP / VM deployment scripts
├── docs/                # Current documentation
├── data/                # Reference CSV/SQL — see data/README.md
├── package.json         # Frontend dependencies & scripts
├── docker-compose.yml
├── Dockerfile
├── README.md
├── REPO_LAYOUT.md       # This file
└── memo_road_safety.pdf # G.O. memo linked from login page
```

## Configuration (root)

- `.env.example`, `server/.env.example` — environment templates
- `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `eslint.config.js`
- `playwright.config.ts`, `vitest.config.ts`

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

- `node_modules/`, `dist/`, `server/dist/`
- `.env`, `server/.env`, `road-accident-data.json`
- `server/uploads/`, `*.xlsx`, `*.log`
