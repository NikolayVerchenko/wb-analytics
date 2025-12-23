# Прокси-сервер для Wildberries API

## Установка зависимостей

```bash
npm install
```

## Настройка

1. Создайте файл `.env` в корне проекта (если его еще нет)
2. Добавьте ваш API ключ Wildberries:

```env
WB_API_KEY=ваш_api_ключ_wildberries
# или используйте существующий ключ
VITE_WB_API_KEY=ваш_api_ключ_wildberries
PORT=3000
```

## Запуск

### Только прокси-сервер:
```bash
npm run server
```

### Прокси-сервер + Vite dev сервер одновременно:
```bash
npm run dev:full
```

Прокси-сервер будет доступен на `http://localhost:3000`

## Использование

Теперь вы можете делать запросы через прокси:

```javascript
// Вместо прямого обращения к WB API:
// https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod

// Используйте прокси:
fetch('http://localhost:3000/api/v5/supplier/reportDetailByPeriod')
```

Прокси автоматически:
- ✅ Добавит заголовок `Authorization` с вашим API ключом
- ✅ Обойдет CORS ограничения
- ✅ Перешлет запрос на WB API
- ✅ Вернет ответ обратно

## Health Check

Проверьте, что сервер работает:
```bash
curl http://localhost:3000/health
```
