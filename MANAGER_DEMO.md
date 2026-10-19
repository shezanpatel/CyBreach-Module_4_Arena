# Manager demonstration: CyBreach Arena

## Current integrated local profile

On this workstation, the live manager-demo path is configured as follows:

- Pod Delta: `http://127.0.0.1:8000`
- Pod Beta engagement API: `http://127.0.0.1:8002`, using the Wallet service
- Wallet Service: `http://127.0.0.1:8005`, backed by the dedicated local
  `wallet-pytest-db` PostgreSQL container
- Redpanda: `localhost:9092`; Beta lifecycle events were confirmed delivered
- Frontend: `http://127.0.0.1:5173`

The test database contains local demo credits only. The frontend preview wallet
still displays synthetic state; use the Wallet helper below to show the separate
Alpha ledger. With Beta in Wallet service mode, a local Juice Shop run can debit
that separate test ledger; it does not make the Delta sample balance real. The
local signing keys are in ignored `.env` files and must not be shared with the
project zip. The preview signing key was rotated while enabling this profile,
so sign out and enter Sample Preview again before presenting. One
integration scan was run during setup; wait for Beta's five-minute quick-scan
cooldown before running it again in the UI. The latest completed local-lab
report is restored from Beta when Sample Preview loads, so it can be opened
without running another scan.

## What this demonstration proves

This walkthrough shows the local Arena dashboard, real service reachability,
campaign definitions served by Pod Beta, a passive check of the local OWASP
Juice Shop, and Pod Beta's engagement report from the headers actually returned
by that local application.

It does **not** use customer data or real payments. The preview account, credit
balance, receipts, and tenant analytics are fictional. Gamma's leaderboard and
benchmark cohorts are seeded demo data, not real peer comparisons. The local
Juice Shop check is real only for the local lab running on this computer; it
does not test an employer system or an external target. The preview credits do
not enter the Alpha ledger. In the configured integration profile, Beta makes a
separate 5 CRD debit against the dedicated local test Wallet ledger when the
local check completes; this is test data, not company funds.

## What was updated

- **Latest report recovery:** Preview login no longer wipes the previous
  engagement. Delta can recover the latest completed, tenant-scoped local-lab
  report from Beta's database, including its five outcomes and finding count.
  The current saved result has three findings and two passed checks. The sample
  balance remains fictional and separate from Wallet.
- **Report access:** Campaigns shows **OPEN LATEST REPORT** only when an actual
  completed result exists. The report is loaded from saved Beta data, so the
  manager can reopen it after signing out or restarting Delta without rerunning
  the check.
- **Button behavior:** Header labels without actions, such as **SIMULATED DEMO
  EVENTS**, are now displayed as status text. Empty placeholder actions were
  removed; actual controls such as **REFRESH** and **View wallet** remain
  clickable.
- **Wallet description:** Campaign guidance now explains that Delta's sample
  credit balance and Beta's configured Wallet debit are separate ledgers.

## Integration work completed for this local demo

- Beta validates signed access tokens and scopes engagement access to the
  authenticated tenant. A tenant-scoped engagement listing supports report
  recovery.
- Engagement state, completed reports, and boss-fight stage results are stored
  in Beta's database so they survive Beta restarts.
- Beta is configured for Wallet service mode in this profile. A local lab run
  was verified to debit 5 CRD from a 1,200 CRD test balance, leaving 1,195 CRD.
- Beta lifecycle events are configured through Kafka/Redpanda. Four lifecycle
  events from the verified run were delivered to the local broker.
- The Juice Shop integration makes one passive local HTTP request, submits the
  observed header checks through Beta's engagement lifecycle, and displays the
  saved outcomes. It does not send exploit payloads.
- Delta's health page recently returned five of five services healthy. The last
  full repository run recorded 359 passing tests **before** the latest report
  recovery and button-label edits. Those latest edits received Python compile,
  frontend build, and API smoke checks; the full test suite has not been rerun
  since them.

## Does this demo cover the complete company website?

No. The local site is the Arena frontend served on `localhost:5173`; it is not a
deployed company website and it is not connected to a company's production
tenant. It demonstrates the UI and selected service flows. These are the
current sources behind the main screens:

| Screen | What this demo uses | What a company deployment needs |
| --- | --- | --- |
| Dashboard | Live API reachability and campaign/ranking counts; the preview account, balance, and analytics are synthetic. | A company tenant, identity, and live tenant data from the owning services. |
| Campaigns | Beta returns campaign definitions and recommendations; definitions are local catalog fixtures. The optional local header check is real against this machine's Juice Shop. | Company-approved campaign catalog, authorized targets, execution adapters, and real findings/report storage. |
| Latest report | A real Beta-persisted report from the local Juice Shop check, restored under the preview tenant. | Reports from company-authorized assessments and integrated detection/telemetry sources. |
| Leaderboard | Gamma API with seeded demo rankings. | Consenting organizations, verified tenant metrics, and aggregation/privacy controls. |
| Benchmark | Gamma API with seeded synthetic cohorts. | Sufficient real opted-in peers, privacy thresholds, and an approved data-sharing policy. |
| Wallet | Fictional Delta preview balance and simulated sample checkout. Separately, Beta can debit the local Alpha test ledger. | A company Wallet tenant, production billing configuration if charging money, reconciliation, and finance approval. |
| Notifications and analytics | Preview events and metrics are synthetic. | Company event producers, tenant-scoped records, notification channels, and operational metrics. |
| Services | Live reachability probes. A green result proves an API answered, not that every business flow works. | Production monitoring, alerts, dependency checks, and service-level objectives. |

Campaign names such as APT emulation are catalog entries in this build; they do
not mean the full campaign actually runs. The only verified target assessment
here is the passive Juice Shop header baseline. The saved Beta summary contains
the five technique verdicts and evidence references; it may not retain every
raw HTTP header value from the original request.

## Why the manager view uses sample data

There is no company identity-provider account, approved customer tenant, company
data feed, or written target authorization configured for this workstation.
Showing invented values as if they were real would misrepresent the product and
could expose or alter systems without permission. The preview therefore labels
fictional wallet activity, receipts, and analytics; Gamma labels its seeded
rankings and cohorts; and the one measured security check stays inside a local
loopback lab. Live data in this demo means service health, Beta API responses,
the local Juice Shop response, the persisted Beta report, and (when service mode
is enabled) a CRD entry in the isolated test Wallet ledger. It does not mean
live company or customer data.

## What removing the simulation means

Turning off preview login hides the sample account and its preview-specific
events, receipts, and analytics. It does **not** automatically remove Gamma's
seeded benchmark/ranking records or the local campaign fixtures; those sources
must each be removed or disabled in a production profile too. Removing the
sample paths does **not** create real company data: without production
integrations, those screens will show empty states or connection errors. Keep
fixtures and simulation helpers in a development/test profile only, label them
clearly, and disable preview login and sample billing in production. Replace
each sample source with a real, tenant-scoped provider before presenting that
feature as operational.

## What a company needs for real access

Before a company can use a deployed Arena site with its own systems, the
organization and product team need to provide and configure:

1. **A real deployment:** company-approved hosting, a company domain with HTTPS,
   production databases, backups, monitoring, secrets management, and separate
   development/staging/production environments. `localhost` is reachable only
   from the developer's machine.
2. **Company sign-in and tenant setup:** an approved identity provider or
   production identity service, verified token issuer/audience and key rotation,
   tenant provisioning, user membership, roles, and authorization checks for
   every API and report.
3. **Approved integration credentials and endpoints:** production Wallet,
   Beta execution, Gamma, Delta, and any Modules 1-3 telemetry/SIEM/EDR/cloud
   sources. Configure TLS, service identities, event broker topics, retries,
   idempotency, audit logs, and tenant ownership for every record.
4. **Authorized assessment scope:** the company must inventory and approve the
   exact domains, IP ranges, accounts, time windows, permitted tests, rate
   limits, and emergency stop process. The current local-only check must not be
   pointed at company systems as-is.
5. **Real wallet and payment decisions:** provision the company's Wallet
   accounts and credit rules. If purchases are enabled, configure the approved
   payment provider in its required compliance mode, webhook verification,
   refunds, reconciliation, and explicit finance/customer approval. The local
   test database and simulated checkout are not production billing.
6. **Real analytics and peer data:** connect trusted tenant metrics and obtain
   opt-in/data-sharing approval for benchmarks. Enforce minimum cohort sizes,
   anonymization, retention/deletion rules, and applicable privacy and data
   residency requirements.
7. **Operational acceptance:** test cross-pod authorization, isolation,
   failures, event delivery, recovery, load, monitoring, incident response, and
   the documented security controls in a company-controlled staging environment
   before granting production access.

With those integrations and approvals, the intended Arena workflow can let an
authorized company user browse available campaigns, launch only assessments
approved for that tenant and scope, review persisted findings/recommendations,
track service and resilience metrics, receive tenant notifications, manage
approved wallet credits, and view opt-in aggregated comparisons. Those are
product goals; this local demo has not verified all of them against a live
company environment.

## Before the manager arrives

1. Start the services using [TEAM_SETUP.md](TEAM_SETUP.md). For this demo,
   configure Delta with `LAB_DEMO_ENABLED=true` and start the optional local
   Juice Shop container from the `services/pod_delta` directory:

   ```powershell
   docker compose -f docker-compose.lab.yml up -d
   Invoke-WebRequest http://127.0.0.1:3000 -UseBasicParsing
   ```

   Keep the lab bound to `127.0.0.1:3000`. Delta rejects non-loopback targets.
2. Start all five APIs and the frontend. Leave their terminal windows running.
3. Open <http://127.0.0.1:5173>. The public page should show all five APIs as
   healthy. Then choose **Connect an account** and **Enter Sample Preview**.
   No manager password is needed for this local preview.
4. Open **Services** once and confirm Delta, both Beta APIs, Gamma, and Wallet
   are healthy. The UI polls APIs; this is service reachability, not a full
   production-readiness claim.
5. Open **Campaigns**. Confirm that Beta campaigns load and that the local lab
   action names the Juice Shop target. If it says **Run sample simulation**,
   lab mode did not reach Delta; do not describe that button as a live check.
6. Do not click the local check more than once during the talk. Beta enforces a
   five-minute cooldown after a completed quick scan. If you need another run,
   wait for the full cooldown; restarting Beta does not clear its persisted
   engagement history.

## Optional: show a real local Wallet ledger debit

The quick preview above uses a fictional Delta wallet. To demonstrate Beta
debiting Pod Alpha's actual local ledger, use the same preview tenant while
configuring Beta for Wallet service mode. This is still local demo funding, not
customer money.

1. For this workstation, the Wallet API and Redpanda are already running on
   ports 8005 and 9092. In a fresh setup, start the broker and Wallet
   API/PostgreSQL as described in TEAM_SETUP.md. Configure the Wallet `.env`
   with local secrets. Set the Wallet
   `JWT_SECRET_KEY` and `SERVICE_API_KEY` to the values copied into Beta's
   `WALLET_SERVICE_JWT_SECRET` and `WALLET_SERVICE_API_KEY`.
2. In `services/pod_beta/.env`, set `BETA_WALLET_MODE=service`, set
   `WALLET_SERVICE_URL` to the Wallet API URL, set `KAFKA_ENABLE=true`, and set
   `KAFKA_BOOTSTRAP_SERVERS` to the host broker (`localhost:9092` for the
   current workstation; `localhost:19092` for the TEAM_SETUP stack).
   Set `BETA_JWT_SECRET` to Delta's `SECRET_KEY`. Restart both Beta APIs after
   changing the file.
3. Seed 1,200 CRD into the local Wallet ledger for the preview tenant. From the
   repository root, run:

   ```powershell
   services\wallet_service\.venv312\Scripts\python.exe services\wallet_service\scripts\mod4_demo_wallet.py --tenant preview-tenant --credit 1200
   ```

   This helper only accepts a loopback Wallet URL and calls the authenticated
   Wallet credit API. The operation is recorded in the Wallet ledger.
4. Enter Sample Preview in the browser and run the local Juice Shop check once.
   Beta now calls the Wallet service to debit its CRD cost. Check the actual
   ledger balance after the run:

   ```powershell
   services\wallet_service\.venv312\Scripts\python.exe services\wallet_service\scripts\mod4_demo_wallet.py --tenant preview-tenant
   ```

   The preview Wallet card remains fictional and does not mirror this ledger.
   Show the command output and Wallet history/API as evidence of the separate
   Alpha ledger transaction. Kafka events are durable in Beta's outbox and are
   published when Redpanda is reachable; do not claim broker delivery unless
   the broker is running and its logs or consumer confirm receipt.

## Six-minute talk track

### 1. Platform status (about 45 seconds)

On the public status page and then **Services**, explain that the frontend calls
through Delta and that the displayed services are responding. Point out that
the Wallet API is reachable as a separate service; preview transactions are
still fictional and do not modify its ledger.

### 2. Campaign discovery (about 45 seconds)

Open **Campaigns** and show the definitions and recommendations returned by
Pod Beta. Explain that these are local campaign catalog fixtures, not campaigns
being run against a customer environment.

### 3. Local evidence and engagement report (about 2 minutes)

Click **RUN LOCAL OWASP JUICE SHOP LOCAL LAB CHECK** once. This makes one
ordinary HTTP GET to `http://127.0.0.1:3000/`, checks five security response
headers, and submits those observed values through Pod Beta's create, scope,
execute, and complete lifecycle. No exploit payloads are sent. Open the latest
report and show the target, HTTP status, each observed header, and the resulting
recommendations.

The current local lab run returned HTTP 200 and found three missing headers
(Content-Security-Policy, Referrer-Policy, and Permissions-Policy); two checked
headers were present. Results can change if the lab image changes, so present
the values displayed by the report rather than promising these exact counts.

Say explicitly: **“This is measured data from our local Juice Shop container.
It demonstrates the Arena-to-Beta workflow; it is not a scan of a company or
customer system.”**

### 4. Rankings and benchmarks (about 1 minute)

Open **Leaderboard**, then **Benchmark**. These screens query Gamma, but the
tenants/cohorts are seeded synthetic demo data. For a benchmark example, use
Finance / North / Medium if available. The seeded cohort currently contains 19
records and returns a median of 73.6. Call these **sample aggregate values**,
not industry facts or real competitor data.

### 5. Wallet, notifications, and analytics (about 1 minute)

Show **Wallet**, **Notifications**, and **Analytics** briefly. Explain that the
preview balance, sample events, and preview analytics are kept in Delta's
development demo state. No payment is taken and no Alpha ledger entry is
created. The displayed analytics score is a demo metric, not the Module 3
Resilience Score.

### 6. Close (about 30 seconds)

Summarize what the demo established: the services connect, the campaign catalog
loads, and observed local-lab evidence can pass through Beta's engagement/report
flow. The seeded leaderboard/benchmark and preview wallet are demonstration
data. Live customer, payment, peer-benchmark, and Module 1/2/3 integrations are
separate follow-up work.

## Recovery notes

- **A service is red:** open **Services**, refresh, and restart that API using
  its command in TEAM_SETUP.md. Do not spend demo time opening Docker Desktop
  tabs; show the status page and move on if an optional subsystem is unavailable.
- **The local check fails:** verify Juice Shop responds at
  `http://127.0.0.1:3000/`, Delta has `LAB_DEMO_ENABLED=true`, and Beta is
  healthy. A failed check should not be presented as a completed report.
- **No benchmark cohorts appear:** verify Gamma's health and PostgreSQL
  connection. Skip the benchmark screen rather than inventing a comparison.
- **Need a clean preview account:** use **Reset demo** in the Wallet panel.
  Signing out and back in preserves the current preview activity. A Delta
  restart reseeds the fictional account and restores the latest completed
  local-lab report from Beta when one is available.

