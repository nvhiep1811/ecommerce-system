# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

COPY admin-web/package*.json ./
RUN npm ci --no-audit

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:8080/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY admin-web/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
