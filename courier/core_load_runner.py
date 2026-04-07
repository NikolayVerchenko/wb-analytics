from dataclasses import dataclass, field
from typing import Any, Callable

import psycopg

from courier.common import db_connection


@dataclass(slots=True)
class CoreLoadResult:
    source: str
    load_id: str
    metrics: dict[str, Any] = field(default_factory=dict)

    def format(self) -> str:
        parts = [f"source={self.source}", f"load_id={self.load_id}"]
        for key, value in self.metrics.items():
            parts.append(f"{key}={value}")
        return " ".join(parts)


CoreLoadFn = Callable[[psycopg.Connection], CoreLoadResult]


def run_core_load(load_fn: CoreLoadFn) -> int:
    with db_connection() as conn:
        result = load_fn(conn)
        conn.commit()

    print(result.format())
    return 0
