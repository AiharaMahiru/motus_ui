from core.config.env import load_project_env
from core.ui.tui_app import MotusTUIApp


def main() -> None:
    load_project_env()
    MotusTUIApp().run()


if __name__ == "__main__":
    main()
