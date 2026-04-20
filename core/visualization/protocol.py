from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any


CODE_FENCE_PATTERN = re.compile(r"```(?P<lang>[a-zA-Z0-9_-]+)\n(?P<body>.*?)```", re.DOTALL)
SUPPORTED_MERMAID_STARTERS = {
    "flowchart",
    "graph",
    "sequencediagram",
    "statediagram",
    "statediagram-v2",
    "classdiagram",
    "erdiagram",
    "journey",
    "timeline",
    "mindmap",
    "gantt",
    "pie",
    "xychart-beta",
    "quadrantchart",
    "gitgraph",
    "architecture-beta",
    "block-beta",
    "requirementdiagram",
    "kanban",
    "packet-beta",
    "c4context",
}
SUPPORTED_VIZ_TYPES = {
    "line",
    "bar",
    "area",
    "pie",
    "doughnut",
    "scatter",
    "radar",
    "heatmap",
    "funnel",
    "gauge",
    "sankey",
    "candlestick",
}


@dataclass(slots=True)
class VisualizationSanitizeResult:
    content: str
    warnings: list[str]


class VisualizationProtocolService:
    """校验并轻量纠错会话内嵌可视化协议。"""

    def sanitize(self, content: str) -> VisualizationSanitizeResult:
        warnings: list[str] = []

        def replace(match: re.Match[str]) -> str:
            language = (match.group("lang") or "").strip().lower()
            body = (match.group("body") or "").strip()

            if language == "viz":
                sanitized_body, warning = self._sanitize_viz(body)
                if warning:
                    warnings.append(warning)
                if sanitized_body is None:
                    return f"```json\n{body}\n```"
                return f"```viz\n{sanitized_body}\n```"

            if language == "mermaid":
                valid, warning = self._validate_mermaid(body)
                if warning:
                    warnings.append(warning)
                if not valid:
                    return f"```text\n{body}\n```"
                return f"```mermaid\n{body}\n```"

            return match.group(0)

        updated = CODE_FENCE_PATTERN.sub(replace, content)
        if warnings:
            note = "\n\n注：已自动校正部分内嵌图表协议；无法校验通过的图块已降级为普通代码块。"
            if note.strip() not in updated:
                updated = f"{updated.rstrip()}{note}"
        return VisualizationSanitizeResult(content=updated, warnings=warnings)

    def _sanitize_viz(self, body: str) -> tuple[str | None, str | None]:
        try:
            payload = json.loads(body)
        except Exception:
            return None, "viz 代码块不是合法 JSON，已降级为普通代码块"

        normalized = self._normalize_viz_payload(payload)
        if normalized is None:
            return None, "viz 代码块结构无法识别，已降级为普通代码块"

        issues = self._validate_viz_payload(normalized)
        if issues:
            return None, f"viz 代码块未通过校验：{'；'.join(issues[:3])}"

        return json.dumps(normalized, ensure_ascii=False, indent=2), None

    def _normalize_viz_payload(self, payload: Any) -> dict[str, Any] | None:
        if not isinstance(payload, dict):
            return None

        chart_type = str(payload.get("type") or "").strip().lower()
        data = payload.get("data")
        if isinstance(data, dict) and chart_type in {"line", "bar", "area"}:
            labels = data.get("labels")
            datasets = data.get("datasets")
            if isinstance(labels, list) and isinstance(datasets, list):
                return {
                    "type": chart_type,
                    "title": payload.get("title"),
                    "subtitle": payload.get("subtitle"),
                    "x": labels,
                    "series": [
                        {
                            "name": item.get("label") or item.get("name") or f"系列{index + 1}",
                            "data": item.get("data") or [],
                            "color": item.get("borderColor") or item.get("backgroundColor"),
                        }
                        for index, item in enumerate(datasets)
                        if isinstance(item, dict)
                    ],
                }

        if isinstance(data, dict) and chart_type in {"pie", "doughnut"}:
            labels = data.get("labels")
            datasets = data.get("datasets")
            if isinstance(labels, list) and isinstance(datasets, list) and datasets:
                dataset = datasets[0]
                values = dataset.get("data") if isinstance(dataset, dict) else None
                if isinstance(values, list):
                    return {
                        "type": chart_type,
                        "title": payload.get("title"),
                        "subtitle": payload.get("subtitle"),
                        "series": [
                            {
                                "data": [
                                    {"name": str(label), "value": value}
                                    for label, value in zip(labels, values)
                                ]
                            }
                        ],
                    }

        if chart_type == "scatter" and isinstance(data, dict):
            datasets = data.get("datasets")
            if isinstance(datasets, list):
                series: list[dict[str, Any]] = []
                for index, item in enumerate(datasets):
                    if not isinstance(item, dict):
                        continue
                    raw_points = item.get("data")
                    points: list[dict[str, Any]] = []
                    if isinstance(raw_points, list):
                        for point in raw_points:
                            if isinstance(point, dict) and "x" in point and "y" in point:
                                points.append({"x": point["x"], "y": point["y"], "label": point.get("label")})
                            elif isinstance(point, (list, tuple)) and len(point) >= 2:
                                points.append({"x": point[0], "y": point[1]})
                    series.append(
                        {
                            "name": item.get("label") or f"系列{index + 1}",
                            "points": points,
                        }
                    )
                return {
                    "type": "scatter",
                    "title": payload.get("title"),
                    "subtitle": payload.get("subtitle"),
                    "series": series,
                }

        if chart_type in SUPPORTED_VIZ_TYPES:
            return payload

        return None

    def _validate_viz_payload(self, payload: dict[str, Any]) -> list[str]:
        issues: list[str] = []
        chart_type = str(payload.get("type") or "").strip().lower()
        if chart_type not in SUPPORTED_VIZ_TYPES:
            return ["不支持的图表类型"]

        if chart_type in {"line", "bar", "area"}:
            x = payload.get("x")
            series = payload.get("series")
            if not isinstance(x, list) or not x:
                issues.append("x 轴不能为空")
            if not isinstance(series, list) or not series:
                issues.append("series 不能为空")
            if isinstance(x, list) and isinstance(series, list):
                for index, item in enumerate(series):
                    data = item.get("data") if isinstance(item, dict) else None
                    if not isinstance(data, list) or len(data) != len(x):
                        issues.append(f"series[{index}] 的 data 长度必须与 x 一致")

        elif chart_type in {"pie", "doughnut", "funnel"}:
            series = payload.get("series")
            if not isinstance(series, list) or not series:
                issues.append("series 不能为空")
            else:
                points = series[0].get("data") if isinstance(series[0], dict) else None
                if not isinstance(points, list) or not points:
                    issues.append("series[0].data 不能为空")

        elif chart_type == "scatter":
            series = payload.get("series")
            if not isinstance(series, list) or not series:
                issues.append("scatter series 不能为空")
            else:
                for index, item in enumerate(series):
                    points = item.get("points") if isinstance(item, dict) else None
                    if not isinstance(points, list) or not points:
                        issues.append(f"series[{index}] 的 points 不能为空")

        elif chart_type == "radar":
            indicators = payload.get("indicators")
            series = payload.get("series")
            if not isinstance(indicators, list) or len(indicators) < 3:
                issues.append("radar indicators 至少需要 3 个")
            if not isinstance(series, list) or not series:
                issues.append("radar series 不能为空")

        elif chart_type == "heatmap":
            x = payload.get("x")
            y = payload.get("y")
            values = payload.get("values")
            if not isinstance(x, list) or not x:
                issues.append("heatmap x 轴不能为空")
            if not isinstance(y, list) or not y:
                issues.append("heatmap y 轴不能为空")
            if not isinstance(values, list) or not values:
                issues.append("heatmap values 不能为空")

        elif chart_type == "gauge":
            series = payload.get("series")
            if not isinstance(series, list) or not series:
                issues.append("gauge series 不能为空")

        elif chart_type == "sankey":
            series = payload.get("series")
            if not isinstance(series, list) or not series or not isinstance(series[0], dict):
                issues.append("sankey series 不能为空")
            else:
                if not isinstance(series[0].get("nodes"), list) or not series[0]["nodes"]:
                    issues.append("sankey nodes 不能为空")
                if not isinstance(series[0].get("links"), list) or not series[0]["links"]:
                    issues.append("sankey links 不能为空")

        elif chart_type == "candlestick":
            x = payload.get("x")
            series = payload.get("series")
            if not isinstance(x, list) or not x:
                issues.append("candlestick x 轴不能为空")
            if not isinstance(series, list) or not series or not isinstance(series[0], dict):
                issues.append("candlestick series 不能为空")
            else:
                data = series[0].get("data")
                if not isinstance(data, list) or len(data) != len(x):
                    issues.append("candlestick data 长度必须与 x 一致")

        return issues

    def _validate_mermaid(self, body: str) -> tuple[bool, str | None]:
        first_line = next((line.strip() for line in body.splitlines() if line.strip()), "").lower()
        if not first_line:
            return False, "空 Mermaid 代码块已降级为普通代码块"

        starter = first_line.split()[0]
        if starter not in SUPPORTED_MERMAID_STARTERS:
            return False, "Mermaid 首行未匹配官方标准图种，已降级为普通代码块"
        return True, None
