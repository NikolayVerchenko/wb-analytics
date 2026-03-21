import argparse
import sys
import uuid
from decimal import Decimal
from typing import Any

import psycopg

from courier.common import db_connection


SOURCE = "cardsList"
COLOR_NAMES = {
    "color",
    "colors",
    "main color",
    "primary color",
    "tsvet",
    "cvet",
    "цвет",
    "цвета",
    "основной цвет",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Load minimal Wildberries cards list data from raw into core tables."
    )
    parser.add_argument("--account-id", required=True, help="Account UUID")
    return parser.parse_args()


def numeric_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def get_latest_payload_pages(
    conn: psycopg.Connection,
    account_id: uuid.UUID,
) -> tuple[uuid.UUID, list[dict[str, Any]]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select load_id
            from raw.load_runs
            where account_id = %s
              and source = %s
              and status = 'success'
            order by fetched_at desc
            limit 1
            """,
            (account_id, SOURCE),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("No successful raw cardsList load found for the account")
        load_id = row[0]

        cur.execute(
            """
            select payload
            from raw.api_payloads
            where load_id = %s
            order by fetched_at, id
            """,
            (load_id,),
        )
        payload_rows = cur.fetchall()
    return load_id, [item[0] for item in payload_rows]


def replace_cards_snapshot(conn: psycopg.Connection, account_id: uuid.UUID) -> None:
    with conn.cursor() as cur:
        cur.execute("delete from core.product_card_colors where account_id = %s", (account_id,))
        cur.execute("delete from core.product_card_photos where account_id = %s", (account_id,))
        cur.execute("delete from core.product_card_sizes where account_id = %s", (account_id,))
        cur.execute("delete from core.product_cards where account_id = %s", (account_id,))


def extract_colors(card: dict[str, Any]) -> list[str]:
    characteristics = card.get("characteristics") or []
    colors: list[str] = []
    for characteristic in characteristics:
        name = str(characteristic.get("name") or "").strip().lower()
        if name not in COLOR_NAMES:
            continue
        for value in characteristic.get("value") or []:
            text = str(value).strip()
            if text and text not in colors:
                colors.append(text)
    return colors


def build_rows(
    account_id: uuid.UUID,
    load_id: uuid.UUID,
    payload_pages: list[dict[str, Any]],
) -> tuple[list[tuple], list[tuple], list[tuple], list[tuple]]:
    cards_rows: list[tuple] = []
    colors_rows: list[tuple] = []
    photos_rows: list[tuple] = []
    sizes_rows: list[tuple] = []

    for payload in payload_pages:
        for card in payload.get("cards") or []:
            nm_id = card.get("nmID")
            if nm_id is None:
                continue

            dimensions = card.get("dimensions") or {}
            cards_rows.append(
                (
                    account_id,
                    int(nm_id),
                    card.get("vendorCode"),
                    card.get("subjectName"),
                    card.get("brand"),
                    numeric_or_none(dimensions.get("weightBrutto")),
                    load_id,
                )
            )

            for color_index, color in enumerate(extract_colors(card), start=1):
                colors_rows.append(
                    (account_id, int(nm_id), color, color_index, load_id)
                )

            for photo_index, photo in enumerate(card.get("photos") or [], start=1):
                photo_url = (
                    photo.get("big")
                    or photo.get("square")
                    or photo.get("tm")
                    or photo.get("c516x688")
                    or photo.get("c246x328")
                )
                if not photo_url:
                    continue
                photos_rows.append(
                    (account_id, int(nm_id), photo_index, photo_url, load_id)
                )

            seen_sizes: set[str] = set()
            for size in card.get("sizes") or []:
                tech_size = str(size.get("techSize") or "").strip()
                if not tech_size or tech_size in seen_sizes:
                    continue
                seen_sizes.add(tech_size)
                sizes_rows.append(
                    (account_id, int(nm_id), tech_size, len(seen_sizes), load_id)
                )

    deduped_cards: dict[tuple[uuid.UUID, int], tuple] = {}
    for row in cards_rows:
        deduped_cards[(row[0], row[1])] = row

    return list(deduped_cards.values()), colors_rows, photos_rows, sizes_rows


def insert_rows(
    conn: psycopg.Connection,
    cards_rows: list[tuple],
    colors_rows: list[tuple],
    photos_rows: list[tuple],
    sizes_rows: list[tuple],
) -> None:
    with conn.cursor() as cur:
        if cards_rows:
            cur.executemany(
                """
                insert into core.product_cards (
                    account_id,
                    nm_id,
                    vendor_code,
                    subject_name,
                    brand,
                    weight_brutto,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, now())
                """,
                cards_rows,
            )
        if colors_rows:
            cur.executemany(
                """
                insert into core.product_card_colors (
                    account_id,
                    nm_id,
                    color,
                    color_index,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, now())
                """,
                colors_rows,
            )
        if photos_rows:
            cur.executemany(
                """
                insert into core.product_card_photos (
                    account_id,
                    nm_id,
                    photo_index,
                    photo_url,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, now())
                """,
                photos_rows,
            )
        if sizes_rows:
            cur.executemany(
                """
                insert into core.product_card_sizes (
                    account_id,
                    nm_id,
                    tech_size,
                    size_index,
                    raw_load_id,
                    loaded_at
                )
                values (%s, %s, %s, %s, %s, now())
                """,
                sizes_rows,
            )


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)

    with db_connection() as conn:
        load_id, payload_pages = get_latest_payload_pages(conn, account_id)
        cards_rows, colors_rows, photos_rows, sizes_rows = build_rows(
            account_id, load_id, payload_pages
        )
        replace_cards_snapshot(conn, account_id)
        insert_rows(conn, cards_rows, colors_rows, photos_rows, sizes_rows)
        conn.commit()

    print(
        f"source={SOURCE} load_id={load_id} cards={len(cards_rows)} "
        f"colors={len(colors_rows)} photos={len(photos_rows)} sizes={len(sizes_rows)}"
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
