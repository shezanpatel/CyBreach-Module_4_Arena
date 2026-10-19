from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt
from httpx import ASGITransport, AsyncClient

from app.core.security import current_principal
from app.engagement.api import app as engagement_app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=engagement_app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_engagement_api_requires_valid_token_and_tenant_scope(client, monkeypatch):
    secret = "beta-security-test-secret"
    monkeypatch.setenv("BETA_JWT_SECRET", secret)
    engagement_app.dependency_overrides.pop(current_principal, None)
    try:
        unauthenticated = await client.get("/engagement/recommendations/tenant-a")
        assert unauthenticated.status_code == 401

        token = jwt.encode(
            {
                "sub": "user-a",
                "tenant_id": "tenant-a",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            },
            secret,
            algorithm="HS256",
        )
        allowed = await client.get(
            "/engagement/recommendations/tenant-a",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert allowed.status_code == 200

        forbidden = await client.get(
            "/engagement/recommendations/tenant-b",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert forbidden.status_code == 403
    finally:
        engagement_app.dependency_overrides.pop(current_principal, None)
