import time
import unittest
import uuid
import shutil

from core.schemas.workflow import (
    WorkflowPlannerPlan,
    WorkflowPlannerRequest,
    WorkflowRuntimeConfig,
    WorkflowRunDetail,
    WorkflowRunRequest,
)
from core.workflows import WorkflowService
from core.workflows.storage import get_workflow_run_storage_dir, persist_workflow_run


class FakeWorkflowPlanner:
    async def plan(self, *, goal, workflows):
        return WorkflowPlannerPlan(
            workflow_name='text_insights',
            input_payload={'text': f'根据目标生成的测试文本：{goal}'},
            reason='目标明显是在做文本分析，所以选择 text_insights。',
            confidence='high',
            missing_information=[],
            warnings=['这是测试 planner 生成的固定输入。'],
            candidate_workflows=['text_insights', 'skill_blueprint'],
        )


class WorkflowServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_plan_run_returns_structured_plan(self) -> None:
        service = WorkflowService(planner=FakeWorkflowPlanner())

        response = await service.plan_run(WorkflowPlannerRequest(goal='分析一段文本内容'))

        self.assertEqual(response.plan.workflow_name, 'text_insights')
        self.assertEqual(response.plan.confidence, 'high')
        self.assertIn('skill_blueprint', response.plan.candidate_workflows)

    async def test_start_agent_run_persists_planner_metadata(self) -> None:
        service = WorkflowService(planner=FakeWorkflowPlanner())

        detail = await service.start_agent_run(WorkflowPlannerRequest(goal='分析一段文本内容'))
        self.assertEqual(detail.launch_mode, 'agent')
        self.assertEqual(detail.workflow_name, 'text_insights')
        self.assertEqual(detail.planner_confidence, 'high')
        self.assertIsNotNone(detail.user_goal)

        for _ in range(50):
            current = service.get_run(detail.run_id)
            if current.status in {'completed', 'error'}:
                break
            time.sleep(0.02)

        current = service.get_run(detail.run_id)
        self.assertEqual(current.status, 'completed')
        self.assertIsNotNone(current.output_payload)

    async def test_start_manual_run_marks_manual_mode(self) -> None:
        service = WorkflowService(planner=FakeWorkflowPlanner())

        detail = await service.start_run(
            WorkflowRunRequest(
                workflow_name='text_insights',
                input_payload={'text': 'hello workflow'},
            )
        )

        self.assertEqual(detail.launch_mode, 'manual')
        self.assertIsNone(detail.user_goal)

    async def test_restore_completed_run_from_disk(self) -> None:
        service = WorkflowService(planner=FakeWorkflowPlanner())
        detail = await service.start_run(
            WorkflowRunRequest(
                workflow_name='text_insights',
                input_payload={'text': 'hello workflow persistence'},
            )
        )
        self.addCleanup(lambda: shutil.rmtree(get_workflow_run_storage_dir(detail.run_id), ignore_errors=True))

        for _ in range(50):
            current = service.get_run(detail.run_id)
            if current.status in {'completed', 'error'}:
                break
            time.sleep(0.02)

        restored_service = WorkflowService(planner=FakeWorkflowPlanner())
        restored = restored_service.get_run(detail.run_id)

        self.assertEqual(restored.status, 'completed')
        self.assertIsNotNone(restored.output_payload)

    async def test_restore_running_run_marks_error_after_restart(self) -> None:
        run_id = str(uuid.uuid4())
        detail = WorkflowRunDetail(
            run_id=run_id,
            workflow_name='text_insights',
            status='running',
            created_at='2026-04-19T00:00:00+00:00',
            updated_at='2026-04-19T00:00:10+00:00',
            launch_mode='manual',
            user_goal=None,
            planner_reason=None,
            planner_confidence=None,
            planner_warnings=[],
            planner_missing_information=[],
            runtime=WorkflowRuntimeConfig(),
            attempt_count=1,
            project_root='/tmp/project',
            trace_log_dir='/tmp/trace',
            input_payload={'text': 'hello'},
            output_payload=None,
            error=None,
        )
        persist_workflow_run(detail)
        self.addCleanup(lambda: shutil.rmtree(get_workflow_run_storage_dir(run_id), ignore_errors=True))

        restored_service = WorkflowService(planner=FakeWorkflowPlanner())
        restored = restored_service.get_run(run_id)

        self.assertEqual(restored.status, 'error')
        self.assertIn('服务重启', restored.error or '')


if __name__ == '__main__':
    unittest.main()
