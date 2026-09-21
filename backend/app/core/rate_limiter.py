import os
import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter.
    Limits each client IP to `requests_limit` requests within `window_seconds`.
    Automatically handles X-Forwarded-For headers when behind reverse proxies / K8s ingress.
    """

    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    def _get_client_identifier(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "127.0.0.1"

    async def __call__(self, request: Request):
        # Skip rate limiting in test environments if requested
        if os.getenv("TESTING", "").lower() == "true":
            return

        client_ip = self._get_client_identifier(request)
        now = time.time()
        client_history = self.requests[client_ip]

        # Evict timestamps older than the sliding window
        while client_history and client_history[0] <= now - self.window_seconds:
            client_history.popleft()

        if len(client_history) >= self.requests_limit:
            retry_after = int(self.window_seconds - (now - client_history[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requêtes. Veuillez patienter avant de réessayer.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        client_history.append(now)

        # Periodically clean up stale IPs to prevent unbounded memory growth
        if len(self.requests) > 5000:
            stale_ips = [
                ip
                for ip, history in self.requests.items()
                if not history or history[-1] <= now - self.window_seconds
            ]
            for ip in stale_ips:
                self.requests.pop(ip, None)
