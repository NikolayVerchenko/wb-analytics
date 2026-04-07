from decimal import Decimal
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class EconomicsPeriodItemRead(BaseModel):
    source_mode: str
    account_id: UUID
    date_from: date
    date_to: date
    week_start: date | None
    nm_id: int
    vendor_code: str | None
    brand_name: str | None
    subject_name: str | None
    bonus_type_name: str | None
    account_name: str | None
    photo_url: str | None
    order_count: int | None
    sales_quantity: int | None
    return_quantity: int | None
    retail_price_sale: Decimal | None
    retail_price_return: Decimal | None
    realization_before_spp: Decimal | None
    retail_amount_sale: Decimal | None
    retail_amount_return: Decimal | None
    realization_after_spp: Decimal | None
    spp_amount: Decimal | None
    spp_percent: Decimal | None
    ppvz_for_pay_sale: Decimal | None
    ppvz_for_pay_return: Decimal | None
    seller_transfer: Decimal | None
    delivery_quantity: Decimal | None
    refusal_quantity: Decimal | None
    buyout_percent: Decimal | None
    delivery_cost: Decimal | None
    penalty_cost: Decimal | None
    cashback_amount: Decimal | None
    paid_storage_cost: Decimal | None
    advert_cost: Decimal | None
    acceptance_cost: Decimal | None
    wb_commission_amount: Decimal | None
    wb_commission_percent: Decimal | None
    tax_amount: Decimal | None
    cogs_amount: Decimal | None
    profit_amount: Decimal | None
    margin_percent: Decimal | None
    roi_percent: Decimal | None


class EconomicsPeriodSizeRead(BaseModel):
    source_mode: str
    account_id: UUID
    date_from: date
    date_to: date
    week_start: date | None
    nm_id: int
    vendor_code: str | None
    ts_name: str | None
    brand_name: str | None
    subject_name: str | None
    bonus_type_name: str | None
    account_name: str | None
    photo_url: str | None
    sales_quantity: int | None
    return_quantity: int | None
    retail_price_sale: Decimal | None
    retail_price_return: Decimal | None
    realization_before_spp: Decimal | None
    retail_amount_sale: Decimal | None
    retail_amount_return: Decimal | None
    realization_after_spp: Decimal | None
    spp_amount: Decimal | None
    spp_percent: Decimal | None
    ppvz_for_pay_sale: Decimal | None
    ppvz_for_pay_return: Decimal | None
    seller_transfer: Decimal | None
    delivery_quantity: Decimal | None
    refusal_quantity: Decimal | None
    buyout_percent: Decimal | None
    delivery_cost: Decimal | None
    penalty_cost: Decimal | None
    cashback_amount: Decimal | None
    paid_storage_cost: Decimal | None
    tax_amount: Decimal | None
    cogs_amount: Decimal | None
    wb_commission_amount: Decimal | None
    wb_commission_percent: Decimal | None
    profit_amount: Decimal | None
    margin_percent: Decimal | None
    roi_percent: Decimal | None


class EconomicsPeriodTotalsRead(BaseModel):
    sales_quantity: Decimal | None
    order_count: Decimal | None
    delivery_quantity: Decimal | None
    refusal_quantity: Decimal | None
    return_quantity: Decimal | None
    buyout_percent: Decimal | None
    realization_before_spp: Decimal | None
    realization_after_spp: Decimal | None
    spp_amount: Decimal | None
    spp_percent: Decimal | None
    seller_transfer: Decimal | None
    wb_commission_amount: Decimal | None
    wb_commission_percent: Decimal | None
    advert_cost: Decimal | None
    delivery_cost: Decimal | None
    paid_storage_cost: Decimal | None
    penalty_cost: Decimal | None
    acceptance_cost: Decimal | None
    tax_amount: Decimal | None
    cogs_amount: Decimal | None
    profit_amount: Decimal | None
    margin_percent: Decimal | None
    roi_percent: Decimal | None


class EconomicsPeriodItemsResponse(BaseModel):
    items: list[EconomicsPeriodItemRead]
    totals: EconomicsPeriodTotalsRead



class EconomicsFilterOptionRead(BaseModel):
    value: str
    label: str
    hint: str | None = None


class EconomicsFilterOptionsResponse(BaseModel):
    subjects: list[EconomicsFilterOptionRead]
    brands: list[EconomicsFilterOptionRead]
    articles: list[EconomicsFilterOptionRead]


class EconomicsDashboardMetricRead(BaseModel):
    key: str
    label: str
    current: Decimal | None
    previous: Decimal | None = None
    delta: Decimal | None = None
    delta_percent: Decimal | None = None


class EconomicsDashboardResponse(BaseModel):
    date_from: date
    date_to: date
    previous_date_from: date | None = None
    previous_date_to: date | None = None
    metrics: list[EconomicsDashboardMetricRead]
