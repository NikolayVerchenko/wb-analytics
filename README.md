# Wildberries Analytics

Приложение для аналитики Wildberries на основе Vue 3 + TypeScript с архитектурой Domain-Driven Design и принципами SOLID.

## Архитектура

Проект организован по принципам DDD (Domain-Driven Design):

```
src/
├── core/
│   ├── domain/
│   │   ├── entities/          # Доменные сущности (Order, Sale, Expense, etc.)
│   │   └── repositories/      # Интерфейсы репозиториев
│   └── di/                    # Dependency Injection контейнер
├── infrastructure/
│   ├── api/                   # Клиент для работы с WB API (Axios)
│   ├── db/                    # База данных Dexie.js
│   ├── repositories/          # Реализации репозиториев
│   └── services/              # Сервисы синхронизации (BaseSyncService)
├── application/
│   └── use-cases/             # Бизнес-логика (SyncDataUseCase, CalculatePnLUseCase)
└── presentation/
    ├── components/            # Vue компоненты
    └── composables/           # Vue composables для работы с use-cases
```

## Принципы SOLID

- **Single Responsibility**: Каждый класс отвечает за одну задачу
- **Open/Closed**: BaseSyncService расширяется через наследование
- **Liskov Substitution**: Все наследники BaseSyncService взаимозаменяемы
- **Interface Segregation**: Интерфейсы репозиториев разделены по типам данных
- **Dependency Inversion**: Зависимости инжектируются через DI контейнер

## Установка

```bash
npm install
```

## Настройка

Создайте файл `.env` на основе `.env.example` и укажите ваш API ключ Wildberries:

```
VITE_WB_API_KEY=your_api_key_here
```

## Запуск

```bash
npm run dev
```

## Сборка

```bash
npm run build
```

## Структура базы данных

База данных IndexedDB содержит следующие таблицы:
- `orders` - заказы
- `sales` - продажи
- `advExpenses` - расходы на рекламу
- `storage` - остатки на складах
- `acceptance` - приемки
- `products` - товары

## Использование

1. Укажите API ключ в `.env`
2. Запустите приложение
3. Используйте кнопку "Синхронизировать данные" для загрузки данных с WB API
4. Используйте компонент PnL для расчета прибыли и убытков
