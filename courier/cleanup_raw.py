import argparse
import sys
import uuid

import psycopg

from courier.common import db_connection


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clean up old raw ingestion data while keeping the latest successful load per group."
    )
    parser.add_argument("--account-id", default=None, help="Optional account UUID filter")
    parser.add_argument(
        "--failed-older-than-days",
        type=int,
        default=7,
        help="Delete failed raw loads older than this many days",
    )
    parser.add_argument(
        "--started-older-than-days",
        type=int,
        default=2,
        help="Delete stale started raw loads older than this many days",
    )
    parser.add_argument(
        "--success-older-than-days",
        type=int,
        default=30,
        help="Delete old successful raw loads older than this many days, keeping the latest per group",
    )
    parser.add_argument(
        "--keep-success-per-group",
        type=int,
        default=1,
        help="How many latest successful raw loads to keep per (account, source, period) group",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete rows. Without this flag the script prints a dry-run summary only.",
    )
    return parser.parse_args()


def get_failed_candidate_load_ids(
    conn: psycopg.Connection,
    *,
    account_id: uuid.UUID | None,
    older_than_days: int,
) -> list[uuid.UUID]:
    params: list[object] = [older_than_days]
    account_filter = ""
    if account_id is not None:
        account_filter = "and account_id = %s"
        params.append(account_id)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            select load_id
            from raw.load_runs
            where status = 'failed'
              and fetched_at < now() - (%s * interval '1 day')
              {account_filter}
            """,
            tuple(params),
        )
        rows = cur.fetchall()
    return [row[0] for row in rows]


def get_started_candidate_load_ids(
    conn: psycopg.Connection,
    *,
    account_id: uuid.UUID | None,
    older_than_days: int,
) -> list[uuid.UUID]:
    params: list[object] = [older_than_days]
    account_filter = ""
    if account_id is not None:
        account_filter = "and account_id = %s"
        params.append(account_id)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            select load_id
            from raw.load_runs
            where status = 'started'
              and fetched_at < now() - (%s * interval '1 day')
              {account_filter}
            """,
            tuple(params),
        )
        rows = cur.fetchall()
    return [row[0] for row in rows]


def get_success_candidate_load_ids(
    conn: psycopg.Connection,
    *,
    account_id: uuid.UUID | None,
    older_than_days: int,
    keep_per_group: int,
) -> list[uuid.UUID]:
    params: list[object] = [older_than_days]
    account_filter = ""
    if account_id is not None:
        account_filter = "and account_id = %s"
        params.append(account_id)
    params.append(keep_per_group)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            with ranked_success as (
                select
                    load_id,
                    row_number() over (
                        partition by account_id, source, period_from, period_to, period_mode, week_start
                        order by fetched_at desc, load_id desc
                    ) as rn
                from raw.load_runs
                where status = 'success'
                  and fetched_at < now() - (%s * interval '1 day')
                  {account_filter}
            )
            select load_id
            from ranked_success
            where rn > %s
            """,
            tuple(params),
        )
        rows = cur.fetchall()
    return [row[0] for row in rows]


def get_candidate_load_ids(
    conn: psycopg.Connection,
    *,
    account_id: uuid.UUID | None,
    failed_older_than_days: int,
    started_older_than_days: int,
    success_older_than_days: int,
    keep_success_per_group: int,
) -> list[uuid.UUID]:
    load_ids = set()
    load_ids.update(
        get_failed_candidate_load_ids(
            conn,
            account_id=account_id,
            older_than_days=failed_older_than_days,
        )
    )
    load_ids.update(
        get_started_candidate_load_ids(
            conn,
            account_id=account_id,
            older_than_days=started_older_than_days,
        )
    )
    load_ids.update(
        get_success_candidate_load_ids(
            conn,
            account_id=account_id,
            older_than_days=success_older_than_days,
            keep_per_group=keep_success_per_group,
        )
    )
    return list(load_ids)


def count_payload_rows(conn: psycopg.Connection, load_ids: list[uuid.UUID]) -> int:
    if not load_ids:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "select count(*) from raw.api_payloads where load_id = any(%s)",
            (load_ids,),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0


def delete_load_ids(conn: psycopg.Connection, load_ids: list[uuid.UUID]) -> tuple[int, int]:
    if not load_ids:
        return 0, 0
    with conn.cursor() as cur:
        cur.execute(
            "delete from raw.api_payloads where load_id = any(%s)",
            (load_ids,),
        )
        deleted_payloads = cur.rowcount
        cur.execute(
            "delete from raw.load_runs where load_id = any(%s)",
            (load_ids,),
        )
        deleted_runs = cur.rowcount
    return deleted_payloads, deleted_runs


def run() -> int:
    args = parse_args()
    if args.failed_older_than_days < 0:
        raise ValueError("failed-older-than-days must be >= 0")
    if args.started_older_than_days < 0:
        raise ValueError("started-older-than-days must be >= 0")
    if args.success_older_than_days < 0:
        raise ValueError("success-older-than-days must be >= 0")
    if args.keep_success_per_group < 1:
        raise ValueError("keep-success-per-group must be >= 1")

    account_id = uuid.UUID(args.account_id) if args.account_id else None

    with db_connection() as conn:
        load_ids = get_candidate_load_ids(
            conn,
            account_id=account_id,
            failed_older_than_days=args.failed_older_than_days,
            started_older_than_days=args.started_older_than_days,
            success_older_than_days=args.success_older_than_days,
            keep_success_per_group=args.keep_success_per_group,
        )
        payload_count = count_payload_rows(conn, load_ids)

        if not args.apply:
            print(
                f"dry_run=true candidate_load_runs={len(load_ids)} candidate_payload_rows={payload_count}"
            )
            return 0

        deleted_payloads, deleted_runs = delete_load_ids(conn, load_ids)
        conn.commit()

    print(
        f"dry_run=false deleted_load_runs={deleted_runs} deleted_payload_rows={deleted_payloads}"
    )
    return 0


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
