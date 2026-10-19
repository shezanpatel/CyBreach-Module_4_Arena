"""Shared authenticated test principal for Pod Beta API tests."""

import os

import pytest

os.environ.setdefault("BETA_WALLET_MODE", "mock")

from app.campaign.api import app as campaign_app
from app.core.security import Principal, current_principal
from app.engagement.api import app as engagement_app


@pytest.fixture(autouse=True)
def use_test_admin_principal():
    principal = Principal(subject="beta-test-admin", tenant_id="beta-test-tenant", role="admin")
    for app in (campaign_app, engagement_app):
        app.dependency_overrides[current_principal] = lambda principal=principal: principal
    yield
    for app in (campaign_app, engagement_app):
        app.dependency_overrides.pop(current_principal, None)
