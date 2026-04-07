import argparse
import sys
import time
import uuid

from courier.common import db_connection, get_token, get_week_start, parse_iso_date
from courier.raw_io import insert_raw_payload, raw_load_run_exists
from courier.raw_load_runner import RawLoadRunner
from courier.wb_api_client import WbApiClient


ENDPOINT = 'https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod'
SOURCE = 'reportDetailByPeriod'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Fetch Wildberries raw reportDetailByPeriod payloads into raw tables.'
    )
    parser.add_argument('--account-id', required=True, help='Account UUID')
    parser.add_argument('--mode', required=True, choices=('daily', 'weekly'))
    parser.add_argument('--date-from', required=True, help='YYYY-MM-DD')
    parser.add_argument('--date-to', required=True, help='YYYY-MM-DD')
    parser.add_argument('--limit', type=int, default=100000)
    parser.add_argument('--load-id', help='Existing load UUID for resume mode')
    parser.add_argument('--rrdid-start', type=int, default=0)
    parser.add_argument('--rows-loaded-start', type=int, default=0)
    return parser.parse_args()


def extract_next_rrdid(items: list[dict], current_rrdid: int) -> int:
    if not items:
        return current_rrdid
    last_item = items[-1]
    for key in ('rrd_id', 'rrdid', 'rrdId'):
        if key in last_item:
            value = last_item[key]
            try:
                return int(value)
            except (TypeError, ValueError) as exc:
                raise RuntimeError(f'Invalid {key} value in response: {value}') from exc
    raise RuntimeError('Missing rrd_id/rrdid/rrdId in last response item')


def run() -> int:
    args = parse_args()
    account_id = uuid.UUID(args.account_id)
    date_from = parse_iso_date(args.date_from)
    date_to = parse_iso_date(args.date_to)
    if date_from > date_to:
        raise ValueError('date-from must be <= date-to')
    if args.limit <= 0:
        raise ValueError('limit must be positive')
    if args.rrdid_start < 0:
        raise ValueError('rrdid-start must be >= 0')
    if args.rows_loaded_start < 0:
        raise ValueError('rows-loaded-start must be >= 0')

    load_id = uuid.UUID(args.load_id) if args.load_id else uuid.uuid4()
    week_start = get_week_start(date_from)
    total_rows = args.rows_loaded_start
    rrdid = args.rrdid_start

    with db_connection() as conn:
        is_resume = args.load_id is not None and raw_load_run_exists(conn, load_id=load_id)
        runner = RawLoadRunner(
            conn=conn,
            load_id=load_id,
            account_id=account_id,
            source=SOURCE,
            period_from=date_from,
            period_to=date_to,
            period_mode=args.mode,
            week_start=week_start,
        )
        try:
            token = get_token(conn, account_id)
            client = WbApiClient(token=token, timeout=60, max_retries=3, backoff_seconds=2.0)
            if is_resume:
                runner.resume(rows_loaded=total_rows)
            else:
                runner.start()
            while True:
                request_params = {
                    'dateFrom': f'{date_from.isoformat()}T00:00:00',
                    'dateTo': f'{date_to.isoformat()}T23:59:59',
                    'limit': args.limit,
                    'rrdid': rrdid,
                    'period': args.mode,
                }
                response = client.get(ENDPOINT, params=request_params, expected_statuses={200, 204})
                http_status = response.status_code
                if http_status == 204:
                    print(f'mode={args.mode} rrdid={rrdid} http_status={http_status} page_rows=0 total_rows={total_rows}')
                    break
                payload = response.json()
                if not isinstance(payload, list):
                    raise RuntimeError(f'Expected list payload, got {type(payload).__name__}')
                page_rows = len(payload)
                insert_raw_payload(
                    conn,
                    load_id=load_id,
                    account_id=account_id,
                    source=SOURCE,
                    request_params=request_params,
                    payload=payload,
                    period_mode=args.mode,
                    week_start=week_start,
                )
                total_rows += page_rows
                conn.commit()
                print(f'mode={args.mode} rrdid={rrdid} http_status={http_status} page_rows={page_rows} total_rows={total_rows}')
                if not payload:
                    break
                next_rrdid = extract_next_rrdid(payload, rrdid)
                if next_rrdid == rrdid:
                    raise RuntimeError(f'Pagination stalled: next_rrdid={next_rrdid}')
                print(f'sync_raw_progress load_id={load_id} next_rrdid={next_rrdid} total_rows={total_rows}')
                rrdid = next_rrdid
                time.sleep(5)
            runner.succeed(total_rows)
            print(f'sync_raw_complete load_id={load_id} total_rows={total_rows}')
            return 0
        except Exception as exc:
            runner.fail(rows_loaded=total_rows, error=str(exc))
            raise


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:
        print(f'Error: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
