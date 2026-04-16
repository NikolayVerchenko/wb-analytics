create table if not exists mart.ui_item_day_filters (
    account_id uuid not null,
    calendar_date date not null,
    filter_type text not null,
    value text not null,
    label text not null,
    hint text
);

create unique index if not exists ui_item_day_filters_pk
    on mart.ui_item_day_filters (account_id, calendar_date, filter_type, value);

create index if not exists ui_item_day_filters_account_date_type_idx
    on mart.ui_item_day_filters (account_id, calendar_date, filter_type);

create index if not exists ui_item_day_filters_account_type_date_value_idx
    on mart.ui_item_day_filters (account_id, filter_type, calendar_date, value);

truncate table mart.ui_item_day_filters;

insert into mart.ui_item_day_filters (
    account_id,
    calendar_date,
    filter_type,
    value,
    label,
    hint
)
with subject_rows as (
    select distinct
        account_id,
        calendar_date,
        'subject'::text as filter_type,
        btrim(subject_name) as value,
        btrim(subject_name) as label,
        null::text as hint
    from mart.ui_item_day
    where nullif(btrim(subject_name), '') is not null
),
brand_rows as (
    select distinct
        account_id,
        calendar_date,
        'brand'::text as filter_type,
        btrim(brand_name) as value,
        btrim(brand_name) as label,
        null::text as hint
    from mart.ui_item_day
    where nullif(btrim(brand_name), '') is not null
),
article_ranked as (
    select
        account_id,
        calendar_date,
        'article'::text as filter_type,
        btrim(vendor_code) as value,
        btrim(vendor_code) as label,
        nm_id::text as hint,
        row_number() over (
            partition by account_id, calendar_date, btrim(vendor_code)
            order by nm_id nulls last
        ) as rn
    from mart.ui_item_day
    where nullif(btrim(vendor_code), '') is not null
),
article_rows as (
    select
        account_id,
        calendar_date,
        filter_type,
        value,
        label,
        hint
    from article_ranked
    where rn = 1
)
select * from subject_rows
union all
select * from brand_rows
union all
select * from article_rows;
