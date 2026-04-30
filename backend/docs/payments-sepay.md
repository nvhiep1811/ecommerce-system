# Payment methods and SePay integration

## API checklist

1. Call `GET /api/payment-methods`.
2. Create an order with `paymentMethod=COD` through `POST /api/orders` or the existing `POST /api/commerce/orders`.
3. Verify the COD order remains `orderStatus=pending` and `paymentStatus=unpaid`.
4. Verify an `ORDER_CREATED` outbox event is relayed to RabbitMQ with routing key `order.created`.
5. Create an order with `paymentMethod=SEPAY_QR`.
6. Verify the response has `nextAction=SHOW_QR` and `payment.qrCodeUrl` or `payment.qrImageBase64`, `transferContent`, `expiredAt`.
7. Mobile should render QR, allow QR image download, copy `transferContent`, show countdown from `expiredAt`, and poll payment status.
8. Simulate a SePay success webhook to `POST /api/payments/sepay/ipn`.
9. Verify payment becomes `paid`, order becomes `paid`, and the order `paidAt` is set.
10. Verify the order-paid email event is consumed from RabbitMQ.
11. Create an order with `paymentMethod=SEPAY_CHECKOUT`.
12. Verify the response has `nextAction=OPEN_CHECKOUT_URL` and `payment.checkoutUrl`.
13. Open `checkoutUrl`; backend renders an auto-submit HTML form to SePay `checkout/init`.
14. Simulate payment expiry by setting `expired_at` in the past and waiting for the scheduled job.
15. Verify payment becomes `expired` and the order becomes `payment_expired` only for online payments.
16. Send the same webhook transaction twice and verify no second email/state transition is produced.
17. Verify `APPLE_PAY` and `GOOGLE_PAY` are returned disabled unless explicitly configured and implemented.

## SePay variables

- `SEPAY_ENABLED`
- `SEPAY_MERCHANT_ID`
- `SEPAY_SECRET_KEY`
- `SEPAY_CHECKOUT_ENDPOINT`
- `SEPAY_QR_ENDPOINT`
- `SEPAY_SUCCESS_URL`
- `SEPAY_CANCEL_URL`
- `SEPAY_ERROR_URL`
- `SEPAY_WEBHOOK_SECRET`
- `SEPAY_PAYMENT_EXPIRE_MINUTES`
- `SEPAY_BANK_NAME`
- `SEPAY_BANK_ACCOUNT_NUMBER`
- `SEPAY_ACCOUNT_NAME`
- `SEPAY_BANK_DEEP_LINK` (optional; keep blank unless the gateway/bank confirms support)
- `APP_PUBLIC_BASE_URL`

## VietQR.io variables

VietQR.io is used only as a QR/deeplink UX helper for `SEPAY_QR`. It must not confirm payment.
Only a valid SePay webhook/IPN may mark payment/order as paid.

- `VIETQR_ENABLED`
- `VIETQR_QR_BASE_URL`
- `VIETQR_DEEPLINK_BASE_URL`
- `VIETQR_BANK_BIN`
- `VIETQR_BANK_CODE`
- `VIETQR_ACCOUNT_NO`
- `VIETQR_ACCOUNT_NAME`
- `VIETQR_TEMPLATE`
- `VIETQR_DEEPLINK_ENABLED`
- `VIETQR_DEEPLINK_APP_CODE`
- `VIETQR_RETURN_URL`

## RabbitMQ and mail variables

- `RABBITMQ_HOST`
- `RABBITMQ_PORT`
- `RABBITMQ_USERNAME`
- `RABBITMQ_PASSWORD`
- `EVENTS_RABBIT_EXCHANGE`
- `EVENTS_RABBIT_NOTIFICATION_EMAIL_QUEUE`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`

## SePay TODO before production

- Confirm the production checkout endpoint, merchant id, and secret from SePay.
- Confirm whether `SEPAY_CARD` should be exposed separately or hidden behind `SEPAY_CHECKOUT`.
- Confirm callback URLs are public HTTPS URLs before enabling checkout outside local testing.
- Confirm bank short name accepted by `qr.sepay.vn/banks.json`.
- Confirm VietQR bank BIN/code and app deeplink code before enabling `VIETQR_DEEPLINK_ENABLED`.
- Decide whether overpayment should be accepted. Current backend requires exact amount match.
- Decide inventory timing for online payments. Current code keeps the existing behavior and reserves inventory when the order is created.
