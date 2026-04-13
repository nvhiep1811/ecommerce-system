# Mobile App

Expo client for the service-based `ecommerce-system`.

## Boundary

This app is frontend-only for business data:

- no direct PostgreSQL access
- no direct Supabase table access
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

- legacy Supabase client dependency removed
- legacy Expo SQLite plugin removed
- unused NativeWind and Tailwind starter scaffolding removed
- app metadata renamed from starter values to project-specific values
- routing and UI remain Expo Router based
