from uuid import UUID

import psycopg

from backend.app.modules.tax.schemas import TaxSettingsUpsert


class TaxRepository:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def get_tax_settings(self, account_id: UUID) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                select
                    account_id,
                    round(tax_rate * 100, 4) as tax_rate_percent,
                    tax_base,
                    effective_from,
                    created_at,
                    updated_at
                from core.account_tax_settings
                where account_id = %s
                """,
                (account_id,),
            )
            return cur.fetchone()

    def upsert_tax_settings(self, account_id: UUID, payload: TaxSettingsUpsert) -> dict:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                insert into core.account_tax_settings (
                    account_id,
                    tax_rate,
                    tax_base,
                    effective_from,
                    updated_at
                )
                values (
                    %s,
                    %s,
                    'realization_after_spp',
                    coalesce(%s, current_date),
                    now()
                )
                on conflict (account_id) do update
                set
                    tax_rate = excluded.tax_rate,
                    tax_base = excluded.tax_base,
                    effective_from = excluded.effective_from,
                    updated_at = now()
                returning
                    account_id,
                    round(tax_rate * 100, 4) as tax_rate_percent,
                    tax_base,
                    effective_from,
                    created_at,
                    updated_at
                """,
                (account_id, float(payload.tax_rate_percent) / 100, payload.effective_from),
            )
            row = cur.fetchone()
        self._conn.commit()
        return row
