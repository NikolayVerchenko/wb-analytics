# WB Analytics - Архитектура проекта

## Схема базы данных

```mermaid
erDiagram
    SALES ||--o{ PURCHASE_ORDERS : "связаны"
    RETURNS ||--o{ PURCHASE_ORDERS : "связаны"
    LOGISTICS ||--o{ PURCHASE_ORDERS : "связаны"
    ADV_COSTS ||--o{ SALES : "связаны по артикулу"
    SETTINGS ||--|| SYNC_REGISTRY : "настройки"
    
    SALES {
        string pk PK "nm_id_rr_dt_ts_name"
        string dt "дата"
        number ni "артикул WB"
        string sa "артикул продавца"
        string bc "бренд"
        string sj "предмет"
        string sz "размер"
        number qt "количество"
        number pv "цена продажи"
        number pa "сумма продажи"
        number pz "к выплате"
    }
    
    RETURNS {
        string pk PK "nm_id_rr_dt_ts_name"
        string dt "дата"
        number ni "артикул WB"
        string sa "артикул продавца"
        string bc "бренд"
        string sj "предмет"
        string sz "размер"
        number qt "количество"
        number pv "цена продажи"
        number pa "сумма продажи"
    }
    
    LOGISTICS {
        string pk PK "nm_id_rr_dt_ts_name"
        string dt "дата"
        number ni "артикул WB"
        string sa "артикул продавца"
        string bc "бренд"
        string sj "предмет"
        string sz "размер"
        number dl "доставка"
        number rt "возврат"
        number dr "доставка в рублях"
    }
    
    PENALTIES {
        string pk PK "nm_id_rr_dt_ts_name"
        string dt "дата"
        number ni "артикул WB"
        string sa "артикул продавца"
        string bc "бренд"
        string sj "предмет"
        string sz "размер"
        string bt "тип бонуса"
        number pn "штраф"
    }
    
    DEDUCTIONS {
        string pk PK "nm_id_rr_dt_ts_name"
        string dt "дата"
        number ni "артикул WB"
        string sa "артикул продавца"
        string bc "бренд"
        string sj "предмет"
        string sz "размер"
        string bt "тип бонуса"
        number dd "удержание"
    }
    
    ADV_COSTS {
        string pk PK "nmId_date"
        string dt "дата"
        number ni "артикул WB"
        number costs "сумма рекламных расходов"
    }
    
    SETTINGS {
        string key PK
        string value "значение (API ключ и др.)"
    }
    
    SYNC_REGISTRY {
        string key PK
        any value "значение"
        number updatedAt "дата обновления"
    }
```

## Схема компонентов и потока данных

```mermaid
graph TB
    subgraph "UI Layer"
        A[SyncView.vue<br/>Загрузка отчетов] 
        B[SummaryView.vue<br/>Сводка данных]
        C[Dashboard.vue<br/>Дашборд]
        D[ReportSyncPanel.vue<br/>Настройки синхронизации]
    end
    
    subgraph "API Layer"
        E[SyncManager.ts<br/>Менеджер синхронизации]
        F[FinanceFetcher.ts<br/>Fetcher финансовых данных]
        AF[AdvFetcher.ts<br/>Fetcher рекламных расходов]
        G[WbApiClient.ts<br/>Базовый API клиент]
    end
    
    subgraph "Data Layer"
        H[(IndexedDB<br/>WbAnalyticsDB)]
        I[sales table]
        J[returns table]
        K[logistics table]
        L[penalties table]
        M[deductions table]
        AC[adv_costs table]
        N[settings table]
        O[syncRegistry table]
    end
    
    A -->|startFullSync| E
    D -->|startFullSync| E
    E -->|управляет| F
    E -->|управляет| AF
    F -->|fetchReportPage| G
    AF -->|getAdvHistory| G
    AF -->|getAdvInfo| G
    G -->|HTTP запросы| WB[Wildberries API<br/>Statistics API]
    G -->|HTTP запросы| WB_ADV[Wildberries API<br/>Advert API]
    F -->|distribute & save| H
    AF -->|distribute & save| H
    H --> I
    H --> J
    H --> K
    H --> L
    H --> M
    H --> AC
    H --> N
    H --> O
    B -->|read| H
    C -->|read| H
    D -->|save API key| N
    A -->|прогресс| F
    A -->|прогресс| AF
    
    style A fill:#e1f5ff
    style E fill:#fff4e1
    style F fill:#ffe1f5
    style G fill:#e1fff5
    style H fill:#e8f5e9
```

## Схема структуры директорий

```mermaid
graph TD
    A[src/] --> B[api/]
    A --> C[db/]
    A --> D[views/]
    A --> E[presentation/]
    A --> F[core/]
    
    B --> B1[WbApiClient.ts<br/>Базовый API клиент]
    B --> B2[SyncManager.ts<br/>Менеджер синхронизации]
    B --> B3[fetchers/]
    
    B3 --> B3A[FinanceFetcher.ts<br/>Пагинация финансовых данных]
    B3 --> B3B[AdvFetcher.ts<br/>Загрузка рекламных расходов]
    
    C --> C1[db.ts<br/>Dexie schema v3<br/>5 финансовых + реклама<br/>+ 2 системные таблицы]
    
    A --> T[types/]
    T --> T1[db.ts<br/>Интерфейсы:<br/>ISale, IReturn,<br/>ILogistics, IPenalty,<br/>IDeduction, IAdvCost,<br/>WBReportRow]
    
    D --> D1[SyncView.vue]
    
    E --> E1[components/]
    E --> E2[stores/]
    E --> E3[composables/]
    
    E1 --> E1A[SummaryView.vue]
    E1 --> E1B[Dashboard.vue]
    E1 --> E1C[ReportSyncPanel.vue]
    E1 --> E1D[TopMenu.vue]
    E1 --> E1E[DateRangePicker.vue]
    
    F --> F1[services/]
    F --> F2[domain/]
    F --> F3[di/]
    
    F1 --> F1A[DateRangeService.ts]
    F1 --> F1B[CategoryService.ts]
    F1 --> F1C[VendorCodeService.ts]
    F1 --> F1D[DatePeriodService.ts]
    
    style B fill:#e1f5ff
    style B3 fill:#d1e5ff
    style C fill:#e8f5e9
    style E fill:#fff4e1
    style F fill:#f3e5f5
```

## Схема потока синхронизации данных

```mermaid
sequenceDiagram
    participant U as User
    participant SV as SyncView.vue
    participant SM as SyncManager
    participant FF as FinanceFetcher
    participant AF as AdvFetcher
    participant AC as WbApiClient
    participant WB as Wildberries Statistics API
    participant WB_ADV as Wildberries Advert API
    participant DB as IndexedDB
    
    U->>SV: Выбирает даты и период
    U->>SV: Нажимает "Начать загрузку"
    SV->>SM: startFullSync(dateFrom, dateTo, period)
    SM->>SM: setApiKey(apiKey)
    par Параллельная загрузка
        SM->>FF: fetchFullReport(dateFrom, dateTo, period)
    and
        SM->>AF: fetchAds(dateFrom, dateTo)
    end
    FF->>FF: reset() - сброс состояния
    FF->>FF: isFetching = true
    loop Пагинация (rrdid)
        FF->>AC: fetchReportPage(dateFrom, dateTo, period, rrdid)
        AC->>WB: GET /api/v5/supplier/reportDetailByPeriod
        WB-->>AC: Массив записей (200) или 204
        AC-->>FF: Массив записей (WBReportRow[])
        FF->>FF: Распределение по supplier_oper_name
        FF->>FF: "Продажа" -> sales
        FF->>FF: "Возврат" -> returns
        FF->>FF: "Логистика" -> logistics
        FF->>FF: "Штраф" -> penalties
        FF->>FF: "Удержание" -> deductions
        FF->>FF: Генерация PK: nm_id_rr_dt_ts_name
        FF->>FF: Группировка в Map по PK
        FF->>FF: Суммирование числовых полей
        FF->>DB: bulkPut() - перезапись по PK
        DB-->>FF: Данные сохранены
        FF->>FF: loadedCount.value++ (реактивное обновление)
        FF->>FF: Сохраняет rrd_id из последней записи
        FF->>FF: waitForRateLimit() - задержка 61 секунда
    end
    FF->>FF: isFetching = false
    FF-->>SM: Количество загруженных записей
    
    AF->>AF: reset() - сброс состояния
    AF->>AF: isFetching = true
    loop По каждому дню
        AF->>AC: getAdvHistory(date, date)
        AC->>WB_ADV: GET /adv/v1/upd
        WB_ADV-->>AC: Массив записей о затратах
        AC-->>AF: Массив записей
        AF->>AF: Сбор уникальных advertId
        AF->>AC: getAdvInfo(advertIds) - батчи по 50
        AC->>WB_ADV: GET /api/advert/v2/adverts
        WB_ADV-->>AC: Информация о кампаниях
        AC-->>AF: Массив кампаний с nm_settings
        AF->>AF: Распределение затрат по артикулам
        AF->>AF: Генерация PK: nmId_date
        AF->>AF: Группировка в Map по PK
        AF->>AF: Суммирование затрат
        AF->>AF: waitForRateLimit() - задержка 300мс
    end
    AF->>DB: bulkPut() - сохранение всех записей
    DB-->>AF: Данные сохранены
    AF->>AF: isFetching = false
    AF-->>SM: Количество загруженных записей
    
    SM->>SM: Суммирование результатов
    SM-->>SV: Общее количество загруженных записей
    SV->>SV: console.log(totalLoaded)
    SV->>SV: Показывает "Загрузка завершена"
    
    Note over SV,FF: Прогресс отображается через<br/>реактивные поля FinanceFetcher и AdvFetcher
```

## Схема состояния компонентов

```mermaid
stateDiagram-v2
    [*] --> Idle: Загрузка страницы
    
    Idle --> Loading: Пользователь нажимает<br/>"Начать загрузку"
    Loading --> Fetching: SyncManager.startFullSync()<br/>FinanceFetcher.reset()
    Fetching --> Fetching: WbApiClient.fetchReportPage()<br/>(rrdid пагинация)
    Fetching --> Error: Ошибка API (401/429)
    Fetching --> Success: Все данные загружены (204)
    Error --> Idle: Показать ошибку из<br/>financeFetcher.error
    Success --> Processing: Данные получены
    Processing --> Saved: Данные сохранены в БД
    Saved --> Idle: Загрузка завершена
    
    note right of Loading
        financeFetcher.isFetching = true
        financeFetcher.loadedCount = 0
        financeFetcher.error = null
    end note
    
    note right of Fetching
        financeFetcher.loadedCount++ (реактивно)
        Распределение данных по 5 таблицам
        Группировка в памяти (Map) по PK
        Суммирование числовых полей при совпадении PK
        bulkPut с перезаписью (overwrite)
        Задержка 61 секунда между запросами
        WbApiClient делает одиночные запросы
    end note
    
    note right of Error
        financeFetcher.error устанавливается
        financeFetcher.isFetching = false
        Показать сообщение об ошибке
        Кнопка доступна снова
    end note
```

## Новая архитектура API слоя

```mermaid
classDiagram
    class SyncManager {
        -WbApiClient apiClient
        +FinanceFetcher financeFetcher
        +AdvFetcher advFetcher
        +setApiKey(apiKey)
        +startFullSync(dateFrom, dateTo, period)
        +getFinanceFetcher()
        +getAdvFetcher()
        +isSyncing()
    }
    
    class WbApiClient {
        -string apiKey
        -string baseURL
        +setApiKey(apiKey)
        +fetchReportPage(dateFrom, dateTo, period, rrdid)
        +getAdvHistory(from, to)
        +getAdvInfo(ids)
        -getAdvertApiBaseUrl()
    }
    
    class FinanceFetcher {
        -WbApiClient apiClient
        +ref loadedCount
        +ref isFetching
        +ref error
        +fetchFullReport(dateFrom, dateTo, period)
        +reset()
        -formatDate(dateStr)
        -generatePK(item)
        -mapToSale(item)
        -mapToReturn(item)
        -mapToLogistics(item)
        -mapToPenalty(item)
        -mapToDeduction(item)
        -distributeAndSave(items)
        -waitForRateLimit()
    }
    
    class AdvFetcher {
        -WbApiClient apiClient
        +ref loadedCount
        +ref isFetching
        +ref error
        +fetchAds(dateFrom, dateTo)
        +reset()
        -formatDate(dateStr)
        -generatePK(nmId, date)
        -generateDateRange(dateFrom, dateTo)
        -waitForRateLimit()
    }
    
    SyncManager --> WbApiClient : использует
    SyncManager --> FinanceFetcher : управляет
    SyncManager --> AdvFetcher : управляет
    FinanceFetcher --> WbApiClient : вызывает fetchReportPage()
    AdvFetcher --> WbApiClient : вызывает getAdvHistory(), getAdvInfo()
    
    note for SyncManager "Координирует все fetcher-ы\nЕдиная точка входа для синхронизации\nПараллельная загрузка финансов и рекламы"
    note for WbApiClient "Только одиночные запросы\nБез циклов и пагинации\nПоддержка Statistics API и Advert API"
    note for FinanceFetcher "Логика пагинации\nРаспределение по 5 таблицам\nГруппировка в памяти (Map)\nСуммирование при совпадении PK\nbulkPut с overwrite\nРеактивные поля для UI\nЗадержки между запросами (61 сек)"
    note for AdvFetcher "Итерация по дням\nЗагрузка истории затрат\nЗагрузка информации о кампаниях (батчи по 50)\nРаспределение затрат по артикулам\nКэширование кампаний\nГруппировка и суммирование в памяти\nbulkPut с overwrite\nРеактивные поля для UI\nЗадержки между запросами (300мс)"
```

## Логика распределения данных

```mermaid
flowchart TD
    A[WBReportRow из API] --> B{Проверка supplier_oper_name}
    
    B -->|"Продажа"| C[mapToSale]
    B -->|"Возврат"| D[mapToReturn]
    B -->|"Логистика"| E[mapToLogistics]
    B -->|"Штраф"| F[mapToPenalty]
    B -->|"Удержание"| G[mapToDeduction]
    B -->|Другое| H[Пропуск записи]
    
    C --> I[Генерация PK:<br/>nm_id_rr_dt_ts_name]
    D --> I
    E --> I
    F --> I
    G --> I
    
    I --> AG[Группировка в Map по PK]
    
    AG --> J[sales Map]
    AG --> K[returns Map]
    AG --> L[logistics Map]
    AG --> M[penalties Map]
    AG --> N[deductions Map]
    
    J --> SUM1[Суммирование:<br/>qt, pv, pa, pz]
    K --> SUM2[Суммирование:<br/>qt, pv, pa]
    L --> SUM3[Суммирование:<br/>dl, rt, dr]
    M --> SUM4[Суммирование:<br/>pn]
    N --> SUM5[Суммирование:<br/>dd]
    
    SUM1 --> O1[db.sales.bulkPut<br/>(overwrite)]
    SUM2 --> O2[db.returns.bulkPut<br/>(overwrite)]
    SUM3 --> O3[db.logistics.bulkPut<br/>(overwrite)]
    SUM4 --> O4[db.penalties.bulkPut<br/>(overwrite)]
    SUM5 --> O5[db.deductions.bulkPut<br/>(overwrite)]
    
    O1 --> P[IndexedDB сохранено]
    O2 --> P
    O3 --> P
    O4 --> P
    O5 --> P
    
    style C fill:#e1f5ff
    style D fill:#fff4e1
    style E fill:#ffe1f5
    style F fill:#ffe5e1
    style G fill:#f5e1ff
    style I fill:#e8f5e9
    style AG fill:#fff4e1
    style SUM1 fill:#fff9e1
    style SUM2 fill:#fff9e1
    style SUM3 fill:#fff9e1
    style SUM4 fill:#fff9e1
    style SUM5 fill:#fff9e1
    style O1 fill:#e1fff5
    style O2 fill:#e1fff5
    style O3 fill:#e1fff5
    style O4 fill:#e1fff5
    style O5 fill:#e1fff5
    style P fill:#e8f5e9
```

## Маппинг полей из API в таблицы БД

### Финансовые таблицы (из Statistics API)

| supplier_oper_name | Таблица | Поля маппинга |
|-------------------|---------|---------------|
| "Продажа" | `sales` | rr_dt → dt, nm_id → ni, sa_name → sa, brand_name → bc, subject_name → sj, ts_name → sz, quantity → qt, retail_price → pv, retail_amount → pa, ppvz_for_pay → pz |
| "Возврат" | `returns` | rr_dt → dt, nm_id → ni, sa_name → sa, brand_name → bc, subject_name → sj, ts_name → sz, quantity → qt, retail_price → pv, retail_amount → pa |
| "Логистика" | `logistics` | rr_dt → dt, nm_id → ni, sa_name → sa, brand_name → bc, subject_name → sj, ts_name → sz, delivery_amount → dl, return_amount → rt, delivery_rub → dr |
| "Штраф" | `penalties` | rr_dt → dt, nm_id → ni, sa_name → sa, brand_name → bc, subject_name → sj, ts_name → sz, bonus_type_name → bt, penalty → pn |
| "Удержание" | `deductions` | rr_dt → dt, nm_id → ni, sa_name → sa, brand_name → bc, subject_name → sj, ts_name → sz, bonus_type_name → bt, deduction → dd |

**Primary Key (pk) для финансовых таблиц**: `${nm_id}_${rr_dt}_${ts_name}`

### Таблица рекламных расходов (из Advert API)

| Источник данных | Таблица | Поля маппинга |
|----------------|---------|---------------|
| `/adv/v1/upd` (история затрат) + `/api/advert/v2/adverts` (информация о кампаниях) | `adv_costs` | updTime → dt, nm_id (из nm_settings) → ni, updSum / количество артикулов → costs |

**Primary Key (pk) для adv_costs**: `${nmId}_${date}` (артикул_дата)

**Логика распределения затрат**:
1. Получение истории затрат за день через `/adv/v1/upd`
2. Сбор уникальных `advertId` из истории
3. Получение информации о кампаниях через `/api/advert/v2/adverts` (батчи по 50 ID)
4. Извлечение `nm_id` из `nm_settings` каждой кампании
5. Распределение суммы `updSum` на количество артикулов в кампании
6. Группировка по PK (`${nmId}_${date}`) и суммирование затрат

## Логика группировки и перезаписи данных

### Группировка в памяти
Данные группируются в памяти с использованием `Map<string, Record>` перед сохранением в БД:

1. **Генерация PK**: `${nm_id}_${rr_dt}_${ts_name}` (без `rrd_id` для группировки)
2. **Группировка**: Записи с одинаковым PK объединяются в одну запись
3. **Суммирование числовых полей** при совпадении PK:
   - **sales**: `qt`, `pv`, `pa`, `pz`
   - **returns**: `qt`, `pv`, `pa`
   - **logistics**: `dl`, `rt`, `dr`
   - **penalties**: `pn`
   - **deductions**: `dd`

### Перезапись в БД
- `bulkPut()` автоматически заменяет записи с существующими PK (overwrite)
- При повторной загрузке тех же данных (одинаковые даты) старые записи полностью заменяются новыми сгруппированными результатами
- Исключает удвоение сумм при повторных загрузках

## Логика загрузки рекламных расходов

### Процесс загрузки
1. **Итерация по дням**: Генерируется список дат от `dateFrom` до `dateTo`
2. **Для каждого дня**:
   - Получение истории затрат через `getAdvHistory(date, date)`
   - Если затрат нет, переход к следующему дню
   - Сбор уникальных `advertId` из истории затрат
   - Получение информации о кампаниях через `getAdvInfo(advertIds)` (батчи по 50 ID, кэширование)
   - Распределение затрат по артикулам из `nm_settings`
3. **Распределение затрат**:
   - Для каждой записи истории затрат: `costSum / количество_артикулов_в_кампании`
   - Группировка по PK (`${nmId}_${date}`)
   - Суммирование затрат, если один артикул участвовал в нескольких кампаниях за день
4. **Сохранение**: `bulkPut()` всех записей в таблицу `adv_costs`

### Особенности
- **Кэширование кампаний**: Информация о кампаниях кэшируется, чтобы не запрашивать повторно
- **Батчинг**: API ограничивает до 50 ID за запрос, поэтому большие списки разбиваются на батчи
- **Лимиты API**: Задержка 300мс между запросами (1-5 запросов/сек)
- **Логирование**: Подробные логи прогресса в консоль браузера
