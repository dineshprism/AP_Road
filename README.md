# Road Accident Data Hub

A full-stack web application for recording, managing, and analysing fatal road accident investigation reports across all 25 districts of **Andhra Pradesh**. Built for the Police, Transport, Roads & Buildings Department under **G.O.Ms.No.42 (Section 135, MV Act 1988)**.

---

## Table of Contents:

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Frontend](#frontend)
- [Backend](#backend)
- [Database](#database)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Production website updates](docs/WEBSITE-UPDATE.md) (local IDE + AWS VM)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      Client (Browser)                    │
│         React 18 + TypeScript + Tailwind CSS             │
│         Vite dev server :8081 (proxies /api → :3000)     │
└──────────────────┬───────────────────────────────────────┘
                   │  HTTP / JSON (Bearer JWT)
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    Express API Server                    │
│           Node 20 + TypeScript (port 3000)               │
│  ┌────────────┐ ┌─────────────┐ ┌──────────────────┐    │
│  │ /api/auth  │ │ /api/       │ │ /api/admin       │    │
│  │ signup     │ │ submissions │ │ submissions      │    │
│  │ login      │ │ CRUD        │ │ (filtered query) │    │
│  │ me         │ │             │ │                  │    │
│  └────────────┘ └─────────────┘ └──────────────────┘    │
│         Helmet · CORS · Rate Limiting · JWT Auth         │
└──────────────────┬───────────────────────────────────────┘
                   │  pg (node-postgres)
                   ▼
┌──────────────────────────────────────────────────────────┐
│               PostgreSQL 16 (Alpine)                     │
│  users · profiles · user_roles · accident_submissions    │
│  Triggers · Indexes · pgcrypto UUID                      │
└──────────────────────────────────────────────────────────┘
```

In **production**, the Express server also serves the pre-built React SPA from the `dist/` directory, so only a single port (3000) is exposed.

---

## Tech Stack

| Layer        | Technology                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), React Router v6, TanStack React Query |
| **Backend**  | Node.js 20, Express 4, TypeScript, JWT (jsonwebtoken), bcrypt, Helmet, express-rate-limit           |
| **Database** | PostgreSQL 16                                                                                       |
| **Tooling**  | Vitest, Playwright, ESLint, Docker, Docker Compose                                                  |

---

## Frontend

The frontend is a single-page React application built with Vite and TypeScript.

### Pages

| Route              | Component          | Description                                      |
| ------------------ | ------------------ | ------------------------------------------------ |
| `/`                | `Index`            | Landing / home page                              |
| `/auth`            | `AuthPage`         | Login and signup forms                           |
| `/dashboard`       | `UserDashboard`    | User's own submissions list                      |
| `/admin`           | `AdminDashboard`   | Admin view with filters by district, date, year  |
| `/submit`          | `AccidentForm`     | Multi-section accident report form               |
| `/submission/:id`  | `SubmissionView`   | Detailed view of a single submission             |

### Key Libraries

- **shadcn/ui** — Pre-built accessible UI components (Accordion, Dialog, Form, Select, etc.)
- **React Hook Form + Zod** — Form handling with schema validation
- **TanStack React Query** — Server state management and caching
- **Recharts** — Dashboard charts and analytics
- **jsPDF + jspdf-autotable** — PDF export of investigation reports
- **docx + file-saver** — DOCX export of investigation reports
- **Lucide React** — Icon set

### Development

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev          # Starts Vite dev server on http://localhost:8081
```

The Vite dev server proxies all `/api` requests to `http://localhost:3000`.

---

## Backend

The backend is a RESTful Express API located in the `backend/` directory.

### Core Modules

| File                      | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `backend/src/index.ts`    | Express app setup, middleware, route mounting      |
| `backend/src/auth.ts`     | JWT generation, verification, auth middleware      |
| `backend/src/db.ts`       | PostgreSQL connection pool (`pg`)                  |
| `backend/src/db/*.repo.ts`| Data-access layer, one repository module per domain |
| `backend/src/migrate.ts`  | Database migration script (creates all tables)     |

### Middleware

- **Helmet** — Security headers
- **CORS** — Configurable origin
- **express-rate-limit** — Request rate limiting
- **JSON body parser** — 2 MB limit
- **JWT auth middleware** — Protects `/api/submissions` and `/api/admin` routes

### Authentication Flow

1. User signs up via `POST /api/auth/signup` — password hashed with bcrypt (12 rounds), JWT returned
2. User logs in via `POST /api/auth/login` — credentials verified, JWT returned (7-day expiry)
3. Protected routes extract user from `Authorization: Bearer <token>` header
4. Admin routes additionally check the `user_roles` table for the `admin` role

### Running the Server

```bash
cd backend
npm install
npm run dev          # tsx watch — hot-reload on http://localhost:3000
```

---

## Database

PostgreSQL 16 with the `pgcrypto` extension for UUID generation.

### Schema

```
┌──────────────┐       ┌──────────────────┐       ┌───────────────────────────┐
│    users     │       │   user_roles     │       │       profiles            │
│──────────────│       │──────────────────│       │───────────────────────────│
│ id (PK)      │◄──┐   │ id (PK)          │       │ id (PK)                   │
│ email        │   ├──│ user_id (FK)     │       │ user_id (FK, UNIQUE)      │
│ password_hash│   │   │ role (enum)      │       │ full_name                 │
│ created_at   │   │   └──────────────────┘       │ district                  │
└──────────────┘   │                               │ designation               │
                   │   ┌───────────────────────┐   │ created_at                │
                   └──│ accident_submissions   │   └───────────────────────────┘
                       │───────────────────────│
                       │ id (PK)               │
                       │ user_id (FK)          │
                       │ district              │
                       │ place_of_accident     │
                       │ mandal                │
                       │ police_station        │
                       │ fir_number            │
                       │ road_type             │
                       │ accident_date         │
                       │ accident_time         │
                       │ lat_long              │
                       │ persons_died          │
                       │ persons_injured       │
                       │ vehicles (JSONB)      │
                       │ drivers (JSONB)       │
                       │ driver_related_causes │
                       │   (JSONB)             │
                       │ vehicle_condition_    │
                       │   causes (JSONB)      │
                       │ road_engineering_*    │
                       │   (5× JSONB columns)  │
                       │ prepared_by_*         │
                       │ verified_by_*         │
                       │ approved_by_*         │
                       │ created_at            │
                       │ updated_at            │
                       └───────────────────────┘
```

### Enums

- `app_role` — `'admin'` | `'user'`

### Triggers

- **`update_accident_submissions_updated_at`** — Automatically sets `updated_at` to `now()` on every update

### Indexes

- `idx_submissions_district` — On `accident_submissions(district)`
- `idx_submissions_date` — On `accident_submissions(accident_date)`
- `idx_submissions_user` — On `accident_submissions(user_id)`
- `idx_user_roles_user` — On `user_roles(user_id)`
- `idx_profiles_user` — On `profiles(user_id)`

### Running Migrations

```bash
cd backend
npm run migrate      # Creates tables, indexes, triggers
```

Seed data is available in `backend/tools/seeds/`.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **PostgreSQL** >= 16 (or use Docker)
- **npm** (included with Node.js)

### Local Development

```bash
# 1. Clone the repository
git clone <repo-url>
cd road-accident-data-hub-main

# 2. Install frontend dependencies
cd frontend
npm install --legacy-peer-deps
cd ..

# 3. Install backend dependencies
cd backend
npm install
cd ..

# 4. Set up PostgreSQL and configure environment variables
#    (see Environment Variables section below)

# 5. Run database migrations
cd backend
npm run migrate
cd ..

# 6. Start backend (terminal 1)
cd backend
npm run dev

# 7. Start frontend (terminal 2)
cd frontend
npm run dev

# Frontend: http://localhost:8081
# Backend:  http://localhost:3000
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/road_accident_db
JWT_SECRET=<random-64-character-secret>
PORT=3000
CORS_ORIGIN=http://localhost:8081
NODE_ENV=development
```

The frontend calls `/api` directly. In Docker/production, set `GOOGLE_MAPS_API_KEY` for the backend; do not use `VITE_GOOGLE_MAPS_API_KEY`.

---

## Docker Deployment

The project includes a multi-stage Dockerfile and a Docker Compose configuration for one-command deployment.

```bash
# Build and start all services (app + PostgreSQL)
docker compose up -d --build

# The application is available at http://localhost:3000
```

### Docker Compose Services

| Service | Image              | Description                              |
| ------- | ------------------ | ---------------------------------------- |
| `db`    | postgres:16-alpine | PostgreSQL database with health checks   |
| `app`   | Custom (multi-stage) | Frontend + backend in a single container |

### Multi-Stage Build

1. **Stage 1 (frontend-build)** — Installs npm deps, builds the React app with Vite
2. **Stage 2 (backend-build)** — Installs backend deps, compiles TypeScript
3. **Stage 3 (production)** — Copies built assets, runs `node dist/index.js`

---

## API Reference

All endpoints return JSON. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint          | Auth | Description               |
| ------ | ----------------- | ---- | ------------------------- |
| POST   | `/api/auth/signup` | No   | Register a new user       |
| POST   | `/api/auth/login`  | No   | Login, returns JWT        |
| GET    | `/api/auth/me`     | Yes  | Get current user profile  |

### Submissions

| Method | Endpoint                | Auth | Description                        |
| ------ | ----------------------- | ---- | ---------------------------------- |
| POST   | `/api/submissions`       | Yes  | Create a new accident submission   |
| GET    | `/api/submissions`       | Yes  | List current user's submissions    |
| GET    | `/api/submissions/:id`   | Yes  | Get a single submission by ID      |

### Admin

| Method | Endpoint                  | Auth  | Description                                  |
| ------ | ------------------------- | ----- | -------------------------------------------- |
| GET    | `/api/admin/submissions`   | Admin | List all submissions with optional filters   |

Query parameters for admin: `district`, `year`, `month`, `date`.

### Health

| Method | Endpoint       | Auth | Description     |
| ------ | -------------- | ---- | --------------- |
| GET    | `/api/health`  | No   | Health check    |

---

## Project Structure

See **[REPO_LAYOUT.md](REPO_LAYOUT.md)** for the full layout. Summary:

```
road-accident-data-hub-main/
├── frontend/
│   ├── src/                    # React frontend (pages, components, hooks)
│   ├── public/                 # Static assets
│   ├── memo_road_safety.pdf    # G.O. memo (login download)
│   └── package.json
├── backend/
│   ├── src/                    # Express API, auth, migrations, routes
│   │   └── db/                 # Data-access repository layer
│   ├── templates/              # Static templates used at runtime (e.g. DSR workbook)
│   ├── tools/                  # Seeds, AWS import, CCTNS sync
│   └── package.json
├── docs/                       # Active documentation
├── db/                         # Reference CSV/SQL (CCTNS masterdata, schema)
├── deploy/                     # Deployment scripts
├── _archive/                   # Legacy docs, dev tests, old experiments (not used in prod)
├── docker-compose.yml
└── Dockerfile
```

---

## Scripts

### Frontend (`frontend/package.json`)

| Script         | Command              | Description                    |
| -------------- | -------------------- | ------------------------------ |
| `dev`          | `vite`               | Start dev server (port 8081)   |
| `build`        | `vite build`         | Production build               |
| `preview`      | `vite preview`       | Preview production build       |
| `test`         | `vitest run`         | Run unit tests                 |
| `test:watch`   | `vitest`             | Run tests in watch mode        |
| `lint`         | `eslint .`           | Lint source files              |

### Backend (`backend/package.json`)

| Script    | Command             | Description                         |
| --------- | ------------------- | ----------------------------------- |
| `dev`     | `tsx watch src/index.ts` | Start server with hot reload   |
| `build`   | `tsc`               | Compile TypeScript                  |
| `start`   | `node dist/index.js`| Run compiled server                 |
| `migrate` | `tsx src/migrate.ts` | Run database migrations            |
