from datetime import date, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
import psycopg

from courier.common import get_week_start
from backend.app.modules.sync.executor import SyncExecutor
from backend.app.modules.sync.repository import SyncRepository
from backend.app.modules.sync.schemas import (
    DateRangeRead,
    SyncDataset,
    SyncCoverageActiveJobRead,
    SyncCoverageDatasetRead,
    SyncCoverageResponse,
    SyncCoverageSectionRead,
    SyncCoverageSectionStatus,
    SyncHistoryGapFillRequest,
    SyncHistoryGapFillResponse,
    SyncJobCreate,
    SyncJobCreateResponse,
    SyncJobDetailsResponse,
    SyncJobRead,
    SyncJobStatus,
    SyncJobStepRead,
    SyncJobStepStatus,
    SyncJobType,
    SyncMode,
)


class SyncService:
    _HISTORICAL_DATASETS: tuple[tuple[SyncDataset, str], ...] = (
        (SyncDataset.SALES, 'Продажи'),
        (SyncDataset.ADVERTS_SNAPSHOT, 'Реклама'),
        (SyncDataset.ADVERTS_COST, 'Расходы рекламы'),
        (SyncDataset.ACCEPTANCE, 'Приёмка'),
        (SyncDataset.STORAGE, 'Хранение'),
    )
    _OPERATIONAL_DATASETS: tuple[tuple[str, str, SyncDataset, SyncMode, SyncJobType], ...] = (
        ('open_week', 'Незакрытая неделя', SyncDataset.SALES, SyncMode.DAILY, SyncJobType.OPEN_WEEK_REFRESH),
        ('orders', 'Воронка / заказы', SyncDataset.SALES_FUNNEL, SyncMode.DAILY, SyncJobType.OPEN_WEEK_REFRESH),
    )
    _REFERENCE_DATASETS: tuple[tuple[str, str], ...] = (
        ('cards', 'Карточки'),
        ('stocks', 'Остатки'),
        ('supplies', 'Поставки'),
    )
    _GAP_FILL_DATASETS: tuple[SyncDataset, ...] = (
        SyncDataset.ADVERTS_SNAPSHOT,
        SyncDataset.ADVERTS_COST,
        SyncDataset.ACCEPTANCE,
        SyncDataset.STORAGE,
    )

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn
        self._repository = SyncRepository(conn)

    def create_job(self, payload: SyncJobCreate, *, user_id: UUID) -> SyncJobCreateResponse:
        self._ensure_account_access(user_id=user_id, account_id=payload.account_id)
        if payload.job_type == SyncJobType.INITIAL_SALES_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for sales backfill')
            return self._create_initial_sales_job(payload)
        if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for funnel backfill')
            return self._create_sales_funnel_job(payload)
        if payload.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH:
            if payload.mode != SyncMode.DAILY:
                raise HTTPException(status_code=400, detail='Stock snapshot refresh supports only daily mode')
            return self._create_stock_snapshot_job(payload)
        if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH:
            if payload.mode != SyncMode.DAILY:
                raise HTTPException(status_code=400, detail='Open week refresh supports only daily mode')
            return self._create_open_week_job(payload)
        raise HTTPException(status_code=400, detail='Unsupported job type for MVP')

    def continue_job(self, payload: SyncJobCreate, *, user_id: UUID) -> SyncJobCreateResponse:
        self._ensure_account_access(user_id=user_id, account_id=payload.account_id)
        if payload.job_type == SyncJobType.INITIAL_SALES_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for sales backfill')
            return self._continue_initial_sales_job(payload)
        if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL:
            if payload.mode != SyncMode.WEEKLY:
                raise HTTPException(status_code=400, detail='MVP supports only weekly mode for funnel backfill')
            return self._continue_sales_funnel_job(payload)
        if payload.job_type == SyncJobType.STOCK_SNAPSHOT_REFRESH:
            raise HTTPException(status_code=400, detail='Stock snapshot refresh does not support continue; start a fresh snapshot job instead.')
        if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH:
            raise HTTPException(status_code=400, detail='Open week refresh does not support continue; start a fresh open-week job instead.')
        raise HTTPException(status_code=400, detail='Unsupported job type for MVP')

    def fill_missing_history(
        self,
        payload: SyncHistoryGapFillRequest,
        *,
        user_id: UUID,
    ) -> SyncHistoryGapFillResponse:
        self._ensure_account_access(user_id=user_id, account_id=payload.account_id)
        datasets = self._normalize_gap_fill_datasets(payload.datasets)
        active_jobs = self._repository.list_active_jobs_for_account(payload.account_id)

        conflicting_job = self._find_conflicting_historical_job(active_jobs, datasets=datasets)
        if conflicting_job is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется историческая загрузка: '
                    f"job_id={conflicting_job['job_id']}. "
                    'Дождитесь завершения текущей job или остановите её перед догрузкой отставания.'
                ),
            )

        sales_periods = self._repository.list_dataset_success_periods(
            payload.account_id,
            dataset=SyncDataset.SALES.value,
            mode=SyncMode.WEEKLY.value,
        )
        if not sales_periods:
            raise HTTPException(
                status_code=400,
                detail='Сначала нужно загрузить продажи. Нельзя догрузить историю относительно sales, если sales ещё не загружены.',
            )

        plan_map: dict[tuple[date, date], list[SyncDataset]] = {}
        include_adverts_snapshot_prepare = False

        adverts_snapshot_prepared = self._repository.has_successful_prepare_step_for_account(
            payload.account_id,
            mode=SyncMode.WEEKLY.value,
            dataset=SyncDataset.ADVERTS_SNAPSHOT.value,
        )

        for dataset in datasets:
            if dataset == SyncDataset.ADVERTS_SNAPSHOT:
                include_adverts_snapshot_prepare = include_adverts_snapshot_prepare or not adverts_snapshot_prepared
                continue

            target_periods = self._repository.list_dataset_success_periods(
                payload.account_id,
                dataset=dataset.value,
                mode=SyncMode.WEEKLY.value,
            )
            missing_periods = self._compute_missing_periods_against_anchor(sales_periods, target_periods)
            if dataset == SyncDataset.ADVERTS_COST and missing_periods:
                include_adverts_snapshot_prepare = True

            for period_from, period_to in missing_periods:
                plan_map.setdefault((period_from, period_to), [])
                if dataset not in plan_map[(period_from, period_to)]:
                    plan_map[(period_from, period_to)].append(dataset)

        weekly_step_plan = [
            (period_from, period_to, datasets_for_period)
            for (period_from, period_to), datasets_for_period in sorted(plan_map.items(), key=lambda item: item[0][0], reverse=True)
        ]

        planned_steps = sum(len(datasets_for_period) for _, _, datasets_for_period in weekly_step_plan)
        if include_adverts_snapshot_prepare:
            planned_steps += 1

        if planned_steps == 0:
            return SyncHistoryGapFillResponse(
                status='noop',
                message='Все выбранные данные уже догружены относительно продаж.',
                datasets=datasets,
                planned_steps=0,
            )

        sales_bounds = self._repository.get_dataset_coverage_bounds(
            payload.account_id,
            dataset=SyncDataset.SALES.value,
            mode=SyncMode.WEEKLY.value,
        )
        if sales_bounds is None:
            raise HTTPException(status_code=400, detail='Не удалось определить покрытие продаж для historical gap-fill.')

        effective_date_from = min(
            [period_from for period_from, _, _ in weekly_step_plan],
            default=sales_bounds['loaded_from'],
        )
        effective_date_to = max(
            [period_to for _, period_to, _ in weekly_step_plan],
            default=sales_bounds['loaded_to'],
        )

        job_response = self._create_job_with_plan(
            payload=SyncJobCreate(
                account_id=payload.account_id,
                job_type=SyncJobType.HISTORY_GAP_FILL,
                mode=SyncMode.WEEKLY,
                date_from=effective_date_from,
                date_to=effective_date_to,
                datasets=datasets,
            ),
            weekly_step_plan=weekly_step_plan,
            datasets=datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=include_adverts_snapshot_prepare,
        )
        return SyncHistoryGapFillResponse(
            job_id=job_response.job_id,
            status='pending',
            datasets=datasets,
            planned_steps=planned_steps,
        )

    def _create_initial_sales_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_initial_sales_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется weekly-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Сейчас нельзя молча подменять её новой job. Дождитесь завершения текущей job '
                    'или остановите её, затем запустите выбранный период.'
                ),
            )

        weekly_ranges = self._build_closed_week_ranges(payload.date_from, payload.date_to)
        weekly_step_plan = self._build_weekly_step_plan(weekly_ranges=weekly_ranges, datasets=effective_datasets)
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=SyncDataset.CARDS in effective_datasets,
            include_adverts_snapshot_prepare=SyncDataset.ADVERTS_SNAPSHOT in effective_datasets,
        )

    def _create_sales_funnel_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_sales_funnel_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES_FUNNEL.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется funnel-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Дождитесь завершения текущей funnel job или остановите её, затем запустите новый период.'
                ),
            )

        daily_ranges = self._build_closed_day_ranges(payload.date_from, payload.date_to)
        weekly_step_plan = [
            (period_from, period_to, [SyncDataset.SALES_FUNNEL])
            for period_from, period_to in daily_ranges
        ]
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=False,
        )

    def _create_open_week_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_open_week_datasets(payload.datasets)
        open_week_from, open_week_to = self._build_open_week_range(payload.date_to)
        effective_payload = SyncJobCreate(
            account_id=payload.account_id,
            job_type=payload.job_type,
            mode=payload.mode,
            date_from=open_week_from,
            date_to=open_week_to,
            datasets=effective_datasets,
        )

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES.value,
        )
        if active_job is not None and active_job['job_type'] == SyncJobType.OPEN_WEEK_REFRESH.value:
            if active_job['date_from'] == open_week_from and active_job['date_to'] == open_week_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )
            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется обновление незакрытой недели: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). Дождитесь завершения текущей job или остановите её."
                ),
            )

        open_week_plan = [
            (
                open_week_from,
                open_week_to,
                [
                    dataset
                    for dataset in effective_datasets
                    if dataset in {SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE}
                ],
            )
        ]
        if SyncDataset.SALES_FUNNEL in effective_datasets:
            cursor = open_week_from
            while cursor <= open_week_to:
                open_week_plan.append((cursor, cursor, [SyncDataset.SALES_FUNNEL]))
                cursor += timedelta(days=1)
        return self._create_job_with_plan(
            payload=effective_payload,
            weekly_step_plan=open_week_plan,
            datasets=effective_datasets,
            include_cards_prepare=True,
            include_adverts_snapshot_prepare=True,
        )

    def _create_stock_snapshot_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_stock_snapshot_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.WAREHOUSE_REMAINS.value,
        )
        if active_job is not None:
            return SyncJobCreateResponse(
                job_id=active_job['job_id'],
                status=SyncJobStatus(active_job['status']),
            )

        snapshot_day = payload.date_to
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=[(snapshot_day, snapshot_day, [SyncDataset.WAREHOUSE_REMAINS])],
            datasets=effective_datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=False,
        )

    def _continue_initial_sales_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_initial_sales_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется weekly-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Сейчас нельзя молча подменять её новой job. Дождитесь завершения текущей job '
                    'или остановите её, затем продолжите выбранный период.'
                ),
            )

        weekly_ranges = self._build_closed_week_ranges(payload.date_from, payload.date_to)
        successful_periods_by_dataset = {
            dataset: {
                (row['period_from'], row['period_to'])
                for row in self._repository.list_successful_step_periods_for_account(
                    payload.account_id,
                    mode=payload.mode.value,
                    dataset=dataset.value,
                    date_from=payload.date_from,
                    date_to=payload.date_to,
                    job_type=payload.job_type.value,
                )
            }
            for dataset in (SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE)
        }

        weekly_step_plan: list[tuple[date, date, list[SyncDataset]]] = []
        for period_from, period_to in weekly_ranges:
            remaining_datasets = [
                dataset
                for dataset in (SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE)
                if (period_from, period_to) not in successful_periods_by_dataset[dataset]
            ]
            if remaining_datasets:
                weekly_step_plan.append((period_from, period_to, remaining_datasets))

        include_cards_prepare = not self._repository.has_successful_prepare_step_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.CARDS.value,
            job_type=payload.job_type.value,
        )
        include_adverts_snapshot_prepare = not self._repository.has_successful_prepare_step_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.ADVERTS_SNAPSHOT.value,
            job_type=payload.job_type.value,
        )

        if not weekly_step_plan and not include_cards_prepare and not include_adverts_snapshot_prepare:
            raise HTTPException(status_code=400, detail='Все закрытые недели в выбранном периоде уже успешно загружены.')

        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=include_cards_prepare,
            include_adverts_snapshot_prepare=include_adverts_snapshot_prepare,
        )

    def _continue_sales_funnel_job(self, payload: SyncJobCreate) -> SyncJobCreateResponse:
        effective_datasets = self._normalize_sales_funnel_datasets(payload.datasets)

        active_job = self._repository.get_active_job_for_account(
            payload.account_id,
            mode=payload.mode.value,
            dataset=SyncDataset.SALES_FUNNEL.value,
        )
        if active_job is not None:
            if active_job['date_from'] == payload.date_from and active_job['date_to'] == payload.date_to:
                return SyncJobCreateResponse(
                    job_id=active_job['job_id'],
                    status=SyncJobStatus(active_job['status']),
                )

            raise HTTPException(
                status_code=409,
                detail=(
                    'По этому кабинету уже выполняется funnel-загрузка за другой период: '
                    f"{active_job['date_from'].isoformat()} .. {active_job['date_to'].isoformat()} "
                    f"(job_id={active_job['job_id']}). "
                    'Дождитесь завершения текущей funnel job или остановите её, затем продолжите выбранный период.'
                ),
            )

        daily_ranges = self._build_closed_day_ranges(payload.date_from, payload.date_to)
        successful_days = {
            (row['period_from'], row['period_to'])
            for row in self._repository.list_successful_step_periods_for_account(
                payload.account_id,
                mode=payload.mode.value,
                dataset=SyncDataset.SALES_FUNNEL.value,
                date_from=payload.date_from,
                date_to=payload.date_to,
                job_type=payload.job_type.value,
            )
        }
        weekly_step_plan = [
            (period_from, period_to, [SyncDataset.SALES_FUNNEL])
            for period_from, period_to in daily_ranges
            if (period_from, period_to) not in successful_days
        ]

        if not weekly_step_plan:
            raise HTTPException(status_code=400, detail='Все закрытые дни воронки в выбранном периоде уже успешно загружены.')

        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=False,
            include_adverts_snapshot_prepare=False,
        )

    def get_job_details(self, job_id: UUID, *, user_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        step_rows = self._repository.list_job_steps(job_id)
        return SyncJobDetailsResponse(
            job=SyncJobRead.model_validate(job_row),
            steps=[SyncJobStepRead.model_validate(row) for row in step_rows],
        )

    def get_account_coverage(self, account_id: UUID, *, user_id: UUID) -> SyncCoverageResponse:
        self._ensure_account_access(user_id=user_id, account_id=account_id)
        active_jobs = self._repository.list_active_jobs_for_account(account_id)
        return SyncCoverageResponse(
            account_id=account_id,
            historical=self._build_historical_coverage(account_id, active_jobs=active_jobs),
            operational=self._build_operational_coverage(account_id, active_jobs=active_jobs),
            reference_data=self._build_reference_coverage(account_id, active_jobs=active_jobs),
            active_jobs=[
                SyncCoverageActiveJobRead(
                    job_id=row['job_id'],
                    job_type=SyncJobType(row['job_type']),
                    mode=SyncMode(row['mode']),
                    status=SyncJobStatus(row['status']),
                )
                for row in active_jobs
            ],
        )

    def _create_job_with_plan(
        self,
        *,
        payload: SyncJobCreate,
        weekly_step_plan: list[tuple[date, date, list[SyncDataset]]],
        datasets: list[SyncDataset],
        include_cards_prepare: bool,
        include_adverts_snapshot_prepare: bool,
    ) -> SyncJobCreateResponse:
        if not weekly_step_plan and not include_cards_prepare and not include_adverts_snapshot_prepare:
            detail = 'No closed full weeks found in the selected period'
            if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH:
                detail = 'No open-week steps found for the selected period'
            raise HTTPException(status_code=400, detail=detail)

        job_id = uuid4()
        job_row = self._repository.create_job(
            job_id=job_id,
            account_id=payload.account_id,
            job_type=payload.job_type.value,
            mode=payload.mode.value,
            date_from=payload.date_from,
            date_to=payload.date_to,
            status=SyncJobStatus.PENDING.value,
            datasets=[dataset.value for dataset in datasets],
        )

        if include_cards_prepare:
            self._repository.create_step(
                step_id=uuid4(),
                job_id=job_id,
                dataset=SyncDataset.CARDS.value,
                period_from=payload.date_from,
                period_to=payload.date_to,
                status=SyncJobStepStatus.PENDING.value,
                payload_json={
                    'job_type': payload.job_type.value,
                    'mode': payload.mode.value,
                    'step_type': 'prepare',
                    'restart_from_progress': True,
                },
            )

        if include_adverts_snapshot_prepare:
            self._repository.create_step(
                step_id=uuid4(),
                job_id=job_id,
                dataset=SyncDataset.ADVERTS_SNAPSHOT.value,
                period_from=payload.date_from,
                period_to=payload.date_to,
                status=SyncJobStepStatus.PENDING.value,
                payload_json={
                    'job_type': payload.job_type.value,
                    'mode': payload.mode.value,
                    'step_type': 'prepare',
                    'restart_from_progress': True,
                },
            )

        for period_from, period_to, weekly_datasets in weekly_step_plan:
            for weekly_dataset in weekly_datasets:
                self._repository.create_step(
                    step_id=uuid4(),
                    job_id=job_id,
                    dataset=weekly_dataset.value,
                    period_from=period_from,
                    period_to=period_to,
                    status=SyncJobStepStatus.PENDING.value,
                    payload_json={
                        'job_type': payload.job_type.value,
                        'mode': payload.mode.value,
                        'step_type': 'snapshot' if weekly_dataset == SyncDataset.WAREHOUSE_REMAINS else 'open_week_dataset' if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH else 'weekly_dataset',
                        'run_marts_after': weekly_dataset == SyncDataset.WAREHOUSE_REMAINS or weekly_dataset == SyncDataset.STORAGE or (weekly_dataset == SyncDataset.ACCEPTANCE and SyncDataset.STORAGE not in weekly_datasets) or (weekly_dataset == SyncDataset.ADVERTS_COST and SyncDataset.ACCEPTANCE not in weekly_datasets and SyncDataset.STORAGE not in weekly_datasets) or (weekly_dataset == SyncDataset.SALES_FUNNEL and period_to == payload.date_to) or (weekly_dataset == SyncDataset.SALES and SyncDataset.SALES_FUNNEL not in datasets and SyncDataset.ADVERTS_COST not in weekly_datasets and SyncDataset.ACCEPTANCE not in weekly_datasets and SyncDataset.STORAGE not in weekly_datasets),
                        'restart_from_progress': True,
                    },
                )

        self._conn.commit()
        return SyncJobCreateResponse(job_id=job_row['job_id'], status=SyncJobStatus(job_row['status']))

    def _build_historical_coverage(
        self,
        account_id: UUID,
        *,
        active_jobs: list[dict],
    ) -> SyncCoverageSectionRead:
        datasets = [
            self._build_historical_dataset(
                account_id,
                dataset=dataset,
                label=label,
                active_jobs=active_jobs,
            )
            for dataset, label in self._HISTORICAL_DATASETS
        ]
        return SyncCoverageSectionRead(
            status=self._resolve_section_status(datasets),
            datasets=datasets,
        )

    def _build_operational_coverage(
        self,
        account_id: UUID,
        *,
        active_jobs: list[dict],
    ) -> SyncCoverageSectionRead:
        datasets = [
            self._build_operational_dataset(
                account_id,
                dataset_key=dataset_key,
                label=label,
                source_dataset=source_dataset,
                mode=mode,
                job_type=job_type,
                active_jobs=active_jobs,
            )
            for dataset_key, label, source_dataset, mode, job_type in self._OPERATIONAL_DATASETS
        ]
        return SyncCoverageSectionRead(
            status=self._resolve_section_status(datasets),
            datasets=datasets,
        )

    def _build_reference_coverage(
        self,
        account_id: UUID,
        *,
        active_jobs: list[dict],
    ) -> SyncCoverageSectionRead:
        datasets = [
            self._build_reference_dataset(
                account_id,
                dataset_key=dataset_key,
                label=label,
                active_jobs=active_jobs,
            )
            for dataset_key, label in self._REFERENCE_DATASETS
        ]
        return SyncCoverageSectionRead(
            status=self._resolve_section_status(datasets),
            datasets=datasets,
        )

    def _build_historical_dataset(
        self,
        account_id: UUID,
        *,
        dataset: SyncDataset,
        label: str,
        active_jobs: list[dict],
    ) -> SyncCoverageDatasetRead:
        periods = self._repository.list_dataset_success_periods(
            account_id,
            dataset=dataset.value,
            mode=SyncMode.WEEKLY.value,
        )
        bounds = self._repository.get_dataset_coverage_bounds(
            account_id,
            dataset=dataset.value,
            mode=SyncMode.WEEKLY.value,
        )
        last_problem = self._repository.get_dataset_last_problem(
            account_id,
            dataset=dataset.value,
            mode=SyncMode.WEEKLY.value,
        )
        is_loading = self._has_active_job(active_jobs, mode=SyncMode.WEEKLY, dataset=dataset)
        missing_periods = self._compute_missing_week_ranges(periods)
        status = self._resolve_dataset_status(
            has_data=bounds is not None,
            is_loading=is_loading,
            has_problem=last_problem is not None,
            has_gaps=bool(missing_periods),
            is_stale=False,
        )
        return SyncCoverageDatasetRead(
            dataset=dataset.value,
            label=label,
            loaded_from=bounds['loaded_from'] if bounds is not None else None,
            loaded_to=bounds['loaded_to'] if bounds is not None else None,
            last_success_at=bounds['last_success_at'] if bounds is not None else None,
            has_gaps=bool(missing_periods),
            missing_periods=missing_periods,
            status=status,
            comment=self._build_problem_comment(last_problem=last_problem, has_gaps=bool(missing_periods)),
        )

    def _build_operational_dataset(
        self,
        account_id: UUID,
        *,
        dataset_key: str,
        label: str,
        source_dataset: SyncDataset,
        mode: SyncMode,
        job_type: SyncJobType,
        active_jobs: list[dict],
    ) -> SyncCoverageDatasetRead:
        freshness = self._repository.get_operational_dataset_freshness(
            account_id,
            dataset=source_dataset.value,
            mode=mode.value,
            job_type=job_type.value,
        )
        last_problem = self._repository.get_dataset_last_problem(
            account_id,
            dataset=source_dataset.value,
            mode=mode.value,
            job_type=job_type.value,
        )
        is_loading = self._has_active_job(active_jobs, mode=mode, dataset=source_dataset, job_type=job_type)
        actual_to = freshness['actual_to'] if freshness is not None else None
        status = self._resolve_dataset_status(
            has_data=freshness is not None,
            is_loading=is_loading,
            has_problem=last_problem is not None,
            has_gaps=False,
            is_stale=self._is_operational_stale(actual_to),
        )
        return SyncCoverageDatasetRead(
            dataset=dataset_key,
            label=label,
            loaded_to=actual_to,
            actual_at=freshness['last_success_at'] if freshness is not None else None,
            last_success_at=freshness['last_success_at'] if freshness is not None else None,
            status=status,
            comment=self._build_problem_comment(last_problem=last_problem, has_gaps=False),
        )

    def _build_reference_dataset(
        self,
        account_id: UUID,
        *,
        dataset_key: str,
        label: str,
        active_jobs: list[dict],
    ) -> SyncCoverageDatasetRead:
        if dataset_key == 'cards':
            snapshot = self._repository.get_cards_snapshot(account_id)
            source_dataset = SyncDataset.CARDS
            mode = SyncMode.WEEKLY
        elif dataset_key == 'stocks':
            snapshot = self._repository.get_stocks_snapshot(account_id)
            source_dataset = SyncDataset.WAREHOUSE_REMAINS
            mode = SyncMode.DAILY
        else:
            snapshot = self._repository.get_supplies_snapshot(account_id)
            source_dataset = None
            mode = None

        last_problem = None
        is_loading = False
        if source_dataset is not None and mode is not None:
            last_problem = self._repository.get_dataset_last_problem(
                account_id,
                dataset=source_dataset.value,
                mode=mode.value,
            )
            is_loading = self._has_active_job(active_jobs, mode=mode, dataset=source_dataset)

        actual_at = None if snapshot is None else snapshot.get('actual_at') or snapshot.get('last_success_at')
        status = self._resolve_dataset_status(
            has_data=snapshot is not None,
            is_loading=is_loading,
            has_problem=last_problem is not None,
            has_gaps=False,
            is_stale=self._is_reference_stale(actual_at),
        )
        return SyncCoverageDatasetRead(
            dataset=dataset_key,
            label=label,
            actual_at=actual_at,
            last_success_at=None if snapshot is None else snapshot.get('last_success_at') or snapshot.get('actual_at'),
            entity_count=None if snapshot is None else snapshot.get('entity_count'),
            status=status,
            comment=self._build_problem_comment(last_problem=last_problem, has_gaps=False),
        )

    def should_resume_job(self, job_id: UUID, *, user_id: UUID) -> bool:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        if job_row['status'] != SyncJobStatus.RUNNING.value:
            return False

        recovered = self._repository.recover_timed_out_running_steps(job_id=job_id)
        if recovered > 0:
            self._repository.refresh_job_status(job_id)
            self._conn.commit()

        return self._repository.get_next_pending_step(job_id=job_id) is not None

    def run_job(self, job_id: UUID, *, user_id: UUID, max_steps: int = 1) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        executor = SyncExecutor()
        dataset = (
            SyncDataset.SALES_FUNNEL.value
            if job_row['job_type'] == SyncJobType.SALES_FUNNEL_BACKFILL.value
            else SyncDataset.WAREHOUSE_REMAINS.value if job_row['job_type'] == SyncJobType.STOCK_SNAPSHOT_REFRESH.value else None
        )
        executor.execute_job_until_done(job_id=job_id, dataset=dataset, max_steps=max_steps)

        return self.get_job_details(job_id, user_id=user_id)

    def retry_failed_steps(self, job_id: UUID, *, user_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        self._repository.reset_failed_steps(job_id)
        self._repository.refresh_job_status(job_id)
        self._conn.commit()
        return self.get_job_details(job_id, user_id=user_id)

    def cancel_job(self, job_id: UUID, *, user_id: UUID) -> SyncJobDetailsResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        self._repository.cancel_job(job_id)
        self._conn.commit()
        return self.get_job_details(job_id, user_id=user_id)

    def restart_job(self, job_id: UUID, *, user_id: UUID) -> SyncJobCreateResponse:
        job_row = self._repository.get_job(job_id)
        if job_row is None:
            raise HTTPException(status_code=404, detail='Sync job not found')
        self._ensure_account_access(user_id=user_id, account_id=job_row['account_id'])

        step_rows = self._repository.list_job_steps(job_id)
        weekly_step_datasets: dict[tuple[date, date], list[SyncDataset]] = {}
        for step in step_rows:
            if step['dataset'] not in {SyncDataset.SALES.value, SyncDataset.SALES_FUNNEL.value, SyncDataset.ADVERTS_COST.value, SyncDataset.ACCEPTANCE.value, SyncDataset.STORAGE.value, SyncDataset.WAREHOUSE_REMAINS.value}:
                continue
            if step['status'] == SyncJobStepStatus.SUCCESS.value:
                continue
            key = (step['period_from'], step['period_to'])
            weekly_step_datasets.setdefault(key, [])
            dataset_enum = SyncDataset(step['dataset'])
            if dataset_enum not in weekly_step_datasets[key]:
                weekly_step_datasets[key].append(dataset_enum)
        weekly_step_plan = [
            (period_from, period_to, datasets_for_week)
            for (period_from, period_to), datasets_for_week in sorted(weekly_step_datasets.items(), key=lambda item: item[0][0], reverse=True)
        ]
        include_cards_prepare = any(
            step['dataset'] == SyncDataset.CARDS.value and step['status'] != SyncJobStepStatus.SUCCESS.value
            for step in step_rows
        )
        include_adverts_snapshot_prepare = any(
            step['dataset'] == SyncDataset.ADVERTS_SNAPSHOT.value and step['status'] != SyncJobStepStatus.SUCCESS.value
            for step in step_rows
        )

        if not weekly_step_plan and not include_cards_prepare and not include_adverts_snapshot_prepare:
            raise HTTPException(status_code=400, detail='Эта job уже полностью загружена, перезапускать нечего.')

        if job_row['status'] in (SyncJobStatus.PENDING.value, SyncJobStatus.RUNNING.value):
            self._repository.cancel_job(job_id, reason='Cancelled by restart request')
            self._conn.commit()

        payload = SyncJobCreate(
            account_id=job_row['account_id'],
            job_type=SyncJobType(job_row['job_type']),
            mode=SyncMode(job_row['mode']),
            date_from=job_row['date_from'],
            date_to=job_row['date_to'],
            datasets=[SyncDataset(value) for value in job_row['datasets']],
        )
        effective_datasets = (
            self._normalize_initial_sales_datasets(payload.datasets)
            if payload.job_type == SyncJobType.INITIAL_SALES_BACKFILL
            else self._normalize_sales_funnel_datasets(payload.datasets) if payload.job_type == SyncJobType.SALES_FUNNEL_BACKFILL
            else self._normalize_open_week_datasets(payload.datasets) if payload.job_type == SyncJobType.OPEN_WEEK_REFRESH
            else self._normalize_stock_snapshot_datasets(payload.datasets)
        )
        return self._create_job_with_plan(
            payload=payload,
            weekly_step_plan=weekly_step_plan,
            datasets=effective_datasets,
            include_cards_prepare=include_cards_prepare,
            include_adverts_snapshot_prepare=include_adverts_snapshot_prepare,
        )

    def _ensure_account_access(self, *, user_id: UUID, account_id: UUID) -> None:
        if not self._repository.user_has_account_access(user_id=user_id, account_id=account_id):
            raise HTTPException(status_code=403, detail='Access to this account is forbidden.')

    def _has_active_job(
        self,
        active_jobs: list[dict],
        *,
        mode: SyncMode,
        dataset: SyncDataset,
        job_type: SyncJobType | None = None,
    ) -> bool:
        for job in active_jobs:
            if job['mode'] != mode.value:
                continue
            if dataset.value not in (job.get('datasets') or []):
                continue
            if job_type is not None and job['job_type'] != job_type.value:
                continue
            return True
        return False

    def _compute_missing_week_ranges(self, periods: list[dict]) -> list[DateRangeRead]:
        if not periods:
            return []

        normalized_periods = sorted(
            {
                (row['date_from'], row['date_to'])
                for row in periods
                if row.get('date_from') is not None and row.get('date_to') is not None
            },
            key=lambda row: row[0],
        )
        if not normalized_periods:
            return []

        first_start = get_week_start(normalized_periods[0][0])
        last_start = get_week_start(normalized_periods[-1][0])
        loaded_weeks = {get_week_start(period_from) for period_from, _ in normalized_periods}

        missing_periods: list[DateRangeRead] = []
        cursor = first_start
        while cursor <= last_start:
            if cursor not in loaded_weeks:
                missing_periods.append(
                    DateRangeRead(
                        date_from=cursor,
                        date_to=cursor + timedelta(days=6),
                    )
                )
            cursor += timedelta(days=7)
        return missing_periods

    def _resolve_dataset_status(
        self,
        *,
        has_data: bool,
        is_loading: bool,
        has_problem: bool,
        has_gaps: bool,
        is_stale: bool,
    ) -> SyncCoverageSectionStatus:
        if is_loading:
            return SyncCoverageSectionStatus.LOADING
        if not has_data:
            return SyncCoverageSectionStatus.ERROR if has_problem else SyncCoverageSectionStatus.EMPTY
        if has_problem or has_gaps:
            return SyncCoverageSectionStatus.PARTIAL
        if is_stale:
            return SyncCoverageSectionStatus.STALE
        return SyncCoverageSectionStatus.ACTUAL

    def _resolve_section_status(self, datasets: list[SyncCoverageDatasetRead]) -> SyncCoverageSectionStatus:
        if not datasets:
            return SyncCoverageSectionStatus.EMPTY

        statuses = {dataset.status for dataset in datasets}
        if SyncCoverageSectionStatus.LOADING in statuses:
            return SyncCoverageSectionStatus.LOADING
        if SyncCoverageSectionStatus.PARTIAL in statuses:
            return SyncCoverageSectionStatus.PARTIAL
        if SyncCoverageSectionStatus.ERROR in statuses:
            return SyncCoverageSectionStatus.ERROR
        if statuses == {SyncCoverageSectionStatus.EMPTY}:
            return SyncCoverageSectionStatus.EMPTY
        if SyncCoverageSectionStatus.STALE in statuses:
            return SyncCoverageSectionStatus.STALE
        return SyncCoverageSectionStatus.ACTUAL

    def _build_problem_comment(self, *, last_problem: dict | None, has_gaps: bool) -> str | None:
        if has_gaps and last_problem is not None:
            return 'Есть пропуски по периодам и были ошибки последней загрузки.'
        if has_gaps:
            return 'Есть пропуски по периодам.'
        if last_problem is not None:
            return 'Последняя загрузка завершилась с ошибкой.'
        return None

    def _is_operational_stale(self, actual_to: date | None) -> bool:
        if actual_to is None:
            return False
        return actual_to < date.today() - timedelta(days=1)

    def _is_reference_stale(self, actual_at: datetime | None) -> bool:
        if actual_at is None:
            return False
        return actual_at.date() < date.today() - timedelta(days=1)

    def _normalize_gap_fill_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = set(self._GAP_FILL_DATASETS)
        if not unique:
            raise HTTPException(status_code=400, detail='Выберите хотя бы один исторический набор данных для догрузки.')
        if any(dataset not in allowed for dataset in unique):
            raise HTTPException(
                status_code=400,
                detail='Gap-fill поддерживает только adverts_snapshot, adverts_cost, acceptance и storage.',
            )
        return unique

    def _compute_missing_periods_against_anchor(
        self,
        anchor_periods: list[dict],
        target_periods: list[dict],
    ) -> list[tuple[date, date]]:
        anchor = {
            (row['date_from'], row['date_to'])
            for row in anchor_periods
            if row.get('date_from') is not None and row.get('date_to') is not None
        }
        target = {
            (row['date_from'], row['date_to'])
            for row in target_periods
            if row.get('date_from') is not None and row.get('date_to') is not None
        }
        return sorted(anchor - target, key=lambda item: item[0], reverse=True)

    def _find_conflicting_historical_job(
        self,
        active_jobs: list[dict],
        *,
        datasets: list[SyncDataset],
    ) -> dict | None:
        requested = {dataset.value for dataset in datasets}
        requested.add(SyncDataset.SALES.value)

        for job in active_jobs:
            if job['mode'] != SyncMode.WEEKLY.value:
                continue
            job_datasets = set(job.get('datasets') or [])
            if job['job_type'] == SyncJobType.SALES_FUNNEL_BACKFILL.value:
                continue
            if job_datasets & requested:
                return job
        return None

    def _normalize_initial_sales_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.SALES, SyncDataset.CARDS, SyncDataset.ADVERTS_SNAPSHOT, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='MVP supports only sales, cards, adverts_snapshot, adverts_cost, acceptance and storage datasets for initial sales backfill')
        if SyncDataset.SALES not in unique:
            raise HTTPException(status_code=400, detail='Sales is required for weekly sync jobs')
        if SyncDataset.CARDS not in unique:
            unique.append(SyncDataset.CARDS)
        if SyncDataset.ADVERTS_SNAPSHOT not in unique:
            unique.append(SyncDataset.ADVERTS_SNAPSHOT)
        if SyncDataset.ADVERTS_COST not in unique:
            unique.append(SyncDataset.ADVERTS_COST)
        if SyncDataset.ACCEPTANCE not in unique:
            unique.append(SyncDataset.ACCEPTANCE)
        if SyncDataset.STORAGE not in unique:
            unique.append(SyncDataset.STORAGE)
        if SyncDataset.SALES_FUNNEL not in unique:
            unique.append(SyncDataset.SALES_FUNNEL)
        return unique

    def _normalize_sales_funnel_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.SALES_FUNNEL}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='MVP supports only sales_funnel dataset for funnel backfill')
        if unique != [SyncDataset.SALES_FUNNEL]:
            return [SyncDataset.SALES_FUNNEL]
        return unique

    def _normalize_stock_snapshot_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.WAREHOUSE_REMAINS}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='Stock snapshot refresh supports only warehouse_remains dataset')
        return [SyncDataset.WAREHOUSE_REMAINS]

    def _normalize_open_week_datasets(self, datasets: list[SyncDataset]) -> list[SyncDataset]:
        unique = list(dict.fromkeys(datasets))
        allowed = {SyncDataset.SALES, SyncDataset.SALES_FUNNEL, SyncDataset.CARDS, SyncDataset.ADVERTS_SNAPSHOT, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE}
        if not unique or any(dataset not in allowed for dataset in unique):
            raise HTTPException(status_code=400, detail='Open week refresh supports only sales, sales_funnel, cards, adverts_snapshot, adverts_cost, acceptance and storage datasets')
        if SyncDataset.SALES not in unique:
            raise HTTPException(status_code=400, detail='Sales is required for open week refresh')
        if SyncDataset.CARDS not in unique:
            unique.append(SyncDataset.CARDS)
        if SyncDataset.ADVERTS_SNAPSHOT not in unique:
            unique.append(SyncDataset.ADVERTS_SNAPSHOT)
        if SyncDataset.ADVERTS_COST not in unique:
            unique.append(SyncDataset.ADVERTS_COST)
        if SyncDataset.ACCEPTANCE not in unique:
            unique.append(SyncDataset.ACCEPTANCE)
        if SyncDataset.STORAGE not in unique:
            unique.append(SyncDataset.STORAGE)
        if SyncDataset.SALES_FUNNEL not in unique:
            unique.append(SyncDataset.SALES_FUNNEL)
        return unique

    def _build_weekly_step_plan(
        self,
        *,
        weekly_ranges: list[tuple[date, date]],
        datasets: list[SyncDataset],
    ) -> list[tuple[date, date, list[SyncDataset]]]:
        weekly_datasets = [dataset for dataset in datasets if dataset in {SyncDataset.SALES, SyncDataset.ADVERTS_COST, SyncDataset.ACCEPTANCE, SyncDataset.STORAGE, SyncDataset.WAREHOUSE_REMAINS}]
        return [
            (period_from, period_to, list(weekly_datasets))
            for period_from, period_to in weekly_ranges
        ]

    def _build_closed_day_ranges(self, date_from: date, date_to: date) -> list[tuple[date, date]]:
        weekly_ranges = self._build_closed_week_ranges(date_from, date_to)
        day_ranges: list[tuple[date, date]] = []
        for week_start, week_end in weekly_ranges:
            cursor = week_start
            while cursor <= week_end:
                day_ranges.append((cursor, cursor))
                cursor += timedelta(days=1)
        return day_ranges

    def _build_closed_week_ranges(self, date_from: date, date_to: date) -> list[tuple[date, date]]:
        today = date.today()
        current_week_start = get_week_start(today)
        last_closed_day = current_week_start - timedelta(days=1)
        effective_date_to = min(date_to, last_closed_day)
        if date_from > effective_date_to:
            return []

        first_week_start = get_week_start(date_from)
        if first_week_start < date_from:
            first_week_start += timedelta(days=7)

        last_week_start = get_week_start(effective_date_to)
        last_week_end = last_week_start + timedelta(days=6)
        if last_week_end > effective_date_to:
            last_week_start -= timedelta(days=7)

        if first_week_start > last_week_start:
            return []

        ranges: list[tuple[date, date]] = []
        cursor = first_week_start
        while cursor <= last_week_start:
            ranges.append((cursor, cursor + timedelta(days=6)))
            cursor += timedelta(days=7)
        return ranges

    def _build_open_week_range(self, anchor_date: date) -> tuple[date, date]:
        today = date.today()
        effective_anchor = min(anchor_date, today)
        open_week_start = get_week_start(effective_anchor)
        return open_week_start, effective_anchor
