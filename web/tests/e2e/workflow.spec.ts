import { expect, test } from '@playwright/test'


test('can run a workflow and render its output', async ({ page }) => {
  await page.goto('/workflows')
  await page.getByLabel('展开左侧栏').click()
  await expect(page.locator('.sidebar-section', { hasText: '可用定义' }).getByRole('button', { name: 'text_insights' })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: '启动 run' }).click()

  await expect(page.getByTestId('workflow-output-json')).toContainText('"keywords"', { timeout: 120_000 })
})


test('can submit an agent orchestration goal from the bottom composer', async ({ page }) => {
  const fakeRun = {
    run_id: 'agent-smoke-run',
    workflow_name: 'text_insights',
    status: 'completed',
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:01Z',
    launch_mode: 'agent',
    user_goal: '请自动分析这段产品文案',
    planner_reason: '目标是文本分析，因此选择 text_insights。',
    planner_confidence: 'high',
    planner_warnings: [],
    planner_missing_information: [],
    project_root: '/opt/Agent',
    trace_log_dir: '/opt/Agent/runtime/traces/workflows/agent-smoke-run',
    input_payload: {
      text: '这是一段产品文案，用于 smoke test。',
    },
    output_payload: {
      keywords: ['产品文案', 'smoke', 'test'],
      preview: ['这是一段产品文案，用于 smoke test。'],
    },
    error: null,
  }

  await page.route('**/api/workflows/agent-runs', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: fakeRun,
      status: 202,
    })
  })
  await page.route('**/api/workflows/runs/agent-smoke-run', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: fakeRun,
      status: 200,
    })
  })

  await page.goto('/workflows')
  await page.getByTestId('workflow-goal-input').fill('请自动分析这段产品文案')
  await page.getByTestId('workflow-agent-run-button').click()

  await expect(page.getByText('agent 编排')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('workflow-output-json')).toContainText('"keywords"', { timeout: 30_000 })
})
