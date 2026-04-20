import { expect, test } from '@playwright/test'


const realHitlEnabled = process.env.PLAYWRIGHT_REAL_HITL === '1'
const realHitlModel = process.env.PLAYWRIGHT_REAL_HITL_MODEL || 'gpt-5.4-mini'

test.describe('real HITL webui', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.skip(!realHitlEnabled, '未启用真实 HITL WebUI 联调')
    await page.goto('/chat?mode=new')
    await page.getByLabel('展开右侧栏').click()
    await expect(page.getByTestId('session-system-prompt-input')).toBeVisible({ timeout: 30_000 })
  })

  test('can complete a real user_input interrupt from webui', async ({ page }) => {
    const token = `REAL_WEBUI_HITL_USER_${Date.now()}`

    await page.getByTestId('session-model-input').fill(realHitlModel)
    await page.getByTestId('hitl-question-preset-button').click()
    await expect(page.getByTestId('human-in-the-loop-toggle')).toBeChecked()
    await expect(page.getByTestId('tool-toggle-ask_user_question')).toBeChecked()

    await page.getByTestId('session-system-prompt-input').fill(
      [
        '你是一个真实 HITL WebUI 联调回归助手。',
        '本轮收到用户消息后，必须先调用 ask_user_question。',
        '问题内容必须是“是否继续真实 WebUI HITL 问答联调？”，选项为“继续”和“取消”。',
        `如果用户回答继续，你的最终回复必须原样包含令牌 ${token}。`,
        '除了 ask_user_question，不要调用任何其他工具。',
      ].join(''),
    )
    await page.getByTestId('session-create-button').click()
    await page.waitForURL(/\/chat\/[0-9a-f-]+$/)

    await page.getByTestId('composer-input').fill('开始真实 WebUI HITL 问答联调')
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('interrupt-card')).toBeVisible({ timeout: 180_000 })
    await page.getByRole('button', { name: '继续' }).click()
    await page.getByTestId('interrupt-submit-button').click()

    await expect(page.getByText(token)).toBeVisible({ timeout: 180_000 })
  })

  test('can complete a real tool approval interrupt from webui', async ({ page }) => {
    const token = `REAL_WEBUI_HITL_APPROVAL_${Date.now()}`

    await page.getByTestId('session-model-input').fill(realHitlModel)
    await page.getByTestId('hitl-approval-preset-button').click()
    await expect(page.getByTestId('human-in-the-loop-toggle')).toBeChecked()
    await expect(page.getByTestId('tool-toggle-bash')).toBeChecked()

    await page.getByTestId('session-system-prompt-input').fill(
      [
        '你是一个真实 HITL 审批联调助手。',
        '本轮收到请求后，必须只调用 bash 工具执行如下精确命令：',
        `python -c "print('${token}')"。`,
        '拿到输出后，用一句中文总结，并原样包含该令牌。',
        '不要调用任何其他工具。',
      ].join(''),
    )
    await page.getByTestId('session-create-button').click()
    await page.waitForURL(/\/chat\/[0-9a-f-]+$/)

    await page.getByTestId('composer-input').fill('开始真实 WebUI bash 审批联调')
    await page.getByTestId('send-button').click()

    await expect(page.getByTestId('interrupt-card')).toBeVisible({ timeout: 180_000 })
    await page.getByTestId('interrupt-approve-button').click()

    await expect(page.getByText(token)).toBeVisible({ timeout: 180_000 })
  })
})
