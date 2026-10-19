# CyBreach Arena - Module 4 (Audit & Handoff)

## Table of Contents
- [1. Project Overview](#1-project-overview)
- [2. The Pods: What Each One Does](#2-the-pods-what-each-one-does)
- [3. Architecture & Ports](#3-architecture--ports)
- [4. Prerequisites](#4-prerequisites)
- [5. Installation - Step by Step](#5-installation---step-by-step)
- [6. Running the Whole Project](#6-running-the-whole-project)
- [7. Running Tests](#7-running-tests)
- [8. Expected Errors & How to Resolve Them](#8-expected-errors--how-to-resolve-them)
- [9. Scope of Work: What Is Done](#9-scope-of-work-what-is-done)
- [10. What Is Still Left to Integrate & Implement](#10-what-is-still-left-to-integrate--implement)
- [11. Files Excluded From This Repository](#11-files-excluded-from-this-repository)
- [12. Security Note](#12-security-note)

## 1. Project Overview
CyBreach Arena is a multi-service cybersecurity training and simulation platform. This repository contains the integrated Module 4 codebase, consisting of four primary "Pods" (services), a Wallet/Pod Alpha service, and a centralized React/Vite frontend dashboard.

It supports a local manager demo with a simulated account, wallet, checkout/receipt, scan findings, notifications, and analytics. Pod Delta acts as the authenticated API gateway and proxies supported campaign, leaderboard, benchmark, and wallet requests to the configured backend pods.

IMPORTANT: Demo authentication, checkout, scans, and benchmarks are simulated. They do not charge real money, contact real targets, or process real Wallet transactions. Review "Current behavior and limitations" before presenting this as a live security or payment product.

## 2. The Pods: What Each One Does

### Pod Delta - API Gateway & Hub (`services/pod_delta/`)
Role: Browser-facing FastAPI service and authenticated API gateway.
- Authenticated API gateway for notifications, preferences, analytics, integration health, WebSocket events, and the Arena gateway.
- Proxies selected requests to Pod Beta (campaigns/engagements), Pod Gamma (leaderboards/benchmarks), and Wallet without exposing upstream URLs or credentials to the browser.
- Local development-only manager sign-in and tenant-scoped in-memory demo state.
- Demo wallet balance, top-ups, printable receipt downloads, reports, notifications, analytics, and scan findings (all simulated/in-memory).
- Integrates Redis (caching), Redpanda/Kafka (event streaming), PostgreSQL, and ClickHouse (analytics) via Docker Compose.
- Optional local lab (OWASP Juice Shop, loopback-only) and optional Stripe test checkout.
Default port: **8000**.

### Pod Beta - Campaign Catalog & Engagement APIs (`services/pod_beta/`)
Role: Core business logic for security assessments. Two FastAPI apps:
- Campaign catalog (`app.campaign.api:app`): campaign browsing/creation, hash verification, scheduling, staged boss-fight endpoints.
- Engagement manager (`app.engagement.api:app`): engagement creation, lifecycle transitions, recommendations, reports.
- Engagement records persisted in SQLAlchemy database (SQLite by default, configurable `DATABASE_URL`).
- Kafka/Redpanda delivery of engagement lifecycle events when `KAFKA_ENABLE=true`.
- Arena local-lab workflow collects HTTP response headers from the loopback Juice Shop target and submits them through Pod Beta's engagement lifecycle.
- Source-only service: no Docker Compose; runs in a Python virtual environment.
Default ports: **8001** (campaigns) and **8002** (engagements).
### Pod Gamma - Leaderboards & Benchmarks (`services/pod_gamma/`)
Role: Competitive and comparative tenant/player data analysis backed by Redis and PostgreSQL.
- Redis-stored absolute global, industry, region, and size leaderboards and improvement rankings.
- Tenant opt-in/opt-out consent lifecycle for leaderboard participation; tenant score updates require opt-in and matching metadata.
- Cohort benchmark, comparison, and trend endpoints read persisted aggregates from PostgreSQL.
- Streaks, badges, and additional Arena analytics routes.
Benchmark data is synthetic/seeded (not real peer data); differential privacy is not applied.
Default port: **8003**.

### Pod Alpha / Wallet Service - Billing & Ledger (`services/wallet_service/`)
Role: Financial ledger for the platform (separate FastAPI/PostgreSQL backend).
- Ledger management tracking `CRD` (Arena Credits).
- Authenticated wallet transactions (deposit/withdrawal/balance/history/export).
- Subscriptions, reconciliation, currency conversion, and budget alerts.
- Kafka/Redpanda integration for wallet event reconciliation.
- The local Arena demo checkout does NOT write real transactions to Pod Alpha; it uses Delta's in-memory simulated wallet.
Default port: **8004**.

### Frontend - React/Vite Dashboard (`services/pod_delta/frontend/`)
Role: Browser dashboard for campaigns, leaderboard, benchmark, demo wallet, scan findings, and service status.
- Communicates only with Pod Delta (gateway), not directly with upstream pods.
- Built with Vite; served on port **5173**.

## 3. Architecture & Ports

| Service | Location | Port | Purpose |
|---|---|---|---|
| Frontend | `services/pod_delta/frontend/` | 5173 | React/Vite dashboard |
| Pod Delta | `services/pod_delta/` | 8000 | API gateway + demo state |
| Pod Beta campaigns | `services/pod_beta/` | 8001 | Campaign catalog |
| Pod Beta engagements | `services/pod_beta/` | 8002 | Engagement manager |
| Pod Gamma | `services/pod_gamma/` | 8003 | Leaderboards & benchmarks |
| Wallet / Pod Alpha | `services/wallet_service/` | 8004 | Wallet ledger |
| Shared Redis | - | 6379 | Caching |
| Gamma PostgreSQL | - | 5432 | Gamma relational store |
| Wallet PostgreSQL | - | 5434 | Wallet database |
| Redpanda / Kafka | - | 19092 | Event streaming |
| ClickHouse | - | 8123 | Delta analytics |
| Wallet test PostgreSQL | - | 55432 | Test database |
| Optional Juice Shop (lab) | - | 3000 | Local lab target |

All services bind to loopback (`127.0.0.1`). The frontend talks only to Pod Delta; Delta proxies to upstream pods. When running several stacks at once, configure non-conflicting ports and make Delta's upstream URLs match them.

## 4. Prerequisites
- Git
- Python 3.12 recommended
- Node.js compatible with Vite 8 and npm
- Docker Desktop/Engine with Docker Compose
- PowerShell (recommended on Windows)

Verify in PowerShell:
```powershell
git --version
python --version
node --version
npm --version
docker --version
docker compose version
```

## 5. Installation - Step by Step

### Step A: Extract / clone the repository
Keep the folder structure intact. This ZIP/folder contains source and configuration templates, not virtual environments, `node_modules`, or Docker images. Initial setup needs internet so pip, npm, and Docker can download dependencies and images.
```powershell
Set-Location C:\path\to\cybreach-module4-arena
```

### Step B: Start backing infrastructure (Docker)
Open a terminal and run:
```powershell
# Pod Delta infrastructure (Redis, Redpanda, PostgreSQL, ClickHouse)
Set-Location services\pod_delta
docker compose up -d redis redpanda redpanda-init postgres clickhouse

# Pod Gamma PostgreSQL
Set-Location ..\pod_gamma
docker compose up -d postgres

# Wallet database (manual container on port 5434)
docker run --name arena-wallet-db -e POSTGRES_USER=wallet_user -e POSTGRES_PASSWORD=wallet_password -e POSTGRES_DB=wallet_db -p 127.0.0.1:5434:5432 -d postgres:16
```

### Step C: Create local configuration
Copy the `.env.example` template to `.env` for each service and review the values:
```powershell
Copy-Item services\pod_delta\.env.example services\pod_delta\.env
Copy-Item services\pod_gamma\.env.example services\pod_gamma\.env
Copy-Item services\wallet_service\.env.example services\wallet_service\.env
Copy-Item services\pod_beta\.env.example services\pod_beta\.env
```
Set Delta's upstream URLs to the default ports above (Beta 8001/8002, Gamma 8003, Wallet 8004) and `KAFKA_BOOTSTRAP_SERVERS=localhost:19092`. For the manager demo set `DEV_DEMO_AUTH_ENABLED=true` and `ENVIRONMENT=development` in Delta's `.env`.

### Step D: Install Python dependencies (one virtual env per service)
```powershell
# Root shared env (used by the test runner)
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r services\pod_gamma\requirements.txt -r services\pod_delta\requirements.txt psycopg2-binary

# Pod Delta
py -3.12 -m venv services\pod_delta\.venv
services\pod_delta\.venv\Scripts\python.exe -m pip install --upgrade pip
services\pod_delta\.venv\Scripts\python.exe -m pip install -r services\pod_delta\requirements.txt psycopg2-binary

# Pod Beta (source-only; install FastAPI/Uvicorn/SQLAlchemy/Pydantic if no requirements.txt)
Set-Location services\pod_beta
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt   # only if a requirements.txt is present

# Wallet / Pod Alpha
Set-Location ..\wallet_service
py -3.12 -m venv .venv312
.venv312\Scripts\python.exe -m pip install --upgrade pip
.venv312\Scripts\python.exe -m pip install -r requirements.txt
Set-Location ..\..

# Frontend packages
Set-Location services\pod_delta\frontend
npm install
Set-Location ..\..\..
```

## 6. Running the Whole Project

Start each service in a SEPARATE PowerShell terminal, in this order. Infrastructure (Docker) from Step B must already be running.

### Terminal 1: Pod Delta (port 8000)
```powershell
Set-Location services\pod_delta
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2: Pod Beta - Campaigns (port 8001)
```powershell
Set-Location services\pod_beta
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\uvicorn.exe app.campaign.api:app --reload --host 127.0.0.1 --port 8001
```

### Terminal 3: Pod Beta - Engagements (port 8002)
```powershell
Set-Location services\pod_beta
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\uvicorn.exe app.engagement.api:app --reload --host 127.0.0.1 --port 8002
```

### Terminal 4: Pod Gamma (port 8003)
```powershell
Set-Location services\pod_gamma
$env:APP_PORT="8003"
$env:REDIS_HOST="127.0.0.1"
$env:REDIS_PORT="6379"
$env:REDIS_PASSWORD=""
$env:DATABASE_URL="postgresql+asyncpg://leaderboard_user:GammaLocalOnly2026@127.0.0.1:5432/leaderboard"
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003
```

### Terminal 5: Wallet / Pod Alpha (port 8004)
```powershell
Set-Location services\wallet_service
.venv312\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8004
```

### Terminal 6: Frontend (port 5173)
```powershell
Set-Location services\pod_delta\frontend
npm run dev
```
Open <http://localhost:5173>. API is at <http://127.0.0.1:8000>; interactive docs at <http://127.0.0.1:8000/api/docs>.

**Default manager demo login** (development-only, not for production): `manager@cybreach.demo` / `ArenaDemo2026!`. Requires `ENVIRONMENT=development`, `DEV_DEMO_AUTH_ENABLED=true`, and a loopback client.

### Verify everything is running
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/integration/health
Invoke-RestMethod http://127.0.0.1:8003/health
Invoke-RestMethod http://127.0.0.1:8004/
```
Delta public status should report healthy for Delta, both Beta APIs, Gamma, and Wallet. Gamma health should show Redis and PostgreSQL connected.

## 7. Running Tests

The repository test runner covers root/Pod Beta, Pod Gamma, Pod Delta, and Wallet service tests:
```powershell
.\run-all-tests.ps1
```

Individual suites (debug from each service directory):
```powershell
# Pod Gamma
Set-Location services\pod_gamma
..\..\.venv\Scripts\python.exe -m pytest tests -q

# Pod Delta
Set-Location services\pod_delta
.\.venv\Scripts\python.exe -m pytest -q

# Wallet service (needs wallet-pytest-db container on port 55432)
docker run --name wallet-pytest-db -e POSTGRES_USER=wallet_user -e POSTGRES_PASSWORD=wallet_password -e POSTGRES_DB=wallet_db -p 127.0.0.1:55432:5432 -d postgres:16
```

Frontend checks (there is no frontend test script):
```powershell
Set-Location services\pod_delta\frontend
npm run lint
npm run build
```

## 8. Expected Errors & How to Resolve Them

| Error | Likely cause | Resolution |
|---|---|---|
| `ConnectionRefusedError` | An upstream pod (Beta/Gamma/Wallet) is not running | Start the missing pod on its assigned port (8001-8004) |
| `JWT Signature Verification Failed` | Delta's `SECRET_KEY` does not match `BETA_JWT_SECRET` or `WALLET_SERVICE_JWT_SECRET` | Copy the same secret into every pod's `.env` file and restart |
| `Port already in use` | A previous process or Docker container holds the port | `Stop-Process -Id (Get-NetTCPConnection -LocalPort <PORT>).OwningProcess` |
| `Redpanda Connection Timeout` | `redpanda-init` container did not finish creating topics | Restart Delta's `docker compose` stack |
| `401 Unauthorized` in Demo | `DEV_DEMO_AUTH_ENABLED` is `false` | Set `DEV_DEMO_AUTH_ENABLED=true` in `services/pod_delta/.env` |
| `ModuleNotFoundError` | Dependencies not installed or wrong virtual env active | Activate the correct service venv and run `pip install -r requirements.txt` |
| `npm ERR!` | Node version incompatible with Vite 8 or missing `node_modules` | Install Node.js LTS, then run `npm install` in the frontend folder |
| `docker: command not found` | Docker Desktop not running or not installed | Start Docker Desktop and verify `docker info` |
| Database connection refused | PostgreSQL container not started or wrong port | Start the compose stack; verify ports 5432 (Gamma) and 5434 (Wallet) |
| `404` / gateway proxy errors | Delta's upstream URLs don't match the running pod ports | Update `POD_BETA_*_URL`, `POD_GAMMA_URL`, `WALLET_SERVICE_URL` in Delta's `.env` and restart Delta |

## 9. Scope of Work: What Is Done ✅
- Inter-Pod connectivity: Delta successfully proxies to Beta, Gamma, and Wallet.
- Unified auth: shared JWT secret mechanism lets Delta authorize requests across all pods.
- Campaign execution flow: local Juice Shop lab integration works end-to-end (Scan -> Beta Engagement -> Report).
- Event streaming: Redpanda integration for publishing engagement events.
- Simulated demo mode: robust "Sample Preview" mode for managers without complex production setup.
- Reporting: Beta generates reports from local lab header checks.
- All configured Python pod suites have passed together; frontend lint/build and local service health checked.

## 10. What Is Still Left to Integrate & Implement ⏳
- Production Identity Provider: currently local demo hardcoded credentials; needs OIDC/Auth0 integration.
- Real payment processing: Stripe is in mock/test mode in Delta; needs production Stripe/bank hooks.
- Module 1-3 telemetry integration: Analytics tab uses simulated data; needs live metrics from Module 1 (SIEM) and Module 2 (EDR).
- Live peer data for Gamma: benchmarks are synthetic cohorts; needs real cross-tenant aggregation with privacy-preserving layers (differential privacy).
- Execution adapters: only the "Passive Header Scan" is live; real exploit-based campaigns (APT emulation) are catalog entries only and lack execution drivers.
- Secret management: transition from `.env` files to a secure vault (HashiCorp Vault or AWS Secrets Manager).
- Production hardening: unique secrets, disable demo auth, add production identity/payment integrations, and review the security model before deployment.

## 11. Files Excluded From This Repository
The following are intentionally NOT committed (see `.gitignore`):
- Virtual environments (`/ .venv/`, `**/.venv*/`) — regenerable, environment-specific
- Python bytecode (`__pycache__/`, `*.pyc`) — regenerable
- Databases (`*.db`) — binary runtime state, regenerable
- `.env` files — contain secrets; use the `.env.example` templates instead
- Logs (`*.log`), zips (`*.zip`), PDFs, and temp files — runtime artifacts
- `.vscode/` — editor configuration
All source code, documentation, config templates (`.env.example`), tests, contracts, fixtures, and shared files ARE included.

## 12. Security Note
Demo credentials (`manager@cybreach.demo` / `ArenaDemo2026!`) are public development-only identities, not secrets. Do not use them in production. Generate unique `JWT_SECRET_KEY` / `SERVICE_API_KEY` values for the Wallet service and matching `WALLET_SERVICE_JWT_SECRET` for Delta before any non-local deployment. Never commit real `.env` files or production credentials.

