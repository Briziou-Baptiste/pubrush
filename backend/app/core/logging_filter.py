import logging
import re
from typing import Any, List, Tuple


class SensitiveDataFilter(logging.Filter):
    """Filtre de logging pour assainir et masquer les jetons, codes et secrets."""

    PATTERNS: List[Tuple[re.Pattern, str]] = [
        # Authorization: Bearer <secret> or Bearer <secret>
        (
            re.compile(
                r"((?i:authorization\s*:\s*)?bearer\s+)(?:\"[^\"]*\"|'[^']*'|[^\s\"',]+)",
                re.IGNORECASE,
            ),
            r"\1[REDACTED]",
        ),
        # access_token=<secret>
        (
            re.compile(
                r"(\baccess_token=)(?:\"[^\"]*\"|'[^']*'|[^&\s\"',]+)",
                re.IGNORECASE,
            ),
            r"\1[REDACTED]",
        ),
        # token=<secret>
        (
            re.compile(
                r"(\btoken=)(?:\"[^\"]*\"|'[^']*'|[^&\s\"',]+)",
                re.IGNORECASE,
            ),
            r"\1[REDACTED]",
        ),
        # code=<secret>
        (
            re.compile(
                r"(\bcode=)(?:\"[^\"]*\"|'[^']*'|[^&\s\"',]+)",
                re.IGNORECASE,
            ),
            r"\1[REDACTED]",
        ),
    ]

    @classmethod
    def redact(cls, text: str) -> str:
        """Remplace les secrets connus par [REDACTED]."""
        if not isinstance(text, str):
            return text
        result = text
        for pattern, replacement in cls.PATTERNS:
            result = pattern.sub(replacement, result)
        return result

    def _redact_value(self, val: Any) -> Any:
        if isinstance(val, str):
            return self.redact(val)
        if isinstance(val, tuple):
            return tuple(self._redact_value(x) for x in val)
        if isinstance(val, list):
            return [self._redact_value(x) for x in val]
        if isinstance(val, dict):
            return {k: self._redact_value(v) for k, v in val.items()}
        return val

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            if record.args:
                try:
                    formatted = record.msg % record.args
                    record.msg = self.redact(formatted)
                    record.args = ()
                except Exception:
                    record.msg = self.redact(record.msg)
                    record.args = self._redact_value(record.args)
            else:
                record.msg = self.redact(record.msg)
        return True


def setup_logging_filters() -> None:
    """Configure SensitiveDataFilter sur le root logger et les loggers uvicorn."""
    filt = SensitiveDataFilter()
    target_loggers = [
        logging.getLogger(),
        logging.getLogger("uvicorn"),
        logging.getLogger("uvicorn.access"),
        logging.getLogger("uvicorn.error"),
    ]
    for target in target_loggers:
        if not any(isinstance(f, SensitiveDataFilter) for f in target.filters):
            target.addFilter(filt)
        for handler in target.handlers:
            if not any(isinstance(f, SensitiveDataFilter) for f in handler.filters):
                handler.addFilter(filt)
