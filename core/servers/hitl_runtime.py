from __future__ import annotations

from motus.serve.schemas import SessionStatus

from core.config.paths import PROJECT_ROOT
from core.schemas.session import InterruptInfo, SessionCreateRequest, SessionDetail, SessionSummary
from core.tracing import get_session_trace_dir

from .hitl_telemetry import default_context_window_usage, load_hitl_session_telemetry
from .hitl_state import PersistentSession


def build_interrupt_infos(session: PersistentSession) -> list[InterruptInfo] | None:
    """把 Motus interrupt 结构转成统一后端可直接消费的模型。"""

    if session.status != SessionStatus.interrupted or not session.pending_interrupts:
        return None

    interrupts: list[InterruptInfo] = []
    for interrupt_id, message in session.pending_interrupts.items():
        payload = dict(message.payload or {})
        interrupt_type = str(
            payload.get("type")
            or payload.get("kind")
            or payload.get("name")
            or "approval"
        )
        interrupts.append(
            InterruptInfo(
                interrupt_id=interrupt_id,
                type=interrupt_type,
                payload=payload,
                resumable=True,
            )
        )
    return interrupts or None


def reconcile_persistent_session(session: PersistentSession) -> PersistentSession:
    """在读 session 摘要前做一次轻量修正，避免残留 running/interrupted。"""

    session.reconcile_runtime_state()
    return session


def build_hitl_session_summary(
    session: PersistentSession,
    config: SessionCreateRequest,
) -> SessionSummary:
    """把 HITL session + config 合成为统一的 SessionSummary。"""

    session = reconcile_persistent_session(session)
    telemetry = load_hitl_session_telemetry(session.session_id)
    return SessionSummary(
        session_id=session.session_id,
        title=config.title,
        status=session.status.value if isinstance(session.status, SessionStatus) else session.status,
        model_name=config.model_name,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(session.state),
        total_usage=telemetry.total_usage if telemetry is not None else {},
        total_cost_usd=telemetry.total_cost_usd if telemetry is not None else None,
        last_error=session.error,
        multi_agent_enabled=config.multi_agent.enabled(),
        specialist_count=config.multi_agent.specialist_count(),
        project_root=str(PROJECT_ROOT),
        trace_log_dir=str(get_session_trace_dir(session.session_id)),
    )


def build_hitl_session_detail(
    session: PersistentSession,
    config: SessionCreateRequest,
) -> SessionDetail:
    """构造统一 SessionDetail，供 WebUI / 其他 UI 直接复用。"""

    summary = build_hitl_session_summary(session, config)
    telemetry = load_hitl_session_telemetry(session.session_id)
    return SessionDetail(
        **summary.model_dump(),
        system_prompt=config.system_prompt,
        provider=config.provider,
        model_client=config.model_client,
        pricing_model=config.pricing_model,
        cache_policy=config.cache_policy,
        max_steps=config.max_steps,
        timeout_seconds=config.timeout_seconds,
        thinking=config.thinking,
        enabled_tools=list(config.enabled_tools),
        mcp_servers=list(config.mcp_servers),
        multi_agent=config.multi_agent,
        sandbox=config.sandbox,
        human_in_the_loop=config.human_in_the_loop,
        approval_tool_names=list(config.approval_tool_names),
        input_guardrails=list(config.input_guardrails),
        output_guardrails=list(config.output_guardrails),
        tool_guardrails=list(config.tool_guardrails),
        response_format=config.response_format,
        memory=config.memory,
        context_window=telemetry.context_window if telemetry is not None else default_context_window_usage(),
        last_response=session.response,
        interrupts=build_interrupt_infos(session),
        resume_supported=session.status == SessionStatus.interrupted and bool(session.pending_interrupts),
        resume_blocked_reason=(
            session.error
            if session.status != SessionStatus.interrupted and session.error and session.pending_interrupts
            else None
        ),
    )
