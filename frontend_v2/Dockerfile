FROM node:20-alpine

WORKDIR /app

COPY frontend_v2/package*.json ./
RUN npm ci

COPY frontend_v2/ ./

RUN npm run build

CMD ["sh", "-c", "mkdir -p /static && rm -rf /static/* && cp -r /app/dist/. /static"]
