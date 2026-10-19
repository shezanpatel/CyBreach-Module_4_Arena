# Pod Alpha

Pod Alpha is the Wallet Service in this Arena checkout. The linked upstream
project is [upretisuman776/Wallet-Service](https://github.com/upretisuman776/Wallet-Service).

The runnable service lives at [`services/wallet_service`](../wallet_service/),
which already contains the Wallet API, PostgreSQL ledger, authentication,
idempotency, audit history, and event publishing. It is the maintained local
integration point; this directory is not a second service or a copy of the
upstream repository. The linked upstream snapshot was reviewed at commit
`06fb26a`; the local service has follow-on changes, so it was not overwritten
with the older snapshot.

Delta probes the Wallet API at `http://127.0.0.1:8004` by default. Its
authenticated, non-demo gateway can read the user's wallet balance and ledger.
The public local demo deliberately keeps a separate in-memory wallet and does
not write transactions to Pod Alpha.

See the [Wallet Service setup guide](../wallet_service/README.md) for
configuration, Compose, API, and test instructions.
