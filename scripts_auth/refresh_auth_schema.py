import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from courier.common import db_connection


def main() -> None:
    sql_files = [
        ROOT / 'db' / 'core' / 'users.sql',
        ROOT / 'db' / 'core' / 'telegram_identities.sql',
        ROOT / 'db' / 'core' / 'auth_sessions.sql',
        ROOT / 'db' / 'core' / 'password_reset_tokens.sql',
    ]
    with db_connection() as conn:
        with conn.cursor() as cur:
            for sql_file in sql_files:
                cur.execute(sql_file.read_text(encoding='utf-8'))
        conn.commit()


if __name__ == '__main__':
    main()
