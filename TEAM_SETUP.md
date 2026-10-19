# CyBreach Arena team setup (Windows)

Use these PowerShell steps from a fresh ZIP extraction. Keep the folder structure intact. The ZIP contains source and configuration templates, not Python virtual environments, node_modules, or Docker image archives. Initial setup needs internet so pip, npm, and Docker can download dependencies and images.

## 1. Install prerequisites

Install Python 3.12, Node.js 20.19+ or 22.12+ (npm included), and Docker Desktop with Docker Compose. If Windows Package Manager (winget) is available, install them from PowerShell:

```powershell
winget install --exact --id Python.Python.3.12
winget install --exact --id OpenJS.NodeJS.LTS
winget install --exact --id Docker.DockerDesktop
```

Otherwise, use the official installers. Start Docker Desktop from the Start menu and verify:

```powershell
py -3.12 --version
node --version
npm.cmd --version
docker --version
docker compose version
docker info
```

## 2. Extract and install dependencies

Replace the sample path with the actual extraction path. Run these from the project root.

```powershell
Set-Location C:\path\to\cybreach-module4-arena

# Shared environment for root and service tests
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r services\pod_gamma\requirements.txt -r services\pod_delta\requirements.txt -r services\pod_beta\requirements.txt psycopg2-binary

# Pod Delta
py -3.12 -m venv services\pod_delta\.venv
services\pod_delta\.venv\Scripts\python.exe -m pip install --upgrade pip
services\pod_delta\.venv\Scripts\python.exe -m pip install -r services\pod_delta\requirements.txt psycopg2-binary

# Wallet / Pod Alpha
py -3.12 -m venv services\wallet_service\.venv312
services\wallet_service\.venv312\Scripts\python.exe -m pip install --upgrade pip
services\wallet_service\.venv312\Scripts\python.exe -m pip install -r services\wallet_service\requirements.txt

# Frontend packages
Set-Location services\pod_delta\frontend
npm.cmd install
Set-Location ..\..\..
```

Pod Beta uses the shared environment and its requirements file.

## 3. Create local configuration

```powershell
Copy-Item services\pod_delta\.env.example services\pod_delta\.env
Copy-Item services\pod_gamma\.env.example services\pod_gamma\.env
Copy-Item services\wallet_service\.env.example services\wallet_service\.env
Copy-Item services\pod_beta\.env.example services\pod_beta\.env
notepad services\pod_delta\.env
notepad services\pod_gamma\.env
notepad services\wallet_service\.env
notepad services\pod_beta\.env
```

Set these local development values in the files:

- Delta: DEV_DEMO_AUTH_ENABLED=true; DEMO_STARTING_CREDITS=1200; LAB_DEMO_ENABLED=true for the manager walkthrough (set false to use the no-target sample simulation). Keep the default upstream URLs (Beta 8001/8002, Gamma 8003, Wallet 8004) and KAFKA_BOOTSTRAP_SERVERS=localhost:19092. The browser walkthrough uses the **Enter Sample Preview** button; no manager password is needed.
- Gamma: POSTGRES_DB=leaderboard; POSTGRES_USER=leaderboard_user; POSTGRES_PASSWORD=GammaLocalOnly2026; DATABASE_URL=postgresql+asyncpg://leaderboard_user:GammaLocalOnly2026@localhost:5432/leaderboard; REDIS_HOST=127.0.0.1; REDIS_PORT=6379; REDIS_PASSWORD= (empty, including any duplicate REDIS_PASSWORD entry in the template). These steps share Delta's Redis, so Gamma's separate Redis container is not started.
- Wallet: POSTGRES_HOST=127.0.0.1; POSTGRES_PORT=5434; DATABASE_URL=postgresql+psycopg://wallet_user:wallet_password@127.0.0.1:5434/wallet_db; KAFKA_BOOTSTRAP_SERVERS=localhost:19092. Replace JWT_SECRET_KEY and SERVICE_API_KEY with local values. Set Delta's WALLET_SERVICE_JWT_SECRET to exactly match Wallet's JWT_SECRET_KEY.
- Beta: set BETA_JWT_SECRET to exactly match Delta's SECRET_KEY. For local preview, explicitly set BETA_WALLET_MODE=mock. Live service mode is the default and uses the authenticated Wallet API; copy Wallet's JWT_SECRET_KEY and SERVICE_API_KEY into WALLET_SERVICE_JWT_SECRET and WALLET_SERVICE_API_KEY. CRD is the Arena credit unit; it is not USD. Set KAFKA_ENABLE=true when Redpanda is running to publish the durable outbox.

For an end-to-end Module 4 Wallet/Kafka demonstration, use
`BETA_WALLET_MODE=service`, set `KAFKA_ENABLE=true` and
`KAFKA_BOOTSTRAP_SERVERS=localhost:19092`, and restart both Beta APIs. Make sure
the Wallet API is using the same `JWT_SECRET_KEY` and `SERVICE_API_KEY` copied
into Beta's `WALLET_SERVICE_JWT_SECRET` and `WALLET_SERVICE_API_KEY`. With the
local Wallet running, the helper in
`services\wallet_service\scripts\mod4_demo_wallet.py` can seed and inspect a
local tenant's CRD ledger. The Sample Preview wallet card is still fictional;
use the helper or Wallet API history to show real ledger entries. Keep
`BETA_WALLET_MODE=mock` only when you intend to show the labeled preview flow.

These settings are for local development only. Do not expose the demo account or local secrets publicly or use them in production.

## 4. Start Docker infrastructure

Start Delta Redis, Redpanda, its topic initializer, and ClickHouse. Delta uses SQLite by default, so its PostgreSQL container is not needed here. Delta and Wallet share Redpanda on port 19092.

```powershell
Set-Location services\pod_delta
docker compose up -d redis redpanda redpanda-init clickhouse
Set-Location ..\..\
```

Start only Gamma PostgreSQL. Gamma shares Delta Redis, so do not start Gamma's Redis container.

```powershell
Set-Location services\pod_gamma
docker compose up -d postgres
Set-Location ..\..\
```

Start Wallet PostgreSQL separately on port 5434:

```powershell
docker run --name arena-wallet-db -e POSTGRES_USER=wallet_user -e POSTGRES_PASSWORD=wallet_password -e POSTGRES_DB=wallet_db -p 127.0.0.1:5434:5432 -d postgres:16
docker ps
docker exec gamma-postgres pg_isready -U leaderboard_user -d leaderboard
docker exec arena-wallet-db pg_isready -U wallet_user -d wallet_db
```

Compose downloads the required images. Start the local Juice Shop lab for the manager walkthrough (intentionally vulnerable; it is bound only to loopback):

```powershell
docker compose -f services\pod_delta\docker-compose.lab.yml up -d
```

With `LAB_DEMO_ENABLED=true`, the UI checks only `http://127.0.0.1:3000` and sends observed response-header results through Pod Beta. Set `LAB_DEMO_ENABLED=false` if you want only the labeled, no-target simulation instead. Restart Delta after changing this setting.

## 5. Start each API

Open five PowerShell windows. Replace the sample path with the actual extraction path, and leave each process running in its window.

**Window 1: Pod Beta campaigns (port 8001)**

```powershell
Set-Location C:\path\to\cybreach-module4-arena\services\pod_beta
..\..\.venv\Scripts\python.exe -m uvicorn app.campaign.api:app --reload --host 127.0.0.1 --port 8001
```

**Window 2: Pod Beta engagements (port 8002)**

```powershell
Set-Location C:\path\to\cybreach-module4-arena\services\pod_beta
..\..\.venv\Scripts\python.exe -m uvicorn app.engagement.api:app --reload --host 127.0.0.1 --port 8002
```

**Window 3: Pod Gamma (port 8003)**

```powershell
Set-Location C:\path\to\cybreach-module4-arena\services\pod_gamma
$env:APP_PORT = "8003"
$env:REDIS_HOST = "127.0.0.1"
$env:REDIS_PORT = "6379"
$env:REDIS_PASSWORD = ""
$env:DATABASE_URL = "postgresql+asyncpg://leaderboard_user:GammaLocalOnly2026@127.0.0.1:5432/leaderboard"
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003
```

Use the same Gamma database password in the .env file and command.

**Window 4: Wallet / Pod Alpha (port 8004)**

```powershell
Set-Location C:\path\to\cybreach-module4-arena\services\wallet_service
.\.venv312\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8004
```

**Window 5: Pod Delta gateway (port 8000)**

```powershell
Set-Location C:\path\to\cybreach-module4-arena\services\pod_delta
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 6. Start the frontend

Open another PowerShell window:

```powershell
Set-Location C:\path\to\cybreach-module4-arena\services\pod_delta\frontend
npm.cmd run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173, choose **Connect an account**, then **Enter Sample Preview**. See [MANAGER_DEMO.md](MANAGER_DEMO.md) for the presentation sequence and data disclosures.

## 7. Verify all services

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/integration/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/arena/public-status | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:8003/health
Invoke-RestMethod http://127.0.0.1:8004/
```

Delta public status should show healthy for Delta, both Beta APIs, Gamma, and Wallet. Gamma health should show Redis and PostgreSQL connected.

## 8. Run tests and frontend checks

The full test script needs a separate PostgreSQL container named wallet-pytest-db on port 55432. This is distinct from the Wallet API database.

```powershell
docker run --name wallet-pytest-db -e POSTGRES_USER=wallet_user -e POSTGRES_PASSWORD=wallet_password -e POSTGRES_DB=wallet_db -p 127.0.0.1:55432:5432 -d postgres:16
docker exec wallet-pytest-db pg_isready -U wallet_user -d wallet_db
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run-all-tests.ps1
```

Frontend lint and build (there is no frontend test script):

```powershell
Set-Location services\pod_delta\frontend
npm.cmd run lint
npm.cmd run build
```

## Ports

| Service | Port |
| --- | ---: |
| Frontend | 5173 |
| Pod Delta | 8000 |
| Pod Beta campaigns | 8001 |
| Pod Beta engagements | 8002 |
| Pod Gamma | 8003 |
| Wallet / Pod Alpha | 8004 |
| Shared Redis | 6379 |
| Gamma PostgreSQL | 5432 |
| Wallet PostgreSQL | 5434 |
| Redpanda | 19092 |
| ClickHouse HTTP | 8123 |
| Wallet test PostgreSQL | 55432 |
| Optional Juice Shop | 3000 |

Stop each API/frontend process with Ctrl+C. Stop containers without deleting volumes:

```powershell
docker compose -f services\pod_delta\docker-compose.yml down
docker compose -f services\pod_gamma\docker-compose.yml down
docker stop arena-wallet-db wallet-pytest-db
docker compose -f services\pod_delta\docker-compose.lab.yml down
```

The final command is needed only if Juice Shop was started. Do not add -v to compose down unless intentionally deleting stored database/Redis data.
