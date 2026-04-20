import json
import time
import unittest
import uuid
import shutil
from unittest.mock import patch

from motus.memory import BasicMemory, CompactionMemory
from pydantic import BaseModel

from core.memory.store import setup_memory
from core.config.paths import TOOL_PLUGINS_DIR, WORKFLOW_PLUGINS_DIR
from core.schemas.memory import MemoryConfig
from core.schemas.workflow import WorkflowRunRequest, WorkflowRuntimeConfig
from core.chat import get_conversation_log_path
from core.tools.host import ToolBuildContext, build_dynamic_tool_map
from core.workflows import WorkflowService
from core.workflows.registry import WorkflowDefinition, get_workflow_catalog
from core.workflows.storage import get_workflow_run_storage_dir


class MemoryRuntimeTests(unittest.TestCase):
    def test_basic_memory_restores_messages_from_jsonl_log(self) -> None:
        session_id = f"memory-basic-{uuid.uuid4().hex[:8]}"
        log_path = get_conversation_log_path(session_id)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(
            "\n".join(
                [
                    json.dumps({"type": "session_meta", "session_id": session_id}, ensure_ascii=False),
                    json.dumps(
                        {
                            "type": "message",
                            "message": {"role": "user", "content": "你好，恢复我"},
                        },
                        ensure_ascii=False,
                    ),
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        memory = setup_memory(
            session_id=session_id,
            settings=MemoryConfig(type="basic"),
        )

        self.assertIsInstance(memory, BasicMemory)
        self.assertEqual(len(memory.messages), 1)
        self.assertEqual(memory.messages[0].content, "你好，恢复我")

    def test_compact_memory_still_uses_compaction_memory(self) -> None:
        memory = setup_memory(
            session_id=f"memory-compact-{uuid.uuid4().hex[:8]}",
            settings=MemoryConfig(type="compact"),
        )

        self.assertIsInstance(memory, CompactionMemory)


class _WorkflowInput(BaseModel):
    value: str = "demo"


class WorkflowRuntimePolicyTests(unittest.IsolatedAsyncioTestCase):
    async def test_workflow_retries_until_success(self) -> None:
        attempts = {"count": 0}

        def flaky_runner(_input: _WorkflowInput) -> dict:
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise RuntimeError("first failure")
            return {"status": "ok"}

        definition = WorkflowDefinition(
            name="flaky",
            description="flaky workflow",
            input_model=_WorkflowInput,
            runner=flaky_runner,
        )

        with patch("core.workflows.service.get_workflow", return_value=definition):
            service = WorkflowService()
            detail = await service.start_run(
                WorkflowRunRequest(
                    workflow_name="flaky",
                    input_payload={"value": "x"},
                    runtime=WorkflowRuntimeConfig(max_retries=1, retry_delay_seconds=0.01),
                )
            )

            while service.get_run(detail.run_id).status in {"queued", "running"}:
                time.sleep(0.01)

            finished = service.get_run(detail.run_id)
            self.assertEqual(finished.status, "completed")
            self.assertEqual(finished.attempt_count, 2)
            self.assertEqual(finished.output_payload, {"status": "ok"})

    async def test_workflow_timeout_marks_run_as_error(self) -> None:
        def slow_runner(_input: _WorkflowInput) -> dict:
            time.sleep(0.2)
            return {"status": "slow"}

        definition = WorkflowDefinition(
            name="slow",
            description="slow workflow",
            input_model=_WorkflowInput,
            runner=slow_runner,
        )

        with patch("core.workflows.service.get_workflow", return_value=definition):
            service = WorkflowService()
            detail = await service.start_run(
                WorkflowRunRequest(
                    workflow_name="slow",
                    input_payload={"value": "x"},
                    runtime=WorkflowRuntimeConfig(timeout_seconds=0.05),
                )
            )

            while service.get_run(detail.run_id).status in {"queued", "running"}:
                time.sleep(0.01)

            finished = service.get_run(detail.run_id)
            self.assertEqual(finished.status, "error")
            self.assertEqual(finished.attempt_count, 1)
            self.assertIn("timed out", finished.error or "")

    async def test_workflow_can_be_cancelled(self) -> None:
        started = {"value": False}

        def slow_runner(_input: _WorkflowInput) -> dict:
            started["value"] = True
            time.sleep(0.1)
            return {"status": "late"}

        definition = WorkflowDefinition(
            name="cancel-me",
            description="cancel workflow",
            input_model=_WorkflowInput,
            runner=slow_runner,
        )

        with patch("core.workflows.service.get_workflow", return_value=definition):
            service = WorkflowService()
            detail = await service.start_run(
                WorkflowRunRequest(
                    workflow_name="cancel-me",
                    input_payload={"value": "x"},
                    runtime=WorkflowRuntimeConfig(),
                )
            )

            cancelled = service.cancel_run(detail.run_id)
            self.assertEqual(cancelled.status, "cancelled")
            self.assertIn("取消", cancelled.error or "")
            while service.get_run(detail.run_id).status not in {"cancelled", "completed", "error", "terminated"}:
                time.sleep(0.01)
            self.assertEqual(service.get_run(detail.run_id).status, "cancelled")


class DynamicHostTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        TOOL_PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
        WORKFLOW_PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
        self.tool_plugin = TOOL_PLUGINS_DIR / f"dynamic_tool_{uuid.uuid4().hex[:8]}.py"
        self.workflow_plugin = WORKFLOW_PLUGINS_DIR / f"dynamic_workflow_{uuid.uuid4().hex[:8]}.py"

    def tearDown(self) -> None:
        if self.tool_plugin.exists():
            self.tool_plugin.unlink()
        if self.workflow_plugin.exists():
            self.workflow_plugin.unlink()

    async def test_dynamic_tool_plugin_can_be_discovered_and_called(self) -> None:
        self.tool_plugin.write_text(
            """
from motus.tools import tool

def register_tools(register):
    @tool(name="dynamic_echo")
    async def dynamic_echo(text: str) -> str:
        return text.upper()

    register(
        name="dynamic_echo",
        factory=lambda: dynamic_echo,
        group="external",
        source="filesystem",
        persistence="filesystem",
    )
""".strip(),
            encoding="utf-8",
        )

        tool_map = build_dynamic_tool_map(
            ToolBuildContext(
                sandbox_runtime=None,
                sandbox_config=None,
                session_scoped_todo=True,
                human_in_the_loop=False,
            )
        )

        self.assertIn("dynamic_echo", tool_map)
        result = await tool_map["dynamic_echo"](text="hello")
        self.assertEqual(result, "HELLO")

    async def test_dynamic_workflow_plugin_can_run_and_survive_service_restart(self) -> None:
        self.workflow_plugin.write_text(
            """
from pydantic import BaseModel
from core.workflows.registry import WorkflowDefinition

class DynamicInput(BaseModel):
    text: str

def run_dynamic(input_model: DynamicInput) -> dict:
    return {"echo": input_model.text.upper()}

def register_workflows(register):
    register(
        WorkflowDefinition(
            name="dynamic_echo_flow",
            description="动态 workflow",
            input_model=DynamicInput,
            runner=run_dynamic,
            source="filesystem",
            persistence="filesystem",
        )
    )
""".strip(),
            encoding="utf-8",
        )

        service = WorkflowService()
        definitions = {item.name for item in service.list_definitions()}
        self.assertIn("dynamic_echo_flow", definitions)

        detail = await service.start_run(
            WorkflowRunRequest(
                workflow_name="dynamic_echo_flow",
                input_payload={"text": "agent"},
                runtime=WorkflowRuntimeConfig(),
            )
        )
        self.addCleanup(lambda: shutil.rmtree(get_workflow_run_storage_dir(detail.run_id), ignore_errors=True))

        while service.get_run(detail.run_id).status in {"queued", "running"}:
            time.sleep(0.01)

        finished = service.get_run(detail.run_id)
        self.assertEqual(finished.status, "completed")
        self.assertEqual(finished.output_payload, {"echo": "AGENT"})

        restored = WorkflowService()
        self.assertEqual(restored.get_run(detail.run_id).status, "completed")
        catalog_names = {item.name for item in get_workflow_catalog().workflows}
        self.assertIn("dynamic_echo_flow", catalog_names)


if __name__ == "__main__":
    unittest.main()
