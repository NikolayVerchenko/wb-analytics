from __future__ import annotations

import argparse
from uuid import UUID

import psycopg
from psycopg import ClientCursor

from backend.app.modules.accounts.service import AccountsService
from backend.app.settings import get_settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Grant a user access to an account.')
    parser.add_argument('--account-id', required=True, type=UUID, help='Target account UUID')
    parser.add_argument('--role', default='member', choices=['owner', 'member'], help='Access role')
    parser.add_argument('--user-id', type=UUID, help='Target user UUID')
    parser.add_argument('--email', help='Target user email')
    parser.add_argument('--telegram-user-id', type=int, help='Target Telegram user id')
    return parser.parse_args()


def resolve_user_id(conn: psycopg.Connection, args: argparse.Namespace) -> UUID:
    selectors_used = sum(
        value is not None
        for value in (args.user_id, args.email, args.telegram_user_id)
    )
    if selectors_used != 1:
        raise SystemExit('Specify exactly one selector: --user-id or --email or --telegram-user-id')

    if args.user_id is not None:
        return args.user_id

    with conn.cursor() as cur:
        if args.email is not None:
            cur.execute(
                """
                select user_id
                from core.users
                where lower(email) = lower(%s)
                """,
                (args.email,),
            )
        else:
            cur.execute(
                """
                select user_id
                from core.telegram_identities
                where telegram_user_id = %s
                """,
                (args.telegram_user_id,),
            )
        row = cur.fetchone()

    if row is None:
        raise SystemExit('Target user not found')
    return UUID(str(row['user_id']))


def ensure_account_exists(conn: psycopg.Connection, account_id: UUID) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            select exists(
                select 1
                from core.accounts
                where account_id = %s
            ) as exists_account
            """,
            (account_id,),
        )
        row = cur.fetchone()

    if not row or not row['exists_account']:
        raise SystemExit('Target account not found')


def main() -> None:
    args = parse_args()
    settings = get_settings()
    conn = psycopg.connect(
        host=settings.pg_host,
        port=settings.pg_port,
        dbname=settings.pg_database,
        user=settings.pg_user,
        password=settings.pg_password,
        row_factory=psycopg.rows.dict_row,
        cursor_factory=ClientCursor,
        prepare_threshold=None,
    )

    with conn:
        user_id = resolve_user_id(conn, args)
        ensure_account_exists(conn, args.account_id)
        access_row = AccountsService(conn).grant_account_access(
            user_id=user_id,
            account_id=args.account_id,
            role=args.role,
        )
        conn.commit()

    print('granted_access')
    print(f"user_id={access_row['user_id']}")
    print(f"account_id={access_row['account_id']}")
    print(f"role={access_row['role']}")


if __name__ == '__main__':
    main()
