-- realistic_demo_seed.sql
-- Seed dataset synced with the data inserted directly into Supabase on 2026-04-13.
-- Demo logins:
--   admin@ecommerce.local / Admin@123
--   seller.tech@ecommerce.local / Seller@123
--   seller.home@ecommerce.local / Seller@123
--   chau.customer@ecommerce.local / Customer@123
--   khang.customer@ecommerce.local / Customer@123
--   mai.customer@ecommerce.local / Customer@123
-- Seed images are expected in Supabase Storage:
--   https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/

begin;

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
  ('admin@ecommerce.local', crypt('Admin@123', gen_salt('bf', 8)), 'System Admin', '+84901111001', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/users/admin-avatar.jpg', 'active', true, '2026-03-01T08:00:00+07', '2026-04-10T08:00:00+07'),
  ('seller.tech@ecommerce.local', crypt('Seller@123', gen_salt('bf', 8)), 'Pham Quoc Dat', '+84901222002', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/users/seller-tech-avatar.jpg', 'active', true, '2026-03-03T09:00:00+07', '2026-04-10T09:00:00+07'),
  ('seller.home@ecommerce.local', crypt('Seller@123', gen_salt('bf', 8)), 'Tran Hoang Nam', '+84901333003', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/users/seller-home-avatar.jpg', 'active', true, '2026-03-04T09:30:00+07', '2026-04-10T09:30:00+07'),
  ('chau.customer@ecommerce.local', crypt('Customer@123', gen_salt('bf', 8)), 'Nguyen Minh Chau', '+84903777011', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/users/chau-avatar.jpg', 'active', true, '2026-03-08T19:15:00+07', '2026-04-12T12:00:00+07'),
  ('khang.customer@ecommerce.local', crypt('Customer@123', gen_salt('bf', 8)), 'Tran Minh Khang', '+84903888022', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/users/khang-avatar.jpg', 'active', true, '2026-03-10T08:45:00+07', '2026-04-12T19:10:00+07'),
  ('mai.customer@ecommerce.local', crypt('Customer@123', gen_salt('bf', 8)), 'Le Thu Mai', '+84903999033', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/users/mai-avatar.jpg', 'active', true, '2026-03-12T20:10:00+07', '2026-04-11T14:45:00+07')
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
  ('chau.customer@ecommerce.local', 'Nguyen Minh Chau', '+84903777011', '45 Nguyen Huu Canh, Landmark 81', 'Ward 22', 'Binh Thanh', 'Ho Chi Minh City', 'Ho Chi Minh City', '700000', 'Vietnam', true, '2026-03-09T08:30:00+07'::timestamptz, '2026-04-01T08:30:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'Nguyen Minh Chau', '+84903777011', '12 Le Loi, Ben Nghe', 'Ben Nghe', 'District 1', 'Ho Chi Minh City', 'Ho Chi Minh City', '700000', 'Vietnam', false, '2026-03-25T11:30:00+07'::timestamptz, '2026-03-25T11:30:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'Tran Minh Khang', '+84903888022', '88 Tran Phu', 'Hai Chau 1', 'Hai Chau', 'Da Nang', 'Da Nang', '550000', 'Vietnam', true, '2026-03-11T09:00:00+07'::timestamptz, '2026-04-09T18:45:00+07'::timestamptz),
  ('mai.customer@ecommerce.local', 'Le Thu Mai', '+84903999033', '27 Hoang Cau', 'O Cho Dua', 'Dong Da', 'Ha Noi', 'Ha Noi', '100000', 'Vietnam', true, '2026-03-13T10:20:00+07'::timestamptz, '2026-04-11T09:20:00+07'::timestamptz),
  ('seller.tech@ecommerce.local', 'Pham Quoc Dat', '+84901222002', '190 Pasteur', 'Vo Thi Sau', 'District 3', 'Ho Chi Minh City', 'Ho Chi Minh City', '700000', 'Vietnam', true, '2026-03-05T13:00:00+07'::timestamptz, '2026-03-05T13:00:00+07'::timestamptz),
  ('seller.home@ecommerce.local', 'Tran Hoang Nam', '+84901333003', '15 Nguyen Van Linh', 'Thac Gian', 'Thanh Khe', 'Da Nang', 'Da Nang', '550000', 'Vietnam', true, '2026-03-05T14:00:00+07'::timestamptz, '2026-03-05T14:00:00+07'::timestamptz)
) as seeded(email, receiver_name, receiver_phone, address_line, ward, district, city, province, postal_code, country, is_default, created_at, updated_at)
join public.users u on u.email = seeded.email
where not exists (
  select 1
  from public.addresses a
  where a.user_id = u.id
    and a.address_line = seeded.address_line
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
  ('chau.customer@ecommerce.local', 'VNPAY', 'VNPAY', 'pm_chau_vnpay_main', 'VNPAY Wallet', null::integer, null::integer, true, '2026-03-15T08:10:00+07'::timestamptz, '2026-04-05T09:10:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'CARD', 'VISA', 'pm_chau_visa_4242', 'Visa ending 4242', 10, 2028, false, '2026-03-15T08:12:00+07'::timestamptz, '2026-03-15T08:12:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'MOMO', 'MOMO', 'pm_khang_momo_main', 'MoMo 0903****22', null::integer, null::integer, true, '2026-03-17T10:00:00+07'::timestamptz, '2026-04-12T08:00:00+07'::timestamptz),
  ('mai.customer@ecommerce.local', 'BANK_TRANSFER', 'Vietcombank', 'pm_mai_vcb_2689', 'VCB ending 2689', null::integer, null::integer, true, '2026-03-19T19:00:00+07'::timestamptz, '2026-03-19T19:00:00+07'::timestamptz)
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
  ('Apple', 'Apple devices and accessories curated for premium everyday use.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/apple-logo.jpg', '2026-03-05T08:00:00+07'::timestamptz, '2026-03-05T08:00:00+07'::timestamptz),
  ('Samsung', 'Samsung mobile and charging accessories for mainstream buyers.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/samsung-logo.jpg', '2026-03-05T08:05:00+07'::timestamptz, '2026-03-05T08:05:00+07'::timestamptz),
  ('Xiaomi', 'Value-first smart devices and home appliances.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/xiaomi-logo.jpg', '2026-03-05T08:10:00+07'::timestamptz, '2026-03-05T08:10:00+07'::timestamptz),
  ('Logitech', 'Productivity peripherals for workstations and desks.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/logitech-logo.jpg', '2026-03-05T08:15:00+07'::timestamptz, '2026-03-05T08:15:00+07'::timestamptz),
  ('Anker', 'Fast charging and power accessories for mobile users.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/anker-logo.jpg', '2026-03-05T08:20:00+07'::timestamptz, '2026-03-05T08:20:00+07'::timestamptz),
  ('JBL', 'Portable audio products for indoor and outdoor listening.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/jbl-logo.jpg', '2026-03-05T08:25:00+07'::timestamptz, '2026-03-05T08:25:00+07'::timestamptz),
  ('Ecovacs', 'Robot vacuum and smart cleaning appliances.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/brands/ecovacs-logo.jpg', '2026-03-05T08:30:00+07'::timestamptz, '2026-03-05T08:30:00+07'::timestamptz)
) as seeded(name, description, logo_url, created_at, updated_at)
where not exists (
  select 1 from public.brands b where b.name = seeded.name
);

insert into public.categories (parent_id, name, slug, description, image_url, is_active, created_at, updated_at)
select null, seeded.name, seeded.slug, seeded.description, seeded.image_url, true, seeded.created_at, seeded.updated_at
from (values
  ('Electronics', 'electronics', 'Phones, audio, and accessories for daily digital life.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/electronics.jpg', '2026-03-06T09:00:00+07'::timestamptz, '2026-03-06T09:00:00+07'::timestamptz),
  ('Home Living', 'home-living', 'Smart appliances and practical devices for modern homes.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/home-living.jpg', '2026-03-06T09:05:00+07'::timestamptz, '2026-03-06T09:05:00+07'::timestamptz)
) as seeded(name, slug, description, image_url, created_at, updated_at)
where not exists (
  select 1 from public.categories c where c.slug = seeded.slug
);

insert into public.categories (parent_id, name, slug, description, image_url, is_active, created_at, updated_at)
select parent.id, seeded.name, seeded.slug, seeded.description, seeded.image_url, true, seeded.created_at, seeded.updated_at
from (values
  ('electronics', 'Smartphones', 'smartphones', 'Latest flagship and value smartphones ready for checkout testing.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/smartphones.jpg', '2026-03-06T09:10:00+07'::timestamptz, '2026-03-06T09:10:00+07'::timestamptz),
  ('electronics', 'Audio', 'audio', 'Wireless earbuds, speakers, and portable sound devices.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/audio.jpg', '2026-03-06T09:12:00+07'::timestamptz, '2026-03-06T09:12:00+07'::timestamptz),
  ('electronics', 'Accessories', 'accessories', 'Chargers and practical mobile accessories.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/accessories.jpg', '2026-03-06T09:14:00+07'::timestamptz, '2026-03-06T09:14:00+07'::timestamptz),
  ('home-living', 'Smart Home', 'smart-home', 'Robots and smart appliances for everyday home routines.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/smart-home.jpg', '2026-03-06T09:16:00+07'::timestamptz, '2026-03-06T09:16:00+07'::timestamptz),
  ('home-living', 'Desk Setup', 'desk-setup', 'Work-from-home essentials for comfortable productivity.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/categories/desk-setup.jpg', '2026-03-06T09:18:00+07'::timestamptz, '2026-03-06T09:18:00+07'::timestamptz)
) as seeded(parent_slug, name, slug, description, image_url, created_at, updated_at)
join public.categories parent on parent.slug = seeded.parent_slug
where not exists (
  select 1 from public.categories c where c.slug = seeded.slug
);
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
  ('smartphones', 'Apple', 'seller.tech@ecommerce.local', 'IP15-128-BLK', 'iPhone 15 128GB', 'iphone-15-128gb-black', 'Flagship iPhone for premium everyday users.', 'Apple iPhone 15 with 128GB storage, long battery life, and a dependable dual-camera setup for photo-heavy customers.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/iphone-15-thumbnail.jpg', 999.00, '2026-03-20T09:00:00+07'::timestamptz, '2026-03-18T09:00:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('smartphones', 'Samsung', 'seller.tech@ecommerce.local', 'SGS24-256-GRY', 'Samsung Galaxy S24 256GB', 'samsung-galaxy-s24-256gb-gray', 'Compact Android flagship with strong camera and display.', 'Samsung Galaxy S24 256GB in graphite grey, balanced for users who want flagship performance without going ultra-premium.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/samsung-s24-thumbnail.jpg', 899.00, '2026-03-21T09:00:00+07'::timestamptz, '2026-03-19T09:00:00+07'::timestamptz, '2026-04-10T09:00:00+07'::timestamptz),
  ('smartphones', 'Xiaomi', 'seller.tech@ecommerce.local', 'RDN13-256-BLK', 'Redmi Note 13 8GB 256GB', 'redmi-note-13-8gb-256gb-black', 'Value smartphone with generous storage and battery life.', 'Redmi Note 13 with 8GB RAM and 256GB storage, ideal for budget-sensitive buyers who still want a modern OLED phone.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/redmi-note-13-thumbnail.jpg', 289.00, '2026-03-22T09:00:00+07'::timestamptz, '2026-03-20T09:00:00+07'::timestamptz, '2026-04-11T10:00:00+07'::timestamptz),
  ('audio', 'Apple', 'seller.tech@ecommerce.local', 'APP2-USBC', 'AirPods Pro 2 USB-C', 'airpods-pro-2-usbc', 'Premium wireless earbuds with reliable ANC.', 'AirPods Pro 2 with USB-C charging case, active noise cancellation, and seamless pairing for Apple ecosystem customers.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/airpods-pro-2-thumbnail.jpg', 249.00, '2026-03-23T09:00:00+07'::timestamptz, '2026-03-21T09:00:00+07'::timestamptz, '2026-04-05T14:00:00+07'::timestamptz),
  ('desk-setup', 'Logitech', 'seller.tech@ecommerce.local', 'MXM3S-GRAPH', 'Logitech MX Master 3S', 'logitech-mx-master-3s-graphite', 'Productivity mouse built for heavy office workflows.', 'Logitech MX Master 3S in graphite for designers, developers, and office users who want quiet clicks and ergonomic comfort.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/mx-master-3s-thumbnail.jpg', 109.00, '2026-03-24T09:00:00+07'::timestamptz, '2026-03-22T09:00:00+07'::timestamptz, '2026-04-08T11:00:00+07'::timestamptz),
  ('accessories', 'Anker', 'seller.tech@ecommerce.local', 'ANK65-GAN', 'Anker Prime 65W GaN Charger', 'anker-prime-65w-gan-charger', 'Compact fast charger for laptop and phone users.', 'Anker Prime 65W GaN charger with two USB-C ports for travelers and users who want one charger for phone and tablet.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/anker-65w-thumbnail.jpg', 59.00, '2026-03-25T09:00:00+07'::timestamptz, '2026-03-23T09:00:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('audio', 'JBL', 'seller.home@ecommerce.local', 'JBLFLIP6-BLK', 'JBL Flip 6 Portable Speaker', 'jbl-flip-6-black', 'Portable Bluetooth speaker for daily and outdoor use.', 'JBL Flip 6 portable speaker with IP67 protection, punchy sound, and enough battery for home use or weekend trips.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/jbl-flip-6-thumbnail.jpg', 129.00, '2026-03-26T09:00:00+07'::timestamptz, '2026-03-24T09:00:00+07'::timestamptz, '2026-04-12T11:30:00+07'::timestamptz),
  ('smart-home', 'Ecovacs', 'seller.home@ecommerce.local', 'ECO-N8', 'Ecovacs Deebot N8', 'ecovacs-deebot-n8', 'Robot vacuum that covers apartment-sized homes well.', 'Ecovacs Deebot N8 robot vacuum with mapping and mop support, suitable for busy households and apartment owners.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/ecovacs-n8-thumbnail.jpg', 349.00, '2026-03-27T09:00:00+07'::timestamptz, '2026-03-25T09:00:00+07'::timestamptz, '2026-04-10T09:30:00+07'::timestamptz),
  ('smart-home', 'Xiaomi', 'seller.home@ecommerce.local', 'XM-AIRFRY45', 'Xiaomi Smart Air Fryer 4.5L', 'xiaomi-smart-air-fryer-45l', 'Smart kitchen appliance for healthier quick meals.', 'Xiaomi Smart Air Fryer 4.5L with app scheduling and enough basket size for small families and couple households.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/air-fryer-thumbnail.jpg', 119.00, '2026-03-28T09:00:00+07'::timestamptz, '2026-03-26T09:00:00+07'::timestamptz, '2026-04-12T11:30:00+07'::timestamptz),
  ('accessories', 'Samsung', 'seller.tech@ecommerce.local', 'SS25W-USBC', 'Samsung 25W USB-C Charger', 'samsung-25w-usb-c-charger', 'Affordable fast charger for Galaxy users.', 'Samsung 25W USB-C travel adapter for customers who need a dependable first-party charger at a low price point.', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/samsung-25w-thumbnail.jpg', 24.00, '2026-03-29T09:00:00+07'::timestamptz, '2026-03-27T09:00:00+07'::timestamptz, '2026-04-09T08:00:00+07'::timestamptz)
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
  ('iphone-15-128gb-black', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/iphone-15-front.jpg', true, 1, '2026-03-18T09:05:00+07'::timestamptz),
  ('iphone-15-128gb-black', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/iphone-15-back.jpg', false, 2, '2026-03-18T09:06:00+07'::timestamptz),
  ('samsung-galaxy-s24-256gb-gray', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/samsung-s24-front.jpg', true, 1, '2026-03-19T09:05:00+07'::timestamptz),
  ('samsung-galaxy-s24-256gb-gray', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/samsung-s24-lifestyle.jpg', false, 2, '2026-03-19T09:06:00+07'::timestamptz),
  ('redmi-note-13-8gb-256gb-black', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/redmi-note-13-front.jpg', true, 1, '2026-03-20T09:05:00+07'::timestamptz),
  ('airpods-pro-2-usbc', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/airpods-pro-2-case.jpg', true, 1, '2026-03-21T09:05:00+07'::timestamptz),
  ('logitech-mx-master-3s-graphite', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/mx-master-3s-top.jpg', true, 1, '2026-03-22T09:05:00+07'::timestamptz),
  ('anker-prime-65w-gan-charger', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/anker-65w-main.jpg', true, 1, '2026-03-23T09:05:00+07'::timestamptz),
  ('jbl-flip-6-black', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/jbl-flip-6-front.jpg', true, 1, '2026-03-24T09:05:00+07'::timestamptz),
  ('jbl-flip-6-black', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/jbl-flip-6-outdoor.jpg', false, 2, '2026-03-24T09:06:00+07'::timestamptz),
  ('ecovacs-deebot-n8', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/ecovacs-n8-main.jpg', true, 1, '2026-03-25T09:05:00+07'::timestamptz),
  ('xiaomi-smart-air-fryer-45l', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/air-fryer-main.jpg', true, 1, '2026-03-26T09:05:00+07'::timestamptz),
  ('samsung-25w-usb-c-charger', 'https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/products/samsung-25w-main.jpg', true, 1, '2026-03-27T09:05:00+07'::timestamptz)
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
  ('samsung-25w-usb-c-charger', 40, 0, 5, '2026-03-27T09:10:00+07'::timestamptz, '2026-04-09T08:00:00+07'::timestamptz)
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
  ('WELCOME10', '10 percent off for first-time style seed orders.', 'percent', 10.00, 100.00, 120.00, '2026-03-25T00:00:00+07', '2026-05-31T23:59:59+07', 500, 0, true, '2026-03-25T00:00:00+07', '2026-03-25T00:00:00+07'),
  ('FREESHIP50', 'Flat discount that effectively covers standard delivery.', 'fixed', 5.00, 50.00, 5.00, '2026-04-01T00:00:00+07', '2026-05-15T23:59:59+07', 300, 0, true, '2026-04-01T00:00:00+07', '2026-04-01T00:00:00+07'),
  ('TECH15', '15 percent off selected tech baskets with a capped discount.', 'percent', 15.00, 300.00, 80.00, '2026-04-01T00:00:00+07', '2026-04-30T23:59:59+07', 150, 0, true, '2026-04-01T00:00:00+07', '2026-04-01T00:00:00+07'),
  ('NEWBUY5', 'Flat starter discount for quick first checkouts.', 'fixed', 5.00, 30.00, null, '2026-03-20T00:00:00+07', '2026-06-30T23:59:59+07', 1000, 0, true, '2026-03-20T00:00:00+07', '2026-03-20T00:00:00+07')
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
  ('Standard Delivery', 'Reliable nationwide delivery used by the seeded checkout flows.', 2, 4, 5.00, '2026-03-25T08:00:00+07'::timestamptz, '2026-03-25T08:00:00+07'::timestamptz),
  ('Express Delivery', 'Faster shipping option for time-sensitive orders.', 1, 2, 12.00, '2026-03-25T08:05:00+07'::timestamptz, '2026-03-25T08:05:00+07'::timestamptz),
  ('Store Pickup', 'Pickup at partner pickup points in major cities.', 0, 1, 0.00, '2026-03-25T08:10:00+07'::timestamptz, '2026-03-25T08:10:00+07'::timestamptz)
) as seeded(name, description, estimated_min_days, estimated_max_days, fee, created_at, updated_at)
where not exists (
  select 1 from public.shipping_methods sm where sm.name = seeded.name
);

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
  ('ORD-202604010001', 'chau.customer@ecommerce.local', 'WELCOME10', 'Standard Delivery', 'delivered', 'paid', 'delivered', 'Nguyen Minh Chau', '+84903777011', '45 Nguyen Huu Canh, Landmark 81', 'Ward 22', 'Binh Thanh', 'Ho Chi Minh City', 'Ho Chi Minh City', '700000', 'Vietnam', 'Deliver before 6 PM if possible.', 'COD', 1058.00, 5.00, 105.80, 105.80, 1063.00, '2026-04-01T09:15:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz, null::timestamptz, '2026-04-04T15:30:00+07'::timestamptz, '2026-04-01T09:15:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'chau.customer@ecommerce.local', null, 'Standard Delivery', 'shipping', 'paid', 'shipping', 'Nguyen Minh Chau', '+84903777011', '12 Le Loi, Ben Nghe', 'Ben Nghe', 'District 1', 'Ho Chi Minh City', 'Ho Chi Minh City', '700000', 'Vietnam', 'Office reception accepts packages during business hours.', 'VNPAY', 249.00, 5.00, 24.90, 0.00, 278.90, '2026-04-05T10:20:00+07'::timestamptz, '2026-04-05T10:21:00+07'::timestamptz, null::timestamptz, null::timestamptz, '2026-04-05T10:20:00+07'::timestamptz, '2026-04-06T14:00:00+07'::timestamptz),
  ('ORD-202604090001', 'khang.customer@ecommerce.local', null, 'Standard Delivery', 'pending', 'unpaid', 'pending', 'Tran Minh Khang', '+84903888022', '88 Tran Phu', 'Hai Chau 1', 'Hai Chau', 'Da Nang', 'Da Nang', '550000', 'Vietnam', 'Please call before delivery.', 'COD', 129.00, 5.00, 12.90, 0.00, 146.90, '2026-04-09T19:40:00+07'::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, '2026-04-09T19:40:00+07'::timestamptz, '2026-04-09T19:40:00+07'::timestamptz),
  ('ORD-202604100001', 'khang.customer@ecommerce.local', null, 'Standard Delivery', 'confirmed', 'pending', 'packed', 'Tran Minh Khang', '+84903888022', '88 Tran Phu', 'Hai Chau 1', 'Hai Chau', 'Da Nang', 'Da Nang', '550000', 'Vietnam', 'Customer requested careful packaging for the robot vacuum.', 'BANK_TRANSFER', 349.00, 5.00, 34.90, 0.00, 388.90, '2026-04-10T14:05:00+07'::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz, '2026-04-10T14:05:00+07'::timestamptz, '2026-04-10T15:00:00+07'::timestamptz),
  ('ORD-202604110001', 'mai.customer@ecommerce.local', null, 'Standard Delivery', 'cancelled', 'failed', 'cancelled', 'Le Thu Mai', '+84903999033', '27 Hoang Cau', 'O Cho Dua', 'Dong Da', 'Ha Noi', 'Ha Noi', '100000', 'Vietnam', 'Cancelled after customer changed purchase plan.', 'COD', 289.00, 5.00, 28.90, 0.00, 322.90, '2026-04-11T11:30:00+07'::timestamptz, null::timestamptz, '2026-04-11T12:10:00+07'::timestamptz, null::timestamptz, '2026-04-11T11:30:00+07'::timestamptz, '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'khang.customer@ecommerce.local', 'FREESHIP50', 'Standard Delivery', 'delivered', 'paid', 'delivered', 'Tran Minh Khang', '+84903888022', '88 Tran Phu', 'Hai Chau 1', 'Hai Chau', 'Da Nang', 'Da Nang', '550000', 'Vietnam', 'Customer left note to hand over directly to family member.', 'MOMO', 248.00, 5.00, 24.80, 5.00, 272.80, '2026-04-12T08:45:00+07'::timestamptz, '2026-04-12T08:46:00+07'::timestamptz, null::timestamptz, '2026-04-13T11:15:00+07'::timestamptz, '2026-04-12T08:45:00+07'::timestamptz, '2026-04-13T11:15:00+07'::timestamptz)
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
  ('ORD-202604010001', 'iphone-15-128gb-black', 999.00, 1, 999.00, '2026-04-01T09:16:00+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 59.00, 1, 59.00, '2026-04-01T09:16:30+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 249.00, 1, 249.00, '2026-04-05T10:20:30+07'::timestamptz),
  ('ORD-202604090001', 'jbl-flip-6-black', 129.00, 1, 129.00, '2026-04-09T19:40:30+07'::timestamptz),
  ('ORD-202604100001', 'ecovacs-deebot-n8', 349.00, 1, 349.00, '2026-04-10T14:05:30+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 289.00, 1, 289.00, '2026-04-11T11:30:30+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 129.00, 1, 129.00, '2026-04-12T08:45:30+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 119.00, 1, 119.00, '2026-04-12T08:45:45+07'::timestamptz)
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
  ('ORD-202604010001', 'iphone-15-128gb-black', 'reserve', 1, 'Inventory reserved for paid-ready COD order.', '2026-04-01T09:17:00+07'::timestamptz),
  ('ORD-202604010001', 'iphone-15-128gb-black', 'out', 1, 'Stock consumed after successful delivery.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 'reserve', 1, 'Inventory reserved for paid-ready COD order.', '2026-04-01T09:17:10+07'::timestamptz),
  ('ORD-202604010001', 'anker-prime-65w-gan-charger', 'out', 1, 'Stock consumed after successful delivery.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 'reserve', 1, 'Inventory reserved after successful VNPAY payment.', '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604050001', 'airpods-pro-2-usbc', 'out', 1, 'Order handed over to carrier.', '2026-04-06T09:00:00+07'::timestamptz),
  ('ORD-202604090001', 'jbl-flip-6-black', 'reserve', 1, 'Reserved while waiting for COD confirmation.', '2026-04-09T19:41:00+07'::timestamptz),
  ('ORD-202604100001', 'ecovacs-deebot-n8', 'reserve', 1, 'Reserved after seller confirmed order.', '2026-04-10T14:06:00+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 'reserve', 1, 'Reserved during checkout creation.', '2026-04-11T11:31:00+07'::timestamptz),
  ('ORD-202604110001', 'redmi-note-13-8gb-256gb-black', 'release', 1, 'Released after customer cancelled order.', '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 'reserve', 1, 'Reserved after successful MoMo payment.', '2026-04-12T08:46:00+07'::timestamptz),
  ('ORD-202604120001', 'jbl-flip-6-black', 'out', 1, 'Delivered to customer.', '2026-04-13T11:15:00+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 'reserve', 1, 'Reserved after successful MoMo payment.', '2026-04-12T08:46:10+07'::timestamptz),
  ('ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 'out', 1, 'Delivered to customer.', '2026-04-13T11:15:00+07'::timestamptz)
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
  ('ORD-202604010001', 'COD', 'COD', 'paid', 1063.00, 'USD', 'cash-202604010001', '00', 'Collected on delivery.', '2026-04-04T15:30:00+07'::timestamptz, null::timestamptz, '2026-04-01T09:15:30+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'VNPAY', 'VNPAY', 'paid', 278.90, 'USD', 'vnp-202604050001', '00', 'Payment captured successfully.', '2026-04-05T10:21:00+07'::timestamptz, null::timestamptz, '2026-04-05T10:20:30+07'::timestamptz, '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604090001', 'COD', 'COD', 'pending', 146.90, 'USD', 'cod-202604090001', null, 'Awaiting delivery collection.', null::timestamptz, null::timestamptz, '2026-04-09T19:40:30+07'::timestamptz, '2026-04-09T19:40:30+07'::timestamptz),
  ('ORD-202604100001', 'BANK_TRANSFER', 'BANK_TRANSFER', 'pending', 388.90, 'USD', 'bank-202604100001', null, 'Awaiting incoming transfer.', null::timestamptz, null::timestamptz, '2026-04-10T14:05:30+07'::timestamptz, '2026-04-10T14:05:30+07'::timestamptz),
  ('ORD-202604110001', 'COD', 'COD', 'failed', 322.90, 'USD', 'cod-202604110001', 'USER_CANCELLED', 'Customer cancelled before handoff.', null::timestamptz, '2026-04-11T12:10:00+07'::timestamptz, '2026-04-11T11:30:30+07'::timestamptz, '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'MOMO', 'MOMO', 'paid', 272.80, 'USD', 'momo-202604120001', '00', 'Payment confirmed by wallet callback.', '2026-04-12T08:46:00+07'::timestamptz, null::timestamptz, '2026-04-12T08:45:30+07'::timestamptz, '2026-04-12T08:46:00+07'::timestamptz)
) as seeded(order_no, provider, method, status, amount, currency, provider_transaction_id, gateway_response_code, gateway_message, paid_at, failed_at, created_at, updated_at)
join public.orders o on o.order_no = seeded.order_no;

insert into public.payment_transactions (
  payment_id, transaction_type, status, amount, external_ref, raw_payload, created_at
)
select
  p.id, seeded.transaction_type, seeded.status, seeded.amount, seeded.external_ref, seeded.raw_payload, seeded.created_at
from (values
  ('ORD-202604010001', 'capture', 'paid', 1063.00, 'cash-202604010001', '{"source":"cod","status":"paid"}'::jsonb, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'capture', 'paid', 278.90, 'vnp-202604050001', '{"gateway":"VNPAY","status":"paid","responseCode":"00"}'::jsonb, '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604090001', 'authorize', 'pending', 146.90, 'cod-202604090001', '{"source":"cod","status":"pending"}'::jsonb, '2026-04-09T19:40:30+07'::timestamptz),
  ('ORD-202604100001', 'authorize', 'pending', 388.90, 'bank-202604100001', '{"gateway":"BANK_TRANSFER","status":"pending"}'::jsonb, '2026-04-10T14:05:30+07'::timestamptz),
  ('ORD-202604110001', 'webhook_update', 'failed', 322.90, 'cod-202604110001', '{"source":"cod","status":"failed","reason":"customer_cancelled"}'::jsonb, '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'capture', 'paid', 272.80, 'momo-202604120001', '{"gateway":"MOMO","status":"paid","responseCode":"00"}'::jsonb, '2026-04-12T08:46:00+07'::timestamptz)
) as seeded(order_no, transaction_type, status, amount, external_ref, raw_payload, created_at)
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
  ('ORD-202604010001', 'Standard Delivery', 'SHP-202604010001', 'GHN', 'GHN940001245', 'delivered', 'Delivered successfully to customer address.', '2026-04-02T08:30:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz, '2026-04-02T08:30:00+07'::timestamptz, '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'Standard Delivery', 'SHP-202604050001', 'GHTK', 'GHTK770005515', 'in_transit', 'Parcel is moving between linehaul hubs.', '2026-04-06T09:00:00+07'::timestamptz, null::timestamptz, '2026-04-06T09:00:00+07'::timestamptz, '2026-04-06T14:00:00+07'::timestamptz),
  ('ORD-202604100001', 'Standard Delivery', 'SHP-202604100001', 'AhaMove', 'AHM20260410001', 'ready_to_ship', 'Packed and waiting for carrier pickup.', null::timestamptz, null::timestamptz, '2026-04-10T15:00:00+07'::timestamptz, '2026-04-10T15:00:00+07'::timestamptz),
  ('ORD-202604120001', 'Standard Delivery', 'SHP-202604120001', 'GHN', 'GHN940001620', 'delivered', 'Delivered and confirmed by customer family member.', '2026-04-12T13:20:00+07'::timestamptz, '2026-04-13T11:15:00+07'::timestamptz, '2026-04-12T13:20:00+07'::timestamptz, '2026-04-13T11:15:00+07'::timestamptz)
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
  ('ORD-202604010001', 'order', 'pending', 'confirmed', 'seller.tech@ecommerce.local', 'Seller confirmed the order after checking stock.', '2026-04-01T10:05:00+07'::timestamptz),
  ('ORD-202604010001', 'fulfillment', 'pending', 'shipping', 'seller.tech@ecommerce.local', 'Package handed to carrier.', '2026-04-02T08:30:00+07'::timestamptz),
  ('ORD-202604010001', 'payment', 'unpaid', 'paid', null, 'COD payment marked paid on delivery.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604010001', 'order', 'shipping', 'delivered', 'seller.tech@ecommerce.local', 'Customer received the package.', '2026-04-04T15:30:00+07'::timestamptz),
  ('ORD-202604050001', 'order', 'pending', 'confirmed', 'seller.tech@ecommerce.local', 'Seller confirmed payment and stock.', '2026-04-05T10:40:00+07'::timestamptz),
  ('ORD-202604050001', 'payment', 'pending', 'paid', null, 'VNPAY callback confirmed the charge.', '2026-04-05T10:21:00+07'::timestamptz),
  ('ORD-202604050001', 'fulfillment', 'pending', 'shipping', 'seller.tech@ecommerce.local', 'Package is moving with carrier.', '2026-04-06T09:00:00+07'::timestamptz),
  ('ORD-202604090001', 'order', null, 'pending', 'khang.customer@ecommerce.local', 'Order created from mobile checkout.', '2026-04-09T19:40:00+07'::timestamptz),
  ('ORD-202604100001', 'order', 'pending', 'confirmed', 'seller.home@ecommerce.local', 'Seller confirmed and started packing.', '2026-04-10T15:00:00+07'::timestamptz),
  ('ORD-202604100001', 'payment', 'unpaid', 'pending', null, 'Waiting for bank transfer confirmation.', '2026-04-10T14:10:00+07'::timestamptz),
  ('ORD-202604110001', 'order', 'pending', 'cancelled', 'mai.customer@ecommerce.local', 'Customer cancelled before shipment.', '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604110001', 'payment', 'unpaid', 'failed', null, 'Marked failed because checkout was cancelled.', '2026-04-11T12:10:00+07'::timestamptz),
  ('ORD-202604120001', 'order', 'pending', 'confirmed', 'seller.home@ecommerce.local', 'Seller confirmed stock and packaging.', '2026-04-12T09:10:00+07'::timestamptz),
  ('ORD-202604120001', 'payment', 'pending', 'paid', null, 'MoMo payment callback succeeded.', '2026-04-12T08:46:00+07'::timestamptz),
  ('ORD-202604120001', 'fulfillment', 'pending', 'shipping', 'seller.home@ecommerce.local', 'Carrier collected the parcel.', '2026-04-12T13:20:00+07'::timestamptz),
  ('ORD-202604120001', 'order', 'shipping', 'delivered', 'seller.home@ecommerce.local', 'Delivered to customer family member.', '2026-04-13T11:15:00+07'::timestamptz)
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
  ('chau.customer@ecommerce.local', 'ORD-202604010001', 'iphone-15-128gb-black', 5, 'Excellent phone for daily use. Battery easily lasts through my workday and the camera feels very dependable.', array['https://dglfcdxadwvvvhlqnkyp.supabase.co/storage/v1/object/public/product-images/seed/reviews/review-iphone-15.jpg']::text[], '2026-04-06T20:15:00+07'::timestamptz, '2026-04-06T20:15:00+07'::timestamptz),
  ('chau.customer@ecommerce.local', 'ORD-202604010001', 'anker-prime-65w-gan-charger', 4, 'Very compact charger and it handles both my phone and tablet well. Useful bundle add-on.', null::text[], '2026-04-06T20:20:00+07'::timestamptz, '2026-04-06T20:20:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'ORD-202604120001', 'jbl-flip-6-black', 5, 'Speaker is louder than expected for the size and perfect for weekend coffee shop sessions.', null::text[], '2026-04-13T18:00:00+07'::timestamptz, '2026-04-13T18:00:00+07'::timestamptz),
  ('khang.customer@ecommerce.local', 'ORD-202604120001', 'xiaomi-smart-air-fryer-45l', 4, 'Good first air fryer for a small family. App scheduling is simple and the basket size is practical.', null::text[], '2026-04-13T18:10:00+07'::timestamptz, '2026-04-13T18:10:00+07'::timestamptz)
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
