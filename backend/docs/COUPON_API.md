# 🎟️ Quản lý Voucher/Coupon API Documentation

## 📌 Base URL
```
POST   /catalog/coupons
GET    /catalog/coupons
GET    /catalog/coupons/{id}
PUT    /catalog/coupons/{id}
DELETE /catalog/coupons/{id}
POST   /catalog/coupons/validate
```

---

## 1️⃣ **TẠO VOUCHER** (CREATE)

### Endpoint
```
POST /catalog/coupons
```

### Authorization
- **Required Role:** `ADMIN`
- **Header:** `Authorization: Bearer {JWT_TOKEN}`

### Request Body
```json
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
```

### Response (201 Created)
```json
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

---



### Endpoint
```
GET /catalog/coupons/{id}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | Long | Yes | Coupon ID |

### Response (200 OK)
```json
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
  "usedCount": 45,
  "active": true,
  "createdAt": "2026-05-12T10:30:00Z"
}
```

### Error Responses
```json
{
  "status": "NOT_FOUND",
  "message": "Coupon not found"
}
```

---

## 3️⃣ **LẤY DANH SÁCH VOUCHER** (LIST ALL)

### Endpoint
```
GET /catalog/coupons
```

### Parameters
- **None** (returns all active coupons)

### Response (200 OK)
```json
[
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
    "usedCount": 45,
    "active": true,
    "createdAt": "2026-05-12T10:30:00Z"
  },
  {
    "id": 2,
    "code": "FLAT500",
    "description": "Flat 500 on orders above 2000",
    "discountType": "fixed",
    "discountValue": 500.00,
    "minOrderValue": 2000.00,
    "maxDiscount": null,
    "startAt": null,
    "endAt": null,
    "usageLimit": null,
    "usedCount": 120,
    "active": true,
    "createdAt": "2026-05-10T14:20:00Z"
  }
]
```

---

## 4️⃣ **CHỈNH SỬA VOUCHER** (UPDATE)

### Endpoint
```
PUT /catalog/coupons/{id}
```

### Authorization
- **Required Role:** `ADMIN`
- **Header:** `Authorization: Bearer {JWT_TOKEN}`

### Request Body (all fields optional)
```json
{
  "description": "Updated description",
  "discountType": "percent",
  "discountValue": 15,
  "minOrderValue": 75.00,
  "maxDiscount": 30.00,
  "startAt": "2026-06-01T00:00:00Z",
  "endAt": "2026-12-31T23:59:59Z",
  "usageLimit": 150,
  "active": false
}
```

### Response (200 OK)
```json
{
  "id": 1,
  "code": "SAVE10",
  "description": "Updated description",
  "discountType": "percent",
  "discountValue": 15.00,
  "minOrderValue": 75.00,
  "maxDiscount": 30.00,
  "startAt": "2026-06-01T00:00:00Z",
  "endAt": "2026-12-31T23:59:59Z",
  "usageLimit": 150,
  "usedCount": 45,
  "active": false,
  "createdAt": "2026-05-12T10:30:00Z"
}
```

### Error Responses
```json
{
  "status": "NOT_FOUND",
  "message": "Coupon not found"
}
```

{
  "status": "BAD_REQUEST",
  "message": "Percent discount cannot exceed 100"
}
```

---

## 5️⃣ **XOÁ VOUCHER** (DELETE)

### Endpoint
```
DELETE /catalog/coupons/{id}
```

### Authorization
- **Required Role:** `ADMIN`
- **Header:** `Authorization: Bearer {JWT_TOKEN}`

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | Long | Yes | Coupon ID |

### Response (204 No Content)
```
(no body)
```

### Error Responses
```json
// 404 Not Found
{
  "status": "NOT_FOUND",
  "message": "Coupon not found"
}
```

---

## 6️⃣ **KIỂM TRA/VALIDATE VOUCHER** (EXISTING)

### Endpoint
```
POST /catalog/coupons/validate
```

### Authorization
- **Public** (no auth required)

### Request Body
```json
{
  "code": "SAVE10",
  "orderValue": 100.00
}
```

### Response (200 OK)
```json
{
  "valid": true,
  "discount": 10.00,
  "message": "Coupon applied successfully",
  "coupon": {
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
    "usedCount": 45,
    "active": true,
    "createdAt": "2026-05-12T10:30:00Z"
  }
}
```


## 📊 Coupon Status Codes

| HTTP Code | Meaning |
|-----------|---------|
| 200 | OK - Success |
| 201 | Created - Resource successfully created |
| 204 | No Content - Successful deletion |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid JWT |
| 403 | Forbidden - Insufficient role |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Coupon code already exists |
| 500 | Internal Server Error |

---

## 🔐 Security Rules

✅ **Tạo/chỉnh sửa/xoá voucher**: Chỉ ADMIN
✅ **Lấy voucher**: Công khai
✅ **Validate voucher**: Công khai
✅ **Discount tự động trừ**: Khi checkout, auto tính (không có endpoint riêng)

---

## 🧪 Ví dụ Thực tế

### Tạo voucher 15% cho đơn ≥ 100k
```bash
curl -X POST http://localhost:8000/catalog/coupons \
  -H "Authorization: Bearer {JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUMMER2026",
    "description": "Summer sale 15% off",
    "discountType": "percent",
    "discountValue": 15,
    "minOrderValue": 100000,
    "maxDiscount": 150000,
    "startAt": "2026-06-01T00:00:00Z",
    "endAt": "2026-08-31T23:59:59Z",
    "usageLimit": 500,
    "active": true
  }'
```

### Validate voucher
```bash
curl -X POST http://localhost:8000/catalog/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUMMER2026",
    "orderValue": 150000
  }'
```

### Chỉnh sửa voucher (vô hiệu hóa)
```bash
curl -X PUT http://localhost:8000/catalog/coupons/1 \
  -H "Authorization: Bearer {JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false
  }'
```

### Xoá voucher
```bash
curl -X DELETE http://localhost:8000/catalog/coupons/1 \
  -H "Authorization: Bearer {JWT}"
```

---

## 📝 Notes

1. **Coupon code**: Tự động convert thành UPPERCASE
2. **Discount type**: `percent` hoặc `fixed`
3. **Percent discount**: Phải ≤ 100
4. **Date validation**: `endAt > startAt` nếu cả hai được set
5. **Post-create events**: System publish COUPON_CREATED event via outbox
6. **Post-update events**: System publish COUPON_UPDATED event via outbox
7. **Post-delete events**: System publish COUPON_DELETED event via outbox

