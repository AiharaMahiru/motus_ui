from pathlib import Path

from dotenv import load_dotenv

from .tracing import ensure_tracing_env_defaults


def load_project_env() -> None:
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env", override=True)
    ensure_tracing_env_defaults()


load_project_env()
