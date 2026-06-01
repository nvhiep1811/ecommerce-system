-- realistic_demo_seed.sql
-- Vietnamese VND demo seed dataset for PostgreSQL/RDS.
-- Demo logins:
--   admin@ecommerce.local / Admin@123
--   seller.tech@ecommerce.local / Seller@123
--   seller.home@ecommerce.local / Seller@123
--   chau.customer@ecommerce.local / Customer@123
--   khang.customer@ecommerce.local / Customer@123
--   mai.customer@ecommerce.local / Customer@123
-- Seed images are expected in S3/CloudFront under existing bucket prefixes:
--   https://d35ci4s1xmcpe.cloudfront.net/assets/
--   https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/
--   https://d35ci4s1xmcpe.cloudfront.net/products/seed/

begin;

insert into public.roles (code, description)
values
  ('CUSTOMER', 'Khach hang'),
  ('ADMIN', 'Quan tri vien'),
  ('SELLER', 'Nguoi ban')
on conflict (code) do update
set description = excluded.description;

insert into public.users (
  email,
  password_hash,
  full_name,
  phone_number,
  avatar_url,
  status,
  is_verified,
  created_at,
  updated_at
)
values
  ('admin@ecommerce.local', crypt('Admin@123', gen_salt('bf', 8)), 'Quản trị hệ thống', '+84901111001', 'https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/users/admin-avatar.jpg', 'active', true, '2026-03-01T08:00:00+07', '2026-04-10T08:00:00+07'),
  ('seller.tech@ecommerce.local', crypt('Seller@123', gen_salt('bf', 8)), 'Phạm Quốc Đạt', '+84901222002', 'https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/users/seller-tech-avatar.jpg', 'active', true, '2026-03-03T09:00:00+07', '2026-04-10T09:00:00+07'),
  ('seller.home@ecommerce.local', crypt('Seller@123', gen_salt('bf', 8)), 'Trần Hoàng Nam', '+84901333003', 'https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/users/seller-home-avatar.jpg', 'active', true, '2026-03-04T09:30:00+07', '2026-04-10T09:30:00+07'),
  ('chau.customer@ecommerce.local', crypt('Customer@123', gen_salt('bf', 8)), 'Nguyễn Minh Châu', '+84903777011', 'https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/users/chau-avatar.jpg', 'active', true, '2026-03-08T19:15:00+07', '2026-04-12T12:00:00+07'),
  ('khang.customer@ecommerce.local', crypt('Customer@123', gen_salt('bf', 8)), 'Trần Minh Khang', '+84903888022', 'https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/users/khang-avatar.jpg', 'active', true, '2026-03-10T08:45:00+07', '2026-04-12T19:10:00+07'),
  ('mai.customer@ecommerce.local', crypt('Customer@123', gen_salt('bf', 8)), 'Lê Thu Mai', '+84903999033', 'https://d35ci4s1xmcpe.cloudfront.net/avatars/seed/users/mai-avatar.jpg', 'active', true, '2026-03-12T20:10:00+07', '2026-04-11T14:45:00+07')
on conflict (email) do update
set
  password_hash = excluded.password_hash,
  full_name = excluded.full_name,
  phone_number = excluded.phone_number,
  avatar_url = excluded.avatar_url,
  status = excluded.status,
  is_verified = excluded.is_verified,
  updated_at = excluded.updated_at;

insert into public.user_roles (user_id, role_code, created_at)
select u.id, seeded.role_code, seeded.created_at
from (values
  ('admin@ecommerce.local', 'ADMIN', '2026-03-01T08:00:00+07'::timestamptz),
  ('seller.tech@ecommerce.local', 'SELLER', '2026-03-03T09:00:00+07'::timestamptz),
  ('seller.home@ecommerce.local', 'SELLER', '2026-03-04T09:30:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'CUSTOMER', '2026-03-08T19:15:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'CUSTOMER', '2026-03-10T08:45:00+07'::timestamptz),
  ('mai.customer@ecommerce.local', 'CUSTOMER', '2026-03-12T20:10:00+07'::timestamptz)
) as seeded(email, role_code, created_at)
join public.users u on u.email = seeded.email
on conflict (user_id, role_code) do nothing;

delete from public.addresses a
using public.users u
where a.user_id = u.id
  and u.email in (
    'chau.customer@ecommerce.local',
    'khang.customer@ecommerce.local',
    'mai.customer@ecommerce.local',
    'seller.tech@ecommerce.local',
    'seller.home@ecommerce.local'
  )
  and a.address_line in (
    '45 Nguyen Huu Canh, Landmark 81',
    '45 Nguyễn Hữu Cảnh, Landmark 81',
    '12 Le Loi, Ben Nghe',
    '12 Lê Lợi, Bến Nghé',
    '88 Tran Phu',
    '88 Trần Phú',
    '27 Hoang Cau',
    '27 Hoàng Cầu',
    '190 Pasteur',
    '15 Nguyen Van Linh',
    '15 Nguyễn Văn Linh'
  );

insert into public.addresses (
  user_id,
  receiver_name,
  receiver_phone,
  address_line,
  ward,
  district,
  city,
  province,
  postal_code,
  country,
  is_default,
  created_at,
  updated_at
)
select
  u.id,
  seeded.receiver_name,
  seeded.receiver_phone,
  seeded.address_line,
  seeded.ward,
  seeded.district,
  seeded.city,
  seeded.province,
  seeded.postal_code,
  seeded.country,
  seeded.is_default,
  seeded.created_at,
  seeded.updated_at
from (values
  ('chau.customer@ecommerce.local', 'Nguyễn Minh Châu', '+84903777011', '45 Nguyễn Hữu Cảnh, Landmark 81', 'Phường 22', 'Bình Thạnh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', '700000', 'Việt Nam', true, '2026-03-09T08:30:00+07'::timestamptz, '2026-04-01T08:30:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'Nguyễn Minh Châu', '+84903777011', '12 Lê Lợi, Bến Nghé', 'Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', '700000', 'Việt Nam', false, '2026-03-25T11:30:00+07'::timestamptz, '2026-03-25T11:30:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'Trần Minh Khang', '+84903888022', '88 Trần Phú', 'Hải Châu 1', 'Hải Châu', 'Đà Nẵng', 'Đà Nẵng', '550000', 'Việt Nam', true, '2026-03-11T09:00:00+07'::timestamptz, '2026-04-09T18:45:00+07'::timestamptz),
  ('mai.customer@ecommerce.local', 'Lê Thu Mai', '+84903999033', '27 Hoàng Cầu', 'Ô Chợ Dừa', 'Đống Đa', 'Hà Nội', 'Hà Nội', '100000', 'Việt Nam', true, '2026-03-13T10:20:00+07'::timestamptz, '2026-04-11T09:20:00+07'::timestamptz),
  ('seller.tech@ecommerce.local', 'Phạm Quốc Đạt', '+84901222002', '190 Pasteur', 'Võ Thị Sáu', 'Quận 3', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', '700000', 'Việt Nam', true, '2026-03-05T13:00:00+07'::timestamptz, '2026-03-05T13:00:00+07'::timestamptz),
  ('seller.home@ecommerce.local', 'Trần Hoàng Nam', '+84901333003', '15 Nguyễn Văn Linh', 'Thạc Gián', 'Thanh Khê', 'Đà Nẵng', 'Đà Nẵng', '550000', 'Việt Nam', true, '2026-03-05T14:00:00+07'::timestamptz, '2026-03-05T14:00:00+07'::timestamptz)
) as seeded(email, receiver_name, receiver_phone, address_line, ward, district, city, province, postal_code, country, is_default, created_at, updated_at)
join public.users u on u.email = seeded.email
where not exists (
  select 1
  from public.addresses a
  where a.user_id = u.id
    and a.address_line = seeded.address_line
);

delete from public.customer_payment_methods cpm
using public.users u
where cpm.user_id = u.id
  and u.email in (
    'chau.customer@ecommerce.local',
    'khang.customer@ecommerce.local',
    'mai.customer@ecommerce.local'
  )
  and cpm.provider_token in (
    'pm_chau_vnpay_main',
    'pm_chau_visa_4242',
    'pm_khang_momo_main',
    'pm_mai_vcb_2689'
  );

insert into public.customer_payment_methods (
  user_id,
  method_type,
  provider,
  provider_token,
  masked_account,
  expiry_month,
  expiry_year,
  is_default,
  created_at,
  updated_at
)
select
  u.id,
  seeded.method_type,
  seeded.provider,
  seeded.provider_token,
  seeded.masked_account,
  seeded.expiry_month,
  seeded.expiry_year,
  seeded.is_default,
  seeded.created_at,
  seeded.updated_at
from (values
  ('chau.customer@ecommerce.local', 'VNPAY', 'VNPAY', 'pm_chau_vnpay_main', 'Ví VNPAY', null::integer, null::integer, true, '2026-03-15T08:10:00+07'::timestamptz, '2026-04-05T09:10:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'CARD', 'VISA', 'pm_chau_visa_4242', 'Visa **** 4242', 10, 2028, false, '2026-03-15T08:12:00+07'::timestamptz, '2026-03-15T08:12:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'MOMO', 'MOMO', 'pm_khang_momo_main', 'MoMo 0903****22', null::integer, null::integer, true, '2026-03-17T10:00:00+07'::timestamptz, '2026-04-12T08:00:00+07'::timestamptz),
  ('mai.customer@ecommerce.local', 'BANK_TRANSFER', 'Vietcombank', 'pm_mai_vcb_2689', 'VCB **** 2689', null::integer, null::integer, true, '2026-03-19T19:00:00+07'::timestamptz, '2026-03-19T19:00:00+07'::timestamptz)
) as seeded(email, method_type, provider, provider_token, masked_account, expiry_month, expiry_year, is_default, created_at, updated_at)
join public.users u on u.email = seeded.email
where not exists (
  select 1
  from public.customer_payment_methods cpm
  where cpm.user_id = u.id
    and cpm.method_type = seeded.method_type
    and coalesce(cpm.masked_account, '') = coalesce(seeded.masked_account, '')
);

commit;

begin;
insert into public.brands (name, description, logo_url, created_at, updated_at)
select seeded.name, seeded.description, seeded.logo_url, seeded.created_at, seeded.updated_at
from (values
  ('Apple', 'Thiết bị và phụ kiện Apple chính hãng cho nhu cầu sử dụng hằng ngày.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/apple-logo.jpg', '2026-03-05T08:00:00+07'::timestamptz, '2026-03-05T08:00:00+07'::timestamptz),
  ('Samsung', 'Điện thoại và phụ kiện Samsung phổ biến tại thị trường Việt Nam.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/samsung-logo.jpg', '2026-03-05T08:05:00+07'::timestamptz, '2026-03-05T08:05:00+07'::timestamptz),
  ('Xiaomi', 'Thiết bị thông minh và đồ gia dụng có mức giá dễ tiếp cận.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/xiaomi-logo.jpg', '2026-03-05T08:10:00+07'::timestamptz, '2026-03-05T08:10:00+07'::timestamptz),
  ('Logitech', 'Phụ kiện làm việc và gaming cho góc máy cá nhân.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/logitech-logo.jpg', '2026-03-05T08:15:00+07'::timestamptz, '2026-03-05T08:15:00+07'::timestamptz),
  ('Anker', 'Phụ kiện sạc nhanh và pin dự phòng cho điện thoại, laptop.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/anker-logo.jpg', '2026-03-05T08:20:00+07'::timestamptz, '2026-03-05T08:20:00+07'::timestamptz),
  ('JBL', 'Thiết bị âm thanh di động cho giải trí trong nhà và ngoài trời.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/jbl-logo.jpg', '2026-03-05T08:25:00+07'::timestamptz, '2026-03-05T08:25:00+07'::timestamptz),
  ('Ecovacs', 'Robot hút bụi và thiết bị vệ sinh thông minh cho gia đình.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/brands/ecovacs-logo.jpg', '2026-03-05T08:30:00+07'::timestamptz, '2026-03-05T08:30:00+07'::timestamptz)
) as seeded(name, description, logo_url, created_at, updated_at)
on conflict (name) do update
set
  description = excluded.description,
  logo_url = excluded.logo_url,
  updated_at = excluded.updated_at;

insert into public.categories (parent_id, name, slug, description, image_url, is_active, created_at, updated_at)
select null, seeded.name, seeded.slug, seeded.description, seeded.image_url, true, seeded.created_at, seeded.updated_at
from (values
  ('Điện tử', 'electronics', 'Điện thoại, âm thanh và phụ kiện cho nhu cầu số hằng ngày.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/electronics.jpg', '2026-03-06T09:00:00+07'::timestamptz, '2026-03-06T09:00:00+07'::timestamptz),
  ('Nhà cửa & đời sống', 'home-living', 'Thiết bị thông minh và đồ dùng tiện ích cho gia đình hiện đại.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/home-living.jpg', '2026-03-06T09:05:00+07'::timestamptz, '2026-03-06T09:05:00+07'::timestamptz)
) as seeded(name, slug, description, image_url, created_at, updated_at)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;

insert into public.categories (parent_id, name, slug, description, image_url, is_active, created_at, updated_at)
select parent.id, seeded.name, seeded.slug, seeded.description, seeded.image_url, true, seeded.created_at, seeded.updated_at
from (values
  ('electronics', 'Điện thoại', 'smartphones', 'Điện thoại phổ thông và flagship cho luồng mua hàng demo.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/smartphones.jpg', '2026-03-06T09:10:00+07'::timestamptz, '2026-03-06T09:10:00+07'::timestamptz),
  ('electronics', 'Âm thanh', 'audio', 'Tai nghe, loa di động và thiết bị âm thanh không dây.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/audio.jpg', '2026-03-06T09:12:00+07'::timestamptz, '2026-03-06T09:12:00+07'::timestamptz),
  ('electronics', 'Phụ kiện', 'accessories', 'Cáp sạc, củ sạc và phụ kiện thiết thực cho thiết bị di động.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/accessories.jpg', '2026-03-06T09:14:00+07'::timestamptz, '2026-03-06T09:14:00+07'::timestamptz),
  ('home-living', 'Nhà thông minh', 'smart-home', 'Robot và thiết bị thông minh cho sinh hoạt hằng ngày.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/smart-home.jpg', '2026-03-06T09:16:00+07'::timestamptz, '2026-03-06T09:16:00+07'::timestamptz),
  ('home-living', 'Góc làm việc', 'desk-setup', 'Thiết bị hỗ trợ làm việc tại nhà gọn gàng và hiệu quả.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/categories/desk-setup.jpg', '2026-03-06T09:18:00+07'::timestamptz, '2026-03-06T09:18:00+07'::timestamptz)
) as seeded(parent_slug, name, slug, description, image_url, created_at, updated_at)
join public.categories parent on parent.slug = seeded.parent_slug
on conflict (slug) do update
set
  parent_id = excluded.parent_id,
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;
insert into public.products (
  category_id,
  brand_id,
  seller_id,
  product_type,
  sku,
  name,
  slug,
  short_description,
  description,
  thumbnail_url,
  base_price,
  active,
  published,
  published_at,
  rating_avg,
  review_count,
  created_at,
  updated_at
)
select
  c.id,
  b.id,
  u.id,
  'simple',
  seeded.sku,
  seeded.name,
  seeded.slug,
  seeded.short_description,
  seeded.description,
  seeded.thumbnail_url,
  seeded.base_price,
  true,
  true,
  seeded.published_at,
  0,
  0,
  seeded.created_at,
  seeded.updated_at
from (values
  ('smartphones', 'Apple', 'seller.tech@ecommerce.local', 'IP15-128-BLK', 'iPhone 15 128GB', 'iphone-15-128gb-black', 'iPhone cân bằng cho nhu cầu chụp ảnh và sử dụng hằng ngày.', 'Apple iPhone 15 bộ nhớ 128GB, pin ổn định, camera kép đáng tin cậy và phù hợp với người dùng cần một chiếc máy cao cấp gọn nhẹ.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/iphone-15-thumbnail.jpg', 18990000.00, '2026-03-20T09:00:00+07'::timestamptz, '2026-03-18T09:00:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('smartphones', 'Samsung', 'seller.tech@ecommerce.local', 'SGS24-256-GRY', 'Samsung Galaxy S24 256GB', 'samsung-galaxy-s24-256gb-gray', 'Máy Android nhỏ gọn, màn hình đẹp và camera mạnh.', 'Samsung Galaxy S24 256GB màu xám graphite, phù hợp với người dùng muốn hiệu năng cao, màn hình đẹp và trải nghiệm Android ổn định.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-s24-thumbnail.jpg', 15990000.00, '2026-03-21T09:00:00+07'::timestamptz, '2026-03-19T09:00:00+07'::timestamptz, '2026-04-10T09:00:00+07'::timestamptz),
  ('smartphones', 'Xiaomi', 'seller.tech@ecommerce.local', 'RDN13-256-BLK', 'Redmi Note 13 8GB 256GB', 'redmi-note-13-8gb-256gb-black', 'Điện thoại phổ thông có bộ nhớ lớn và pin tốt.', 'Redmi Note 13 với RAM 8GB, bộ nhớ 256GB, màn hình OLED và mức giá dễ tiếp cận cho người dùng phổ thông.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/redmi-note-13-thumbnail.jpg', 4990000.00, '2026-03-22T09:00:00+07'::timestamptz, '2026-03-20T09:00:00+07'::timestamptz, '2026-04-11T10:00:00+07'::timestamptz),
  ('audio', 'Apple', 'seller.tech@ecommerce.local', 'APP2-USBC', 'AirPods Pro 2 USB-C', 'airpods-pro-2-usbc', 'Tai nghe chống ồn cao cấp cho hệ sinh thái Apple.', 'AirPods Pro 2 hộp sạc USB-C, chống ồn chủ động, xuyên âm tự nhiên và kết nối nhanh với iPhone, iPad, MacBook.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/airpods-pro-2-thumbnail.jpg', 5790000.00, '2026-03-23T09:00:00+07'::timestamptz, '2026-03-21T09:00:00+07'::timestamptz, '2026-04-05T14:00:00+07'::timestamptz),
  ('desk-setup', 'Logitech', 'seller.tech@ecommerce.local', 'MXM3S-GRAPH', 'Logitech MX Master 3S', 'logitech-mx-master-3s-graphite', 'Chuột văn phòng cao cấp cho làm việc nhiều giờ.', 'Logitech MX Master 3S màu graphite, click êm, dáng cầm công thái học và cuộn nhanh cho dân văn phòng, designer, developer.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/mx-master-3s-thumbnail.jpg', 2390000.00, '2026-03-24T09:00:00+07'::timestamptz, '2026-03-22T09:00:00+07'::timestamptz, '2026-04-08T11:00:00+07'::timestamptz),
  ('accessories', 'Anker', 'seller.tech@ecommerce.local', 'ANK65-GAN', 'Củ sạc Anker Prime 65W GaN', 'anker-prime-65w-gan-charger', 'Củ sạc nhanh nhỏ gọn cho điện thoại, tablet và laptop.', 'Củ sạc Anker Prime 65W GaN với hai cổng USB-C, phù hợp cho người thường xuyên di chuyển và muốn dùng một củ sạc cho nhiều thiết bị.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/anker-65w-thumbnail.jpg', 890000.00, '2026-03-25T09:00:00+07'::timestamptz, '2026-03-23T09:00:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('audio', 'JBL', 'seller.home@ecommerce.local', 'JBLFLIP6-BLK', 'Loa Bluetooth JBL Flip 6', 'jbl-flip-6-black', 'Loa di động chống nước cho nghe nhạc hằng ngày.', 'JBL Flip 6 có chuẩn chống nước IP67, âm thanh mạnh mẽ và pin đủ dùng cho phòng làm việc, dã ngoại hoặc cuối tuần.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/jbl-flip-6-thumbnail.jpg', 2690000.00, '2026-03-26T09:00:00+07'::timestamptz, '2026-03-24T09:00:00+07'::timestamptz, '2026-04-12T11:30:00+07'::timestamptz),
  ('smart-home', 'Ecovacs', 'seller.home@ecommerce.local', 'ECO-N8', 'Robot hút bụi Ecovacs Deebot N8', 'ecovacs-deebot-n8', 'Robot hút bụi lau nhà phù hợp căn hộ và nhà phố.', 'Ecovacs Deebot N8 hỗ trợ lập bản đồ, hút bụi và lau nhà, phù hợp cho gia đình bận rộn cần tự động hóa việc vệ sinh.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/ecovacs-n8-thumbnail.jpg', 5990000.00, '2026-03-27T09:00:00+07'::timestamptz, '2026-03-25T09:00:00+07'::timestamptz, '2026-04-10T09:30:00+07'::timestamptz),
  ('smart-home', 'Xiaomi', 'seller.home@ecommerce.local', 'XM-AIRFRY45', 'Nồi chiên không dầu Xiaomi Smart Air Fryer 4.5L', 'xiaomi-smart-air-fryer-45l', 'Nồi chiên thông minh cho bữa ăn nhanh và ít dầu hơn.', 'Xiaomi Smart Air Fryer 4.5L hỗ trợ hẹn giờ qua app, dung tích vừa đủ cho gia đình nhỏ và các món ăn hằng ngày.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/air-fryer-thumbnail.jpg', 1790000.00, '2026-03-28T09:00:00+07'::timestamptz, '2026-03-26T09:00:00+07'::timestamptz, '2026-04-12T11:30:00+07'::timestamptz),
  ('accessories', 'Samsung', 'seller.tech@ecommerce.local', 'SS25W-USBC', 'Củ sạc Samsung USB-C 25W', 'samsung-25w-usb-c-charger', 'Củ sạc nhanh cơ bản cho điện thoại Galaxy.', 'Củ sạc Samsung 25W USB-C nhỏ gọn, phù hợp cho người dùng Galaxy cần một bộ sạc chính hãng với chi phí hợp lý.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-25w-thumbnail.jpg', 390000.00, '2026-03-29T09:00:00+07'::timestamptz, '2026-03-27T09:00:00+07'::timestamptz, '2026-04-09T08:00:00+07'::timestamptz),
  ('accessories', 'Anker', 'seller.tech@ecommerce.local', 'QRTEST-CABLE-10K', 'Cáp test QR 10K', 'qr-test-cable-10k', 'Sản phẩm giá thấp để kiểm thử thanh toán QR.', 'Cáp test QR 10K dùng cho luồng kiểm thử đặt hàng và thanh toán QR với giá sản phẩm 10.000đ.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/anker-65w-thumbnail.jpg', 10000.00, '2026-04-15T09:00:00+07'::timestamptz, '2026-04-15T09:00:00+07'::timestamptz, '2026-04-15T09:00:00+07'::timestamptz),
  ('accessories', 'Samsung', 'seller.tech@ecommerce.local', 'QRTEST-STICKER-10K', 'Miếng dán test QR 10K', 'qr-test-sticker-10k', 'Sản phẩm phụ kiện 10.000đ để kiểm thử thanh toán QR.', 'Miếng dán test QR 10K dùng để tạo đơn hàng giá thấp khi kiểm thử QR payment trên mobile app.', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-25w-thumbnail.jpg', 10000.00, '2026-04-15T09:05:00+07'::timestamptz, '2026-04-15T09:05:00+07'::timestamptz, '2026-04-15T09:05:00+07'::timestamptz)
) as seeded(category_slug, brand_name, seller_email, sku, name, slug, short_description, description, thumbnail_url, base_price, published_at, created_at, updated_at)
join public.categories c on c.slug = seeded.category_slug
join public.brands b on b.name = seeded.brand_name
join public.users u on u.email = seeded.seller_email
on conflict (slug) do update
set
  category_id = excluded.category_id,
  brand_id = excluded.brand_id,
  seller_id = excluded.seller_id,
  sku = excluded.sku,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  thumbnail_url = excluded.thumbnail_url,
  base_price = excluded.base_price,
  active = excluded.active,
  published = excluded.published,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;

insert into public.product_images (product_id, image_url, is_main, sort_order, created_at)
select p.id, seeded.image_url, seeded.is_main, seeded.sort_order, seeded.created_at
from (values
  ('iphone-15-128gb-black', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/iphone-15-front.jpg', true, 1, '2026-03-18T09:05:00+07'::timestamptz),
  ('iphone-15-128gb-black', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/iphone-15-back.jpg', false, 2, '2026-03-18T09:06:00+07'::timestamptz),
  ('samsung-galaxy-s24-256gb-gray', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-s24-front.jpg', true, 1, '2026-03-19T09:05:00+07'::timestamptz),
  ('samsung-galaxy-s24-256gb-gray', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-s24-lifestyle.jpg', false, 2, '2026-03-19T09:06:00+07'::timestamptz),
  ('redmi-note-13-8gb-256gb-black', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/redmi-note-13-front.jpg', true, 1, '2026-03-20T09:05:00+07'::timestamptz),
  ('airpods-pro-2-usbc', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/airpods-pro-2-case.jpg', true, 1, '2026-03-21T09:05:00+07'::timestamptz),
  ('logitech-mx-master-3s-graphite', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/mx-master-3s-top.jpg', true, 1, '2026-03-22T09:05:00+07'::timestamptz),
  ('anker-prime-65w-gan-charger', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/anker-65w-main.jpg', true, 1, '2026-03-23T09:05:00+07'::timestamptz),
  ('jbl-flip-6-black', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/jbl-flip-6-front.jpg', true, 1, '2026-03-24T09:05:00+07'::timestamptz),
  ('jbl-flip-6-black', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/jbl-flip-6-outdoor.jpg', false, 2, '2026-03-24T09:06:00+07'::timestamptz),
  ('ecovacs-deebot-n8', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/ecovacs-n8-main.jpg', true, 1, '2026-03-25T09:05:00+07'::timestamptz),
  ('xiaomi-smart-air-fryer-45l', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/air-fryer-main.jpg', true, 1, '2026-03-26T09:05:00+07'::timestamptz),
  ('samsung-25w-usb-c-charger', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-25w-main.jpg', true, 1, '2026-03-27T09:05:00+07'::timestamptz),
  ('qr-test-cable-10k', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/anker-65w-main.jpg', true, 1, '2026-04-15T09:10:00+07'::timestamptz),
  ('qr-test-sticker-10k', 'https://d35ci4s1xmcpe.cloudfront.net/products/seed/products/samsung-25w-main.jpg', true, 1, '2026-04-15T09:12:00+07'::timestamptz)
) as seeded(slug, image_url, is_main, sort_order, created_at)
join public.products p on p.slug = seeded.slug
where not exists (
  select 1
  from public.product_images pi
  where pi.product_id = p.id
    and pi.image_url = seeded.image_url
);

insert into public.inventory_items (
  product_id,
  variant_id,
  available_qty,
  reserved_qty,
  safety_stock,
  created_at,
  updated_at
)
select p.id, null, seeded.available_qty, seeded.reserved_qty, seeded.safety_stock, seeded.created_at, seeded.updated_at
from (values
  ('iphone-15-128gb-black', 11, 0, 1, '2026-03-18T09:10:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('samsung-galaxy-s24-256gb-gray', 8, 0, 1, '2026-03-19T09:10:00+07'::timestamptz, '2026-04-10T09:00:00+07'::timestamptz),
  ('redmi-note-13-8gb-256gb-black', 18, 0, 2, '2026-03-20T09:10:00+07'::timestamptz, '2026-04-11T10:30:00+07'::timestamptz),
  ('airpods-pro-2-usbc', 14, 0, 2, '2026-03-21T09:10:00+07'::timestamptz, '2026-04-05T14:15:00+07'::timestamptz),
  ('logitech-mx-master-3s-graphite', 20, 0, 2, '2026-03-22T09:10:00+07'::timestamptz, '2026-04-08T11:00:00+07'::timestamptz),
  ('anker-prime-65w-gan-charger', 29, 0, 5, '2026-03-23T09:10:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('jbl-flip-6-black', 23, 1, 2, '2026-03-24T09:10:00+07'::timestamptz, '2026-04-12T16:00:00+07'::timestamptz),
  ('ecovacs-deebot-n8', 9, 1, 1, '2026-03-25T09:10:00+07'::timestamptz, '2026-04-10T15:00:00+07'::timestamptz),
  ('xiaomi-smart-air-fryer-45l', 15, 0, 1, '2026-03-26T09:10:00+07'::timestamptz, '2026-04-13T10:00:00+07'::timestamptz),
  ('samsung-25w-usb-c-charger', 40, 0, 5, '2026-03-27T09:10:00+07'::timestamptz, '2026-04-09T08:00:00+07'::timestamptz),
  ('qr-test-cable-10k', 50, 0, 5, '2026-04-15T09:15:00+07'::timestamptz, '2026-04-15T09:15:00+07'::timestamptz),
  ('qr-test-sticker-10k', 50, 0, 5, '2026-04-15T09:16:00+07'::timestamptz, '2026-04-15T09:16:00+07'::timestamptz)
) as seeded(slug, available_qty, reserved_qty, safety_stock, created_at, updated_at)
join public.products p on p.slug = seeded.slug
where not exists (
  select 1 from public.inventory_items ii where ii.product_id = p.id and ii.variant_id is null
);

insert into public.coupons (
  code,
  description,
  discount_type,
  discount_value,
  min_order_value,
  max_discount,
  start_at,
  end_at,
  usage_limit,
  used_count,
  active,
  created_at,
  updated_at
)
values
  ('WELCOME10', 'Giảm 10% cho đơn hàng đầu tiên, tối đa 500.000đ.', 'percent', 10.00, 1000000.00, 500000.00, '2026-03-25T00:00:00+07', '2026-05-31T23:59:59+07', 500, 0, true, '2026-03-25T00:00:00+07', '2026-03-25T00:00:00+07'),
  ('FREESHIP50', 'Giảm 50.000đ, tương đương miễn phí giao hàng tiêu chuẩn.', 'fixed', 50000.00, 500000.00, 50000.00, '2026-04-01T00:00:00+07', '2026-05-15T23:59:59+07', 300, 0, true, '2026-04-01T00:00:00+07', '2026-04-01T00:00:00+07'),
  ('TECH15', 'Giảm 15% cho giỏ hàng công nghệ, tối đa 1.500.000đ.', 'percent', 15.00, 3000000.00, 1500000.00, '2026-04-01T00:00:00+07', '2026-04-30T23:59:59+07', 150, 0, true, '2026-04-01T00:00:00+07', '2026-04-01T00:00:00+07'),
  ('NEWBUY5', 'Giảm 50.000đ cho khách hàng mới.', 'fixed', 50000.00, 300000.00, null, '2026-03-20T00:00:00+07', '2026-06-30T23:59:59+07', 1000, 0, true, '2026-03-20T00:00:00+07', '2026-03-20T00:00:00+07')
on conflict (code) do update
set
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  min_order_value = excluded.min_order_value,
  max_discount = excluded.max_discount,
  start_at = excluded.start_at,
  end_at = excluded.end_at,
  usage_limit = excluded.usage_limit,
  active = excluded.active,
  updated_at = excluded.updated_at;

update public.shipping_methods
set name = 'Giao hàng tiêu chuẩn',
    description = 'Giao hàng toàn quốc, phù hợp cho đơn demo trong luồng checkout.',
    estimated_min_days = 2,
    estimated_max_days = 4,
    fee = 30000.00,
    updated_at = '2026-03-25T08:00:00+07'::timestamptz
where name = 'Standard Delivery';

update public.shipping_methods
set name = 'Giao hàng nhanh',
    description = 'Tùy chọn giao nhanh cho đơn cần nhận sớm.',
    estimated_min_days = 1,
    estimated_max_days = 2,
    fee = 60000.00,
    updated_at = '2026-03-25T08:05:00+07'::timestamptz
where name = 'Express Delivery';

update public.shipping_methods
set name = 'Nhận tại điểm lấy hàng',
    description = 'Nhận hàng tại điểm đối tác ở các thành phố lớn.',
    estimated_min_days = 0,
    estimated_max_days = 1,
    fee = 0.00,
    updated_at = '2026-03-25T08:10:00+07'::timestamptz
where name = 'Store Pickup';

insert into public.shipping_methods (
  name,
  description,
  estimated_min_days,
  estimated_max_days,
  fee,
  active,
  created_at,
  updated_at
)
select seeded.name, seeded.description, seeded.estimated_min_days, seeded.estimated_max_days, seeded.fee, true, seeded.created_at, seeded.updated_at
from (values
  ('Giao hàng tiêu chuẩn', 'Giao hàng toàn quốc, phù hợp cho đơn demo trong luồng checkout.', 2, 4, 30000.00, '2026-03-25T08:00:00+07'::timestamptz, '2026-03-25T08:00:00+07'::timestamptz),
  ('Giao hàng nhanh', 'Tùy chọn giao nhanh cho đơn cần nhận sớm.', 1, 2, 60000.00, '2026-03-25T08:05:00+07'::timestamptz, '2026-03-25T08:05:00+07'::timestamptz),
  ('Nhận tại điểm lấy hàng', 'Nhận hàng tại điểm đối tác ở các thành phố lớn.', 0, 1, 0.00, '2026-03-25T08:10:00+07'::timestamptz, '2026-03-25T08:10:00+07'::timestamptz)
) as seeded(name, description, estimated_min_days, estimated_max_days, fee, created_at, updated_at)
where not exists (
  select 1 from public.shipping_methods sm where sm.name = seeded.name
);

delete from public.shipping_methods duplicate
using public.shipping_methods keep
where duplicate.name = keep.name
  and duplicate.id > keep.id
  and duplicate.name in ('Giao hàng tiêu chuẩn', 'Giao hàng nhanh', 'Nhận tại điểm lấy hàng');

commit;

begin;
delete from public.reviews
where order_item_id in (
  select oi.id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.payment_transactions
where payment_id in (
  select p.id
  from public.payments p
  join public.orders o on o.id = p.order_id
  where o.order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.coupon_usages
where order_id in (
  select id from public.orders
  where order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.inventory_movements
where reference_type = 'ORDER'
  and reference_id in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  );

delete from public.inventory_reservations
where order_id in (
  select id from public.orders
  where order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.order_status_histories
where order_id in (
  select id from public.orders
  where order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.shipments
where order_id in (
  select id from public.orders
  where order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.payments
where order_id in (
  select id from public.orders
  where order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

delete from public.order_items
where order_id in (
  select id from public.orders
  where order_no in (
    'ORD-202604010001', 'ORD-202604050001', 'ORD-202604090001',
    'ORD-202604100001', 'ORD-202604110001', 'ORD-202604120001'
  )
);

insert into public.orders (
  order_no, cart_id, user_id, coupon_id, coupon_code, shipping_method_id, shipping_method_name,
  order_status, payment_status, fulfillment_status, receiver_name, receiver_phone,
  shipping_address_line, shipping_ward, shipping_district, shipping_city, shipping_province,
  shipping_postal_code, shipping_country, note, payment_method_code, subtotal, shipping_fee,
  tax_amount, discount_amount, grand_total, placed_at, paid_at, cancelled_at, delivered_at,
  created_at, updated_at
)
select
  seeded.order_no, null, u.id, cpn.id, seeded.coupon_code, sm.id, seeded.shipping_method_name,
  seeded.order_status, seeded.payment_status, seeded.fulfillment_status, seeded.receiver_name,
  seeded.receiver_phone, seeded.shipping_address_line, seeded.shipping_ward,
  seeded.shipping_district, seeded.shipping_city, seeded.shipping_province,
  seeded.shipping_postal_code, seeded.shipping_country, seeded.note, seeded.payment_method_code,
  seeded.subtotal, seeded.shipping_fee, seeded.tax_amount, seeded.discount_amount,
  seeded.grand_total, seeded.placed_at, seeded.paid_at, seeded.cancelled_at,
  seeded.delivered_at, seeded.created_at, seeded.updated_at
from (values
  ('ORD-202604010001', 'chau.customer@ecommerce.local', 'WELCOME10', 'Giao hàng tiêu chuẩn', 'delivered', 'paid', 'delivered', 'Nguyễn Minh Châu', '+84903777011', '45 Nguyễn Hữu Cảnh, Landmark 81', 'Phường 22', 'Bình Thạnh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', '700000', 'Việt Nam', 'Nếu được, vui lòng giao trước 18:00.', 'COD', 19880000.00, 30000.00, 1988000.00, 500000.00, 21398000.00, '2026-04-01T09:15:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz, null::timestamptz, '2026-04-04T15:30:00+07'::timestamptz, '2026-04-01T09:15:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'chau.customer@ecommerce.local', null, 'Giao hàng tiêu chuẩn', 'shipping', 'paid', 'shipping', 'Nguyễn Minh Châu', '+84903777011', '12 Lê Lợi, Bến Nghé', 'Bến Nghé', 'Quận 1', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', '700000', 'Việt Nam', 'Lễ tân văn phòng có thể nhận hàng trong giờ hành chính.', 'VNPAY', 5790000.00, 30000.00, 579000.00, 0.00, 6399000.00, '2026-04-05T10:20:00+07'::timestamptz, '2026-04-05T10:21:00+07'::timestamptz, null::timestamptz, null::timestamptz, '2026-04-05T10:20:00+07'::timestamptz, '2026-04-06T14:00:00+07'::timestamptz),
  ('ORD-202604090001', 'khang.customer@ecommerce.local', null, 'Giao hàng tiêu chuẩn', 'pending', 'unpaid', 'pending', 'Trần Minh Khang', '+84903888022', '88 Trần Phú', 'Hải Châu 1', 'Hải Châu', 'Đà Nẵng', 'Đà Nẵng', '550000', 'Việt Nam', 'Vui lòng gọi trước khi giao.', 'COD', 2690000.00, 30000.00, 269000.00, 0.00, 2989000.00, '2026-04-09T19:40:00+07'::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, '2026-04-09T19:40:00+07'::timestamptz, '2026-04-09T19:40:00+07'::timestamptz),
  ('ORD-202604100001', 'khang.customer@ecommerce.local', null, 'Giao hàng tiêu chuẩn', 'confirmed', 'pending', 'packed', 'Trần Minh Khang', '+84903888022', '88 Trần Phú', 'Hải Châu 1', 'Hải Châu', 'Đà Nẵng', 'Đà Nẵng', '550000', 'Việt Nam', 'Khách yêu cầu đóng gói kỹ cho robot hút bụi.', 'BANK_TRANSFER', 5990000.00, 30000.00, 599000.00, 0.00, 6619000.00, '2026-04-10T14:05:00+07'::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, '2026-04-10T14:05:00+07'::timestamptz, '2026-04-10T15:00:00+07'::timestamptz),
  ('ORD-202604110001', 'mai.customer@ecommerce.local', null, 'Giao hàng tiêu chuẩn', 'cancelled', 'failed', 'cancelled', 'Lê Thu Mai', '+84903999033', '27 Hoàng Cầu', 'Ô Chợ Dừa', 'Đống Đa', 'Hà Nội', 'Hà Nội', '100000', 'Việt Nam', 'Đơn bị hủy do khách thay đổi nhu cầu mua hàng.', 'COD', 4990000.00, 30000.00, 499000.00, 0.00, 5519000.00, '2026-04-11T11:30:00+07'::timestamptz, null::timestamptz, '2026-04-11T12:10:00+07'::timestamptz, null::timestamptz, '2026-04-11T11:30:00+07'::timestamptz, '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'khang.customer@ecommerce.local', 'FREESHIP50', 'Giao hàng tiêu chuẩn', 'delivered', 'paid', 'delivered', 'Trần Minh Khang', '+84903888022', '88 Trần Phú', 'Hải Châu 1', 'Hải Châu', 'Đà Nẵng', 'Đà Nẵng', '550000', 'Việt Nam', 'Nhờ giao trực tiếp cho người nhà.', 'MOMO', 4480000.00, 30000.00, 448000.00, 50000.00, 4908000.00, '2026-04-12T08:45:00+07'::timestamptz, '2026-04-12T08:46:00+07'::timestamptz, null::timestamptz, '2026-04-13T11:15:00+07'::timestamptz, '2026-04-12T08:45:00+07'::timestamptz, '2026-04-13T11:15:00+07'::timestamptz)
) as seeded(order_no, user_email, coupon_code, shipping_method_name, order_status, payment_status, fulfillment_status, receiver_name, receiver_phone, shipping_address_line, shipping_ward, shipping_district, shipping_city, shipping_province, shipping_postal_code, shipping_country, note, payment_method_code, subtotal, shipping_fee, tax_amount, discount_amount, grand_total, placed_at, paid_at, cancelled_at, delivered_at, created_at, updated_at)
join public.users u on u.email = seeded.user_email
join public.shipping_methods sm on sm.name = seeded.shipping_method_name
left join public.coupons cpn on cpn.code = seeded.coupon_code
on conflict (order_no) do update
set
  user_id = excluded.user_id,
  coupon_id = excluded.coupon_id,
  coupon_code = excluded.coupon_code,
  shipping_method_id = excluded.shipping_method_id,
  shipping_method_name = excluded.shipping_method_name,
  order_status = excluded.order_status,
  payment_status = excluded.payment_status,
  fulfillment_status = excluded.fulfillment_status,
  receiver_name = excluded.receiver_name,
  receiver_phone = excluded.receiver_phone,
  shipping_address_line = excluded.shipping_address_line,
  shipping_ward = excluded.shipping_ward,
  shipping_district = excluded.shipping_district,
  shipping_city = excluded.shipping_city,
  shipping_province = excluded.shipping_province,
  shipping_postal_code = excluded.shipping_postal_code,
  shipping_country = excluded.shipping_country,
  note = excluded.note,
  payment_method_code = excluded.payment_method_code,
  subtotal = excluded.subtotal,
  shipping_fee = excluded.shipping_fee,
  tax_amount = excluded.tax_amount,
  discount_amount = excluded.discount_amount,
  grand_total = excluded.grand_total,
  placed_at = excluded.placed_at,
  paid_at = excluded.paid_at,
  cancelled_at = excluded.cancelled_at,
  delivered_at = excluded.delivered_at,
  updated_at = excluded.updated_at;

insert into public.order_items (
  order_id, product_id, variant_id, product_name, variant_name, sku,
  thumbnail_url, unit_price, quantity, line_total, created_at
)
select
  o.id, p.id, null, p.name, null, p.sku, p.thumbnail_url,
  seeded.unit_price, seeded.quantity, seeded.line_total, seeded.created_at
from (values
  ('ORD-202604010001', 'iphone-15-128gb-black', 18990000.00, 1, 18990000.00, '2026-04-01T09:16:00+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 890000.00, 1, 890000.00, '2026-04-01T09:16:30+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 5790000.00, 1, 5790000.00, '2026-04-05T10:20:30+07'::timestamptz),
  ('ORD-202604090001', 'jbl-flip-6-black', 2690000.00, 1, 2690000.00, '2026-04-09T19:40:30+07'::timestamptz),
  ('ORD-202604100001', 'ecovacs-deebot-n8', 5990000.00, 1, 5990000.00, '2026-04-10T14:05:30+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 4990000.00, 1, 4990000.00, '2026-04-11T11:30:30+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 2690000.00, 1, 2690000.00, '2026-04-12T08:45:30+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 1790000.00, 1, 1790000.00, '2026-04-12T08:45:45+07'::timestamptz)
) as seeded(order_no, product_slug, unit_price, quantity, line_total, created_at)
join public.orders o on o.order_no = seeded.order_no
join public.products p on p.slug = seeded.product_slug;

insert into public.inventory_reservations (
  order_id, product_id, variant_id, quantity, status, expires_at, created_at
)
select
  o.id, p.id, null, seeded.quantity, seeded.status, seeded.expires_at, seeded.created_at
from (values
  ('ORD-202604010001', 'iphone-15-128gb-black', 1, 'confirmed', null::timestamptz, '2026-04-01T09:17:00+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 1, 'confirmed', null::timestamptz, '2026-04-01T09:17:10+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 1, 'confirmed', null::timestamptz, '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604090001', 'jbl-flip-6-black', 1, 'reserved', '2026-04-11T19:40:00+07'::timestamptz, '2026-04-09T19:41:00+07'::timestamptz),
  ('ORD-202604100001', 'ecovacs-deebot-n8', 1, 'confirmed', null::timestamptz, '2026-04-10T14:06:00+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 1, 'released', null::timestamptz, '2026-04-11T11:31:00+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 1, 'confirmed', null::timestamptz, '2026-04-12T08:46:00+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 1, 'confirmed', null::timestamptz, '2026-04-12T08:46:10+07'::timestamptz)
) as seeded(order_no, product_slug, quantity, status, expires_at, created_at)
join public.orders o on o.order_no = seeded.order_no
join public.products p on p.slug = seeded.product_slug;

insert into public.inventory_movements (
  product_id, variant_id, movement_type, quantity, reference_type, reference_id, note, created_at
)
select
  p.id, null, seeded.movement_type, seeded.quantity, 'ORDER', seeded.order_no, seeded.note, seeded.created_at
from (values
  ('ORD-202604010001', 'iphone-15-128gb-black', 'reserve', 1, 'Giữ hàng cho đơn COD đã sẵn sàng xử lý.', '2026-04-01T09:17:00+07'::timestamptz),
  ('ORD-202604010001', 'iphone-15-128gb-black', 'out', 1, 'Xuất kho sau khi giao hàng thành công.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 'reserve', 1, 'Giữ hàng cho đơn COD đã sẵn sàng xử lý.', '2026-04-01T09:17:10+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 'out', 1, 'Xuất kho sau khi giao hàng thành công.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 'reserve', 1, 'Giữ hàng sau khi VNPAY xác nhận thanh toán.', '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 'out', 1, 'Đơn hàng đã bàn giao cho đơn vị vận chuyển.', '2026-04-06T09:00:00+07'::timestamptz),
  ('ORD-202604090001', 'jbl-flip-6-black', 'reserve', 1, 'Giữ hàng trong lúc chờ xác nhận đơn COD.', '2026-04-09T19:41:00+07'::timestamptz),
  ('ORD-202604100001', 'ecovacs-deebot-n8', 'reserve', 1, 'Giữ hàng sau khi người bán xác nhận đơn.', '2026-04-10T14:06:00+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 'reserve', 1, 'Giữ hàng khi tạo đơn từ checkout.', '2026-04-11T11:31:00+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 'release', 1, 'Hoàn lại tồn kho sau khi khách hủy đơn.', '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 'reserve', 1, 'Giữ hàng sau khi MoMo xác nhận thanh toán.', '2026-04-12T08:46:00+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 'out', 1, 'Đã giao cho khách hàng.', '2026-04-13T11:15:00+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 'reserve', 1, 'Giữ hàng sau khi MoMo xác nhận thanh toán.', '2026-04-12T08:46:10+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 'out', 1, 'Đã giao cho khách hàng.', '2026-04-13T11:15:00+07'::timestamptz)
) as seeded(order_no, product_slug, movement_type, quantity, note, created_at)
join public.products p on p.slug = seeded.product_slug;

insert into public.payments (
  order_id, attempt_no, provider, method, status, amount, currency,
  provider_transaction_id, gateway_response_code, gateway_message,
  paid_at, failed_at, created_at, updated_at
)
select
  o.id, 1, seeded.provider, seeded.method, seeded.status, seeded.amount, seeded.currency,
  seeded.provider_transaction_id, seeded.gateway_response_code, seeded.gateway_message,
  seeded.paid_at, seeded.failed_at, seeded.created_at, seeded.updated_at
from (values
  ('ORD-202604010001', 'COD', 'COD', 'paid', 21398000.00, 'VND', 'cash-202604010001', '00', 'Đã thu tiền khi giao hàng.', '2026-04-04T15:30:00+07'::timestamptz, null::timestamptz, '2026-04-01T09:15:30+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'VNPAY', 'VNPAY', 'paid', 6399000.00, 'VND', 'vnp-202604050001', '00', 'Cổng thanh toán đã ghi nhận giao dịch thành công.', '2026-04-05T10:21:00+07'::timestamptz, null::timestamptz, '2026-04-05T10:20:30+07'::timestamptz, '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604090001', 'COD', 'COD', 'pending', 2989000.00, 'VND', 'cod-202604090001', null, 'Đang chờ thu tiền khi giao hàng.', null::timestamptz, null::timestamptz, '2026-04-09T19:40:30+07'::timestamptz, '2026-04-09T19:40:30+07'::timestamptz),
  ('ORD-202604100001', 'BANK_TRANSFER', 'BANK_TRANSFER', 'pending', 6619000.00, 'VND', 'bank-202604100001', null, 'Đang chờ xác nhận chuyển khoản.', null::timestamptz, null::timestamptz, '2026-04-10T14:05:30+07'::timestamptz, '2026-04-10T14:05:30+07'::timestamptz),
  ('ORD-202604110001', 'COD', 'COD', 'failed', 5519000.00, 'VND', 'cod-202604110001', 'USER_CANCELLED', 'Khách hàng hủy đơn trước khi bàn giao.', null::timestamptz, '2026-04-11T12:10:00+07'::timestamptz, '2026-04-11T11:30:30+07'::timestamptz, '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'MOMO', 'MOMO', 'paid', 4908000.00, 'VND', 'momo-202604120001', '00', 'Ví điện tử đã xác nhận thanh toán.', '2026-04-12T08:46:00+07'::timestamptz, null::timestamptz, '2026-04-12T08:45:30+07'::timestamptz, '2026-04-12T08:46:00+07'::timestamptz)
) as seeded(order_no, provider, method, status, amount, currency, provider_transaction_id, gateway_response_code, gateway_message, paid_at, failed_at, created_at, updated_at)
join public.orders o on o.order_no = seeded.order_no;

insert into public.payment_transactions (
  payment_id, provider_transaction_id, transaction_type, transaction_status, status, amount, currency, external_ref, received_at, raw_payload, created_at
)
select
  p.id, seeded.external_ref, seeded.transaction_type, seeded.status, seeded.status, seeded.amount, seeded.currency, seeded.external_ref, seeded.created_at, seeded.raw_payload, seeded.created_at
from (values
  ('ORD-202604010001', 'capture', 'paid', 21398000.00, 'VND', 'cash-202604010001', '{"source":"cod","status":"paid","currency":"VND"}'::jsonb, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'capture', 'paid', 6399000.00, 'VND', 'vnp-202604050001', '{"gateway":"VNPAY","status":"paid","responseCode":"00","currency":"VND"}'::jsonb, '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604090001', 'authorize', 'pending', 2989000.00, 'VND', 'cod-202604090001', '{"source":"cod","status":"pending","currency":"VND"}'::jsonb, '2026-04-09T19:40:30+07'::timestamptz),
  ('ORD-202604100001', 'authorize', 'pending', 6619000.00, 'VND', 'bank-202604100001', '{"gateway":"BANK_TRANSFER","status":"pending","currency":"VND"}'::jsonb, '2026-04-10T14:05:30+07'::timestamptz),
  ('ORD-202604110001', 'webhook_update', 'failed', 5519000.00, 'VND', 'cod-202604110001', '{"source":"cod","status":"failed","reason":"customer_cancelled","currency":"VND"}'::jsonb, '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'capture', 'paid', 4908000.00, 'VND', 'momo-202604120001', '{"gateway":"MOMO","status":"paid","responseCode":"00","currency":"VND"}'::jsonb, '2026-04-12T08:46:00+07'::timestamptz)
) as seeded(order_no, transaction_type, status, amount, currency, external_ref, raw_payload, created_at)
join public.orders o on o.order_no = seeded.order_no
join public.payments p on p.order_id = o.id and p.attempt_no = 1;

insert into public.shipments (
  order_id, shipping_method_id, shipment_no, carrier, tracking_number,
  shipment_status, note, shipped_at, delivered_at, returned_at, created_at, updated_at
)
select
  o.id, sm.id, seeded.shipment_no, seeded.carrier, seeded.tracking_number,
  seeded.shipment_status, seeded.note, seeded.shipped_at, seeded.delivered_at,
  null, seeded.created_at, seeded.updated_at
from (values
  ('ORD-202604010001', 'Giao hàng tiêu chuẩn', 'SHP-202604010001', 'GHN', 'GHN940001245', 'delivered', 'Đã giao thành công tới địa chỉ khách hàng.', '2026-04-02T08:30:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz, '2026-04-02T08:30:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'Giao hàng tiêu chuẩn', 'SHP-202604050001', 'GHTK', 'GHTK770005515', 'in_transit', 'Bưu kiện đang được luân chuyển giữa các kho.', '2026-04-06T09:00:00+07'::timestamptz, null::timestamptz, '2026-04-06T09:00:00+07'::timestamptz, '2026-04-06T14:00:00+07'::timestamptz),
  ('ORD-202604100001', 'Giao hàng tiêu chuẩn', 'SHP-202604100001', 'AhaMove', 'AHM20260410001', 'ready_to_ship', 'Đã đóng gói và chờ đơn vị vận chuyển lấy hàng.', null::timestamptz, null::timestamptz, '2026-04-10T15:00:00+07'::timestamptz, '2026-04-10T15:00:00+07'::timestamptz),
  ('ORD-202604120001', 'Giao hàng tiêu chuẩn', 'SHP-202604120001', 'GHN', 'GHN940001620', 'delivered', 'Đã giao và được người nhà xác nhận nhận hàng.', '2026-04-12T13:20:00+07'::timestamptz, '2026-04-13T11:15:00+07'::timestamptz, '2026-04-12T13:20:00+07'::timestamptz, '2026-04-13T11:15:00+07'::timestamptz)
) as seeded(order_no, shipping_method_name, shipment_no, carrier, tracking_number, shipment_status, note, shipped_at, delivered_at, created_at, updated_at)
join public.orders o on o.order_no = seeded.order_no
join public.shipping_methods sm on sm.name = seeded.shipping_method_name
on conflict (shipment_no) do update
set
  order_id = excluded.order_id,
  shipping_method_id = excluded.shipping_method_id,
  carrier = excluded.carrier,
  tracking_number = excluded.tracking_number,
  shipment_status = excluded.shipment_status,
  note = excluded.note,
  shipped_at = excluded.shipped_at,
  delivered_at = excluded.delivered_at,
  updated_at = excluded.updated_at;

insert into public.order_status_histories (
  order_id, status_type, old_status, new_status, changed_by, note, changed_at
)
select
  o.id, seeded.status_type, seeded.old_status, seeded.new_status, changer.id, seeded.note, seeded.changed_at
from (values
  ('ORD-202604010001', 'order', 'pending', 'confirmed', 'seller.tech@ecommerce.local', 'Người bán đã kiểm tra tồn kho và xác nhận đơn.', '2026-04-01T10:05:00+07'::timestamptz),
  ('ORD-202604010001', 'fulfillment', 'pending', 'shipping', 'seller.tech@ecommerce.local', 'Đã bàn giao kiện hàng cho đơn vị vận chuyển.', '2026-04-02T08:30:00+07'::timestamptz),
  ('ORD-202604010001', 'payment', 'unpaid', 'paid', null, 'COD được ghi nhận đã thanh toán khi giao hàng.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604010001', 'order', 'shipping', 'delivered', 'seller.tech@ecommerce.local', 'Khách hàng đã nhận hàng.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'order', 'pending', 'confirmed', 'seller.tech@ecommerce.local', 'Người bán xác nhận thanh toán và tồn kho.', '2026-04-05T10:40:00+07'::timestamptz),
  ('ORD-202604050001', 'payment', 'pending', 'paid', null, 'VNPAY callback xác nhận giao dịch thành công.', '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604050001', 'fulfillment', 'pending', 'shipping', 'seller.tech@ecommerce.local', 'Kiện hàng đang được vận chuyển.', '2026-04-06T09:00:00+07'::timestamptz),
  ('ORD-202604090001', 'order', null, 'pending', 'khang.customer@ecommerce.local', 'Đơn hàng được tạo từ mobile checkout.', '2026-04-09T19:40:00+07'::timestamptz),
  ('ORD-202604100001', 'order', 'pending', 'confirmed', 'seller.home@ecommerce.local', 'Người bán đã xác nhận và bắt đầu đóng gói.', '2026-04-10T15:00:00+07'::timestamptz),
  ('ORD-202604100001', 'payment', 'unpaid', 'pending', null, 'Đang chờ xác nhận chuyển khoản ngân hàng.', '2026-04-10T14:10:00+07'::timestamptz),
  ('ORD-202604110001', 'order', 'pending', 'cancelled', 'mai.customer@ecommerce.local', 'Khách hàng hủy đơn trước khi giao.', '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604110001', 'payment', 'unpaid', 'failed', null, 'Thanh toán được đánh dấu thất bại vì đơn đã hủy.', '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'order', 'pending', 'confirmed', 'seller.home@ecommerce.local', 'Người bán xác nhận tồn kho và đóng gói.', '2026-04-12T09:10:00+07'::timestamptz),
  ('ORD-202604120001', 'payment', 'pending', 'paid', null, 'MoMo callback xác nhận thanh toán thành công.', '2026-04-12T08:46:00+07'::timestamptz),
  ('ORD-202604120001', 'fulfillment', 'pending', 'shipping', 'seller.home@ecommerce.local', 'Đơn vị vận chuyển đã lấy hàng.', '2026-04-12T13:20:00+07'::timestamptz),
  ('ORD-202604120001', 'order', 'shipping', 'delivered', 'seller.home@ecommerce.local', 'Đã giao hàng cho người nhà khách.', '2026-04-13T11:15:00+07'::timestamptz)
) as seeded(order_no, status_type, old_status, new_status, changed_by_email, note, changed_at)
join public.orders o on o.order_no = seeded.order_no
left join public.users changer on changer.email = seeded.changed_by_email;

insert into public.coupon_usages (coupon_id, user_id, order_id, used_at)
select c.id, u.id, o.id, seeded.used_at
from (values
  ('WELCOME10', 'chau.customer@ecommerce.local', 'ORD-202604010001', '2026-04-01T09:15:00+07'::timestamptz),
  ('FREESHIP50', 'khang.customer@ecommerce.local', 'ORD-202604120001', '2026-04-12T08:45:00+07'::timestamptz)
) as seeded(coupon_code, user_email, order_no, used_at)
join public.coupons c on c.code = seeded.coupon_code
join public.users u on u.email = seeded.user_email
join public.orders o on o.order_no = seeded.order_no;

insert into public.reviews (
  user_id, product_id, order_item_id, rating, comment, image_urls,
  is_verified_purchase, status, created_at, updated_at
)
select
  u.id, p.id, oi.id, seeded.rating, seeded.comment, seeded.image_urls,
  true, 'visible', seeded.created_at, seeded.updated_at
from (values
  ('chau.customer@ecommerce.local', 'ORD-202604010001', 'iphone-15-128gb-black', 5, 'Máy dùng mượt, pin đủ cho một ngày làm việc và camera chụp rất ổn. Giao hàng đúng hẹn.', array['https://d35ci4s1xmcpe.cloudfront.net/products/seed/reviews/review-iphone-15.jpg']::text[], '2026-04-06T20:15:00+07'::timestamptz, '2026-04-06T20:15:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'ORD-202604010001', 'anker-prime-65w-gan-charger', 4, 'Củ sạc nhỏ gọn, sạc được cả điện thoại và tablet. Mua kèm rất hợp lý.', null::text[], '2026-04-06T20:20:00+07'::timestamptz, '2026-04-06T20:20:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'ORD-202604120001', 'jbl-flip-6-black', 5, 'Loa nhỏ nhưng âm lượng lớn, dùng cuối tuần hoặc ở quán cà phê rất ổn.', null::text[], '2026-04-13T18:00:00+07'::timestamptz, '2026-04-13T18:00:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 4, 'Nồi chiên đầu tiên của gia đình, dễ dùng và dung tích vừa đủ cho bữa ăn hằng ngày.', null::text[], '2026-04-13T18:10:00+07'::timestamptz, '2026-04-13T18:10:00+07'::timestamptz)
) as seeded(user_email, order_no, product_slug, rating, comment, image_urls, created_at, updated_at)
join public.users u on u.email = seeded.user_email
join public.products p on p.slug = seeded.product_slug
join public.orders o on o.order_no = seeded.order_no
join public.order_items oi on oi.order_id = o.id and oi.product_id = p.id;

insert into public.favourites (user_id, product_id, created_at)
select u.id, p.id, seeded.created_at
from (values
  ('chau.customer@ecommerce.local', 'samsung-galaxy-s24-256gb-gray', '2026-04-10T09:30:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'jbl-flip-6-black', '2026-04-10T09:35:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'iphone-15-128gb-black', '2026-04-11T20:00:00+07'::timestamptz),
  ('mai.customer@ecommerce.local', 'ecovacs-deebot-n8', '2026-04-11T09:00:00+07'::timestamptz)
) as seeded(user_email, product_slug, created_at)
join public.users u on u.email = seeded.user_email
join public.products p on p.slug = seeded.product_slug
on conflict (user_id, product_id) do nothing;

update public.coupons c
set used_count = coalesce((
  select count(*)
  from public.coupon_usages cu
  where cu.coupon_id = c.id
), 0),
updated_at = '2026-04-13T18:15:00+07'::timestamptz
where c.code in ('WELCOME10', 'FREESHIP50', 'TECH15', 'NEWBUY5');

update public.products p
set
  rating_avg = coalesce(r.avg_rating, 0),
  review_count = coalesce(r.review_count, 0),
  updated_at = greatest(p.updated_at, coalesce(r.latest_review_at, p.updated_at))
from (
  select
    product_id,
    round(avg(rating)::numeric, 2) as avg_rating,
    count(*)::int as review_count,
    max(updated_at) as latest_review_at
  from public.reviews
  where status = 'visible'
  group by product_id
) r
where p.id = r.product_id;

commit;
