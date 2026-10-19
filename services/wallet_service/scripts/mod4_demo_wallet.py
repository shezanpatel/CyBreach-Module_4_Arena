"""Fund or inspect a local Module 4 demo wallet through Pod Alpha's API."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import httpx
import jwt
from dotenv import load_dotenv


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", required=True, help="Wallet user/tenant ID, e.g. preview-tenant")
    parser.add_argument("--credit", type=int, default=0, help="Optional local demo credit amount in CRD")
    args = parser.parse_args()
    if args.credit < 0:
        parser.error("--credit must be zero or greater")

    env_path = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(env_path, override=False)
    secret = os.getenv("JWT_SECRET_KEY", "")
    api_key = os.getenv("SERVICE_API_KEY", "")
    if not secret or not api_key:
        print(f"Configure JWT_SECRET_KEY and SERVICE_API_KEY in {env_path}", file=sys.stderr)
        return 2

    base_url = os.getenv("MOD4_DEMO_WALLET_URL", "http://127.0.0.1:8004").rstrip("/")
    parsed_url = urlparse(base_url)
    if parsed_url.scheme != "http" or parsed_url.hostname not in {"127.0.0.1", "localhost", "::1"}:
        print("This helper only permits a loopback Wallet URL.", file=sys.stderr)
        return 2
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": args.tenant, "tenant_id": args.tenant, "role": "service",
         "iat": now, "exp": now + timedelta(minutes=2)},
        secret,
        algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
    )
    headers = {"Authorization": f"Bearer {token}"}
    try:
        with httpx.Client(timeout=8.0, trust_env=False) as client:
            if args.credit:
                response = client.post(
                    f"{base_url}/wallet/credit",
                    headers={**headers, "X-Service-API-Key": api_key,
                             "Idempotency-Key": f"mod4-demo-funding:{args.tenant}:{uuid4().hex}"},
                    json={"user_id": args.tenant, "amount": args.credit, "currency": "CRD",
                          "reference_id": f"mod4-local-demo:{uuid4().hex}"},
                )
                response.raise_for_status()
                print(f"Credited {args.credit} CRD to local demo tenant {args.tenant}.")
            response = client.get(
                f"{base_url}/wallet/balance/{args.tenant}",
                params={"currency": "CRD"},
                headers=headers,
            )
            response.raise_for_status()
            print(f"Current Wallet Service balance: {response.json()['available_balance']} CRD")
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        print(f"Wallet request failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
