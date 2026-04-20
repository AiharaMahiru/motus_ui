from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DATA_FILE_SUFFIXES = {
    ".csv",
    ".tsv",
    ".json",
    ".jsonl",
    ".ndjson",
    ".txt",
    ".log",
}

TIME_FIELD_HINTS = ("date", "time", "day", "week", "month", "year", "timestamp", "日期", "时间")
STAGE_FIELD_HINTS = ("stage", "step", "phase", "status", "阶段", "步骤", "状态", "环节")
CATEGORY_FIELD_HINTS = ("type", "category", "group", "name", "标签", "类别", "分组")


@dataclass(slots=True)
class DatasetProfile:
    file_name: str
    file_path: str
    detected_format: str
    row_count_observed: int
    columns: list[str] = field(default_factory=list)
    numeric_fields: list[str] = field(default_factory=list)
    time_fields: list[str] = field(default_factory=list)
    category_fields: list[str] = field(default_factory=list)
    stage_fields: list[str] = field(default_factory=list)
    sample_rows: list[dict[str, Any]] = field(default_factory=list)
    suggested_visualizations: list[str] = field(default_factory=list)


def _normalize_field_name(name: str) -> str:
    return name.strip().lower().replace(" ", "_")


def _looks_numeric(value: Any) -> bool:
    if value is None:
        return False
    text = str(value).strip()
    if not text:
        return False
    try:
        float(text.replace(",", ""))
        return True
    except ValueError:
        return False


def _sample_text(path: Path, *, limit_lines: int = 5) -> list[str]:
    lines: list[str] = []
    with path.open(encoding="utf-8", errors="ignore") as handle:
        for _, raw_line in zip(range(limit_lines), handle):
            line = raw_line.strip()
            if line:
                lines.append(line[:240])
    return lines


class DataAnalysisWorkflowService:
    """附件级数据分析辅助。

    目标不是在后端替代真正的数据分析，而是为 agent 补足：
    - 文件采样
    - 字段识别
    - 图表建议
    """

    def supports_attachment(self, attachment: dict[str, Any]) -> bool:
        file_path = Path(str(attachment.get("file_path") or ""))
        return file_path.suffix.lower() in DATA_FILE_SUFFIXES

    def inspect_attachments(self, attachments: list[dict[str, Any]]) -> list[DatasetProfile]:
        profiles: list[DatasetProfile] = []
        for attachment in attachments:
            if not self.supports_attachment(attachment):
                continue

            path = Path(str(attachment.get("file_path") or ""))
            if not path.exists() or not path.is_file():
                continue

            suffix = path.suffix.lower()
            if suffix == ".csv":
                profile = self._inspect_delimited(path, delimiter=",")
            elif suffix == ".tsv":
                profile = self._inspect_delimited(path, delimiter="\t")
            elif suffix in {".jsonl", ".ndjson"}:
                profile = self._inspect_jsonl(path)
            elif suffix == ".json":
                profile = self._inspect_json(path)
            else:
                profile = self._inspect_text_like(path)

            if profile is not None:
                profiles.append(profile)
        return profiles

    def build_prompt_context(self, profiles: list[DatasetProfile]) -> str | None:
        if not profiles:
            return None

        lines = [
            "后端已对本轮数据附件完成轻量采样和字段识别，请优先结合这些信息分析，不要盲猜数据结构："
        ]
        for profile in profiles:
            lines.append(f"- 文件：{profile.file_name}")
            lines.append(f"  格式：{profile.detected_format}，已采样 {profile.row_count_observed} 行")
            if profile.columns:
                lines.append(f"  字段：{', '.join(profile.columns[:12])}")
            if profile.numeric_fields:
                lines.append(f"  数值字段：{', '.join(profile.numeric_fields[:8])}")
            if profile.time_fields:
                lines.append(f"  时间字段：{', '.join(profile.time_fields[:4])}")
            if profile.category_fields:
                lines.append(f"  类别字段：{', '.join(profile.category_fields[:6])}")
            if profile.stage_fields:
                lines.append(f"  阶段字段：{', '.join(profile.stage_fields[:4])}")
            if profile.suggested_visualizations:
                lines.append(f"  建议图表：{', '.join(profile.suggested_visualizations[:4])}")
            if profile.sample_rows:
                lines.append(
                    "  样例："
                    + json.dumps(profile.sample_rows[:2], ensure_ascii=False)
                )
        return "\n".join(lines)

    def _inspect_delimited(self, path: Path, *, delimiter: str) -> DatasetProfile | None:
        rows: list[dict[str, Any]] = []
        fieldnames: list[str] = []

        with path.open(encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.DictReader(handle, delimiter=delimiter)
            if reader.fieldnames:
                fieldnames = [field.strip() for field in reader.fieldnames if field and field.strip()]
            for _, row in zip(range(8), reader):
                rows.append({str(key).strip(): value for key, value in row.items() if key})

        if not rows and not fieldnames:
            return None

        return self._finalize_profile(
            file_name=path.name,
            file_path=str(path),
            detected_format="csv" if delimiter == "," else "tsv",
            columns=fieldnames or list(rows[0].keys()),
            rows=rows,
        )

    def _inspect_json(self, path: Path) -> DatasetProfile | None:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return self._inspect_text_like(path)

        rows: list[dict[str, Any]] = []
        columns: list[str] = []

        if isinstance(payload, list) and payload and all(isinstance(item, dict) for item in payload[:8]):
            rows = [{str(key): value for key, value in item.items()} for item in payload[:8]]  # type: ignore[union-attr]
            columns = list({key for row in rows for key in row.keys()})
            detected_format = "json-array"
        elif isinstance(payload, dict):
            flat_row = {
                str(key): value
                for key, value in payload.items()
                if isinstance(value, (str, int, float, bool)) or value is None
            }
            if not flat_row:
                return None
            rows = [flat_row]
            columns = list(flat_row.keys())
            detected_format = "json-object"
        else:
            return None

        return self._finalize_profile(
            file_name=path.name,
            file_path=str(path),
            detected_format=detected_format,
            columns=columns,
            rows=rows,
        )

    def _inspect_jsonl(self, path: Path) -> DatasetProfile | None:
        rows: list[dict[str, Any]] = []
        with path.open(encoding="utf-8", errors="ignore") as handle:
            for _, raw_line in zip(range(8), handle):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                except Exception:
                    continue
                if isinstance(item, dict):
                    rows.append({str(key): value for key, value in item.items()})

        if not rows:
            return None

        columns = list({key for row in rows for key in row.keys()})
        return self._finalize_profile(
            file_name=path.name,
            file_path=str(path),
            detected_format="jsonl",
            columns=columns,
            rows=rows,
        )

    def _inspect_text_like(self, path: Path) -> DatasetProfile | None:
        sample_lines = _sample_text(path)
        if not sample_lines:
            return None

        return DatasetProfile(
            file_name=path.name,
            file_path=str(path),
            detected_format=path.suffix.lower().lstrip(".") or "text",
            row_count_observed=len(sample_lines),
            sample_rows=[{"line": line} for line in sample_lines[:3]],
            suggested_visualizations=["line", "bar"],
        )

    def _finalize_profile(
        self,
        *,
        file_name: str,
        file_path: str,
        detected_format: str,
        columns: list[str],
        rows: list[dict[str, Any]],
    ) -> DatasetProfile:
        normalized_columns = [column.strip() for column in columns if column and column.strip()]
        numeric_fields = [
            column
            for column in normalized_columns
            if rows and all(_looks_numeric(row.get(column)) for row in rows if row.get(column) not in (None, ""))
        ]
        time_fields = [
            column
            for column in normalized_columns
            if any(hint in _normalize_field_name(column) for hint in TIME_FIELD_HINTS)
        ]
        category_fields = [
            column
            for column in normalized_columns
            if column not in numeric_fields
            and any(hint in _normalize_field_name(column) for hint in CATEGORY_FIELD_HINTS)
        ]
        if not category_fields:
            category_fields = [
                column
                for column in normalized_columns
                if column not in numeric_fields and column not in time_fields
            ][:3]
        stage_fields = [
            column
            for column in normalized_columns
            if any(hint in _normalize_field_name(column) for hint in STAGE_FIELD_HINTS)
        ]
        suggestions = self._suggest_visualizations(
            columns=normalized_columns,
            numeric_fields=numeric_fields,
            time_fields=time_fields,
            category_fields=category_fields,
            stage_fields=stage_fields,
        )

        return DatasetProfile(
            file_name=file_name,
            file_path=file_path,
            detected_format=detected_format,
            row_count_observed=len(rows),
            columns=normalized_columns,
            numeric_fields=numeric_fields,
            time_fields=time_fields,
            category_fields=category_fields,
            stage_fields=stage_fields,
            sample_rows=rows[:3],
            suggested_visualizations=suggestions,
        )

    def _suggest_visualizations(
        self,
        *,
        columns: list[str],
        numeric_fields: list[str],
        time_fields: list[str],
        category_fields: list[str],
        stage_fields: list[str],
    ) -> list[str]:
        suggestions: list[str] = []
        if time_fields and numeric_fields:
            suggestions.extend(["line", "area"])
        if category_fields and numeric_fields:
            suggestions.append("bar")
        if stage_fields and numeric_fields:
            suggestions.append("funnel")
        if len(numeric_fields) >= 2:
            suggestions.extend(["scatter", "radar"])
        if category_fields and not numeric_fields:
            suggestions.append("pie")
        if len(columns) >= 3 and not time_fields and numeric_fields:
            suggestions.append("heatmap")

        deduped: list[str] = []
        for name in suggestions:
            if name not in deduped:
                deduped.append(name)
        return deduped[:5]
