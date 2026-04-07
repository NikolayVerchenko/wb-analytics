from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.db import get_db_connection

CORE_MANIFEST = ROOT / 'db' / 'deploy' / 'core_overlay.txt'
MARTS_MANIFEST = ROOT / 'db' / 'deploy' / 'marts.txt'
PREREQUISITE_TABLES = [
    'core.accounts',
]


def read_manifest(path: Path) -> list[Path]:
    items: list[Path] = []
    for line in path.read_text(encoding='utf-8').splitlines():
        value = line.strip()
        if not value or value.startswith('#'):
            continue
        items.append(ROOT / value)
    return items


def ensure_prerequisites(conn, *, skip_prerequisites: bool) -> None:
    if skip_prerequisites:
        return

    with conn.cursor() as cur:
        for table_name in PREREQUISITE_TABLES:
            schema_name, rel_name = table_name.split('.', 1)
            cur.execute(
                """
                select 1
                from information_schema.tables
                where table_schema = %s and table_name = %s
                """,
                (schema_name, rel_name),
            )
            if cur.fetchone() is None:
                raise RuntimeError(
                    'Missing prerequisite table: '
                    f'{table_name}. This repository currently deploys the auth/sync/mart overlay, '
                    'not a full empty-database bootstrap.'
                )


def execute_sql_files(conn, files: list[Path]) -> None:
    with conn.cursor() as cur:
        cur.execute('create schema if not exists core')
        cur.execute('create schema if not exists mart')
        for sql_file in files:
            cur.execute(sql_file.read_text(encoding='utf-8'))
    conn.commit()


def build_file_list(*, include_core: bool, include_marts: bool) -> list[Path]:
    files: list[Path] = []
    if include_core:
        files.extend(read_manifest(CORE_MANIFEST))
    if include_marts:
        files.extend(read_manifest(MARTS_MANIFEST))
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description='Apply reproducible SQL overlay for production deployment.')
    parser.add_argument('--skip-core-overlay', action='store_true')
    parser.add_argument('--skip-marts', action='store_true')
    parser.add_argument('--skip-prerequisites', action='store_true')
    args = parser.parse_args()

    files = build_file_list(
        include_core=not args.skip_core_overlay,
        include_marts=not args.skip_marts,
    )
    if not files:
        raise SystemExit('No SQL files selected for deployment.')

    conn = get_db_connection()
    try:
        ensure_prerequisites(conn, skip_prerequisites=args.skip_prerequisites)
        execute_sql_files(conn, files)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
