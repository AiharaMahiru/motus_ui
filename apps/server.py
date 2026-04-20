import os
import uvicorn

from core.config.env import load_project_env


load_project_env()


def main() -> None:
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "8000"))
    uvicorn.run("core.servers.api:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
