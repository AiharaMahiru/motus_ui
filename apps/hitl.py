from core.config.env import load_project_env
from core.servers.hitl import main


load_project_env()


if __name__ == "__main__":
    main()
