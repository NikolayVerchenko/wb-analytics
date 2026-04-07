FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY courier ./courier
COPY scripts ./scripts
COPY scripts_auth ./scripts_auth
COPY db ./db

CMD ["python", "scripts/run_prod_api.py"]
