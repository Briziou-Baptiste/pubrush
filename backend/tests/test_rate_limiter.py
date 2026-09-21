import pytest
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from app.core.rate_limiter import InMemoryRateLimiter


def test_rate_limiter_throttling():
    app = FastAPI()
    limiter = InMemoryRateLimiter(requests_limit=3, window_seconds=60)

    @app.get("/limited", dependencies=[Depends(limiter)])
    def limited_endpoint():
        return {"ok": True}

    # Use a custom client that doesn't trigger TESTING=true bypass
    with pytest.MonkeyPatch.context() as mp:
        mp.delenv("TESTING", raising=False)
        client = TestClient(app)

        # 3 requests allowed
        r1 = client.get("/limited")
        assert r1.status_code == 200
        r2 = client.get("/limited")
        assert r2.status_code == 200
        r3 = client.get("/limited")
        assert r3.status_code == 200

        # 4th request blocked with 429
        r4 = client.get("/limited")
        assert r4.status_code == 429
        assert "Trop de requêtes" in r4.json()["detail"]
        assert "Retry-After" in r4.headers
