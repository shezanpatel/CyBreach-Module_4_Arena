# CyBreach Arena - Module 4 Audit & Handoff

## Project Overview
CyBreach Arena is a multi-service cybersecurity training and simulation platform. This repository contains the integrated Module 4 codebase, consisting of four primary "Pods" (services) and a centralized React-based frontend dashboard.

---

## 1. Pod Definitions & Responsibilities

### **Pod Delta (The Gateway & Hub)**
- **Location:** `services/pod_delta/`
- **Role:** Acts as the authenticated API Gateway. It proxies requests to Pod Beta, Gamma, and Alpha (Wallet).
- **Key Features:**
  - Manages user sessions (JWT).
  - Provides the React/Vite Frontend.
  - Handles in-memory demo state for simulated "Sample Previews".
  - Integrates Redis (caching), Redpanda (event streaming), and ClickHouse (analytics).

### **Pod Beta (Campaigns & Engagements)**
- **Location:** `services/pod_beta/`
- **Role:** Core business logic for security assessments.
- **Key Features:**
  - **Campaign Catalog:** Browsable list of security tests (e.g., APT29 Emulation).
  - **Engagement Manager:** Tracks the "Run" of a campaign, from start to final report.
  - **Report Generator:** Produces findings based on assessment outcomes.
  - **Kafka Integration:** Publishes engagement lifecycle events to Redpanda.

### **Pod Gamma (Rankings & Benchmarks)**
- **Location:** `services/pod_gamma/`
- **Role:** Competitive and comparative data analysis.
- **Key Features:**
  - **Leaderboards:** Real-time tenant rankings stored in Redis.
  - **Benchmarks:** Seeded synthetic cohort data for performance comparison.
  - **Consent Management:** Handles data sharing lifecycle for tenants.

### **Pod Alpha / Wallet Service (Billing)**
- **Location:** `services/wallet_service/`
- **Role:** Financial ledger for the platform.
- **Key Features:**
  - **Ledger Management:** Tracks `CRD` (Arena Credits).
  - **Authenticated Transactions:** Secure debits for starting campaigns.
  - **Kafka Integration:** Receives events to reconcile billing with platform activity.

---

## 2. Installation & Execution Guide

### **Prerequisites**
- **Python:** 3.12+
- **Node.js:** 20+ (LTS)
- **Docker:** Desktop with Docker Compose
- **Environment:** PowerShell (recommended for Windows)

### **Step A: Infrastructure Setup (Docker)**
Run these commands to start the backing databases and message brokers:
```powershell
# Start Pod Delta Infrastructure
Set-Location services/pod_delta
docker compose up -d redis redpanda redpanda-init postgres clickhouse

# Start Pod Gamma Database
Set-Location ../pod_gamma
docker compose up -d postgres

# Start Wallet Database (Manual Container)
docker run --name arena-wallet-db -e POSTGRES_USER=wallet_user -e POSTGRES_PASSWORD=wallet_password -e POSTGRES_DB=wallet_db -p 127.0.0.1:5434:5432 -d postgres:16
```

### **Step B: Backend Installation**
Open separate terminals for each service:

**1. Pod Delta (Port 8000)**
```powershell
Set-Location services/pod_delta
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt psycopg2-binary
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**2. Pod Beta - Campaigns (Port 8001)**
```powershell
Set-Location services/pod_beta
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.campaign.api:app --reload --host 127.0.0.1 --port 8001
```

**3. Pod Beta - Engagements (Port 8002)**
```powershell
Set-Location services/pod_beta
# Use existing venv
uvicorn app.engagement.api:app --reload --host 127.0.0.1 --port 8002
```

**4. Pod Gamma (Port 8003)**
```powershell
Set-Location services/pod_gamma
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8003
```

**5. Wallet Service (Port 8004)**
```powershell
Set-Location services/wallet_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8004
```

### **Step C: Frontend Installation**
```powershell
Set-Location services/pod_delta/frontend
npm install
npm run dev
```

---

## 3. Scope of Work (Audit Status)

### **What is DONE ✅**
- **Inter-Pod Connectivity:** Delta successfully proxies to Beta, Gamma, and Wallet.
- **Unified Auth:** Shared JWT secret mechanism allows Delta to authorize requests across all pods.
- **Campaign Execution Flow:** The "Juice Shop" local lab integration works end-to-end (Scan -> Beta Engagement -> Report).
- **Event Streaming:** Redpanda integration for publishing engagement events.
- **Simulated Demo Mode:** A robust "Sample Preview" mode for managers that doesn't require complex production setup.
- **Reporting:** Beta generates real reports from local lab header checks.

### **What is STILL LEFT to Implement/Integrate ⏳**
- **Production Identity Provider:** Currently using local demo hardcoded credentials. Needs integration with OIDC/Auth0.
- **Real Payment Processing:** Stripe is currently in "Mock/Test" mode in Delta. Needs production Stripe/Bank hooks.
- **Module 1-3 Telemetry Integration:** The "Analytics" tab uses simulated data. It needs to pull live metrics from Module 1 (SIEM) and Module 2 (EDR).
- **Live Peer Data for Gamma:** Benchmarks are currently synthetic cohorts. Needs real cross-tenant data aggregation with privacy-preserving layers (Differential Privacy).
- **Execution Adapters:** Only the "Passive Header Scan" is live. Real exploit-based campaigns (APT emulation) are catalog entries only and lack execution drivers.
- **Secret Management:** Transition from `.env` files to a secure vault (HashiCorp Vault or AWS Secrets Manager).

---

## 4. Expected Errors & Troubleshooting

| Error | Cause | Resolution |
| :--- | :--- | :--- |
| `ConnectionRefusedError` | An upstream pod (Beta/Gamma) is not running. | Verify the pod is running on its assigned port (8001-8004). |
| `JWT Signature Verification Failed` | `SECRET_KEY` in Pod Delta does not match `BETA_JWT_SECRET` or `WALLET_SERVICE_JWT_SECRET`. | Copy the secret from Delta's `.env` to all other pods' `.env` files. |
| `Port already in use` | A previous process or Docker container is holding the port. | Run `Stop-Process -Id (Get-NetTCPConnection -LocalPort <PORT>).OwningProcess` in PowerShell. |
| `Redpanda Connection Timeout` | The `redpanda-init` container didn't finish creating topics. | Restart Delta's docker-compose stack. |
| `401 Unauthorized` in Demo | `DEV_DEMO_AUTH_ENABLED` is set to `false`. | Set `DEV_DEMO_AUTH_ENABLED=true` in `services/pod_delta/.env`. |

---

## 5. Audit Commands for Verification

**Check Service Health:**
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/integration/health
```

**Run Full Test Suite:**
```powershell
.\run-all-tests.ps1
```

**Seed Test Wallet:**
```powershell
python services/wallet_service/scripts/mod4_demo_wallet.py --tenant preview-tenant --credit 1200
```
