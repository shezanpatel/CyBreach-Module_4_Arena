# Integration Runbook

## Start

```powershell
Copy-Item .env.example .env
docker compose up -d redis redpanda redpanda-init postgres
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt psycopg2-binary
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Full Docker stack:

```powershell
docker compose up --build
```

## Verify Health

```powershell
curl http://127.0.0.1:8000/api/v1/integration/health
```

## Frontend API Gateway

The browser must call Pod Delta only. Pod Delta proxies authenticated requests
to Pod Beta, Pod Gamma, the Wallet service, and its own tenant-scoped
notifications/preferences/analytics APIs. The default local API ports are:

| Service | Port |
| --- | ---: |
| Pod Delta | 8000 |
| Pod Beta campaign catalog | 8001 |
| Pod Beta engagement manager | 8002 |
| Pod Gamma | 8003 |
| Wallet service | 8004 |

Set the `POD_BETA_CAMPAIGN_URL`, `POD_BETA_ENGAGEMENT_URL`, `POD_GAMMA_URL`,
`WALLET_SERVICE_URL`, and `POD_DELTA_INTERNAL_URL` variables when the APIs use
different addresses. The default URLs are for local development; do not expose
the Beta, Gamma, or Wallet APIs publicly. Keep them on a private service
network and expose only the authenticated Delta gateway.

The handover configuration disables local demo login. The browser accepts an
organization-issued bearer token and validates it through the Delta gateway;
configure a trusted identity provider and token verification policy before
operator use. The current code does not implement an identity-provider login
or JWKS key rotation, so an externally issued token must use the configured
Delta signing/verification contract. The Wallet API validates delegated JWT
signatures independently. Configure
`WALLET_SERVICE_JWT_SECRET` on Delta to match the Wallet service's
`JWT_SECRET_KEY`; Delta creates a short-lived server-side delegation token.
Because Wallet authorizes per-user balance/history paths against its
`tenant_id` claim, Delta scopes the delegated token's tenant to the authenticated
subject used for that user's wallet path.
The frontend does not offer simulated payments or scan results in the handover
configuration. Wallet reads use Pod Alpha; no real-money payment provider is
configured, so top-ups and charges are unavailable.

Simulated top-up receipts can be downloaded as printable HTML or printed to
PDF from a standalone receipt document, avoiding the scrollable checkout dialog.
When browser popup settings block that print document, the flow downloads the
HTML receipt instead. Demo run reports can be downloaded as HTML or JSON and
identify the Delta simulator as their source. Pod Beta provides the campaign catalog and
engagement API; the current demo run cards do not invoke Pod Beta or perform
real security tests, so their findings must not be presented as live test
results.

The gateway provides read-only UI integration for campaign catalog,
engagement recommendations, leaderboard, benchmark, and health. Pod Gamma
exposes `GET /benchmark/cohorts`; Delta proxies the authenticated request, and
the frontend builds its selectors only from cohorts meeting Gamma's minimum
peer threshold. Gamma reads persisted benchmark aggregates and Compose does not
load benchmark seed files. Check existing database contents for legacy sample
records before handover; do not delete persistent volumes or records without
review. Empty benchmark results are expected until approved real aggregates
exist.

Pod Alpha is the Wallet Service from
https://github.com/upretisuman776/Wallet-Service. This checkout keeps the
canonical runnable service in `services/wallet_service`; `services/pod_alpha`
is a compatibility package path, not a second API. Delta's
`WALLET_SERVICE_URL` defaults to `http://127.0.0.1:8004`. The Wallet API is
reachable there for health checks, and authenticated accounts can read their
balance and ledger through Delta. The handover UI does not create transactions
or accept payments.

The Vite frontend proxies `/api` to `http://127.0.0.1:8000` in development.
Start each API on its assigned port before opening the frontend. The Services
tab reports configured upstream reachability. A successful build does not
mean the pods are running; verify the Services tab and each API's health route.

## Verify Score Display Flow

Produce:

```powershell
docker compose exec redpanda rpk topic produce mod3.score --brokers redpanda:9092
```

Message:

```json
{"event_type":"mod3.score","event_id":"score-1","tenant_id":"tenant-a","timestamp":"2026-09-20T00:00:00Z","data":{"score":82.5,"previous_score":80.0,"trend":"up","components":{"training":40,"response":42.5}}}
```

Check Redis and published event:

```powershell
docker compose exec redis redis-cli GET score:tenant-a
docker compose exec redpanda rpk topic consume score.displayed --brokers redpanda:9092 --num 1
```

## Verify Notification Flow

Produce:

```powershell
docker compose exec redpanda rpk topic produce achievement.awarded --brokers redpanda:9092
```

Message:

```json
{"event_type":"achievement.awarded","event_id":"ach-1","tenant_id":"tenant-a","timestamp":"2026-09-20T00:00:00Z","data":{"achievement_id":"first-defense","achievement_name":"First Defense","user_id":1,"points":50}}
```

Check Notification Hub and published event:

```powershell
curl "http://127.0.0.1:8000/api/v1/notifications/?user_id=1"
docker compose exec redpanda rpk topic consume notification.sent --brokers redpanda:9092 --num 1
```

## Verify Analytics Flow

Produce:

```powershell
docker compose exec redpanda rpk topic produce wallet.transaction --brokers redpanda:9092
```

Message:

```json
{"event_type":"wallet.transaction","event_id":"wallet-1","tenant_id":"tenant-a","timestamp":"2026-09-20T00:00:00Z","data":{"transaction_id":"txn-1","amount":10.0,"currency":"USD","direction":"credit","status":"completed","user_id":1}}
```

Check Analytics Engine and published event:

```powershell
curl "http://127.0.0.1:8000/api/v1/analytics?tenant_id=tenant-a"
docker compose exec redpanda rpk topic consume analytics.report --brokers redpanda:9092 --num 1
```

## Current Cross-Pod Boundaries

The supported browser path is Browser -> Pod Delta gateway -> Pod Beta campaign
catalog / Pod Gamma leaderboard and benchmarks / Pod Alpha wallet for an
authenticated non-demo account. This is request routing, not a peer-to-peer
mesh. A green upstream health result means only that the configured health URL
responded.

The event architecture is not yet a complete cross-pod pipeline in this
checkout. Pod Delta consumes the configured Redpanda topics and publishes its
own notification, analytics, and score-display events. Pod Beta's engagement
service currently uses an in-memory event bus and mock wallet; its lifecycle
events are not published to Delta's Redpanda topics. Pod Gamma serves its own
leaderboard and benchmark API and is not currently updated from Beta lifecycle
events.

Therefore, do not treat the UI's service-health count as proof of shared event
data. Gamma APIs also need authentication and tenant authorization before
deployment beyond an isolated trusted network. A complete event-driven
engagement-to-wallet-to-leaderboard loop requires
replacing Beta's mock wallet with the Alpha wallet integration and connecting
Beta/Gamma producers and consumers to shared event contracts, with durable
state and end-to-end tests. The manual Delta topic checks below validate
Delta's broker integration only.

## Tests

```powershell
pytest tests/integration/test_app_integration_layer.py
```
