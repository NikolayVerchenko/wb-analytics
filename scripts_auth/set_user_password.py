from __future__ import annotations

import argparse
from uuid import UUID

import psycopg

from backend.app.modules.auth.service import PasswordHasher
from backend.app.settings import get_settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Set or reset a local password for an existing user.')
    parser.add_argument('--password', required=True, help='New password value')
    parser.add_argument('--user-id', type=UUID, help='Target user UUID')
    parser.add_argument('--email', help='Target user email')
    parser.add_argument('--telegram-user-id', type=int, help='Target Telegram user id')
    parser.add_argument('--set-email', help='Optional new email to assign to the user')
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


def normalize_email(value: str | None) -> str | None:
    if value is None:
        return None
    email = value.strip().lower()
    if '@' not in email or email.startswith('@') or email.endswith('@'):
        raise SystemExit('Invalid email')
    return email


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
    )

    password_hasher = PasswordHasher()
    password_hash = password_hasher.hash_password(args.password)
    new_email = normalize_email(args.set_email)

    with conn:
        user_id = resolve_user_id(conn, args)
        with conn.cursor() as cur:
            if new_email is None:
                cur.execute(
                    """
                    update core.users
                    set password_hash = %s,
                        updated_at = now()
                    where user_id = %s
                    returning user_id, email
                    """,
                    (password_hash, user_id),
                )
            else:
                cur.execute(
                    """
                    update core.users
                    set email = %s,
                        password_hash = %s,
                        updated_at = now()
                    where user_id = %s
                    returning user_id, email
                    """,
                    (new_email, password_hash, user_id),
                )
            row = cur.fetchone()
            conn.commit()

    if row is None:
        raise SystemExit('User update failed')

    print('password_updated')
    print(f"user_id={row['user_id']}")
    print(f"email={row['email']}")


if __name__ == '__main__':
    main()
