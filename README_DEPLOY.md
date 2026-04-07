# README_DEPLOY

## 1. Требования к серверу

### ОС
- Ubuntu 22.04 LTS или Ubuntu 24.04 LTS

### Минимальные ресурсы
- 2 vCPU
- 4 GB RAM
- 20 GB SSD

### Обязательное ПО
- Docker Engine
- Docker Compose plugin (`docker compose`)
- Git
- Открытые порты 80/443

> Текущий deploy-kit из репозитория поднимает nginx только на `80/tcp`. Порт `443/tcp` стоит открыть заранее, если после первой выкладки будете добавлять TLS/Let's Encrypt.

---

## 2. Подготовка сервера

### 2.1 Установка Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

Проверка:

```bash
docker --version
docker compose version
```

### 2.2 Открытие портов

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

---

## 3. Подготовка проекта на сервере

Рекомендуемый путь:

```bash
sudo mkdir -p /opt/wb-analitics_new
sudo chown $USER:$USER /opt/wb-analitics_new
cd /opt
```

Склонировать проект:

```bash
git clone <YOUR_REPOSITORY_URL> wb-analitics_new
cd /opt/wb-analitics_new
```

Проверить, что в каталоге есть ключевые production-файлы:

```bash
ls -la docker-compose.prod.yml
ls -la deploy/nginx/nginx.conf
ls -la scripts/deploy_db.py
ls -la backend/Dockerfile
ls -la frontend_v2/Dockerfile
```

---

## 4. Настройка env

Нужно создать 3 файла:

```bash
cp .env.prod.example .env.prod
cp .env.courier.prod.example .env.courier.prod
cp frontend_v2/.env.production.example frontend_v2/.env.production
```

### 4.1 `.env.prod`
Используется контейнером PostgreSQL.

Пример:

```env
POSTGRES_DB=wb_analytics
POSTGRES_USER=wb_app
POSTGRES_PASSWORD=change_me_to_strong_password
POSTGRES_PORT=5432
```

Критично:
- `POSTGRES_PASSWORD`

### 4.2 `.env.courier.prod`
Используется backend.

Пример:

```env
APP_ENV=production
APP_SECRET_KEY=change_me_to_a_long_random_secret
FRONTEND_BASE_URL=https://your-domain.ru
PGHOST=postgres
PGPORT=5432
PGDATABASE=wb_analytics
PGUSER=wb_app
PGPASSWORD=change_me_to_strong_password
TELEGRAM_BOT_TOKEN=change_me
ACCESS_TOKEN_TTL_MINUTES=60
REFRESH_TOKEN_TTL_DAYS=30
PASSWORD_RESET_TTL_MINUTES=30
REFRESH_COOKIE_NAME=wb_refresh_token
REFRESH_COOKIE_DOMAIN=your-domain.ru
REFRESH_COOKIE_SAMESITE=lax
REFRESH_COOKIE_SECURE=true
PORT=8010
```

Критично:
- `APP_ENV=production`
- `APP_SECRET_KEY`
- `FRONTEND_BASE_URL`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `REFRESH_COOKIE_SECURE=true`

Нельзя оставлять dev defaults:
- `APP_SECRET_KEY=dev-secret-change-me`
- `FRONTEND_BASE_URL=http://127.0.0.1:5174`
- `FRONTEND_BASE_URL=http://localhost:5174`
- пустой `TELEGRAM_BOT_TOKEN`, если используете Telegram login
- `REFRESH_COOKIE_SECURE=false`

### 4.3 `frontend_v2/.env.production`
Используется на этапе production build frontend.

Пример:

```env
VITE_API_BASE_URL=/api
VITE_TELEGRAM_BOT_NAME=your_bot_name
```

Критично:
- `VITE_TELEGRAM_BOT_NAME`, если используете Telegram login

Примечание:
- `VITE_API_BASE_URL=/api` подходит для текущей схемы `same-origin nginx + /api`
- frontend в проде не зависит от Vite proxy

---

## 5. Подготовка базы данных

### Важно
Текущий `scripts/deploy_db.py` делает **overlay schema deployment**, а не полный bootstrap пустой БД.

Что это значит:
- скрипт разворачивает auth/sync/mart overlay поверх существующей схемы
- скрипт **проверяет наличие** prerequisite таблицы `core.accounts`
- скрипт применяет SQL из:
  - `db/deploy/core_overlay.txt`
  - `db/deploy/marts.txt`

То есть для первой выкладки должны уже существовать:
- базовая operational schema проекта
- как минимум `core.accounts`
- остальные исходные таблицы, на которые опираются mart/fact SQL

### 5.1 Поднять PostgreSQL

```bash
docker compose -f docker-compose.prod.yml up -d postgres
```

Проверить, что postgres healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

### 5.2 Применить overlay schema

```bash
docker compose -f docker-compose.prod.yml run --rm backend python scripts/deploy_db.py
```

Если нужно пропустить mart-слой:

```bash
docker compose -f docker-compose.prod.yml run --rm backend python scripts/deploy_db.py --skip-marts
```

Если схема prerequisite уже проверена вручную:

```bash
docker compose -f docker-compose.prod.yml run --rm backend python scripts/deploy_db.py --skip-prerequisites
```

---

## 6. Запуск приложения

Основная команда запуска:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Поднимутся сервисы:
- `postgres` — база данных
- `frontend-build` — собирает `frontend_v2/dist` и кладёт статику в volume
- `backend` — FastAPI + Uvicorn на внутреннем порту `8010`
- `nginx` — публикует фронт и проксирует `/api`

### Как идёт запрос пользователя
- браузер -> `nginx:80`
- `GET /` -> статический frontend из volume `frontend_dist`
- `GET /api/...` -> proxy на `backend:8010`
- backend -> PostgreSQL (`postgres:5432`)

### Порты
- внешний: `80/tcp`
- внутренний backend: `8010`
- внутренний postgres: `5432`

---

## 7. SPA routing

Проект использует Vue Router в режиме `createWebHistory()`.

Чтобы прямые переходы и refresh работали в production, nginx должен отдавать `index.html` для всех несуществующих frontend routes.

Это уже настроено в `deploy/nginx/nginx.conf`:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Без этого после refresh сломаются маршруты вида:
- `/register`
- `/accounts`
- `/economics`
- `/economics/problems`
- `/stocks`
- `/supplies`
- `/sync`

---

## 8. Проверка после запуска (SMOKE TEST)

### 8.1 Backend health

```bash
curl http://YOUR_DOMAIN/health
```

Ожидается:

```json
{"status":"ok"}
```

### 8.2 Открыть frontend

Открыть в браузере:

```text
http://YOUR_DOMAIN/
```

### 8.3 Проверить auth
- открыть `/register`
- зарегистрировать пользователя по email/паролю
- войти этим пользователем
- обновить страницу (`F5`) и убедиться, что сессия не потерялась
- нажать `Выйти`

### 8.4 Проверить рабочие страницы
После входа и выбора кабинета проверить:
- `/accounts`
- `/economics/problems`
- `/economics`
- `/stocks`
- `/supplies`
- `/sync`

### 8.5 Проверить SPA fallback
Открыть прямой URL в новой вкладке или сделать refresh на:
- `/register`
- `/accounts`
- `/economics/problems`
- `/economics`

Если nginx настроен верно, должен открыться frontend, а не `404`.

---

## 9. Логи и отладка

### Общие команды

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart backend nginx
```

### Логи backend

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### Логи nginx

```bash
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Логи postgres

```bash
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Проверить контейнеры

```bash
docker ps
```

---

## 10. Типовые проблемы

### 10.1 Не работает API
Проверить:
- отвечает ли `http://YOUR_DOMAIN/health`
- поднят ли контейнер `backend`
- есть ли в `deploy/nginx/nginx.conf` блок:

```nginx
location /api/ {
    proxy_pass http://backend:8010/;
}
```

### 10.2 После refresh ломается frontend route
Проверить nginx fallback:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 10.3 Не работают cookies / refresh session
Проверить в `.env.courier.prod`:
- `FRONTEND_BASE_URL=https://your-domain.ru`
- `REFRESH_COOKIE_DOMAIN=your-domain.ru`
- `REFRESH_COOKIE_SECURE=true`
- `REFRESH_COOKIE_SAMESITE=lax`

Для same-origin схемы frontend и backend должны жить под одним доменом.

### 10.4 Не работает Telegram login
Проверить:
- `TELEGRAM_BOT_TOKEN`
- `VITE_TELEGRAM_BOT_NAME`
- `FRONTEND_BASE_URL`
- домен бота в BotFather (`Web Login`) должен совпадать с реальным публичным доменом

### 10.5 Ошибки БД / отсутствуют таблицы
Проверить:
- запускался ли `python scripts/deploy_db.py`
- существует ли prerequisite `core.accounts`
- совпадают ли `PG*` env между postgres и backend
- не пытаетесь ли поднять проект на полностью пустой БД без базовой схемы

---

## 11. Что уже готово
- frontend собирается в production static build
- backend запускается отдельным production entrypoint
- nginx уже настроен на same-origin `/api`
- есть `GET /health`
- refresh token уже в `HttpOnly` cookie
- есть production `docker-compose.prod.yml`
- есть reproducible overlay deploy script для auth/sync/mart schema

## 12. Что нужно проверить вручную
- реальный домен и DNS
- Telegram Web Login domain в BotFather
- корректность `APP_SECRET_KEY`
- корректность cookie-домена
- наличие prerequisite схемы в PostgreSQL до запуска overlay
- все smoke tests после выкладки

## 13. Ограничения текущего деплоя
- в репозитории **нет полного bootstrap SQL** для пустой БД
- `scripts/deploy_db.py` делает только overlay deployment
- prerequisite `core.accounts` должен существовать заранее
- текущий nginx config слушает только `80/tcp`
- TLS/HTTPS в этот deploy-kit не входит и должен добавляться отдельно
