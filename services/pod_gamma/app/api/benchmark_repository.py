"""Database-backed benchmark reads. No runtime cohort fixtures are used."""

from sqlalchemy import text

from app.db import SessionLocal


async def get_benchmark_aggregate(
    industry: str,
    region: str,
    size_band: str,
) -> dict | None:
    query = text(
        """
        SELECT industry, region, size_band, peer_count,
               peer_25th, peer_median, peer_75th
        FROM benchmark_aggregate
        WHERE industry = :industry AND region = :region AND size_band = :size_band
        LIMIT 1
        """
    )
    async with SessionLocal() as session:
        result = await session.execute(
            query,
            {"industry": industry, "region": region, "size_band": size_band},
        )
        row = result.mappings().first()
        return dict(row) if row else None


async def get_available_benchmark_cohorts(min_peer_count: int) -> list[dict]:
    query = text(
        """
        SELECT industry, region, size_band, peer_count
        FROM benchmark_aggregate
        WHERE industry <> 'ALL' AND peer_count >= :minimum
        ORDER BY industry, region, size_band
        """
    )
    async with SessionLocal() as session:
        result = await session.execute(query, {"minimum": min_peer_count})
        return [dict(row) for row in result.mappings().all()]


async def get_global_benchmark() -> dict | None:
    query = text(
        """
        SELECT industry, region, size_band, peer_count,
               peer_25th, peer_median, peer_75th
        FROM benchmark_aggregate
        WHERE industry = 'ALL' AND region = 'GLOBAL' AND size_band = 'ALL'
        LIMIT 1
        """
    )
    async with SessionLocal() as session:
        result = await session.execute(query)
        row = result.mappings().first()
        return dict(row) if row else None


async def get_benchmark_history(tenant_id: str) -> list[dict]:
    query = text(
        """
        SELECT tenant_id, p25, median, p75,
               CURRENT_DATE - snapshot_date AS days_ago
        FROM benchmark_historical
        WHERE tenant_id = :tenant_id
        ORDER BY snapshot_date DESC
        """
    )
    async with SessionLocal() as session:
        result = await session.execute(query, {"tenant_id": tenant_id})
        return [dict(row) for row in result.mappings().all()]
