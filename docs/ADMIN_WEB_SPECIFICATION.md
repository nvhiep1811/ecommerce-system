# 📋 Web Admin Development Specification & Backend API Documentation

**Project:** E-Commerce System  
**Version:** 1.0.0  
**Date:** May 14, 2026  
**Purpose:** Backend API contract and web admin development guidelines for TailAdmin React template

---

## 📑 Table of Contents

1. [Project Architecture](#project-architecture)
2. [Backend Services Overview](#backend-services-overview)
3. [Database Schema Overview](#database-schema-overview)
4. [API Endpoints Specification](#api-endpoints-specification)
5. [Admin Web Requirements](#admin-web-requirements)
6. [Technology Stack](#technology-stack)
7. [GitLab & CI/CD Integration](#gitlab--cicd-integration)
8. [Environment Configuration](#environment-configuration)
9. [Development Setup](#development-setup)
10. [Testing Requirements](#testing-requirements)

---

## 1. Project Architecture

### System Overview

The E-Commerce System follows a **service-based architecture** with a shared PostgreSQL database and clear domain ownership:

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              API Gateway (Port 8080)                        │
│   Single entry point for all client traffic                 │
└─────────────────────────────────────────────────────────────┘
            ↙           ↓            ↘             ↙
    ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐
    │  User    │  │  Catalog   │  │Commerce  │  │  Admin   │
    │ Service  │  │  Service   │  │ Service  │  │  Panel   │
    │Port 8081 │  │Port 8082   │  │Port 8083 │  │Port 3000 │
    └──────────┘  └────────────┘  └──────────┘  └──────────┘
            ↘           ↓            ↙
        ┌────────────────────────────────────┐
        │  Shared PostgreSQL Database        │
        │  - Users & Addresses               │
        │  - Products & Inventory            │
        │  - Orders & Payments               │
        │  - Coupons & Promotions            │
        └────────────────────────────────────┘
```

### Key Architectural Patterns

- **API Gateway:** Single entry point for mobile clients, routes to appropriate services
- **Orchestrator:** `CheckoutOrchestrator` in commerce-service coordinates multi-service checkout flow
- **Strategy Pattern:** `PaymentMethodStrategy` handles multiple payment methods
- **Outbox Pattern:** Reliable event publishing via `outbox_events` table
- **Fault Tolerance:** Resilience4j with Retry, CircuitBreaker, Bulkhead
- **Optimistic Locking:** `@Version` fields on base entities

---

## 2. Backend Services Overview

### 2.1 User Service (Port 8081)

**Responsibilities:**
- Authentication (login, registration, password reset)
- User profile management
- Address management
- Payment method management
- OTP verification

**Database Tables Owned:**
- `users` - User accounts and profiles
- `user_roles` - Role assignments
- `addresses` - User shipping addresses
- `customer_payment_methods` - Stored payment methods
- `roles` - Role definitions (CUSTOMER, ADMIN, SELLER)

**Key Features:**
- JWT-based authentication
- OTP for password reset
- Email verification
- Multiple addresses per user (one default)
- Payment method tokenization

---

### 2.2 Catalog Service (Port 8082)

**Responsibilities:**
- Product management
- Category management
- Brand management
- Coupon/Promotion management
- Product attributes and variants
- Catalog search and filtering

**Database Tables Owned:**
- `products` - Product listings
- `categories` - Product categories (hierarchical)
- `brands` - Product brands
- `product_images` - Product images
- `product_variants` - Product variants (size, color, etc.)
- `product_variant_images` - Variant-specific images
- `attributes` - Product attributes
- `attribute_values` - Attribute values
- `coupons` - Promotion codes
- `coupon_usages` - Coupon usage tracking

**Key Features:**
- Hierarchical categories
- Simple and variant products
- SKU management
- Full-text search with trigram indexes
- Product ratings and reviews (structure ready)
- Coupon validation and usage limits
- Product publish workflow

---

### 2.3 Commerce Service (Port 8083)

**Responsibilities:**
- Order management and checkout
- Inventory management
- Payment processing
- Shipping method management
- Payment gateway integration (SePay, VietQR)

**Database Tables Owned:**
- `orders` - Order records
- `order_items` - Order line items
- `payments` - Payment records
- `inventory_items` - Stock levels
- `inventory_reservations` - Inventory holds
- `inventory_movements` - Stock audit trail
- `carts` - Shopping carts
- `cart_items` - Cart items
- `shipping_methods` - Shipping options
- `outbox_events` - Integration events

**Key Features:**
- Multi-step order management
- Inventory reservation system
- Multiple payment methods
- SePay QR code payment
- SePay checkout integration
- VietQR support
- Order state machine (pending → paid → confirmed → processing → shipping → delivered)
- Coupon application in checkout

---

### 2.4 API Gateway (Port 8080)

**Role:** Single HTTP entry point for mobile clients
**Routes:**
- `/api/auth/**` → User Service
- `/api/users/**` → User Service
- `/api/catalog/**` → Catalog Service
- `/api/commerce/**` → Commerce Service

---

## 3. Database Schema Overview

### 3.1 User Domain

```sql
users (id, email, password_hash, full_name, phone_number, avatar_url, status, is_verified, version)
user_roles (user_id, role_code)
addresses (id, user_id, receiver_name, receiver_phone, address_line, ward, district, city, province, postal_code, country, is_default, version)
customer_payment_methods (id, user_id, method_type, provider, provider_token, masked_account, is_default, version)
```

**Key Constraints:**
- Email is unique and uses `citext` (case-insensitive)
- One default address per user
- One default payment method per user
- Optimistic locking via `version` field

---

### 3.2 Catalog Domain

```sql
brands (id, name, description, logo_url, version)
categories (id, parent_id, name, slug, description, image_url, is_active, version)
products (id, category_id, brand_id, seller_id, product_type, sku, name, slug, short_description, description, thumbnail_url, base_price, active, published, published_at, deleted_at, rating_avg, review_count, version)
product_images (id, product_id, image_url, is_main, sort_order)
product_variants (id, product_id, sku, combination, variant_name, price, active, thumbnail_url, version)
product_variant_images (id, variant_id, image_url, is_main, sort_order)
product_attribute_values (product_id, attribute_value_id)
coupons (id, code, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, usage_limit, used_count, active, version)
coupon_usages (id, coupon_id, user_id, order_id, used_at)
```

**Key Features:**
- Hierarchical categories
- Full-text search on product names (trigram indexes)
- Soft delete via `deleted_at`
- Product variants with JSON `combination` field
- Product ratings and review counts
- Coupon usage limits and time windows

---

### 3.3 Commerce Domain

```sql
shipping_methods (id, name, description, estimated_min_days, estimated_max_days, fee, active, version)
orders (id, order_no, cart_id, user_id, coupon_id, shipping_method_id, order_status, payment_status, fulfillment_status, receiver_name, receiver_phone, shipping_address_line, shipping_ward, shipping_district, shipping_city, shipping_province, shipping_postal_code, shipping_country, note, payment_method_code, subtotal, shipping_fee, tax_amount, discount_amount, grand_total, placed_at, paid_at, cancelled_at, delivered_at, version)
order_items (id, order, quantity, unit_price, subtotal)
payments (id, order_id, payment_method_code, amount, transaction_id, status, provider_response, expires_at, attempted_at, completed_at, version)
inventory_items (id, product_id, variant_id, available_qty, reserved_qty, safety_stock, version)
inventory_reservations (id, order_id, product_id, variant_id, quantity, status, expires_at)
inventory_movements (id, product_id, variant_id, movement_type, quantity, reference_type, reference_id, note)
carts (id, user_id, status, last_merged_at, checked_out_at, abandoned_at, expires_at, version)
cart_items (id, cart_id, product_id, variant_id, quantity, is_selected, added_at, version)
outbox_events (id, aggregate_id, event_type, payload, published, created_at)
```

**Order Status Workflow:**
- `pending` → `pending_payment` → `paid` → `confirmed` → `processing` → `shipping` → `delivered`
- Or: `cancelled`, `payment_expired`, `returned`

**Payment Methods:**
- `COD` (Cash on Delivery)
- `CARD`, `BANK_TRANSFER`, `VNPAY`, `MOMO`, `PAYPAL`
- `SEPAY_QR` (SePay QR code)
- `SEPAY_CHECKOUT` (SePay checkout form)
- `SEPAY_CARD`
- `APPLE_PAY`, `GOOGLE_PAY`

---

## 4. API Endpoints Specification

### 4.1 Authentication Endpoints

**Base URL:** `http://localhost:8080/api/auth` or `http://api-gateway:8080/api/auth`

#### Register User
```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe",
  "phoneNumber": "+84901234567"
}

Response (201 Created):
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "phoneNumber": "+84901234567",
  "token": "jwt-token-here",
  "refreshToken": "refresh-token-here"
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response (200 OK):
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "token": "jwt-token-here",
  "refreshToken": "refresh-token-here",
  "roles": ["CUSTOMER", "ADMIN"]
}
```

#### Request Password Reset OTP
```
POST /auth/request-password-reset-otp
Content-Type: application/json

{
  "email": "user@example.com"
}

Response (200 OK):
{
  "message": "OTP sent to email",
  "expiresIn": 600
}
```

#### Verify Password Reset OTP
```
POST /auth/verify-password-reset-otp
Content-Type: application/json
Authorization: Bearer {token}

{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123!"
}

Response (200 OK):
{
  "message": "Password reset successful"
}
```

#### Refresh Token
```
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "refresh-token-here"
}

Response (200 OK):
{
  "token": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

---

### 4.2 User Profile Endpoints

**Base URL:** `http://localhost:8080/api/users` or `http://api-gateway:8080/api/users`

#### Get Current User Profile
```
GET /users/profile
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "phoneNumber": "+84901234567",
  "avatarUrl": "https://...",
  "status": "active",
  "isVerified": true,
  "roles": ["CUSTOMER"],
  "createdAt": "2026-05-12T10:30:00Z"
}
```

#### Update User Profile
```
PUT /users/profile
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "fullName": "Jane Doe",
  "phoneNumber": "+84901234568",
  "avatarUrl": "https://..."
}

Response (200 OK):
{
  "id": "uuid",
  "fullName": "Jane Doe",
  "phoneNumber": "+84901234568",
  "avatarUrl": "https://..."
}
```

#### Get User Addresses
```
GET /users/addresses
Authorization: Bearer {jwt-token}

Response (200 OK):
[
  {
    "id": 1,
    "receiverName": "John Doe",
    "receiverPhone": "+84901234567",
    "addressLine": "123 Main Street",
    "ward": "Ward 1",
    "district": "District 1",
    "city": "Ho Chi Minh",
    "province": "HCM",
    "postalCode": "700000",
    "country": "Vietnam",
    "isDefault": true,
    "createdAt": "2026-05-12T10:30:00Z"
  }
]
```

#### Create Address
```
POST /users/addresses
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "receiverName": "Jane Doe",
  "receiverPhone": "+84901234568",
  "addressLine": "456 Oak Avenue",
  "ward": "Ward 2",
  "district": "District 2",
  "city": "Ha Noi",
  "province": "HN",
  "postalCode": "100000",
  "country": "Vietnam",
  "isDefault": false
}

Response (201 Created):
{
  "id": 2,
  "receiverName": "Jane Doe",
  "receiverPhone": "+84901234568",
  "addressLine": "456 Oak Avenue",
  ...
}
```

#### Update Address
```
PUT /users/addresses/{id}
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "receiverName": "Jane Smith",
  "receiverPhone": "+84901234569",
  ...
}

Response (200 OK):
{...}
```

#### Delete Address
```
DELETE /users/addresses/{id}
Authorization: Bearer {jwt-token}

Response (204 No Content)
```

#### Set Default Address
```
PUT /users/addresses/{id}/set-default
Authorization: Bearer {jwt-token}

Response (200 OK):
{...}
```

---

### 4.3 Catalog - Products Endpoints

**Base URL:** `http://localhost:8080/api/catalog` or `http://api-gateway:8080/api/catalog`

#### Get Products (List)
```
GET /catalog/products?page=0&size=20&categoryId=1&brandId=1&sortBy=latest&search=iphone
Authorization: Bearer {jwt-token} (optional)

Response (200 OK):
{
  "content": [
    {
      "id": 1,
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "shortDescription": "Latest iPhone model",
      "description": "...",
      "thumbnailUrl": "https://...",
      "basePrice": 999.99,
      "productType": "variant",
      "active": true,
      "published": true,
      "publishedAt": "2026-05-12T10:30:00Z",
      "ratingAvg": 4.5,
      "reviewCount": 120,
      "brand": {
        "id": 1,
        "name": "Apple"
      },
      "category": {
        "id": 2,
        "name": "Smartphones"
      },
      "variants": [
        {
          "id": 1,
          "sku": "IP15P-128GB-BLK",
          "variantName": "128GB Black",
          "price": 999.99,
          "combination": {"storage": "128GB", "color": "Black"},
          "active": true
        }
      ]
    }
  ],
  "totalElements": 150,
  "totalPages": 8,
  "currentPage": 0,
  "size": 20
}
```

#### Get Product Detail
```
GET /catalog/products/{id}
Authorization: Bearer {jwt-token} (optional)

Response (200 OK):
{
  "id": 1,
  "name": "iPhone 15 Pro",
  "description": "...",
  "basePrice": 999.99,
  "images": [
    {
      "id": 1,
      "imageUrl": "https://...",
      "isMain": true,
      "sortOrder": 1
    }
  ],
  "variants": [
    {
      "id": 1,
      "sku": "IP15P-128GB-BLK",
      "variantName": "128GB Black",
      "price": 999.99,
      "combination": {"storage": "128GB", "color": "Black"},
      "active": true,
      "images": [
        {
          "id": 1,
          "imageUrl": "https://...",
          "isMain": true
        }
      ]
    }
  ],
  "attributes": [
    {
      "id": 1,
      "name": "Storage",
      "values": ["128GB", "256GB", "512GB"]
    }
  ],
  "ratingAvg": 4.5,
  "reviewCount": 120
}
```

#### Get Categories
```
GET /catalog/categories
Authorization: Bearer {jwt-token} (optional)

Response (200 OK):
[
  {
    "id": 1,
    "name": "Electronics",
    "slug": "electronics",
    "description": "...",
    "imageUrl": "https://...",
    "isActive": true,
    "children": [
      {
        "id": 2,
        "name": "Smartphones",
        "slug": "smartphones",
        "isActive": true
      }
    ]
  }
]
```

#### Search Products
```
GET /catalog/products/search?q=iphone&page=0&size=20
Authorization: Bearer {jwt-token} (optional)

Response (200 OK):
{
  "content": [...],
  "totalElements": 45,
  "totalPages": 3,
  "currentPage": 0,
  "size": 20
}
```

---

### 4.4 Catalog - Coupons Endpoints

**Base URL:** `http://localhost:8080/api/catalog`

#### Create Coupon (ADMIN)
```
POST /catalog/coupons
Content-Type: application/json
Authorization: Bearer {admin-token}

{
  "code": "SAVE10",
  "description": "10% discount on all orders",
  "discountType": "percent",
  "discountValue": 10,
  "minOrderValue": 50.00,
  "maxDiscount": 20.00,
  "startAt": "2026-05-12T00:00:00Z",
  "endAt": "2026-12-31T23:59:59Z",
  "usageLimit": 100,
  "active": true
}

Response (201 Created):
{
  "id": 1,
  "code": "SAVE10",
  "description": "10% discount on all orders",
  "discountType": "percent",
  "discountValue": 10.00,
  "minOrderValue": 50.00,
  "maxDiscount": 20.00,
  "startAt": "2026-05-12T00:00:00Z",
  "endAt": "2026-12-31T23:59:59Z",
  "usageLimit": 100,
  "usedCount": 0,
  "active": true,
  "createdAt": "2026-05-12T10:30:00Z"
}
```

#### Get Coupons
```
GET /catalog/coupons?page=0&size=20
Authorization: Bearer {admin-token}

Response (200 OK):
{
  "content": [...]
}
```

#### Get Coupon Detail
```
GET /catalog/coupons/{id}
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "id": 1,
  "code": "SAVE10",
  ...
}
```

#### Update Coupon (ADMIN)
```
PUT /catalog/coupons/{id}
Content-Type: application/json
Authorization: Bearer {admin-token}

{
  "description": "Updated description",
  "active": true,
  ...
}

Response (200 OK):
{...}
```

#### Delete Coupon (ADMIN)
```
DELETE /catalog/coupons/{id}
Authorization: Bearer {admin-token}

Response (204 No Content)
```

#### Validate Coupon
```
POST /catalog/coupons/validate
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "couponCode": "SAVE10",
  "orderTotal": 100.00
}

Response (200 OK):
{
  "valid": true,
  "coupon": {
    "id": 1,
    "code": "SAVE10",
    "discountType": "percent",
    "discountValue": 10,
    "discount": 10.00,
    "maxDiscount": 20.00
  },
  "message": "Coupon is valid"
}

OR

Response (400 Bad Request):
{
  "valid": false,
  "message": "Coupon has expired"
}
```

---

### 4.5 Commerce - Orders Endpoints

**Base URL:** `http://localhost:8080/api/commerce` or `http://api-gateway:8080/api/commerce`

#### Create Order (Checkout)
```
POST /commerce/orders
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "cartId": 1,
  "shippingMethodId": 1,
  "paymentMethodCode": "COD",
  "couponCode": "SAVE10",
  "shippingAddressId": 1,
  "note": "Please ring the doorbell"
}

Response (201 Created):
{
  "id": 1,
  "orderNo": "ORD-20260512-001",
  "orderStatus": "pending",
  "paymentStatus": "unpaid",
  "fulfillmentStatus": "pending",
  "subtotal": 1000.00,
  "shippingFee": 50.00,
  "taxAmount": 0.00,
  "discountAmount": 100.00,
  "grandTotal": 950.00,
  "paymentMethodCode": "COD",
  "items": [
    {
      "id": 1,
      "productId": 1,
      "productName": "iPhone 15 Pro",
      "quantity": 1,
      "unitPrice": 999.99,
      "subtotal": 999.99,
      "variantId": 1,
      "variantName": "128GB Black"
    }
  ],
  "placedAt": "2026-05-12T10:30:00Z"
}
```

#### Get User Orders
```
GET /commerce/orders?page=0&size=20&status=paid
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "content": [
    {
      "id": 1,
      "orderNo": "ORD-20260512-001",
      "orderStatus": "paid",
      "paymentStatus": "paid",
      "fulfillmentStatus": "pending",
      "grandTotal": 950.00,
      "placedAt": "2026-05-12T10:30:00Z",
      "paidAt": "2026-05-12T10:35:00Z"
    }
  ],
  "totalElements": 5,
  "totalPages": 1,
  "currentPage": 0
}
```

#### Get Order Detail
```
GET /commerce/orders/{id}
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "id": 1,
  "orderNo": "ORD-20260512-001",
  "orderStatus": "paid",
  "paymentStatus": "paid",
  "fulfillmentStatus": "shipping",
  "subtotal": 1000.00,
  "shippingFee": 50.00,
  "discountAmount": 100.00,
  "grandTotal": 950.00,
  "items": [...],
  "shippingAddress": {...},
  "payment": {...},
  "timeline": [
    {
      "status": "pending",
      "timestamp": "2026-05-12T10:30:00Z",
      "message": "Order placed"
    }
  ]
}
```

#### Cancel Order
```
POST /commerce/orders/{id}/cancel
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "id": 1,
  "orderStatus": "cancelled",
  "cancelledAt": "2026-05-12T10:40:00Z"
}
```

#### Update Order Status (ADMIN)
```
PUT /commerce/orders/{id}/status
Content-Type: application/json
Authorization: Bearer {admin-token}

{
  "orderStatus": "confirmed",
  "fulfillmentStatus": "packed"
}

Response (200 OK):
{...}
```

---

### 4.6 Commerce - Payments Endpoints

**Base URL:** `http://localhost:8080/api/commerce`

#### Get Payment Methods
```
GET /commerce/payment-methods
Authorization: Bearer {jwt-token} (optional)

Response (200 OK):
[
  {
    "code": "COD",
    "name": "Cash on Delivery",
    "description": "Pay when order is delivered",
    "enabled": true
  },
  {
    "code": "CARD",
    "name": "Credit/Debit Card",
    "enabled": true
  },
  {
    "code": "BANK_TRANSFER",
    "name": "Bank Transfer",
    "enabled": true
  },
  {
    "code": "SEPAY_QR",
    "name": "SePay QR Code",
    "enabled": true
  },
  {
    "code": "SEPAY_CHECKOUT",
    "name": "SePay Checkout",
    "enabled": true
  },
  {
    "code": "VNPAY",
    "name": "VNPay",
    "enabled": false
  },
  {
    "code": "MOMO",
    "name": "MoMo",
    "enabled": false
  }
]
```

#### Get Payment Detail
```
GET /commerce/payments/{paymentId}
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "id": 1,
  "orderId": 1,
  "paymentMethodCode": "SEPAY_QR",
  "amount": 950.00,
  "status": "pending",
  "createdAt": "2026-05-12T10:30:00Z",
  "expiresAt": "2026-05-12T11:00:00Z",
  "nextAction": "SHOW_QR",
  "qrCodeUrl": "https://...",
  "qrImageBase64": "data:image/png;base64,...",
  "transferContent": "Order ORD-20260512-001",
  "bankName": "Techcombank",
  "bankAccount": "12345678",
  "accountName": "E-COMMERCE CO"
}
```

#### SePay Webhook (IPN)
```
POST /commerce/payments/sepay/ipn
Content-Type: application/json

{
  "data": {
    "transaction": {
      "id": "sepay-txn-12345",
      "orderCode": "ORD-20260512-001",
      "amount": 950000,
      "status": "success",
      "referenceCode": "SEPAY-REF-123",
      "transferContent": "Order ORD-20260512-001"
    },
    "signature": "sha256-signature-here"
  }
}

Response (200 OK):
{
  "status": "success",
  "message": "Payment processed"
}
```

---

### 4.7 Commerce - Cart Endpoints

**Base URL:** `http://localhost:8080/api/commerce`

#### Get Cart
```
GET /commerce/carts/active
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "id": 1,
  "status": "active",
  "items": [
    {
      "id": 1,
      "productId": 1,
      "productName": "iPhone 15 Pro",
      "variantId": 1,
      "variantName": "128GB Black",
      "quantity": 2,
      "unitPrice": 999.99,
      "subtotal": 1999.98,
      "isSelected": true
    }
  ],
  "subtotal": 1999.98,
  "itemCount": 2,
  "selectedCount": 2
}
```

#### Add to Cart
```
POST /commerce/carts/items
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "productId": 1,
  "variantId": 1,
  "quantity": 1
}

Response (201 Created):
{
  "id": 1,
  "itemCount": 3
}
```

#### Update Cart Item
```
PUT /commerce/carts/items/{cartItemId}
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "quantity": 2,
  "isSelected": true
}

Response (200 OK):
{...}
```

#### Remove from Cart
```
DELETE /commerce/carts/items/{cartItemId}
Authorization: Bearer {jwt-token}

Response (204 No Content)
```

#### Clear Cart
```
DELETE /commerce/carts
Authorization: Bearer {jwt-token}

Response (204 No Content)
```

---

### 4.8 Commerce - Inventory Endpoints

**Base URL:** `http://localhost:8080/api/commerce`

#### Get Product Inventory
```
GET /commerce/inventory/products/{productId}
Authorization: Bearer {jwt-token}

Response (200 OK):
{
  "productId": 1,
  "availableQty": 50,
  "reservedQty": 5,
  "variants": [
    {
      "variantId": 1,
      "variantName": "128GB Black",
      "availableQty": 25,
      "reservedQty": 2
    }
  ]
}
```

---

### 4.9 Commerce - Shipping Methods Endpoints

**Base URL:** `http://localhost:8080/api/commerce`

#### Get Shipping Methods
```
GET /commerce/shipping-methods
Authorization: Bearer {jwt-token} (optional)

Response (200 OK):
[
  {
    "id": 1,
    "name": "Standard Shipping",
    "description": "Delivery in 3-5 business days",
    "estimatedMinDays": 3,
    "estimatedMaxDays": 5,
    "fee": 50.00,
    "active": true
  },
  {
    "id": 2,
    "name": "Express Shipping",
    "description": "Delivery in 1-2 business days",
    "estimatedMinDays": 1,
    "estimatedMaxDays": 2,
    "fee": 150.00,
    "active": true
  }
]
```

---

## 5. Admin Web Requirements

### 5.1 Core Admin Modules

The web admin dashboard needs to manage:

#### A. User Management
- List users with pagination, search, filter
- View user details, addresses, orders
- Ban/unban users
- Assign roles (CUSTOMER, ADMIN, SELLER)
- View user activity logs

#### B. Product Management
- List products with bulk actions
- Create/edit/delete products
- Manage product variants
- Manage product images
- Manage categories and brands
- Publish/unpublish products
- Manage inventory levels
- View product ratings and reviews

#### C. Order Management
- List all orders with advanced filters
- View order details
- Update order status (confirmed, processing, shipped, delivered)
- Update fulfillment status
- View payment status
- Print order invoice
- Process refunds (for returned orders)
- View order timeline

#### D. Coupon/Promotion Management
- Create coupons with expiry dates
- Set usage limits and discount values
- View coupon usage statistics
- Activate/deactivate coupons
- Edit coupon parameters
- Delete expired coupons

#### E. Category & Brand Management
- Create/edit/delete categories (hierarchical)
- Reorder categories
- Create/edit/delete brands
- View category statistics

#### F. System Configuration
- View system settings
- Manage shipping methods
- Configure payment methods
- View environment variables
- Manage email templates (if needed)

#### G. Reports & Analytics
- Dashboard with key metrics (orders, revenue, users)
- Sales reports by date range
- Top products
- Top customers
- Inventory reports
- Payment method breakdown

#### H. System Monitoring
- View system logs
- Monitor service health
- View database connections
- View API response times

---

### 5.2 Authentication & Authorization

**Requirements:**
- JWT-based authentication
- Role-based access control (RBAC)
  - `ADMIN` - Full access to all modules
  - `SELLER` - Access to own products and orders only
  - User roles are stored in `user_roles` table
- Automatic logout on token expiry
- Refresh token mechanism
- Protected routes based on roles

**Admin Login Flow:**
```
1. User enters email/password
2. POST /api/auth/login
3. Backend returns JWT token + refresh token
4. Store tokens in localStorage/cookies
5. Include JWT in all subsequent requests via Authorization header
6. Check user roles - must have ADMIN role
```

---

### 5.3 Key Dashboard Metrics

**Home Dashboard Should Display:**
- Total Orders (current month)
- Total Revenue (current month)
- Total Customers
- Total Products
- Pending Orders Count
- Low Stock Products Count
- Recent Orders (last 5)
- Top Products (last 7 days)
- Payment Method Breakdown (pie chart)
- Daily Revenue Trend (line chart)
- Orders by Status (bar chart)

---

## 6. Technology Stack

### Backend
- **Java:** 17
- **Spring Boot:** 3.3.5
- **Spring Cloud:** 2023.0.3
- **Build Tool:** Maven 3.9.9
- **Database:** PostgreSQL 15+
- **JWT:** jjwt 0.12.6
- **Resilience:** Resilience4j 2.2.0

### Frontend (Admin Web)
- **React:** 19.2.6
- **TypeScript:** ~5.7.2
- **Tailwind CSS:** 4.0.8
- **Vite:** 6.1.0
- **Router:** React Router 7.1.5
- **Charts:** ApexCharts 4.1.0
- **Calendar:** FullCalendar 6.1.15
- **Icons:** Custom SVG + React

### Mobile
- **Framework:** Expo (React Native)
- **TypeScript:** Latest
- **UI Components:** Expo Router

### Infrastructure
- **CI/CD:** GitLab CI (primary), Jenkins (alternative)
- **Container Orchestration:** Docker (ready)
- **Database:** PostgreSQL
- **Message Queue:** RabbitMQ
- **Cache:** Redis (configured)

---

## 7. GitLab & CI/CD Integration

### 7.1 GitLab CI/CD Pipeline

**File Location:** `.gitlab-ci.yml`

**Pipeline Stages:**

1. **Validate Stage** (runs on MR, tags, and branches)
   - Mobile `npm ci` and dependencies install
   - Expo lint check
   - TypeScript type checking

2. **Test Stage**
   - Backend Maven unit tests
   - JUnit reports collection
   - Test coverage reports

3. **Package Stage** (runs on default branch or tags)
   - Build backend JAR files
   - Upload artifacts
   - Retain for 14 days

**Pipeline Rules:**
- Runs on merge requests, tags, and all branches
- Cancels previous pipelines if new one starts
- Max 1 automatic retry on runner failure
- Keeps last 20 builds, 10 artifacts

---

### 7.2 Required GitLab Variables

These secrets must be configured in GitLab CI/CD variables:

```
ECOMMERCE_JWT_SECRET          - JWT signing secret (auto-generate)
AUTH_OTP_SECRET               - OTP encryption secret (auto-generate)
ECOMMERCE_DB_URL              - PostgreSQL JDBC URL
ECOMMERCE_DB_USERNAME         - Database user
ECOMMERCE_DB_PASSWORD         - Database password
REDIS_HOST                    - Redis server hostname
RABBITMQ_HOST                 - RabbitMQ server hostname
RABBITMQ_USERNAME             - RabbitMQ user
RABBITMQ_PASSWORD             - RabbitMQ password
MAIL_HOST                     - SMTP mail server
MAIL_PORT                     - SMTP port
MAIL_USERNAME                 - Mail account username
MAIL_PASSWORD                 - Mail account password
SEPAY_MERCHANT_ID             - SePay merchant ID
SEPAY_SECRET_KEY              - SePay secret key
SEPAY_WEBHOOK_SECRET          - SePay webhook signature secret
VIETQR_ENABLED                - VietQR service enable flag
VIETQR_QR_BASE_URL            - VietQR API endpoint
SUPABASE_URL                  - Supabase project URL (for images only)
SUPABASE_SERVICE_ROLE_KEY     - Supabase service role key
```

**How to set variables in GitLab:**
1. Go to repository → Settings → CI/CD → Variables
2. Add each variable with proper scope
3. Mark sensitive variables as "Masked"
4. Use `$VARIABLE_NAME` in `.gitlab-ci.yml`

---

### 7.3 Docker Build (Optional, For Future)

Current pipeline does NOT include Docker image builds. To add:
- Create `Dockerfile` for each service
- Define Docker image registry
- Add Docker build job to `package` stage
- Define deployment targets

---

## 8. Environment Configuration

### 8.1 Local Development Setup

**Backend Services (.env file)**

```bash
# Database
ECOMMERCE_DB_URL=jdbc:postgresql://localhost:5432/ecommerce_dev
ECOMMERCE_DB_USERNAME=postgres
ECOMMERCE_DB_PASSWORD=your-password

# Security
ECOMMERCE_JWT_SECRET=your-generated-jwt-secret-min-32-chars
AUTH_OTP_SECRET=your-generated-otp-secret-min-32-chars

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# Email (Gmail example)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# SePay (disabled in dev)
SEPAY_ENABLED=false
SEPAY_MERCHANT_ID=
SEPAY_SECRET_KEY=
SEPAY_CHECKOUT_ENDPOINT=https://checkout.sepay.vn/api/checkout/init
SEPAY_QR_ENDPOINT=https://qr.sepay.vn/getqr

# VietQR (disabled in dev)
VIETQR_ENABLED=false

# Supabase (for image uploads)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Base URLs
APP_PUBLIC_BASE_URL=http://localhost:3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

**Mobile App (.env file)**

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

**Admin Web (.env file)**

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

---

### 8.2 Service Startup Order

1. **PostgreSQL Database**
   ```bash
   psql -U postgres -d ecommerce_dev
   # Execute schema_final_merged.sql
   ```

2. **Redis** (optional for dev)
   ```bash
   redis-server
   ```

3. **RabbitMQ** (optional for dev)
   ```bash
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
   ```

4. **Backend Services** (order matters for service discovery)
   ```bash
   # Terminal 1: User Service
   cd backend/user-service
   mvn spring-boot:run

   # Terminal 2: Catalog Service
   cd backend/catalog-service
   mvn spring-boot:run

   # Terminal 3: Commerce Service
   cd backend/commerce-service
   mvn spring-boot:run

   # Terminal 4: API Gateway
   cd backend/api-gateway
   mvn spring-boot:run
   ```

5. **Admin Web**
   ```bash
   cd admin-web
   npm install
   npm run dev
   ```

6. **Mobile App** (Expo)
   ```bash
   cd mobile-app
   npm install
   npm start
   ```

---

### 8.3 Service Ports

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 8080 | http://localhost:8080 |
| User Service | 8081 | http://localhost:8081 |
| Catalog Service | 8082 | http://localhost:8082 |
| Commerce Service | 8083 | http://localhost:8083 |
| Admin Web | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| RabbitMQ | 5672 | localhost:5672 |
| RabbitMQ UI | 15672 | http://localhost:15672 |

---

## 9. Development Setup

### 9.1 Prerequisites

- **Java 17 JDK** (must match backend requirement)
- **Maven 3.9+**
- **Node.js 20+** (for admin web and mobile)
- **PostgreSQL 15+**
- **Git**
- **Postman** or **Insomnia** (for API testing)

### 9.2 Repository Setup

```bash
# Clone repository
git clone <repository-url>
cd ecommerce-system

# Create local .env files
cp backend/.env.example backend/.env
cp mobile-app/.env.example mobile-app/.env

# Edit .env files with local database credentials
```

### 9.3 Database Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ecommerce_dev;

# Execute schema
\c ecommerce_dev
\i backend/db/schema_final_merged.sql

# Seed demo data (optional)
\i backend/db/realistic_demo_seed.sql
```

### 9.4 Backend Build

```bash
cd backend

# Build all modules
mvn clean install

# Run specific service
cd user-service
mvn spring-boot:run
```

### 9.5 Admin Web Setup

```bash
cd admin-web

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Linting
npm run lint
```

### 9.6 Testing Endpoints

**Using cURL:**
```bash
# Get payment methods
curl -X GET http://localhost:8080/api/commerce/payment-methods

# Register user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe",
    "phoneNumber": "+84901234567"
  }'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

---

## 10. Testing Requirements

### 10.1 Backend Unit Tests

Located in `src/test/java` directories:
- AuthServiceTest
- AddressServiceTest
- AuthControllerTest
- CatalogServiceTest
- ProductPageReadCacheTest
- CheckoutOrchestratorTest
- PaymentServiceTest
- InventoryServiceTest
- And more...

**Run tests:**
```bash
cd backend
mvn test

# Run specific test
mvn test -Dtest=AuthServiceTest
```

### 10.2 Integration Test Checklist

Key flows to test:
1. **User Registration & Login**
   - New user registration
   - Login with valid credentials
   - Login with invalid credentials
   - Password reset flow

2. **Product Catalog**
   - List products with pagination
   - Filter by category
   - Search products
   - Get product details with variants
   - Get product inventory

3. **Coupon Management**
   - Create coupon
   - Validate coupon
   - Apply coupon to order
   - Check usage limits

4. **Order Checkout**
   - Add items to cart
   - Remove items from cart
   - Apply shipping method
   - Apply coupon
   - Create order with COD
   - Create order with SEPAY_QR

5. **Payment Processing**
   - Get payment methods
   - Create SePay QR payment
   - Simulate SePay webhook (IPN)
   - Verify payment status changes

6. **Order Management**
   - User views their orders
   - Admin updates order status
   - Order status transitions
   - Cancel order

### 10.3 API Testing Tools

**Recommended:**
- Postman (GUI, easy to learn)
- Insomnia (Alternative to Postman)
- cURL (command line)
- Rest Client VSCode extension

**Test collections to create:**
- Authentication endpoints
- User profile endpoints
- Catalog endpoints
- Order endpoints
- Payment endpoints

---

## 📌 Important Notes for Admin Web Development

### Scenario: Create Admin Dashboard
When developing admin features, follow these steps:

1. **Plan the feature** with this document
2. **Check required endpoints** from Section 4
3. **Implement API client** in `admin-web/src/services/`
4. **Create components** using TailAdmin React components
5. **Add routes** in `admin-web/src/App.tsx`
6. **Test endpoints** using Postman
7. **Build UI pages** with Tailwind CSS
8. **Add authentication** checks via JWT

### API Client Pattern

Example structure for admin web API client:

```typescript
// src/services/apiClient.ts
import axios from 'axios';

const API_BASE_URL = process.env.VITE_API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Add JWT token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
```

### Required Admin Permissions Check

```typescript
// Check if user has ADMIN role
const user = getAuthenticatedUser();
if (!user.roles.includes('ADMIN')) {
  return <Navigate to="/unauthorized" />;
}
```

---

## 🔐 Security Reminders

- **Never commit credentials** in code or .env files
- **Always use HTTPS** in production
- **Validate input** on both client and server
- **Sanitize output** to prevent XSS
- **Use CSRF tokens** for state-changing operations
- **Implement rate limiting** on API endpoints
- **Log all admin actions** for audit trails
- **Rotate secrets** regularly
- **Use strong JWT secrets** (min 32 characters)

---

## 📞 Troubleshooting

### Backend Issues

**Problem:** Database connection fails
```
Solution: Verify ECOMMERCE_DB_URL and credentials in .env
Run: psql -h localhost -U postgres -d ecommerce_dev
```

**Problem:** Port already in use
```
Solution: Kill process using port
Mac/Linux: lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9
Windows: netstat -ano | findstr :8080 | taskkill /PID <PID> /F
```

**Problem:** JWT token invalid
```
Solution: Ensure ECOMMERCE_JWT_SECRET is same in all services
Regenerate token with: echo -n "random-string-32-chars-or-more" | base64
```

---

**Document Last Updated:** 2026-05-14
**Status:** Ready for Admin Web Development
**Next Steps:** Review API endpoints and start implementing admin modules

