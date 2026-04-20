from __future__ import annotations

from motus.serve import AgentServer


def main() -> None:
    server = AgentServer("core.agents.hitl_demo_agent:demo_agent", max_workers=1)
    server.run(host="127.0.0.1", port=8011, log_level="warning")


if __name__ == "__main__":
    main()
