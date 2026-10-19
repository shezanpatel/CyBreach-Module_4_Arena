"""JWT authentication and tenant ownership checks for Pod Beta."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    subject: str
    tenant_id: str
    role: str


def current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Principal:
    secret = os.getenv("BETA_JWT_SECRET", "")
    algorithm = os.getenv("BETA_JWT_ALGORITHM", "HS256")
    if not secret:
        raise HTTPException(status_code=503, detail="Pod Beta JWT secret is not configured")
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer token required", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = jwt.decode(credentials.credentials, secret, algorithms=[algorithm], options={"require_exp": True})
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}) from exc
    tenant_id = claims.get("tenant_id") or claims.get("tid") or claims.get("org_id")
    if not isinstance(tenant_id, str) or not tenant_id.strip():
        raise HTTPException(status_code=401, detail="Token is missing tenant_id")
    principal = Principal(str(claims.get("sub") or tenant_id), tenant_id, str(claims.get("role") or "user").lower())
    request.state.principal = principal
    return principal


def require_tenant(principal: Principal, tenant_id: str) -> None:
    if principal.role not in {"admin", "service"} and principal.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access is forbidden")


def authenticated_request(request: Request) -> Principal:
    """Compatibility helper for middleware integrations."""
    return request.state.principal
