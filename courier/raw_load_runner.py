from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

import psycopg

from courier.raw_io import create_raw_load_run, resume_raw_load_run, update_raw_load_run


@dataclass
class RawLoadRunner:
    conn: psycopg.Connection
    load_id: UUID
    account_id: UUID
    source: str
    period_from: date
    period_to: date
    period_mode: str
    week_start: date

    def start(self) -> None:
        create_raw_load_run(
            self.conn,
            load_id=self.load_id,
            account_id=self.account_id,
            source=self.source,
            period_from=self.period_from,
            period_to=self.period_to,
            period_mode=self.period_mode,
            week_start=self.week_start,
        )
        self.conn.commit()

    def resume(self, *, rows_loaded: int) -> None:
        resume_raw_load_run(
            self.conn,
            load_id=self.load_id,
            rows_loaded=rows_loaded,
        )
        self.conn.commit()

    def succeed(self, rows_loaded: int) -> None:
        update_raw_load_run(
            self.conn,
            load_id=self.load_id,
            status='success',
            rows_loaded=rows_loaded,
            error=None,
        )
        self.conn.commit()

    def fail(self, *, rows_loaded: int, error: str) -> None:
        self.conn.rollback()
        try:
            update_raw_load_run(
                self.conn,
                load_id=self.load_id,
                status='failed',
                rows_loaded=rows_loaded,
                error=error,
            )
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise


def snapshot_date() -> date:
    return datetime.now().date()
