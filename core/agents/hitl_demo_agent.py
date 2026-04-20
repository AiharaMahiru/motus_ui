from __future__ import annotations

from motus.models import ChatMessage


class DemoHitlAgent:
    """最小 HITL demo agent。

    用途只有一个：本地验证 motus serve 的中断/恢复状态机是否真的可用。
    不依赖模型，不依赖外网，worker 收到消息后会直接调用 interrupt()。
    """

    async def run_turn(
        self,
        message: ChatMessage,
        state: list[ChatMessage],
    ) -> tuple[ChatMessage, list[ChatMessage]]:
        from motus.serve.interrupt import interrupt

        resume_value = await interrupt(
            {
                "type": "user_input",
                "questions": [
                    {
                        "question": "是否继续当前操作？",
                        "header": "继续确认",
                        "options": [
                            {"label": "继续", "description": "继续执行当前流程"},
                            {"label": "取消", "description": "终止当前流程"},
                        ],
                    }
                ],
            }
        )
        assistant = ChatMessage.assistant_message(content=f"收到用户回复：{resume_value}")
        return assistant, [*state, message, assistant]


demo_agent = DemoHitlAgent()
