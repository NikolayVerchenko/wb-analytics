create schema if not exists mart;

create or replace view mart.fact_deductions_day_unallocated as
with src as (
    select
        rd.account_id,
        rd.rr_dt as calendar_date,
        rd.week_start,
        rd.period_mode as source_mode,
        rd.supplier_oper_name,
        nullif(btrim(rd.bonus_type_name), '') as bonus_type_name,
        coalesce(rd.penalty, 0)::numeric as penalty_amount,
        coalesce(rd.additional_payment, 0)::numeric as additional_payment_amount,
        coalesce(rd.acquiring_fee, 0)::numeric as acquiring_fee_amount,
        coalesce(rd.cashback_amount, 0)::numeric as cashback_amount
    from (
        select
            account_id,
            rr_dt,
            week_start,
            'weekly'::text as period_mode,
            supplier_oper_name,
            bonus_type_name,
            penalty,
            additional_payment,
            acquiring_fee,
            cashback_amount,
            nm_id,
            sa_name
        from core.report_detail_weekly
        union all
        select
            account_id,
            rr_dt,
            week_start,
            'daily'::text as period_mode,
            supplier_oper_name,
            bonus_type_name,
            penalty,
            additional_payment,
            acquiring_fee,
            cashback_amount,
            nm_id,
            sa_name
        from core.report_detail_daily
    ) rd
    where rd.rr_dt is not null
      and (rd.nm_id is null or rd.nm_id = 0 or rd.sa_name is null or btrim(rd.sa_name) = '')
)
select
    s.account_id,
    s.calendar_date,
    s.week_start,
    s.source_mode,
    s.supplier_oper_name,
    s.bonus_type_name,
    sum(s.penalty_amount)::numeric as penalty_amount,
    sum(s.additional_payment_amount)::numeric as additional_payment_amount,
    sum(s.acquiring_fee_amount)::numeric as acquiring_fee_amount,
    sum(s.cashback_amount)::numeric as cashback_amount,
    sum(
        s.penalty_amount
        + s.additional_payment_amount
        + s.acquiring_fee_amount
        + s.cashback_amount
    )::numeric as total_unallocated_amount
from src s
where s.penalty_amount <> 0
   or s.additional_payment_amount <> 0
   or s.acquiring_fee_amount <> 0
   or s.cashback_amount <> 0
group by
    s.account_id,
    s.calendar_date,
    s.week_start,
    s.source_mode,
    s.supplier_oper_name,
    s.bonus_type_name;
