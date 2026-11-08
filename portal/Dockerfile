# ---- 1. Build the React app ----
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---- 2. Python app with uv ----
FROM python:3.13-slim AS app
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORTAL_STATIC_DIR=/srv/portal/web \
    PORTAL_DB_PATH=/var/lib/portal/portal.db \
    RADIUS_DATA_DIR=/mnt/radius \
    PORTAL_ADMIN_PORT=8080 \
    PORTAL_SELF_SERVICE_PORT=8081

WORKDIR /app
# Dependencies first, so code changes don't reinstall them.
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/ ./
COPY --from=web /web/dist /srv/portal/web

# Non-root. UID 1000 matches the usual first user on a Linux host (e.g. a Raspberry Pi),
# so the shared data folder stays writable there too; Docker Desktop on Windows doesn't care.
RUN useradd --uid 1000 --no-create-home --shell /usr/sbin/nologin portal \
 && mkdir -p /var/lib/portal \
 && chown portal:portal /var/lib/portal
USER portal

# 8080: admin portal. 8081: Wi-Fi users' change-password page only.
EXPOSE 8080 8081
CMD ["python", "-m", "app.serve"]
