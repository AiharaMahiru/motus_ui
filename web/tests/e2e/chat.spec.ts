import { expect, test } from '@playwright/test'


test('can create a session and stream a compact step group', async ({ page }) => {
  const token = `WEBUI_STREAM_${Date.now()}`

  await page.goto('/chat?mode=new')
  await page.getByTestId('composer-input').fill(
    `你必须先调用 to_do 工具写入一项 webui smoke 任务，然后最终只返回 ${token}`,
  )
  await page.getByTestId('send-button').click()

  await expect(page.getByText(token)).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId('composer-input')).toHaveValue('', { timeout: 30_000 })
})
