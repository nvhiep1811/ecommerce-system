# Admin Web Implementation Log

Date: 2026-05-14

## Goal

Build the `admin-web` React app from the existing TailAdmin shell using the API contract in `docs/ADMIN_WEB_SPECIFICATION.md` and the real backend code under `backend/`.

## Backend Startup Notes

The backend is a Spring Boot multi-module setup:

- API Gateway: `http://localhost:8080`
- User Service: `http://localhost:8081`
- Catalog Service: `http://localhost:8082`
- Commerce Service: `http://localhost:8083`

Recommended startup order:

1. Start PostgreSQL and load `backend/db/schema_final_merged.sql`.
2. Load `backend/db/realistic_demo_seed.sql` if demo data is needed.
3. Start `user-service`.
4. Start `catalog-service`.
5. Start `commerce-service`.
6. Start `api-gateway`.
7. Start `admin-web`.

Docker is not strictly required for the Java services, but it is useful if PostgreSQL, Redis, or RabbitMQ are not already installed locally. RabbitMQ is optional for basic admin UI calls, but order/payment notification flows use it.

PowerShell examples:

```powershell
cd backend\user-service
..\mvnw.cmd spring-boot:run

cd backend\catalog-service
..\mvnw.cmd spring-boot:run

cd backend\commerce-service
..\mvnw.cmd spring-boot:run

cd backend\api-gateway
..\mvnw.cmd spring-boot:run

cd admin-web
npm install
npm run dev
```

Admin web env:

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

## API Findings From Backend Code

- Login: `POST /api/auth/login`
  - Request: `{ email, password }`
  - Response: `{ accessToken, user }`
- Current user: `GET /api/users/me`
- Products page: `GET /api/catalog/products/page?page=0&size=10&search=&categoryId=&sellerId=`
- Product create/update: `POST /api/catalog/products`, `PUT /api/catalog/products/{id}`
  - Backend requires role `SELLER` through `@PreAuthorize("hasRole('SELLER')")`.
- Categories: `GET /api/catalog/categories`
  - Supports `parentId` internally.
- Coupons: `GET /api/catalog/coupons`, `POST /api/catalog/coupons`, `PUT /api/catalog/coupons/{id}`, `DELETE /api/catalog/coupons/{id}`
  - Backend currently requires role `SELLER` for create/update/delete, while the admin spec says `ADMIN`.
- Seller orders: `GET /api/commerce/orders/seller?status=...`
- Order detail: `GET /api/commerce/orders/{id}`
- Order next transition: `POST /api/commerce/orders/{id}/next`
- Order cancel: `POST /api/commerce/orders/{id}/cancel`
- Order status update: `PATCH /api/commerce/orders/{id}/status`
  - Backend requires `SELLER`.
- Payment methods: `GET /api/payment-methods`
- Shipping methods: `GET /api/shipping-methods`

## Implementation Plan

1. Replace TailAdmin demo routes/sidebar with ecommerce admin routes.
2. Add API client, auth storage, auth context, protected routes.
3. Implement dashboard using products, seller orders, coupons, payment/shipping methods.
4. Implement Products page with search, pagination, create/edit form.
5. Implement Orders page with filters, detail panel, advance/cancel actions.
6. Implement Coupons page with create/edit/delete form.
7. Implement Catalog/Settings pages for categories, payment methods, and shipping methods.
8. Add environment example and verify `npm run build`.

## Current Status

- Investigation complete.
- Coding not started yet.
