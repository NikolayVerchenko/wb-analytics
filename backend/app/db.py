import os
from collections.abc import Iterator

import psycopg
from dotenv import load_dotenv

load_dotenv('.env.courier')



def get_db_connection() -> psycopg.Connection:
    return psycopg.connect(
        host=os.getenv('PGHOST'),
        port=os.getenv('PGPORT'),
        dbname=os.getenv('PGDATABASE'),
        user=os.getenv('PGUSER'),
        password=os.getenv('PGPASSWORD'),
        row_factory=psycopg.rows.dict_row,
    )



def db_connection() -> Iterator[psycopg.Connection]:
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
