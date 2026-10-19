"""Authenticated client for the Module 4 Wallet credit API."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from jose import jwt

from app.engagement.mock_wallet import WalletInsufficientCreditsError


class WalletServiceError(RuntimeError):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class WalletServiceClient:
    """Calls Alpha's authenticated service endpoint using Arena credit units."""

    def __init__(self):
        self.base_url = os.getenv("WALLET_SERVICE_URL", "http://127.0.0.1:8004").rstrip("/")
        self.secret = os.getenv("WALLET_SERVICE_JWT_SECRET", "")
        self.api_key = os.getenv("WALLET_SERVICE_API_KEY", "")
        self.algorithm = os.getenv("WALLET_SERVICE_JWT_ALGORITHM", "HS256")
        self.currency = os.getenv("ARENA_CREDIT_CURRENCY", "CRD")

    def _headers(self, tenant_id: str, idempotency_key: str) -> dict[str, str]:
        if not self.secret or not self.api_key:
            raise WalletServiceError(503, "Wallet service credentials are not configured")
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {"sub": tenant_id, "tenant_id": tenant_id, "role": "service", "iat": now,
             "exp": now + timedelta(minutes=2)},
            self.secret,
            algorithm=self.algorithm,
        )
        return {
            "Authorization": f"Bearer {token}",
            "X-Service-API-Key": self.api_key,
            "Idempotency-Key": idempotency_key,
        }

    async def _post(self, path: str, tenant_id: str, amount: int,
                    idempotency_key: str, reference_id: str = ""):
        headers = self._headers(tenant_id, idempotency_key)
        payload = {"user_id": tenant_id, "amount": str(Decimal(amount)),
                   "currency": self.currency}
        if reference_id:
            payload["reference_id"] = reference_id
        try:
            async with httpx.AsyncClient(timeout=8.0, trust_env=False) as client:
                response = await client.post(f"{self.base_url}{path}", json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise WalletServiceError(503, "Wallet service is unavailable") from exc
        if response.status_code == 402:
            try:
                async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
                    balance_response = await client.get(
                        f"{self.base_url}/wallet/balance/{tenant_id}",
                        params={"currency": self.currency},
                        headers=headers,
                    )
                balance = int(Decimal(str(balance_response.json().get("available_balance", 0))))
            except (httpx.RequestError, ValueError, TypeError):
                balance = 0
            raise WalletInsufficientCreditsError(cost=amount, balance=balance)
        if response.is_error:
            try:
                detail = response.json().get("detail", "Wallet request failed")
            except ValueError:
                detail = "Wallet request failed"
            raise WalletServiceError(response.status_code, str(detail))
        return response.json()

    async def debit(self, tenant_id: str, amount: int, idempotency_key: str,
                    reason: str, module_source: str = "mod4"):
        del reason, module_source
        return await self._post("/wallet/debit", tenant_id, amount, idempotency_key)

    async def credit(self, tenant_id: str, amount: int, idempotency_key: str,
                     reason: str, module_source: str = "mod4"):
        del reason, module_source
        return await self._post("/wallet/refund", tenant_id, amount, idempotency_key,
                                reference_id=idempotency_key.split(":")[-2])
