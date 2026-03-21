# RESULTS FOR REVIEW

## Schemas
```
core
information_schema
mart
pg_catalog
pg_toast
public
raw
stg
```

## Tables & Views (raw/core/mart)
```
core.acceptance_costs (BASE TABLE)
core.account_supply_item_costs (BASE TABLE)
core.account_tax_settings (BASE TABLE)
core.accounts (BASE TABLE)
core.advert_cost_allocations (VIEW)
core.advert_costs (BASE TABLE)
core.advert_costs_by_vendor_code (VIEW)
core.advert_nms (BASE TABLE)
core.advert_nms_with_vendor_code (VIEW)
core.adverts (BASE TABLE)
core.paid_storage_costs (BASE TABLE)
core.product_card_colors (BASE TABLE)
core.product_card_photos (BASE TABLE)
core.product_card_sizes (BASE TABLE)
core.product_cards (BASE TABLE)
core.product_funnel (BASE TABLE)
core.report_detail_daily (BASE TABLE)
core.report_detail_weekly (BASE TABLE)
core.seller_info (BASE TABLE)
core.supplies (BASE TABLE)
core.supply_goods (BASE TABLE)
core.supply_goods_with_header (VIEW)
core.user_accounts (BASE TABLE)
core.users (BASE TABLE)
core.warehouse_remains_balances (BASE TABLE)
core.warehouse_remains_items (BASE TABLE)
core.wb_offices (BASE TABLE)

mart.fact_advert_day_item (VIEW)
mart.fact_deductions_day_unallocated (VIEW)
mart.fact_unit_economics_day_size_closed (VIEW)
mart.fact_unit_economics_day_size_current (VIEW)
mart.sku_unit_economics_daily_draft (VIEW)
mart.sku_unit_economics_day_closed (VIEW)
mart.sku_unit_economics_day_current (VIEW)
mart.sku_unit_economics_day_item_closed (VIEW)
mart.sku_unit_economics_day_item_current (VIEW)
mart.sku_unit_economics_weekly (VIEW)
mart.supply_items (VIEW)

raw.api_payloads (BASE TABLE)
raw.load_runs (BASE TABLE)
```

## Table Structures (`\d+`)

### raw.load_runs
```
Table "raw.load_runs"
Column    | Type                       | Nullable | Default
--------- | -------------------------- | -------- | -----------------
load_id   | uuid                       | not null |
account_id| uuid                       | not null |
source    | text                       | not null |
period_from | date                     | not null |
period_to | date                       | not null |
fetched_at| timestamp with time zone   | not null | now()
status    | text                       | not null | 'success'
rows_loaded | integer                  | not null | 0
error     | text                       |          |
period_mode | text                     |          |
week_start | date                      |          |

Indexes:
  load_runs_pkey PRIMARY KEY (load_id)
  idx_load_runs_account_time (account_id, fetched_at)

Referenced by:
  raw.api_payloads.load_id -> raw.load_runs.load_id ON DELETE CASCADE
```

### raw.api_payloads
```
Table "raw.api_payloads"
Column       | Type                     | Nullable | Default
------------ | ------------------------ | -------- | -----------------------------
id           | bigint                   | not null | nextval('raw.api_payloads_id_seq')
load_id      | uuid                     | not null |
account_id   | uuid                     | not null |
source       | text                     | not null |
fetched_at   | timestamp with time zone | not null | now()
request_params | jsonb                  |          |
payload      | jsonb                    | not null |
payload_hash | text                     |          |
period_mode  | text                     |          |
week_start   | date                     |          |

Indexes:
  api_payloads_pkey PRIMARY KEY (id)
  idx_api_payloads_account_source_time (account_id, source, fetched_at)
  idx_api_payloads_load_id (load_id)

Foreign-key constraints:
  api_payloads_load_id_fkey (load_id) -> raw.load_runs(load_id) ON DELETE CASCADE
```

### core.users
```
Table "core.users"
Column        | Type                     | Nullable | Default
------------- | ------------------------ | -------- | ----------------
user_id       | uuid                     | not null |
email         | text                     | not null |
password_hash | text                     | not null |
status        | text                     | not null | 'active'
created_at    | timestamp with time zone | not null | now()

Indexes:
  users_pkey PRIMARY KEY (user_id)
  users_email_key UNIQUE (email)
```

### core.accounts
```
Table "core.accounts"
Column     | Type                     | Nullable | Default
---------- | ------------------------ | -------- | ----------------
account_id | uuid                     | not null |
name       | text                     | not null |
wb_token   | text                     |          |
status     | text                     | not null | 'active'
created_at | timestamp with time zone | not null | now()

Indexes:
  accounts_pkey PRIMARY KEY (account_id)
```

### core.user_accounts
```
Table "core.user_accounts"
Column     | Type                     | Nullable | Default
---------- | ------------------------ | -------- | ----------------
user_id    | uuid                     | not null |
account_id | uuid                     | not null |
role       | text                     | not null | 'viewer'
created_at | timestamp with time zone | not null | now()

Indexes:
  user_accounts_pkey PRIMARY KEY (user_id, account_id)
  idx_user_accounts_account (account_id)
```

### core.report_detail_daily
```
Table "core.report_detail_daily"
Columns (selection):
  account_id uuid, rr_dt date, vendor_code text, size_norm text, revenue numeric(18,2),
  commission numeric(18,2), logistics numeric(18,2), storage numeric(18,2),
  penalties numeric(18,2), services numeric(18,2), week_start date, loaded_at timestamptz,
  gi_id bigint, subject_name text, nm_id bigint, brand_name text, sa_name text, ts_name text,
  quantity int, retail_price numeric, retail_amount numeric, supplier_oper_name text,
  delivery_amount int, return_amount int, delivery_rub numeric, ppvz_for_pay numeric,
  acquiring_fee numeric, bonus_type_name text, additional_payment numeric, cashback_amount numeric,
  penalty numeric, rrd_id bigint

Indexes:
  report_detail_daily_pkey (account_id, rrd_id)
  idx_rdd_daily_week (account_id, week_start)
```

### core.report_detail_weekly
```
Table "core.report_detail_weekly"
Structure mirrors daily; indexes:
  report_detail_weekly_pkey (account_id, rrd_id)
  idx_rdd_weekly_week (account_id, week_start)
```

### mart.report_detail_*
```
Not found (to_regclass returned null).
```

## Row Counts
```
raw.load_runs = 24
raw.api_payloads = 69
core.users = 1
core.accounts = 1
core.user_accounts = 1
core.report_detail_daily = 692
core.report_detail_weekly = 5901
```

## Backend Routers / Endpoints

### backend/app/modules/accounts/router.py
- GET /accounts -> list accounts
- GET /accounts/{account_id} -> get account

### backend/app/modules/economics/router.py
- GET /economics/period-items -> list period items
- GET /economics/period-sizes -> list period sizes for nm_id/vendor_code

### backend/app/modules/supplies/router.py
- GET /supplies -> list supplies
- GET /supplies/{supply_id}/items -> list items in supply
- PUT /supplies/{supply_id}/items/cost -> upsert cost per item
- PUT /supplies/{supply_id}/items/cost/all-sizes -> bulk apply cost for article

### backend/app/modules/tax/router.py
- GET /tax-settings/{account_id} -> read tax settings
- PUT /tax-settings/{account_id} -> upsert tax settings

## API Responses

### GET /accounts
```json
[
  {
    "account_id": "e4a0b561-dfc5-459d-a875-867a19c9c21a",
    "name": "WB Client #1",
    "status": "active",
    "created_at": "2026-03-12T19:20:38.974465Z",
    "wb_seller_id": "b8a7a7b5-2b44-47d1-9608-d9fe6f10792b",
    "seller_name": "ИП Верченко Н. Н.",
    "trade_mark": "ИП Верченко"
  }
]
```

### GET /economics/period-items (2026-02-15 .. 2026-03-15)
```json
{
  "items": [
    {
      "nm_id": 429014009,
      "vendor_code": "in-12",
      "sales_quantity": 1,
      "seller_transfer": "798.08",
      "advert_cost": "0",
      "tax_amount": "35.24",
      "cogs_amount": "0",
      "profit_amount": "474.616",
      "margin_percent": "35.74",
      "roi_percent": null
    },
    {
      "nm_id": 523546496,
      "vendor_code": "in-19",
      "sales_quantity": 73,
      "seller_transfer": "62206.99",
      "advert_cost": "3000.0000000000000000",
      "tax_amount": "2823.05",
      "cogs_amount": "25750.00",
      "profit_amount": "16399.9800000000000000",
      "margin_percent": "15.87",
      "roi_percent": "63.69"
    }
  ],
  "totals": {
    "sales_quantity": "516",
    "delivery_quantity": "1147",
    "refusal_quantity": "632",
    "buyout_percent": "44.99",
    "realization_before_spp": "893062.00",
    "realization_after_spp": "602101.54",
    "spp_amount": "290960.46",
    "spp_percent": "32.58",
    "seller_transfer": "537829.80",
    "wb_commission_amount": "355232.20",
    "wb_commission_percent": "39.78",
    "advert_cost": "10063.0000000000000000",
    "delivery_cost": "122313.25",
    "paid_storage_cost": "1300.4922360",
    "penalty_cost": "3850",
    "acceptance_cost": "0",
    "tax_amount": "24084.05",
    "cogs_amount": "192228.00",
    "profit_amount": "183991.0077640000000000",
    "margin_percent": "20.60",
    "roi_percent": "95.71"
  }
}
```

### GET /economics/period-sizes (nm_id=429014009, vendor_code=in-12)
```json
[
  {
    "nm_id": 429014009,
    "vendor_code": "in-12",
    "ts_name": "",
    "sales_quantity": 0,
    "seller_transfer": "0",
    "tax_amount": "0.00",
    "cogs_amount": "0",
    "profit_amount": "0.00"
  },
  {
    "nm_id": 429014009,
    "vendor_code": "in-12",
    "ts_name": "L",
    "sales_quantity": 1,
    "seller_transfer": "798.08",
    "tax_amount": "35.24",
    "cogs_amount": "0",
    "profit_amount": "474.616"
  }
]
```
