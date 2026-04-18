from datetime import date, timedelta
from decimal import Decimal
from time import perf_counter
from uuid import UUID

from fastapi import HTTPException
import psycopg

from backend.app.modules.auth.service import AccessTokenPayload
from backend.app.modules.economics.repository import EconomicsRepository
from backend.app.modules.economics.schemas import (
    EconomicsAdvertDiagnosticsCampaignRead,
    EconomicsAdvertDiagnosticsResponse,
    EconomicsDashboardMetricRead,
    EconomicsDashboardResponse,
    EconomicsFilterOptionRead,
    EconomicsFilterOptionsResponse,
    EconomicsPeriodItemRead,
    EconomicsPeriodItemsResponse,
    EconomicsPeriodSizeRead,
    EconomicsPeriodTotalsRead,
)


class EconomicsService:
    _DASHBOARD_METRICS: tuple[tuple[str, str], ...] = (
        ('sales_quantity', 'Продажи'),
        ('order_count', 'Количество заказов'),
        ('order_sum', 'Сумма заказов'),
        ('delivery_quantity', 'Количество доставок'),
        ('refusal_quantity', 'Количество отказов'),
        ('buyout_percent', '% выкупа'),
        ('realization_before_spp', 'Реализация до СПП'),
        ('realization_after_spp', 'Реализация после СПП'),
        ('spp_amount', 'СПП'),
        ('spp_percent', '% СПП'),
        ('seller_transfer', 'Перечисления продавцу'),
        ('wb_commission_amount', 'Комиссия ВБ'),
        ('wb_commission_percent', '% комиссии ВБ'),
        ('delivery_cost_base', 'Базовая логистика'),
        ('delivery_cost_correction', 'Коррекция логистики'),
        ('delivery_cost', 'Логистика'),
        ('paid_storage_cost', 'Хранение'),
        ('acceptance_cost', 'Платная приемка'),
        ('penalty_cost', 'Штрафы'),
        ('advert_cost', 'Реклама'),
        ('tax_amount', 'Налог'),
        ('cogs_amount', 'Себестоимость'),
        ('profit_amount', 'Прибыль'),
        ('margin_percent', 'Маржа, %'),
        ('roi_percent', 'ROI, %'),
    )
    _SORT_MAP = {
        'vendor_code_asc': 'vendor_code asc nulls last, nm_id',
        'vendor_code_desc': 'vendor_code desc nulls last, nm_id',
        'profit_desc': 'profit_amount desc nulls last, vendor_code nulls last, nm_id',
        'profit_asc': 'profit_amount asc nulls last, vendor_code nulls last, nm_id',
        'revenue_desc': 'realization_before_spp desc nulls last, vendor_code nulls last, nm_id',
        'revenue_asc': 'realization_before_spp asc nulls last, vendor_code nulls last, nm_id',
        'margin_desc': 'margin_percent desc nulls last, vendor_code nulls last, nm_id',
        'margin_asc': 'margin_percent asc nulls last, vendor_code nulls last, nm_id',
        'roi_desc': 'roi_percent desc nulls last, vendor_code nulls last, nm_id',
        'roi_asc': 'roi_percent asc nulls last, vendor_code nulls last, nm_id',
    }

    def __init__(self, conn: psycopg.AsyncConnection) -> None:
        self._repository = EconomicsRepository(conn)

    async def _ensure_account_access(self, *, principal: AccessTokenPayload, account_id: UUID) -> None:
        started_at = perf_counter()
        if not await self._repository.user_has_account_access(user_id=principal.user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')
        elapsed_ms = (perf_counter() - started_at) * 1000
        print(
            'economics_access_check_timing '
            f'user_id={principal.user_id} account_id={account_id} elapsed_ms={elapsed_ms:.1f}'
        )

    async def list_period_items(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        date_from: date,
        date_to: date,
        search: str | None,
        subjects: list[str] | None,
        brands: list[str] | None,
        articles: list[str] | None,
        sort: str | None,
        limit: int,
        offset: int,
        only_negative_profit: bool,
        min_profit: Decimal | None,
        max_profit: Decimal | None,
    ) -> EconomicsPeriodItemsResponse:
        total_started_at = perf_counter()
        await self._ensure_account_access(principal=principal, account_id=account_id)
        if date_from > date_to:
            raise HTTPException(status_code=400, detail='date_from must be less than or equal to date_to')

        if sort is None:
            order_by = (
                "case when coalesce(sales_quantity, 0) <> 0 or coalesce(realization_before_spp, 0) <> 0 \
                or coalesce(seller_transfer, 0) <> 0 then 0 else 1 end, "
                "realization_before_spp desc nulls last, seller_transfer desc nulls last, "
                "vendor_code nulls last, nm_id"
            )
        else:
            order_by = self._SORT_MAP.get(sort)
            if order_by is None:
                raise HTTPException(status_code=400, detail='invalid sort')

        repository_started_at = perf_counter()
        rows, totals_row = await self._repository.list_period_items(
            account_id,
            date_from,
            date_to,
            search,
            subjects,
            brands,
            articles,
            order_by,
            limit,
            offset,
            only_negative_profit,
            min_profit,
            max_profit,
        )
        repository_ms = (perf_counter() - repository_started_at) * 1000
        response_started_at = perf_counter()
        items = [EconomicsPeriodItemRead.model_validate(row) for row in rows]
        totals = EconomicsPeriodTotalsRead.model_validate(totals_row)
        response = EconomicsPeriodItemsResponse(items=items, totals=totals)
        response_ms = (perf_counter() - response_started_at) * 1000
        total_ms = (perf_counter() - total_started_at) * 1000
        print(
            'economics_service_timing '
            f'endpoint=period_items account_id={account_id} rows={len(rows)} '
            f'repository_ms={repository_ms:.1f} response_ms={response_ms:.1f} total_ms={total_ms:.1f}'
        )
        return response

    async def list_period_sizes(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        date_from: date,
        date_to: date,
        nm_id: int,
        vendor_code: str,
    ) -> list[EconomicsPeriodSizeRead]:
        total_started_at = perf_counter()
        await self._ensure_account_access(principal=principal, account_id=account_id)
        if date_from > date_to:
            raise HTTPException(status_code=400, detail='date_from must be less than or equal to date_to')

        repository_started_at = perf_counter()
        rows = await self._repository.list_period_sizes(account_id, date_from, date_to, nm_id, vendor_code)
        repository_ms = (perf_counter() - repository_started_at) * 1000
        response_started_at = perf_counter()
        response = [EconomicsPeriodSizeRead.model_validate(row) for row in rows]
        response_ms = (perf_counter() - response_started_at) * 1000
        total_ms = (perf_counter() - total_started_at) * 1000
        print(
            'economics_service_timing '
            f'endpoint=period_sizes account_id={account_id} rows={len(rows)} '
            f'repository_ms={repository_ms:.1f} response_ms={response_ms:.1f} total_ms={total_ms:.1f}'
        )
        return response


    async def list_filter_options(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        date_from: date,
        date_to: date,
    ) -> EconomicsFilterOptionsResponse:
        total_started_at = perf_counter()
        await self._ensure_account_access(principal=principal, account_id=account_id)
        if date_from > date_to:
            raise HTTPException(status_code=400, detail='date_from must be less than or equal to date_to')

        repository_started_at = perf_counter()
        row = await self._repository.list_filter_options(account_id, date_from, date_to)
        repository_ms = (perf_counter() - repository_started_at) * 1000
        response_started_at = perf_counter()
        response = EconomicsFilterOptionsResponse(
            subjects=[EconomicsFilterOptionRead.model_validate(item) for item in row.get('subjects', [])],
            brands=[EconomicsFilterOptionRead.model_validate(item) for item in row.get('brands', [])],
            articles=[EconomicsFilterOptionRead.model_validate(item) for item in row.get('articles', [])],
        )
        response_ms = (perf_counter() - response_started_at) * 1000
        total_ms = (perf_counter() - total_started_at) * 1000
        print(
            'economics_service_timing '
            f'endpoint=filter_options account_id={account_id} '
            f'subjects={len(row.get("subjects", []))} brands={len(row.get("brands", []))} '
            f'articles={len(row.get("articles", []))} repository_ms={repository_ms:.1f} '
            f'response_ms={response_ms:.1f} total_ms={total_ms:.1f}'
        )
        return response

    async def get_dashboard(
        self,
        principal: AccessTokenPayload,
        account_id: UUID,
        date_from: date,
        date_to: date,
        subjects: list[str] | None,
        brands: list[str] | None,
        articles: list[str] | None,
        compare_previous: bool,
    ) -> EconomicsDashboardResponse:
        total_started_at = perf_counter()
        await self._ensure_account_access(principal=principal, account_id=account_id)
        if date_from > date_to:
            raise HTTPException(status_code=400, detail='date_from must be less than or equal to date_to')

        current_started_at = perf_counter()
        current_totals = EconomicsPeriodTotalsRead.model_validate(
            await self._repository.get_period_totals(
                account_id=account_id,
                date_from=date_from,
                date_to=date_to,
                search=None,
                subjects=subjects,
                brands=brands,
                articles=articles,
                only_negative_profit=False,
                min_profit=None,
                max_profit=None,
            )
        )
        current_ms = (perf_counter() - current_started_at) * 1000

        previous_date_from: date | None = None
        previous_date_to: date | None = None
        previous_totals: EconomicsPeriodTotalsRead | None = None
        previous_ms = 0.0

        if compare_previous:
            previous_date_from, previous_date_to = self._build_previous_period(date_from, date_to)
            previous_started_at = perf_counter()
            previous_totals = EconomicsPeriodTotalsRead.model_validate(
                await self._repository.get_period_totals(
                    account_id=account_id,
                    date_from=previous_date_from,
                    date_to=previous_date_to,
                    search=None,
                    subjects=subjects,
                    brands=brands,
                    articles=articles,
                    only_negative_profit=False,
                    min_profit=None,
                    max_profit=None,
                )
            )
            previous_ms = (perf_counter() - previous_started_at) * 1000

        response_started_at = perf_counter()
        metrics = [
            self._build_dashboard_metric(
                key=key,
                label=label,
                current=getattr(current_totals, key),
                previous=getattr(previous_totals, key) if previous_totals is not None else None,
            )
            for key, label in self._DASHBOARD_METRICS
        ]

        response = EconomicsDashboardResponse(
            date_from=date_from,
            date_to=date_to,
            previous_date_from=previous_date_from,
            previous_date_to=previous_date_to,
            metrics=metrics,
        )
        response_ms = (perf_counter() - response_started_at) * 1000
        total_ms = (perf_counter() - total_started_at) * 1000
        print(
            'economics_service_timing '
            f'endpoint=dashboard account_id={account_id} compare_previous={compare_previous} '
            f'current_ms={current_ms:.1f} previous_ms={previous_ms:.1f} '
            f'response_ms={response_ms:.1f} total_ms={total_ms:.1f}'
        )
        return response

    async def get_advert_diagnostics(
        self,
        *,
        principal: AccessTokenPayload,
        account_id: UUID,
        date_from: date,
        date_to: date,
    ) -> EconomicsAdvertDiagnosticsResponse:
        total_started_at = perf_counter()
        await self._ensure_account_access(principal=principal, account_id=account_id)
        if date_from > date_to:
            raise HTTPException(status_code=400, detail='date_from must be less than or equal to date_to')

        totals_started_at = perf_counter()
        totals_row = await self._repository.get_advert_diagnostics_totals(
            account_id=account_id,
            date_from=date_from,
            date_to=date_to,
        )
        totals_ms = (perf_counter() - totals_started_at) * 1000
        campaigns_started_at = perf_counter()
        campaigns = [
            EconomicsAdvertDiagnosticsCampaignRead.model_validate(row)
            for row in await self._repository.list_advert_diagnostic_campaigns(
                account_id=account_id,
                date_from=date_from,
                date_to=date_to,
            )
        ]
        campaigns_ms = (perf_counter() - campaigns_started_at) * 1000
        response_started_at = perf_counter()
        response = EconomicsAdvertDiagnosticsResponse(
            date_from=date_from,
            date_to=date_to,
            raw_advert_cost=totals_row.get('raw_advert_cost', Decimal('0')),
            sku_advert_cost=totals_row.get('sku_advert_cost', Decimal('0')),
            unattributed_advert_cost=totals_row.get('unattributed_advert_cost', Decimal('0')),
            campaigns=campaigns,
        )
        response_ms = (perf_counter() - response_started_at) * 1000
        total_ms = (perf_counter() - total_started_at) * 1000
        print(
            'economics_service_timing '
            f'endpoint=advert_diagnostics account_id={account_id} campaigns={len(campaigns)} '
            f'totals_ms={totals_ms:.1f} campaigns_ms={campaigns_ms:.1f} '
            f'response_ms={response_ms:.1f} total_ms={total_ms:.1f}'
        )
        return response

    def _build_totals(self, items: list[EconomicsPeriodItemRead]) -> EconomicsPeriodTotalsRead:
        sales_quantity = self._sum(items, 'sales_quantity')
        order_count = self._sum(items, 'order_count')
        order_sum = self._sum(items, 'order_sum')
        retail_amount_sale = self._sum(items, 'retail_amount_sale')
        delivery_quantity = self._sum(items, 'delivery_quantity')
        refusal_quantity = self._sum(items, 'refusal_quantity')
        return_quantity = self._sum(items, 'return_quantity')
        realization_before_spp = self._sum(items, 'realization_before_spp')
        realization_after_spp = self._sum(items, 'realization_after_spp')
        spp_amount = self._sum(items, 'spp_amount')
        seller_transfer = self._sum(items, 'seller_transfer')
        wb_commission_amount = self._sum(items, 'wb_commission_amount')
        advert_cost = self._sum(items, 'advert_cost')
        delivery_cost_base = self._sum(items, 'delivery_cost_base')
        delivery_cost_correction = self._sum(items, 'delivery_cost_correction')
        delivery_cost = self._sum(items, 'delivery_cost')
        paid_storage_cost = self._sum(items, 'paid_storage_cost')
        penalty_cost = self._sum(items, 'penalty_cost')
        acceptance_cost = self._sum(items, 'acceptance_cost')
        tax_amount = self._sum(items, 'tax_amount')
        cogs_amount = self._sum(items, 'cogs_amount')
        profit_amount = self._sum(items, 'profit_amount')

        return EconomicsPeriodTotalsRead(
            sales_quantity=sales_quantity,
            order_count=order_count,
            order_sum=order_sum,
            retail_amount_sale=retail_amount_sale,
            delivery_quantity=delivery_quantity,
            refusal_quantity=refusal_quantity,
            return_quantity=return_quantity,
            buyout_percent=self._percent(sales_quantity, delivery_quantity),
            realization_before_spp=realization_before_spp,
            realization_after_spp=realization_after_spp,
            spp_amount=spp_amount,
            spp_percent=self._percent(spp_amount, realization_before_spp),
            seller_transfer=seller_transfer,
            wb_commission_amount=wb_commission_amount,
            wb_commission_percent=self._percent(wb_commission_amount, realization_before_spp),
            advert_cost=advert_cost,
            delivery_cost_base=delivery_cost_base,
            delivery_cost_correction=delivery_cost_correction,
            delivery_cost=delivery_cost,
            paid_storage_cost=paid_storage_cost,
            penalty_cost=penalty_cost,
            acceptance_cost=acceptance_cost,
            tax_amount=tax_amount,
            cogs_amount=cogs_amount,
            profit_amount=profit_amount,
            margin_percent=self._percent(profit_amount, realization_before_spp),
            roi_percent=self._percent(profit_amount, cogs_amount),
        )

    @staticmethod
    def _sum(items: list[EconomicsPeriodItemRead], field: str) -> Decimal:
        total = Decimal('0')
        for item in items:
            value = getattr(item, field)
            if value is not None:
                total += Decimal(str(value))
        return total

    @staticmethod
    def _percent(numerator: Decimal, denominator: Decimal) -> Decimal | None:
        if denominator == 0:
            return None
        return ((numerator / denominator) * Decimal('100')).quantize(Decimal('0.01'))

    @staticmethod
    def _build_previous_period(date_from: date, date_to: date) -> tuple[date, date]:
        period_days = (date_to - date_from).days + 1
        previous_date_to = date_from - timedelta(days=1)
        previous_date_from = previous_date_to - timedelta(days=period_days - 1)
        return previous_date_from, previous_date_to

    @staticmethod
    def _build_dashboard_metric(
        key: str,
        label: str,
        current: Decimal | None,
        previous: Decimal | None,
    ) -> EconomicsDashboardMetricRead:
        delta: Decimal | None = None
        delta_percent: Decimal | None = None

        if current is not None and previous is not None:
            delta = (current - previous).quantize(Decimal('0.01'))
            if previous != 0:
                delta_percent = ((delta / previous) * Decimal('100')).quantize(Decimal('0.01'))

        return EconomicsDashboardMetricRead(
            key=key,
            label=label,
            current=current,
            previous=previous,
            delta=delta,
            delta_percent=delta_percent,
        )
