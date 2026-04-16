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
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images
```

Notes:

- Android emulator automatically falls back to `http://10.0.2.2:8080/api`
- real devices should use your LAN IP instead of `localhost`
- create a public Supabase Storage bucket for product images, for example `product-images`
- if you upload directly from the app, your bucket policies must allow `INSERT` and `SELECT` for the files you want to expose publicly

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

## Route structure

The Expo Router tree is intentionally grouped by domain:

- `app/(auth)` for login, register, and auth callback flows
- `app/(tabs)` for the main customer shell (`home`, `cart`, `profile`)
- `app/orders` for checkout and order history screens
- `app/search` for product discovery
- `app/seller` for seller-only product and order management
- `app/detail/[id]` for product detail

Naming was normalized so route files describe the feature directly, for example `orders/invoice.tsx` instead of `orders/invoicescreen.tsx`.
