# Mobile App

Expo client for the service-based `ecommerce-system`.

## Boundary

This app is frontend-only for business data:

- no direct PostgreSQL access
- no direct database table access
- no SQLite sync layer for orders, products, auth, or checkout
- all business flows go through the Spring Boot API Gateway

## Environment

Create `mobile-app/.env` from `mobile-app/.env.example`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

Notes:

- Android emulator automatically falls back to `http://10.0.2.2:8080/api`
- real devices should use your LAN IP instead of `localhost`
- product/avatar/chat media uploads go through the backend API; the mobile app does not need AWS credentials

## Commands

```bash
npm install
npm run lint
npx tsc --noEmit
npx expo start
```

## API surface used by the app

- `/api/auth/**`
- `/api/users/**`
- `/api/catalog/**`
- `/api/commerce/**`

## Current cleanup status

- legacy direct storage client dependency removed
- legacy Expo SQLite plugin removed
- unused NativeWind and Tailwind starter scaffolding removed
- app metadata renamed from starter values to project-specific values
- routing and UI remain Expo Router based

## Route structure

The Expo Router tree is intentionally grouped by domain:

- `app/(auth)` for login, register, and auth callback flows
- `app/(tabs)` for the main customer shell (`home`, `cart`, `profile`)
- `app/orders` for checkout and order history screens
- `app/search` for product discovery
- `app/seller` for seller-only product and order management
- `app/detail/[id]` for product detail

Naming was normalized so route files describe the feature directly, for example `orders/invoice.tsx` instead of `orders/invoicescreen.tsx`.
