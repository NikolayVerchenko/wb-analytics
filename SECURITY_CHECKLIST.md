# SECURITY_CHECKLIST

## 1. VPS baseline
- Create a non-root deploy user.
- Disable SSH password login.
- Disable direct root SSH login.
- Keep only ports `22`, `80`, `443` open in `ufw`.
- Install `fail2ban`.
- Enable automatic security updates.

## 2. App secrets
- Replace `APP_SECRET_KEY` with a long random secret.
- Replace `POSTGRES_PASSWORD` and `PGPASSWORD` with a strong database password.
- Replace `TELEGRAM_BOT_TOKEN` with the real bot token.
- Never commit `.env.prod` or `.env.courier.prod`.

## 3. Backend hardening
- Set `APP_ENV=production`.
- Set `APP_ALLOWED_HOSTS` to the real domain list.
- Keep `AUTH_RATE_LIMIT_MAX_REQUESTS` and `AUTH_RATE_LIMIT_WINDOW_SECONDS` enabled.
- Keep `REFRESH_COOKIE_SECURE=true`.
- Keep `REFRESH_COOKIE_SAMESITE=lax`.

## 4. Nginx hardening
- Use the repo nginx config with:
  - CSP
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer-Policy
  - Permissions-Policy
  - auth rate limit
- Enable HSTS only after HTTPS is configured.

## 5. TLS
- Issue a certificate with certbot.
- Redirect HTTP to HTTPS after TLS is live.
- Keep cookies on the production domain only.

## 6. Database
- Do not publish PostgreSQL to the public internet.
- Run bootstrap with:
  `docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm --build backend python scripts/deploy_db.py`
- Make regular backups with `pg_dump`.

## 7. Verification
- `curl https://your-domain.ru/health`
- Login works.
- Refresh survives page reload.
- Logout clears the session.
- Direct SPA refresh on `/economics` and `/economics/problems` works.
- Auth brute force returns `429` after repeated attempts.
