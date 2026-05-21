-- phase4_flash_sale_demo_seed.sql
-- Idempotent demo/load-test seed for Phase 4 flash sale flow.
--
-- This script is safe to run multiple times. It adds Vietnamese catalog data,
-- variants, inventory, flash sale campaigns/items, and load-test customers.
--
-- Demo load-test customer login pattern:
--   loadtest.customer001@ecommerce.local / Customer@123
--   ...
--   loadtest.customer200@ecommerce.local / Customer@123

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
  ('admin@ecommerce.local', crypt('Admin@123', gen_salt('bf', 8)), 'Quản trị hệ thống', '+84901111001', null, 'active', true, now(), now()),
  ('seller.tech@ecommerce.local', crypt('Seller@123', gen_salt('bf', 8)), 'Phạm Quốc Đạt', '+84901222002', null, 'active', true, now(), now()),
  ('seller.home@ecommerce.local', crypt('Seller@123', gen_salt('bf', 8)), 'Trần Hoàng Nam', '+84901333003', null, 'active', true, now(), now())
on conflict (email) do nothing;

insert into public.user_roles (user_id, role_code, created_at)
select u.id, seeded.role_code, now()
from (values
  ('admin@ecommerce.local', 'ADMIN'),
  ('seller.tech@ecommerce.local', 'SELLER'),
  ('seller.home@ecommerce.local', 'SELLER')
) as seeded(email, role_code)
join public.users u on u.email = seeded.email
on conflict (user_id, role_code) do nothing;

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
select
  'loadtest.customer' || lpad(seed_no::text, 3, '0') || '@ecommerce.local',
  crypt('Customer@123', gen_salt('bf', 8)),
  'Khách hàng tải thử ' || lpad(seed_no::text, 3, '0'),
  '+84909' || lpad(seed_no::text, 6, '0'),
  null,
  'active',
  true,
  now(),
  now()
from generate_series(1, 200) as series(seed_no)
on conflict (email) do update
set
  password_hash = excluded.password_hash,
  full_name = excluded.full_name,
  phone_number = excluded.phone_number,
  status = 'active',
  is_verified = true,
  updated_at = now();

insert into public.user_roles (user_id, role_code, created_at)
select u.id, 'CUSTOMER', now()
from public.users u
where u.email::text like 'loadtest.customer%@ecommerce.local'
on conflict (user_id, role_code) do nothing;

insert into public.brands as existing (name, description, logo_url, created_at, updated_at)
select seeded.name, seeded.description, seeded.logo_url, now(), now()
from (values
  ('Apple', 'Thiết bị và phụ kiện Apple chính hãng.', null),
  ('Samsung', 'Điện thoại, tai nghe và phụ kiện Samsung.', null),
  ('Xiaomi', 'Thiết bị thông minh và phụ kiện giá tốt.', null),
  ('Anker', 'Phụ kiện sạc nhanh và cáp bền bỉ.', null),
  ('Sony', 'Thiết bị âm thanh và điện tử cá nhân cao cấp.', null),
  ('Lock&Lock', 'Đồ dùng gia đình và bình giữ nhiệt phổ biến.', null),
  ('Sunhouse', 'Đồ gia dụng Việt Nam cho bếp gia đình.', null),
  ('Philips', 'Thiết bị chăm sóc cá nhân và gia dụng.', null),
  ('La Roche-Posay', 'Dược mỹ phẩm chăm sóc da nhạy cảm.', null),
  ('L''Oréal', 'Mỹ phẩm và chăm sóc cá nhân.', null),
  ('Maybelline', 'Mỹ phẩm trang điểm đại chúng.', null),
  ('Bobby', 'Sản phẩm tã và chăm sóc trẻ em.', null),
  ('Abbott', 'Sản phẩm dinh dưỡng cho mẹ và bé.', null),
  ('Thiên Long', 'Văn phòng phẩm và dụng cụ học tập.', null),
  ('Deli', 'Thiết bị văn phòng và phụ kiện làm việc.', null),
  ('Coolmate', 'Thời trang nam cơ bản, dễ mặc hằng ngày.', null),
  ('UNIQLO', 'Thời trang cơ bản chất lượng tốt.', null),
  ('Biti''s', 'Giày dép Việt Nam cho sinh hoạt và thể thao.', null),
  ('Vinamit', 'Thực phẩm sấy khô và nông sản Việt Nam.', null),
  ('Highlands Coffee', 'Cà phê rang xay và đồ uống Việt Nam.', null),
  ('OMO', 'Sản phẩm giặt giũ gia đình.', null),
  ('Mega Mall Basics', 'Dòng sản phẩm thiết yếu cho demo và flash sale.', null)
) as seeded(name, description, logo_url)
on conflict (name) do update
set
  description = coalesce(nullif(existing.description, ''), excluded.description),
  logo_url = coalesce(existing.logo_url, excluded.logo_url),
  updated_at = case
    when existing.description is null
      or existing.description = ''
      or existing.logo_url is null
    then now()
    else existing.updated_at
  end;

insert into public.categories as existing (parent_id, name, slug, description, image_url, is_active, created_at, updated_at)
select null, seeded.name, seeded.slug, seeded.description, seeded.image_url, true, now(), now()
from (values
  ('Điện tử', 'electronics', 'Điện thoại, âm thanh và phụ kiện cho nhu cầu số hằng ngày.', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80'),
  ('Nhà cửa & đời sống', 'home-living', 'Thiết bị và đồ dùng tiện ích cho gia đình hiện đại.', 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80'),
  ('Thời trang & phụ kiện', 'fashion', 'Trang phục, giày dép và phụ kiện sử dụng hằng ngày.', 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80'),
  ('Làm đẹp & chăm sóc cá nhân', 'beauty-care', 'Mỹ phẩm, chăm sóc da và thiết bị cá nhân.', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'),
  ('Mẹ & bé', 'mom-baby', 'Sản phẩm thiết yếu cho mẹ và bé.', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80'),
  ('Sách & văn phòng phẩm', 'books-stationery', 'Sách, vở và dụng cụ làm việc, học tập.', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80'),
  ('Thể thao & du lịch', 'sports-travel', 'Đồ thể thao, dã ngoại và du lịch.', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80'),
  ('Bách hóa online', 'grocery', 'Đồ uống, thực phẩm khô và sản phẩm gia đình.', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80')
) as seeded(name, slug, description, image_url)
on conflict (slug) do update
set
  name = coalesce(nullif(existing.name, ''), excluded.name),
  description = coalesce(nullif(existing.description, ''), excluded.description),
  image_url = coalesce(existing.image_url, excluded.image_url),
  is_active = existing.is_active,
  updated_at = case
    when existing.name is null
      or existing.name = ''
      or existing.description is null
      or existing.description = ''
      or existing.image_url is null
    then now()
    else existing.updated_at
  end;

insert into public.categories as existing (parent_id, name, slug, description, image_url, is_active, created_at, updated_at)
select parent.id, seeded.name, seeded.slug, seeded.description, seeded.image_url, true, now(), now()
from (values
  ('electronics', 'Điện thoại', 'smartphones', 'Điện thoại phổ thông và flagship.', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'),
  ('electronics', 'Âm thanh', 'audio', 'Tai nghe, loa di động và thiết bị âm thanh.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'),
  ('electronics', 'Phụ kiện', 'accessories', 'Cáp sạc, củ sạc và phụ kiện thiết bị.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80'),
  ('home-living', 'Nhà thông minh', 'smart-home', 'Thiết bị thông minh cho sinh hoạt hằng ngày.', 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=900&q=80'),
  ('home-living', 'Góc làm việc', 'desk-setup', 'Thiết bị hỗ trợ làm việc tại nhà.', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80'),
  ('home-living', 'Đồ bếp', 'kitchen', 'Đồ dùng bếp và thiết bị nấu ăn.', 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80'),
  ('fashion', 'Thời trang nam', 'men-fashion', 'Áo, giày và phụ kiện nam.', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80'),
  ('fashion', 'Thời trang nữ', 'women-fashion', 'Trang phục cơ bản và phụ kiện nữ.', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80'),
  ('beauty-care', 'Chăm sóc da', 'skincare', 'Sữa rửa mặt, serum và sản phẩm dưỡng da.', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80'),
  ('beauty-care', 'Trang điểm', 'makeup', 'Sản phẩm trang điểm phổ biến.', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80'),
  ('beauty-care', 'Thiết bị chăm sóc cá nhân', 'beauty-tools', 'Máy sấy tóc và thiết bị cá nhân.', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80'),
  ('mom-baby', 'Tã & chăm sóc bé', 'baby-care', 'Tã, sữa và đồ chăm sóc bé.', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80'),
  ('books-stationery', 'Sách kinh doanh', 'business-books', 'Sách phát triển bản thân và kinh doanh.', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80'),
  ('books-stationery', 'Văn phòng phẩm', 'stationery', 'Vở, bút và dụng cụ học tập.', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80'),
  ('sports-travel', 'Thể thao ngoài trời', 'outdoor-sports', 'Yoga, chạy bộ và dã ngoại.', 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=80'),
  ('grocery', 'Đồ uống & thực phẩm khô', 'dry-food-beverage', 'Cà phê, đồ khô và thực phẩm đóng gói.', 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80'),
  ('grocery', 'Chăm sóc nhà cửa', 'household-supplies', 'Nước giặt và sản phẩm vệ sinh gia đình.', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80')
) as seeded(parent_slug, name, slug, description, image_url)
join public.categories parent on parent.slug = seeded.parent_slug
on conflict (slug) do update
set
  parent_id = excluded.parent_id,
  name = coalesce(nullif(existing.name, ''), excluded.name),
  description = coalesce(nullif(existing.description, ''), excluded.description),
  image_url = coalesce(existing.image_url, excluded.image_url),
  is_active = existing.is_active,
  updated_at = case
    when existing.name is null
      or existing.name = ''
      or existing.description is null
      or existing.description = ''
      or existing.image_url is null
      or existing.parent_id is distinct from excluded.parent_id
    then now()
    else existing.updated_at
  end;

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
  seeded.product_type,
  seeded.sku,
  seeded.name,
  seeded.slug,
  seeded.short_description,
  seeded.description,
  seeded.thumbnail_url,
  seeded.base_price,
  true,
  true,
  now(),
  seeded.rating_avg,
  seeded.review_count,
  now(),
  now()
from (values
  ('audio', 'Sony', 'seller.tech@ecommerce.local', 'simple', 'PH4-SONY-XM5-BLK', 'Tai nghe Sony WH-1000XM5', 'sony-wh-1000xm5-black', 'Tai nghe chống ồn cao cấp cho làm việc và di chuyển.', 'Sony WH-1000XM5 màu đen, chống ồn chủ động, pin dài và chất âm cân bằng cho người dùng thường xuyên di chuyển.', 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=900&q=80', 6990000.00, 4.8, 128),
  ('accessories', 'Xiaomi', 'seller.tech@ecommerce.local', 'simple', 'PH4-XM-PB20K-33W', 'Pin dự phòng Xiaomi 20000mAh 33W', 'xiaomi-power-bank-20000mah-33w', 'Pin dự phòng dung lượng lớn cho điện thoại và tablet.', 'Pin dự phòng Xiaomi 20000mAh hỗ trợ sạc nhanh 33W, phù hợp du lịch và làm việc ngoài văn phòng.', 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80', 690000.00, 4.6, 89),
  ('accessories', 'Anker', 'seller.tech@ecommerce.local', 'simple', 'PH4-ANK-CABLE-100W', 'Cáp Anker USB-C 100W 1.8m', 'anker-powerline-usbc-100w-18m', 'Cáp sạc nhanh bền bỉ cho laptop và điện thoại.', 'Cáp Anker USB-C 100W dài 1.8m, dùng tốt cho laptop, tablet và điện thoại hỗ trợ sạc nhanh.', 'https://images.unsplash.com/photo-1601524909162-ae8725290836?auto=format&fit=crop&w=900&q=80', 199000.00, 4.7, 311),
  ('audio', 'Samsung', 'seller.tech@ecommerce.local', 'simple', 'PH4-SS-BUDS-FE', 'Samsung Galaxy Buds FE', 'samsung-galaxy-buds-fe', 'Tai nghe không dây nhỏ gọn cho Android.', 'Galaxy Buds FE có chống ồn chủ động, thiết kế gọn và kết nối tốt với điện thoại Samsung Galaxy.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=80', 1490000.00, 4.5, 76),
  ('kitchen', 'Lock&Lock', 'seller.home@ecommerce.local', 'simple', 'PH4-LNL-MUG-475', 'Bình giữ nhiệt Lock&Lock Metro 475ml', 'locknlock-metro-mug-475ml', 'Bình giữ nhiệt gọn, dễ cầm theo mỗi ngày.', 'Bình giữ nhiệt Lock&Lock Metro 475ml giữ nóng/lạnh tốt, phù hợp đi học, đi làm và du lịch ngắn ngày.', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80', 349000.00, 4.6, 54),
  ('kitchen', 'Sunhouse', 'seller.home@ecommerce.local', 'simple', 'PH4-SH-RICE-18L', 'Nồi cơm điện Sunhouse 1.8L', 'sunhouse-rice-cooker-18l', 'Nồi cơm điện dung tích gia đình nhỏ.', 'Nồi cơm điện Sunhouse 1.8L lòng nồi chống dính, dễ sử dụng cho bữa cơm gia đình hằng ngày.', 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=900&q=80', 890000.00, 4.4, 42),
  ('beauty-tools', 'Philips', 'seller.home@ecommerce.local', 'simple', 'PH4-PHILIPS-BHD350', 'Máy sấy tóc Philips BHD350', 'philips-hair-dryer-bhd350', 'Máy sấy tóc nhỏ gọn, có chế độ bảo vệ tóc.', 'Philips BHD350 có nhiều mức nhiệt và đầu sấy hẹp, phù hợp sử dụng tại nhà hoặc mang theo khi du lịch.', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80', 790000.00, 4.5, 63),
  ('skincare', 'La Roche-Posay', 'seller.home@ecommerce.local', 'simple', 'PH4-LRP-CLEANSER-400', 'Sữa rửa mặt La Roche-Posay Effaclar 400ml', 'la-roche-posay-effaclar-cleanser-400ml', 'Sữa rửa mặt dịu nhẹ cho da dầu mụn.', 'La Roche-Posay Effaclar 400ml làm sạch nhẹ, hỗ trợ da dầu mụn và da nhạy cảm.', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80', 425000.00, 4.7, 204),
  ('skincare', 'L''Oréal', 'seller.home@ecommerce.local', 'simple', 'PH4-LOREAL-SERUM-30', 'Serum L''Oréal Hyaluron 30ml', 'loreal-hyaluron-serum-30ml', 'Serum cấp ẩm dễ dùng cho da thường ngày.', 'Serum L''Oréal Hyaluron 30ml cấp ẩm, kết cấu nhẹ và phù hợp nhiều loại da.', 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80', 299000.00, 4.5, 97),
  ('makeup', 'Maybelline', 'seller.home@ecommerce.local', 'simple', 'PH4-MAY-FITME-120', 'Kem nền Maybelline Fit Me 120', 'maybelline-fit-me-foundation-120', 'Kem nền phổ biến cho lớp nền tự nhiên.', 'Maybelline Fit Me tông 120 phù hợp da sáng, finish tự nhiên và dễ dùng hằng ngày.', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80', 188000.00, 4.4, 133),
  ('baby-care', 'Bobby', 'seller.home@ecommerce.local', 'simple', 'PH4-BOBBY-M62', 'Tã quần Bobby size M 62 miếng', 'bobby-diapers-m62', 'Tã quần size M cho bé vận động thoải mái.', 'Tã quần Bobby size M 62 miếng, bề mặt mềm và thấm hút tốt cho bé dùng hằng ngày.', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80', 309000.00, 4.6, 71),
  ('baby-care', 'Abbott', 'seller.home@ecommerce.local', 'simple', 'PH4-ABBOTT-SIMILAC-820', 'Sữa Similac Total Comfort 820g', 'similac-total-comfort-820g', 'Sữa bột cho bé, dùng cho demo ngành mẹ và bé.', 'Sữa Similac Total Comfort 820g dùng trong bộ dữ liệu demo, giá theo VND và tồn kho rõ ràng.', 'https://images.unsplash.com/photo-1566004100631-35d015d6a491?auto=format&fit=crop&w=900&q=80', 635000.00, 4.5, 49),
  ('stationery', 'Thiên Long', 'seller.home@ecommerce.local', 'simple', 'PH4-TL-NOTE-A5', 'Sổ tay Thiên Long A5 120 trang', 'thien-long-notebook-a5-120', 'Sổ tay giá tốt cho học tập và văn phòng.', 'Sổ tay Thiên Long A5 120 trang, giấy dễ viết và phù hợp mua số lượng lớn trong flash sale.', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80', 18000.00, 4.3, 260),
  ('desk-setup', 'Deli', 'seller.tech@ecommerce.local', 'simple', 'PH4-DELI-EK820', 'Bàn phím không dây Deli EK820', 'deli-wireless-keyboard-ek820', 'Bàn phím gọn cho góc làm việc.', 'Bàn phím không dây Deli EK820 layout gọn, phù hợp làm việc văn phòng và học online.', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80', 390000.00, 4.4, 66),
  ('outdoor-sports', 'Mega Mall Basics', 'seller.home@ecommerce.local', 'simple', 'PH4-YOGA-MAT-6MM', 'Thảm yoga TPE 6mm', 'yoga-mat-tpe-6mm', 'Thảm yoga chống trượt cho tập luyện tại nhà.', 'Thảm yoga TPE 6mm có bề mặt chống trượt, dễ cuộn gọn và phù hợp người mới tập.', 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=900&q=80', 159000.00, 4.5, 88),
  ('dry-food-beverage', 'Vinamit', 'seller.home@ecommerce.local', 'simple', 'PH4-VINAMIT-MANGO-250', 'Xoài sấy Vinamit 250g', 'vinamit-dried-mango-250g', 'Đồ ăn vặt trái cây sấy đóng gói.', 'Xoài sấy Vinamit 250g, vị chua ngọt dễ ăn và phù hợp mua kèm trong đơn bách hóa.', 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?auto=format&fit=crop&w=900&q=80', 79000.00, 4.4, 112),
  ('dry-food-beverage', 'Highlands Coffee', 'seller.home@ecommerce.local', 'simple', 'PH4-HIGHLANDS-GROUND-500', 'Cà phê rang xay Highlands 500g', 'highlands-coffee-ground-500g', 'Cà phê rang xay dùng tại nhà.', 'Cà phê rang xay Highlands 500g, phù hợp pha phin hoặc máy nhỏ trong gia đình.', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80', 185000.00, 4.6, 92),
  ('household-supplies', 'OMO', 'seller.home@ecommerce.local', 'simple', 'PH4-OMO-MATIC-38', 'Nước giặt OMO Matic 3.8kg', 'omo-matic-liquid-38kg', 'Nước giặt gia đình dùng cho máy giặt.', 'Nước giặt OMO Matic 3.8kg, hương dễ chịu và phù hợp nhu cầu gia đình hằng tuần.', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80', 219000.00, 4.5, 141),
  ('accessories', 'Mega Mall Basics', 'seller.tech@ecommerce.local', 'simple', 'PH4-K6-CABLE-10K', 'Cáp USB-C Flash Sale 10K', 'ph4-k6-usbc-cable-10k', 'Sản phẩm giá thấp dành riêng cho K6 flash sale.', 'Cáp USB-C Flash Sale 10K là sản phẩm seed riêng cho kiểm thử tải hot path, tránh động vào dữ liệu thanh toán QR demo cũ.', 'https://images.unsplash.com/photo-1601524909162-ae8725290836?auto=format&fit=crop&w=900&q=80', 10000.00, 4.4, 320),
  ('men-fashion', 'Coolmate', 'seller.home@ecommerce.local', 'variant', 'PH4-CM-TEE', 'Áo thun nam Coolmate Basics', 'coolmate-basic-tee', 'Áo thun basic nhiều màu và size.', 'Áo thun nam Coolmate Basics form dễ mặc, có nhiều màu và size cho demo variant.', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', 199000.00, 4.6, 188),
  ('women-fashion', 'UNIQLO', 'seller.home@ecommerce.local', 'variant', 'PH4-UQ-AIRISM', 'Áo UNIQLO Airism cổ tròn', 'uniqlo-airism-crew-neck-tee', 'Áo thun Airism nhiều màu, nhẹ và thoáng.', 'Áo UNIQLO Airism cổ tròn chất liệu mát, phù hợp đi làm và sinh hoạt hằng ngày.', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80', 249000.00, 4.7, 154),
  ('outdoor-sports', 'Biti''s', 'seller.home@ecommerce.local', 'variant', 'PH4-BITIS-HUNTER-X', 'Giày Biti''s Hunter X Lite', 'bitis-hunter-x-lite', 'Giày sneaker nhẹ cho đi lại hằng ngày.', 'Biti''s Hunter X Lite có nhiều size, đế nhẹ và phù hợp chạy việc, đi học, đi chơi.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', 790000.00, 4.6, 122),
  ('accessories', 'Apple', 'seller.tech@ecommerce.local', 'variant', 'PH4-IP15-CASE', 'Ốp lưng iPhone 15 MagSafe', 'iphone-15-magsafe-case', 'Ốp lưng MagSafe nhiều màu cho iPhone 15.', 'Ốp lưng iPhone 15 hỗ trợ MagSafe, nhiều màu và phù hợp flash sale phụ kiện.', 'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=900&q=80', 249000.00, 4.5, 98)
) as seeded(category_slug, brand_name, seller_email, product_type, sku, name, slug, short_description, description, thumbnail_url, base_price, rating_avg, review_count)
join public.categories c on c.slug = seeded.category_slug
join public.brands b on b.name = seeded.brand_name
join public.users u on u.email = seeded.seller_email
on conflict (slug) do update
set
  category_id = excluded.category_id,
  brand_id = excluded.brand_id,
  seller_id = excluded.seller_id,
  product_type = excluded.product_type,
  sku = excluded.sku,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  thumbnail_url = excluded.thumbnail_url,
  base_price = excluded.base_price,
  active = true,
  published = true,
  published_at = excluded.published_at,
  rating_avg = excluded.rating_avg,
  review_count = excluded.review_count,
  updated_at = now();

insert into public.product_images (product_id, image_url, is_main, sort_order, created_at)
select p.id, p.thumbnail_url, true, 1, now()
from public.products p
where p.slug in (
  'sony-wh-1000xm5-black',
  'xiaomi-power-bank-20000mah-33w',
  'anker-powerline-usbc-100w-18m',
  'samsung-galaxy-buds-fe',
  'locknlock-metro-mug-475ml',
  'sunhouse-rice-cooker-18l',
  'philips-hair-dryer-bhd350',
  'la-roche-posay-effaclar-cleanser-400ml',
  'loreal-hyaluron-serum-30ml',
  'maybelline-fit-me-foundation-120',
  'bobby-diapers-m62',
  'similac-total-comfort-820g',
  'thien-long-notebook-a5-120',
  'deli-wireless-keyboard-ek820',
  'yoga-mat-tpe-6mm',
  'vinamit-dried-mango-250g',
  'highlands-coffee-ground-500g',
  'omo-matic-liquid-38kg',
  'ph4-k6-usbc-cable-10k',
  'coolmate-basic-tee',
  'uniqlo-airism-crew-neck-tee',
  'bitis-hunter-x-lite',
  'iphone-15-magsafe-case'
)
and p.thumbnail_url is not null
and not exists (
  select 1
  from public.product_images pi
  where pi.product_id = p.id
    and pi.is_main = true
);

insert into public.product_variants (
  product_id,
  sku,
  combination,
  variant_name,
  price,
  active,
  thumbnail_url,
  created_at,
  updated_at
)
select
  p.id,
  seeded.sku,
  seeded.combination,
  seeded.variant_name,
  seeded.price,
  true,
  seeded.thumbnail_url,
  now(),
  now()
from (values
  ('coolmate-basic-tee', 'PH4-CM-TEE-BLK-M', '{"color":"Đen","size":"M"}'::jsonb, 'Đen / M', 199000.00, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('coolmate-basic-tee', 'PH4-CM-TEE-BLK-L', '{"color":"Đen","size":"L"}'::jsonb, 'Đen / L', 199000.00, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('coolmate-basic-tee', 'PH4-CM-TEE-WHT-M', '{"color":"Trắng","size":"M"}'::jsonb, 'Trắng / M', 199000.00, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('coolmate-basic-tee', 'PH4-CM-TEE-WHT-XL', '{"color":"Trắng","size":"XL"}'::jsonb, 'Trắng / XL', 199000.00, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
  ('uniqlo-airism-crew-neck-tee', 'PH4-UQ-AIRISM-WHT-S', '{"color":"Trắng","size":"S"}'::jsonb, 'Trắng / S', 249000.00, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80'),
  ('uniqlo-airism-crew-neck-tee', 'PH4-UQ-AIRISM-WHT-M', '{"color":"Trắng","size":"M"}'::jsonb, 'Trắng / M', 249000.00, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80'),
  ('uniqlo-airism-crew-neck-tee', 'PH4-UQ-AIRISM-BEG-M', '{"color":"Be","size":"M"}'::jsonb, 'Be / M', 249000.00, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80'),
  ('bitis-hunter-x-lite', 'PH4-BITIS-HX-BLK-40', '{"color":"Đen","size":"40"}'::jsonb, 'Đen / 40', 790000.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'),
  ('bitis-hunter-x-lite', 'PH4-BITIS-HX-BLK-41', '{"color":"Đen","size":"41"}'::jsonb, 'Đen / 41', 790000.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'),
  ('bitis-hunter-x-lite', 'PH4-BITIS-HX-WHT-42', '{"color":"Trắng","size":"42"}'::jsonb, 'Trắng / 42', 790000.00, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'),
  ('iphone-15-magsafe-case', 'PH4-IP15-CASE-CLR', '{"color":"Trong suốt"}'::jsonb, 'Trong suốt', 249000.00, 'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=900&q=80'),
  ('iphone-15-magsafe-case', 'PH4-IP15-CASE-BLK', '{"color":"Đen"}'::jsonb, 'Đen', 249000.00, 'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=900&q=80'),
  ('iphone-15-magsafe-case', 'PH4-IP15-CASE-BLU', '{"color":"Xanh navy"}'::jsonb, 'Xanh navy', 249000.00, 'https://images.unsplash.com/photo-1601593346740-925612772716?auto=format&fit=crop&w=900&q=80')
) as seeded(product_slug, sku, combination, variant_name, price, thumbnail_url)
join public.products p on p.slug = seeded.product_slug
on conflict (product_id, combination) do update
set
  sku = excluded.sku,
  variant_name = excluded.variant_name,
  price = excluded.price,
  active = true,
  thumbnail_url = excluded.thumbnail_url,
  updated_at = now();

insert into public.product_variant_images (variant_id, image_url, is_main, sort_order, created_at)
select pv.id, pv.thumbnail_url, true, 1, now()
from public.product_variants pv
where pv.sku like 'PH4-%'
  and pv.thumbnail_url is not null
  and not exists (
    select 1
    from public.product_variant_images pvi
    where pvi.variant_id = pv.id
      and pvi.is_main = true
  );

with seeded(slug, available_qty, safety_stock) as (
  values
    ('sony-wh-1000xm5-black', 80, 5),
    ('xiaomi-power-bank-20000mah-33w', 200, 20),
    ('anker-powerline-usbc-100w-18m', 10000, 100),
    ('samsung-galaxy-buds-fe', 160, 10),
    ('locknlock-metro-mug-475ml', 250, 20),
    ('sunhouse-rice-cooker-18l', 120, 10),
    ('philips-hair-dryer-bhd350', 100, 10),
    ('la-roche-posay-effaclar-cleanser-400ml', 400, 30),
    ('loreal-hyaluron-serum-30ml', 350, 25),
    ('maybelline-fit-me-foundation-120', 300, 20),
    ('bobby-diapers-m62', 500, 30),
    ('similac-total-comfort-820g', 180, 10),
    ('thien-long-notebook-a5-120', 30000, 100),
    ('deli-wireless-keyboard-ek820', 250, 15),
    ('yoga-mat-tpe-6mm', 500, 25),
    ('vinamit-dried-mango-250g', 800, 40),
    ('highlands-coffee-ground-500g', 600, 30),
    ('omo-matic-liquid-38kg', 450, 25),
    ('ph4-k6-usbc-cable-10k', 50000, 100)
)
update public.inventory_items ii
set
  available_qty = greatest(ii.available_qty, seeded.available_qty),
  safety_stock = greatest(ii.safety_stock, seeded.safety_stock),
  updated_at = now()
from seeded
join public.products p on p.slug = seeded.slug
where ii.product_id = p.id
  and ii.variant_id is null;

with seeded(slug, available_qty, safety_stock) as (
  values
    ('sony-wh-1000xm5-black', 80, 5),
    ('xiaomi-power-bank-20000mah-33w', 200, 20),
    ('anker-powerline-usbc-100w-18m', 10000, 100),
    ('samsung-galaxy-buds-fe', 160, 10),
    ('locknlock-metro-mug-475ml', 250, 20),
    ('sunhouse-rice-cooker-18l', 120, 10),
    ('philips-hair-dryer-bhd350', 100, 10),
    ('la-roche-posay-effaclar-cleanser-400ml', 400, 30),
    ('loreal-hyaluron-serum-30ml', 350, 25),
    ('maybelline-fit-me-foundation-120', 300, 20),
    ('bobby-diapers-m62', 500, 30),
    ('similac-total-comfort-820g', 180, 10),
    ('thien-long-notebook-a5-120', 30000, 100),
    ('deli-wireless-keyboard-ek820', 250, 15),
    ('yoga-mat-tpe-6mm', 500, 25),
    ('vinamit-dried-mango-250g', 800, 40),
    ('highlands-coffee-ground-500g', 600, 30),
    ('omo-matic-liquid-38kg', 450, 25),
    ('ph4-k6-usbc-cable-10k', 50000, 100)
)
insert into public.inventory_items (
  product_id,
  variant_id,
  available_qty,
  reserved_qty,
  safety_stock,
  created_at,
  updated_at
)
select p.id, null, seeded.available_qty, 0, seeded.safety_stock, now(), now()
from seeded
join public.products p on p.slug = seeded.slug
where not exists (
  select 1
  from public.inventory_items ii
  where ii.product_id = p.id
    and ii.variant_id is null
);

with seeded(sku, available_qty, safety_stock) as (
  values
    ('PH4-CM-TEE-BLK-M', 1200, 20),
    ('PH4-CM-TEE-BLK-L', 1200, 20),
    ('PH4-CM-TEE-WHT-M', 1200, 20),
    ('PH4-CM-TEE-WHT-XL', 800, 20),
    ('PH4-UQ-AIRISM-WHT-S', 300, 15),
    ('PH4-UQ-AIRISM-WHT-M', 300, 15),
    ('PH4-UQ-AIRISM-BEG-M', 220, 10),
    ('PH4-BITIS-HX-BLK-40', 160, 10),
    ('PH4-BITIS-HX-BLK-41', 180, 10),
    ('PH4-BITIS-HX-WHT-42', 120, 8),
    ('PH4-IP15-CASE-CLR', 1500, 30),
    ('PH4-IP15-CASE-BLK', 1500, 30),
    ('PH4-IP15-CASE-BLU', 1000, 25)
)
update public.inventory_items ii
set
  available_qty = greatest(ii.available_qty, seeded.available_qty),
  safety_stock = greatest(ii.safety_stock, seeded.safety_stock),
  updated_at = now()
from seeded
join public.product_variants pv on pv.sku = seeded.sku
where ii.product_id = pv.product_id
  and ii.variant_id = pv.id;

with seeded(sku, available_qty, safety_stock) as (
  values
    ('PH4-CM-TEE-BLK-M', 1200, 20),
    ('PH4-CM-TEE-BLK-L', 1200, 20),
    ('PH4-CM-TEE-WHT-M', 1200, 20),
    ('PH4-CM-TEE-WHT-XL', 800, 20),
    ('PH4-UQ-AIRISM-WHT-S', 300, 15),
    ('PH4-UQ-AIRISM-WHT-M', 300, 15),
    ('PH4-UQ-AIRISM-BEG-M', 220, 10),
    ('PH4-BITIS-HX-BLK-40', 160, 10),
    ('PH4-BITIS-HX-BLK-41', 180, 10),
    ('PH4-BITIS-HX-WHT-42', 120, 8),
    ('PH4-IP15-CASE-CLR', 1500, 30),
    ('PH4-IP15-CASE-BLK', 1500, 30),
    ('PH4-IP15-CASE-BLU', 1000, 25)
)
insert into public.inventory_items (
  product_id,
  variant_id,
  available_qty,
  reserved_qty,
  safety_stock,
  created_at,
  updated_at
)
select pv.product_id, pv.id, seeded.available_qty, 0, seeded.safety_stock, now(), now()
from seeded
join public.product_variants pv on pv.sku = seeded.sku
where not exists (
  select 1
  from public.inventory_items ii
  where ii.product_id = pv.product_id
    and ii.variant_id = pv.id
);

update public.flash_sale_campaigns
set
  status = seeded.status,
  starts_at = seeded.starts_at,
  ends_at = seeded.ends_at,
  updated_at = now()
from (values
  ('Mega Mall Flash Sale Hôm nay', 'active', now() - interval '1 hour', now() + interval '12 hours'),
  ('K6 Hot Sale 10K Users', 'active', now() - interval '1 hour', now() + interval '24 hours'),
  ('Mega Mall Flash Sale Cuối tuần', 'scheduled', now() + interval '2 days', now() + interval '2 days 6 hours')
) as seeded(name, status, starts_at, ends_at)
where public.flash_sale_campaigns.name = seeded.name;

insert into public.flash_sale_campaigns (name, status, starts_at, ends_at, created_at, updated_at)
select seeded.name, seeded.status, seeded.starts_at, seeded.ends_at, now(), now()
from (values
  ('Mega Mall Flash Sale Hôm nay', 'active', now() - interval '1 hour', now() + interval '12 hours'),
  ('K6 Hot Sale 10K Users', 'active', now() - interval '1 hour', now() + interval '24 hours'),
  ('Mega Mall Flash Sale Cuối tuần', 'scheduled', now() + interval '2 days', now() + interval '2 days 6 hours')
) as seeded(name, status, starts_at, ends_at)
where not exists (
  select 1
  from public.flash_sale_campaigns fsc
  where fsc.name = seeded.name
);

with seeded(campaign_name, product_slug, variant_sku, sale_price, stock_limit, per_user_limit, status) as (
  values
    ('Mega Mall Flash Sale Hôm nay', 'iphone-15-magsafe-case', 'PH4-IP15-CASE-BLK', 149000.00, 500, 1, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'anker-powerline-usbc-100w-18m', null, 129000.00, 3000, 2, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'sony-wh-1000xm5-black', null, 5990000.00, 80, 1, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'coolmate-basic-tee', 'PH4-CM-TEE-BLK-M', 99000.00, 1200, 2, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'thien-long-notebook-a5-120', null, 12000.00, 15000, 5, 'active'),
    ('K6 Hot Sale 10K Users', 'ph4-k6-usbc-cable-10k', null, 8000.00, 50000, 1, 'active'),
    ('K6 Hot Sale 10K Users', 'anker-powerline-usbc-100w-18m', null, 99000.00, 10000, 1, 'active'),
    ('K6 Hot Sale 10K Users', 'thien-long-notebook-a5-120', null, 9000.00, 30000, 3, 'active'),
    ('Mega Mall Flash Sale Cuối tuần', 'samsung-galaxy-buds-fe', null, 1190000.00, 250, 1, 'scheduled'),
    ('Mega Mall Flash Sale Cuối tuần', 'bitis-hunter-x-lite', 'PH4-BITIS-HX-BLK-41', 590000.00, 180, 1, 'scheduled'),
    ('Mega Mall Flash Sale Cuối tuần', 'la-roche-posay-effaclar-cleanser-400ml', null, 329000.00, 600, 2, 'scheduled')
)
update public.flash_sale_items fsi
set
  sale_price = seeded.sale_price,
  stock_limit = seeded.stock_limit,
  per_user_limit = seeded.per_user_limit,
  status = seeded.status,
  updated_at = now()
from seeded
join public.flash_sale_campaigns fsc on fsc.name = seeded.campaign_name
join public.products p on p.slug = seeded.product_slug
left join public.product_variants pv on pv.sku = seeded.variant_sku
where fsi.campaign_id = fsc.id
  and fsi.product_id = p.id
  and coalesce(fsi.variant_id, -1) = coalesce(pv.id, -1);

with seeded(campaign_name, product_slug, variant_sku, sale_price, stock_limit, per_user_limit, status) as (
  values
    ('Mega Mall Flash Sale Hôm nay', 'iphone-15-magsafe-case', 'PH4-IP15-CASE-BLK', 149000.00, 500, 1, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'anker-powerline-usbc-100w-18m', null, 129000.00, 3000, 2, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'sony-wh-1000xm5-black', null, 5990000.00, 80, 1, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'coolmate-basic-tee', 'PH4-CM-TEE-BLK-M', 99000.00, 1200, 2, 'active'),
    ('Mega Mall Flash Sale Hôm nay', 'thien-long-notebook-a5-120', null, 12000.00, 15000, 5, 'active'),
    ('K6 Hot Sale 10K Users', 'ph4-k6-usbc-cable-10k', null, 8000.00, 50000, 1, 'active'),
    ('K6 Hot Sale 10K Users', 'anker-powerline-usbc-100w-18m', null, 99000.00, 10000, 1, 'active'),
    ('K6 Hot Sale 10K Users', 'thien-long-notebook-a5-120', null, 9000.00, 30000, 3, 'active'),
    ('Mega Mall Flash Sale Cuối tuần', 'samsung-galaxy-buds-fe', null, 1190000.00, 250, 1, 'scheduled'),
    ('Mega Mall Flash Sale Cuối tuần', 'bitis-hunter-x-lite', 'PH4-BITIS-HX-BLK-41', 590000.00, 180, 1, 'scheduled'),
    ('Mega Mall Flash Sale Cuối tuần', 'la-roche-posay-effaclar-cleanser-400ml', null, 329000.00, 600, 2, 'scheduled')
)
insert into public.flash_sale_items (
  campaign_id,
  product_id,
  variant_id,
  sale_price,
  stock_limit,
  per_user_limit,
  reserved_count,
  sold_count,
  status,
  created_at,
  updated_at
)
select
  fsc.id,
  p.id,
  pv.id,
  seeded.sale_price,
  seeded.stock_limit,
  seeded.per_user_limit,
  0,
  0,
  seeded.status,
  now(),
  now()
from seeded
join public.flash_sale_campaigns fsc on fsc.name = seeded.campaign_name
join public.products p on p.slug = seeded.product_slug
left join public.product_variants pv on pv.sku = seeded.variant_sku
where not exists (
  select 1
  from public.flash_sale_items fsi
  where fsi.campaign_id = fsc.id
    and fsi.product_id = p.id
    and coalesce(fsi.variant_id, -1) = coalesce(pv.id, -1)
);

commit;

-- Useful lookup after seeding:
-- select fsc.name, fsc.id as campaign_id, fsi.id as item_id, p.slug, pv.sku as variant_sku,
--        fsi.sale_price, fsi.stock_limit, fsi.per_user_limit, fsi.status
-- from public.flash_sale_items fsi
-- join public.flash_sale_campaigns fsc on fsc.id = fsi.campaign_id
-- join public.products p on p.id = fsi.product_id
-- left join public.product_variants pv on pv.id = fsi.variant_id
-- where fsc.name in ('Mega Mall Flash Sale Hôm nay', 'K6 Hot Sale 10K Users')
-- order by fsc.name, fsi.id;
