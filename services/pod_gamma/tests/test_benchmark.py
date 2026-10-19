from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.api import benchmark as benchmark_api
from app.main import app


client = TestClient(app)

# Representative records belong to the test suite only. Runtime data is read
# from benchmark_aggregate and benchmark_historical in Pod Gamma's database.
TEST_COHORTS = [
    {"industry": "Technology", "region": "West", "size_band": "Large", "peer_count": 20, "peer_25th": 65.2, "peer_median": 76.4, "peer_75th": 88.1},
    {"industry": "Technology", "region": "West", "size_band": "Medium", "peer_count": 18, "peer_25th": 61.3, "peer_median": 72.5, "peer_75th": 84.7},
    {"industry": "Technology", "region": "North", "size_band": "Large", "peer_count": 16, "peer_25th": 62.5, "peer_median": 75.1, "peer_75th": 87.3},
    {"industry": "Finance", "region": "West", "size_band": "Large", "peer_count": 15, "peer_25th": 60.1, "peer_median": 71.2, "peer_75th": 83.5},
    {"industry": "Finance", "region": "North", "size_band": "Medium", "peer_count": 19, "peer_25th": 64.2, "peer_median": 73.6, "peer_75th": 85.4},
    {"industry": "Healthcare", "region": "West", "size_band": "Large", "peer_count": 17, "peer_25th": 63.4, "peer_median": 74.8, "peer_75th": 86.2},
    {"industry": "Healthcare", "region": "South", "size_band": "Medium", "peer_count": 15, "peer_25th": 58.7, "peer_median": 69.9, "peer_75th": 81.5},
    {"industry": "Finance", "region": "West", "size_band": "Small", "peer_count": 8, "peer_25th": 55.0, "peer_median": 63.0, "peer_75th": 72.0},
    {"industry": "ALL", "region": "GLOBAL", "size_band": "ALL", "peer_count": 100, "peer_25th": 60.0, "peer_median": 72.0, "peer_75th": 84.0},
]
TEST_HISTORY = [
    {"tenant_id": "TEST-TENANT", "p25": 60.2, "median": 71.4, "p75": 82.1, "days_ago": 30},
    {"tenant_id": "TEST-TENANT", "p25": 58.3, "median": 69.5, "p75": 80.7, "days_ago": 60},
    {"tenant_id": "TEST-TENANT", "p25": 55.8, "median": 67.2, "p75": 78.9, "days_ago": 90},
]


@pytest.fixture(autouse=True)
def isolated_benchmark_repository(monkeypatch):
    """Keep deterministic fixture records out of the running service."""
    async def get_aggregate(industry, region, size_band):
        return next(
            (
                deepcopy(row)
                for row in TEST_COHORTS
                if (row["industry"], row["region"], row["size_band"])
                == (industry, region, size_band)
            ),
            None,
        )

    async def get_cohorts(minimum):
        return [
            {key: row[key] for key in ("industry", "region", "size_band", "peer_count")}
            for row in TEST_COHORTS
            if row["industry"] != "ALL" and row["peer_count"] >= minimum
        ]

    async def get_global():
        return deepcopy(TEST_COHORTS[-1])

    async def get_history(tenant_id):
        return deepcopy(TEST_HISTORY) if tenant_id == "TEST-TENANT" else []

    monkeypatch.setattr(benchmark_api, "get_benchmark_aggregate", get_aggregate)
    monkeypatch.setattr(benchmark_api, "get_available_benchmark_cohorts", get_cohorts)
    monkeypatch.setattr(benchmark_api, "get_global_benchmark", get_global)
    monkeypatch.setattr(benchmark_api, "get_benchmark_history", get_history)


def test_benchmark_cohorts_only_lists_groups_meeting_minimum():
    response = client.get("/benchmark/cohorts")

    assert response.status_code == 200
    body = response.json()
    assert body["minimum_peer_count"] == 10
    assert body["label"] == "Seeded demo data (synthetic)"
    assert len(body["cohorts"]) == 7
    assert all(cohort["peer_count"] >= body["minimum_peer_count"] for cohort in body["cohorts"])
    assert not any(cohort["size_band"] == "Small" for cohort in body["cohorts"])


def test_benchmark_returns_persisted_aggregate_contract():
    response = client.post(
        "/benchmark",
        json={"industry": "Technology", "region": "West", "size_band": "Large"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["peer_count"] == 20
    assert result["percentile"] == 50.0
    assert result["peer_25th"] == 65.2
    assert result["peer_median"] == 76.4
    assert result["peer_75th"] == 88.1
    assert result["label"] == "Seeded demo data (synthetic)"


def test_benchmark_quantiles_are_ordered_for_all_supported_cohorts():
    cohorts = client.get("/benchmark/cohorts").json()["cohorts"]

    for cohort in cohorts:
        response = client.post("/benchmark", json=cohort)
        assert response.status_code == 200
        result = response.json()
        assert 0 <= result["peer_25th"] <= result["peer_median"] <= result["peer_75th"] <= 100
        assert result["percentile"] == 50.0


def test_benchmark_compare_insufficient_peers():
    response = client.post(
        "/benchmark/compare",
        json={"industry": "Finance", "region": "West", "size_band": "Small"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "insufficient peers"


def test_benchmark_compare_valid_cohort():
    response = client.post(
        "/benchmark/compare",
        json={"industry": "Technology", "region": "West", "size_band": "Large"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["regional_peer_count"] == 20
    assert result["regional_median"] == 76.4
    assert result["global_peer_count"] == 100
    assert result["global_median"] == 72.0
    assert result["median_difference"] == 4.4
    assert result["label"] == "Seeded demo data (synthetic)"


def test_benchmark_trend_comes_from_repository_history():
    response = client.get("/benchmark/trend/TEST-TENANT")

    assert response.status_code == 200
    result = response.json()
    assert [item["days_ago"] for item in result["trend"]] == [30, 60, 90]
    assert result["label"] == "Seeded demo data (synthetic)"


def test_benchmark_compare_unknown_cohort_returns_not_found():
    response = client.post(
        "/benchmark/compare",
        json={"industry": "Unknown", "region": "Unknown", "size_band": "Unknown"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "regional benchmark cohort not found"


def test_empty_database_produces_no_cohorts(monkeypatch):
    async def empty_cohorts(_minimum):
        return []

    monkeypatch.setattr(benchmark_api, "get_available_benchmark_cohorts", empty_cohorts)
    response = client.get("/benchmark/cohorts")

    assert response.status_code == 200
    assert response.json()["cohorts"] == []
