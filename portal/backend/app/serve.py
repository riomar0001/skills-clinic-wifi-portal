"""Run the portal: the admin listener, plus the self-service listener when PORTAL_SELF_SERVICE_PORT is set.

    python -m app.serve

Both listeners share one app (and database); the app tells them apart by the port a request arrived on.
"""

import asyncio

import uvicorn

from app.core.config import load_settings
from app.main import create_app

STARTUP_TIMEOUT_SECONDS = 120


def _config(app, port: int, lifespan: str) -> uvicorn.Config:
    return uvicorn.Config(app, host="0.0.0.0", port=port, lifespan=lifespan, server_header=False,
                          timeout_keep_alive=5, limit_concurrency=100, proxy_headers=False)


async def main() -> None:
    settings = load_settings()
    app = create_app(settings)
    admin = uvicorn.Server(_config(app, settings.admin_port, lifespan="on"))
    servers = [admin]
    tasks = [asyncio.create_task(admin.serve())]

    if settings.self_service_port:
        # Start the second listener only after startup (migrations, setup code) has finished.
        waited = 0.0
        while not admin.started and not tasks[0].done() and waited < STARTUP_TIMEOUT_SECONDS:
            await asyncio.sleep(0.1)
            waited += 0.1
        if admin.started:
            self_service = uvicorn.Server(_config(app, settings.self_service_port, lifespan="off"))
            servers.append(self_service)
            tasks.append(asyncio.create_task(self_service.serve()))

    # Whichever stops first (signal or failure), stop the other too.
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for server in servers:
        server.should_exit = True
    await asyncio.gather(*pending, return_exceptions=True)
    for task in done:
        task.result()  # re-raise a startup failure so the container exits non-zero


if __name__ == "__main__":
    asyncio.run(main())
