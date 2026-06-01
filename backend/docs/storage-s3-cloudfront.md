# Media Storage on S3 and CloudFront

New media uploads are written to a private S3 bucket and read through CloudFront.
The backend does not use public S3 ACLs and does not store S3 URLs in the database.

## Ownership

- `catalog-service` owns product image uploads under `products/`.
- `user-service` owns user avatar uploads under `avatars/`.
- `chat-service` owns chat media uploads under `chat-media/`.
- Shared S3/CDN mechanics live in `shared-kernel` under `com.ecommerce.shared.storage`.

No separate storage service is introduced in this phase.

## Runtime Environment

Required values for the three media-owning services:

```text
S3_BUCKET=ecommerce-prod-media-4ss-2026
S3_REGION=ap-southeast-1
CDN_BASE_URL=https://d35ci4s1xmcpe.cloudfront.net
S3_PRODUCTS_PREFIX=products/
S3_AVATARS_PREFIX=avatars/
S3_CHAT_MEDIA_PREFIX=chat-media/
S3_TEMP_PREFIX=temp/
S3_ENCRYPTION=SSE-S3
S3_CACHE_CONTROL=public, max-age=31536000, immutable
S3_PRODUCT_IMAGE_MAX_SIZE_BYTES=5242880
S3_AVATAR_MAX_SIZE_BYTES=5242880
S3_CHAT_IMAGE_MAX_SIZE_BYTES=5242880
S3_CHAT_VIDEO_MAX_SIZE_BYTES=52428800
```

AWS credentials are resolved by the AWS SDK default credentials provider chain.
On ECS, use IAM Task Roles. Do not commit access keys to the repo.

## Object Keys

```text
products/{sellerId}/{yyyyMMdd}/{uuid}.jpg
avatars/{userId}/{uuid}.jpg
chat-media/{conversationId}/{yyyyMMdd}/{uuid}.jpg
```

Uploaded responses return CloudFront URLs such as:

```text
https://d35ci4s1xmcpe.cloudfront.net/products/{sellerId}/{yyyyMMdd}/{uuid}.jpg
```

## IAM

Least-privilege production roles should scope each service to its own prefix:

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::ecommerce-prod-media-4ss-2026/products/*"
}
```

Use `avatars/*` for `user-service` and `chat-media/*` for `chat-service`.
CloudFront should read the private bucket through OAC.

## Backward Compatibility

- Legacy external media URLs stored in the database are not deleted by the new S3 delete paths.
- `chat-service` keeps `GET /chat/media/{fileName}` for local files uploaded before this change.
- New chat uploads return CloudFront URLs directly and do not route media downloads through the backend.
