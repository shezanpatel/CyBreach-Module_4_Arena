# Pod Beta - Campaign Catalog and Engagement APIs

Pod Beta contains two FastAPI applications:

- Campaign catalog on `app.campaign.api:app`: campaign browsing and creation,
  hash verification, scheduling, and staged boss-fight endpoints.
- Engagement manager on `app.engagement.api:app`: engagement creation,
  lifecycle transitions, recommendations, and reports. Engagement records are
  stored in the configured SQLAlchemy database (`DATABASE_URL`, SQLite by
  default). Pod Beta defaults to the authenticated Wallet service with its `CRD`
  credit unit; set `BETA_WALLET_MODE=mock` explicitly for local demo/test runs. API-created
  campaign definitions, schedules, cooldowns, boss-fight sessions, and event
  outbox records are persisted in the configured SQLAlchemy database. Kafka
  delivery is enabled with `KAFKA_ENABLE=true`.

The Arena local-lab workflow can collect HTTP response headers from the
loopback-only Juice Shop target and submit them through Pod Beta's engagement
lifecycle. If lab mode is disabled or unavailable, Delta can show its separately
labeled sample simulation instead. Neither path is a test of customer systems.

## Requirements

- Python 3.12 recommended
- FastAPI, Uvicorn, Pydantic 2, and SQLAlchemy 2

This source-only service currently has no Docker Compose file. Install the
dependencies in a virtual environment and run tests from the repository root using
[`run-all-tests.ps1`](../../run-all-tests.ps1).

## Install and run (PowerShell)

Create a virtual environment for this service:

```powershell
Set-Location services\pod_beta
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `BETA_JWT_SECRET` to the same value as
Pod Delta's `SECRET_KEY`. Keep `BETA_WALLET_MODE=mock` for local preview; for
real tenant transactions, use `service`, configure the Wallet JWT/API secrets,
and provision tenant `CRD` balances first.

Start the campaign catalog in one terminal:

```powershell
Set-Location services\pod_beta
.\.venv\Scripts\uvicorn.exe app.campaign.api:app --reload --host 127.0.0.1 --port 8001
```

Start the engagement API in a second terminal:

```powershell
Set-Location services\pod_beta
.\.venv\Scripts\uvicorn.exe app.engagement.api:app --reload --host 127.0.0.1 --port 8002
```

Delta's default upstream settings use these local ports:

| API | Local URL |
| --- | --- |
| Campaign catalog | <http://127.0.0.1:8001> |
| Engagement manager | <http://127.0.0.1:8002> |

If you use different ports, update `POD_BETA_CAMPAIGN_URL` and
`POD_BETA_ENGAGEMENT_URL` in `services/pod_delta/.env` and restart Delta.

## Explore the APIs

- Campaign catalog docs: <http://127.0.0.1:8001/docs>
- Engagement manager docs: <http://127.0.0.1:8002/docs>
- Campaign list: `GET /campaigns`
- Engagement create: `POST /engagement/create`
- Engagement report: `GET /engagement/{id}/report`

Check the OpenAPI docs for request payloads. All API routes require a JWT with a
tenant claim signed by `BETA_JWT_SECRET`; tenant-owned engagements, schedules,
recommendations, and boss-fight operations are checked against that claim.
Campaign fixtures are overlaid by persisted API-created definitions. Engagements,
campaign changes, schedules, cooldown timestamps, boss-fight sessions, and the
event outbox survive restarts when the configured database is retained. Boss-fight
stage transitions are also saved and read from the database. Configure
`BETA_WALLET_MODE` and the Wallet credentials to select the real `CRD` ledger or
the local mock.
Enable Kafka to publish and replay pending outbox records.

## Tests

The repository runner includes root and Pod Beta tests:

```powershell
Set-Location <repository-root>
.\run-all-tests.ps1
```

The Beta Python package is included on the root test runner's Python path; run
the suite through that runner rather than expecting a standalone Beta test
directory.
