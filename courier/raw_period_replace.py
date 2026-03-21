from datetime import date
from uuid import UUID

import psycopg


def replace_raw_period_data(
    conn: psycopg.Connection,
    *,
    account_id: UUID,
    source: str,
    period_from: date,
    period_to: date,
    period_mode: str,
    week_start: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            delete from raw.api_payloads
            where account_id = %s
              and source = %s
              and period_mode = %s
              and week_start = %s
              and load_id in (
                  select load_id
                  from raw.load_runs
                  where account_id = %s
                    and source = %s
                    and period_from = %s
                    and period_to = %s
                    and period_mode = %s
                    and week_start = %s
              )
            """,
            (
                account_id,
                source,
                period_mode,
                week_start,
                account_id,
                source,
                period_from,
                period_to,
                period_mode,
                week_start,
            ),
        )
        cur.execute(
            """
            delete from raw.load_runs
            where account_id = %s
              and source = %s
              and period_from = %s
              and period_to = %s
              and period_mode = %s
              and week_start = %s
            """,
            (account_id, source, period_from, period_to, period_mode, week_start),
        )
