"""Request guards for the API and security headers for every response."""

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "wifi-portal"

SECURITY_HEADERS = {
    "Content-Security-Policy": ("default-src 'self'; img-src 'self' data:; style-src 'self'; "
                                "frame-ancestors 'none'; base-uri 'none'; form-action 'self'"),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


def _deny(status: int, message: str) -> JSONResponse:
    return JSONResponse({"detail": message}, status_code=status)


class GuardMiddleware(BaseHTTPMiddleware):
    """Blocks cross-site requests and oversized bodies on /api, and adds security headers.

    Cross-site protection: the session cookie is SameSite=Strict, unsafe requests must carry a
    custom header (browsers won't send one cross-site without a CORS preflight, which we never
    allow), and Origin, when present, must match the Host.
    """

    def __init__(self, app, max_body_bytes: int):
        super().__init__(app)
        self.max_body_bytes = max_body_bytes

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method in UNSAFE_METHODS:
            if denied := self._check(request):
                return self._with_headers(denied)
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return self._with_headers(response)

    def _check(self, request: Request) -> JSONResponse | None:
        if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
            return _deny(403, "Request blocked (missing portal header).")
        origin = request.headers.get("origin")
        host = request.headers.get("host", "")
        if origin is not None and origin not in (f"http://{host}", f"https://{host}"):
            return _deny(403, "Request blocked (cross-site).")
        if request.headers.get("sec-fetch-site") not in (None, "same-origin", "none"):
            return _deny(403, "Request blocked (cross-site).")
        length = request.headers.get("content-length")
        if length is None:
            if request.headers.get("transfer-encoding"):
                return _deny(411, "Content-Length required.")
            return None
        if not length.isdigit() or int(length) > self.max_body_bytes:
            return _deny(413, "Request too large.")
        return None

    @staticmethod
    def _with_headers(response):
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response
