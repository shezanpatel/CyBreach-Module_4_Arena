"""Safe, passive local-lab checks used by the realistic Arena demo."""

from __future__ import annotations

import ipaddress
from datetime import datetime, timezone
from urllib.parse import urlsplit
from uuid import uuid4

import httpx


class LabDemoError(RuntimeError):
    """The configured local lab or Pod Beta flow could not be completed."""

    def __init__(self, message: str, status_code: int = 502):
        self.status_code = status_code
        super().__init__(message)


def validate_local_target(target_url: str) -> str:
    """Accept only an explicit HTTP loopback origin with no redirect path."""
    try:
        parsed = urlsplit(target_url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise LabDemoError("The configured lab URL is invalid") from exc

    if (
        parsed.scheme != "http"
        or not hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in ("", "/")
    ):
        raise LabDemoError("The lab target must be a plain HTTP loopback origin")

    try:
        is_loopback = ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        is_loopback = hostname.lower() == "localhost"
    if not is_loopback:
        raise LabDemoError("The lab target must resolve to localhost or a loopback IP")

    authority = f"{hostname}:{port}" if port else hostname
    return f"http://{authority}"


async def run_local_header_baseline(
    *,
    target_url: str,
    target_name: str,
    beta_url: str,
    tenant_id: str,
    authorization: str,
) -> dict:
    """Read the lab homepage once and submit observed header results to Pod Beta."""
    target = validate_local_target(target_url)
    async with httpx.AsyncClient(
        timeout=8.0,
        follow_redirects=False,
        trust_env=False,
    ) as client:
        try:
            response = await client.get(target)
        except httpx.RequestError as exc:
            raise LabDemoError(f"Could not reach the local lab at {target}") from exc

    if response.is_redirect:
        raise LabDemoError("The lab homepage redirected; configure its final local URL")
    if response.status_code < 200 or response.status_code >= 400:
        raise LabDemoError(f"The lab returned HTTP {response.status_code}")

    header_rules = (
        ("WEB-HEADER-CSP", "Content-Security-Policy", "medium"),
        ("WEB-HEADER-XCTO", "X-Content-Type-Options", "low"),
        ("WEB-HEADER-XFO", "X-Frame-Options", "low"),
        ("WEB-HEADER-REFERRER", "Referrer-Policy", "low"),
        ("WEB-HEADER-PERMISSIONS", "Permissions-Policy", "low"),
    )
    observed_headers = {key.lower(): value for key, value in response.headers.items()}
    checked_at = datetime.now(timezone.utc).isoformat()
    results = []
    for technique_id, header, severity in header_rules:
        value = observed_headers.get(header.lower())
        present = bool(value and value.strip())
        results.append(
            {
                "technique_id": technique_id,
                "verdict": "Detected" if present else "Missed",
                "evidence_ref": f"lab-http:{uuid4().hex}:{header.lower()}",
                "timestamp": checked_at,
                "details": {
                    "header": header,
                    "observed_value": value,
                    "http_status": response.status_code,
                    "target": target,
                },
                "title": (
                    f"{header} configured"
                    if present
                    else f"{header} missing from the lab response"
                ),
                "severity": severity,
                "status": "passed" if present else "finding",
            }
        )

    scope = {
        "assets": [target],
        "techniques": [item[0] for item in header_rules],
        "metadata": {
            "target_name": target_name,
            "assessment": "passive HTTP security-header baseline",
            "request_count": 1,
            "authorization": "configured local loopback lab",
        },
    }
    beta_base = beta_url.rstrip("/")
    async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
        try:
            created = await client.post(
                f"{beta_base}/engagement/create",
                headers={"Authorization": authorization},
                json={
                    "tenant_id": tenant_id,
                    "engagement_type": "quick_scan",
                    "scope": {},
                    "metadata": {"source": "local_lab_demo", "target_name": target_name},
                },
            )
            created.raise_for_status()
            engagement = created.json()
            engagement_id = engagement["engagement_id"]
            scoped = await client.patch(
                f"{beta_base}/engagement/{engagement_id}/scope",
                headers={"Authorization": authorization},
                json={"scope_manifest": scope, "confirmed": True},
            )
            scoped.raise_for_status()
            executing = await client.post(
                f"{beta_base}/engagement/{engagement_id}/execute",
                headers={"Authorization": authorization},
            )
            executing.raise_for_status()
            completed = await client.post(
                f"{beta_base}/engagement/{engagement_id}/complete",
                headers={"Authorization": authorization},
                json={
                    "results": [
                        {
                            key: value
                            for key, value in item.items()
                            if key in {"technique_id", "verdict", "evidence_ref", "timestamp", "details"}
                        }
                        for item in results
                    ],
                    "metadata": {
                        "source": "local_lab_demo",
                        "target_name": target_name,
                        "http_status": response.status_code,
                    },
                },
            )
            completed.raise_for_status()
            beta_result = completed.json()
        except httpx.HTTPStatusError as exc:
            detail = "Pod Beta could not complete the local lab engagement"
            try:
                upstream_detail = exc.response.json().get("detail")
                if upstream_detail:
                    detail = f"Pod Beta: {upstream_detail}"
            except (ValueError, AttributeError):
                pass
            status_code = exc.response.status_code
            if status_code < 400 or status_code >= 500:
                status_code = 502
            raise LabDemoError(detail, status_code=status_code) from exc
        except (httpx.RequestError, KeyError) as exc:
            raise LabDemoError("Pod Beta could not complete the local lab engagement") from exc

    report = beta_result.get("report") or {}
    return {
        "beta_engagement_id": engagement_id,
        "beta_report": report,
        "target": target,
        "target_name": target_name,
        "http_status": response.status_code,
        "results": results,
        "checked_at": checked_at,
    }
