-- V002__backfill_address_ward_district_country.sql
-- Migration: Backfill ward, district, country for existing addresses
-- Date: 2026-04-14
-- Purpose: Align address schema with updated contract (ward, district, country fields)
begin;

-- Step 1: Ensure all addresses have country set to 'Vietnam'
update public.addresses
set
    country = 'Vietnam'
where
    country is null
    or country = '';

-- Step 2: Fix malformed city field that contains district and ward
-- NOTE: city SHOULD be province/city name (e.g., "Ho Chi Minh City", "Da Nang")
-- If city incorrectly contains "District, Ward" format, extract and fix it
update public.addresses
set
    district = case
        when city like '%,%' then trim(split_part (city, ',', 1))
        else district
    end,
    ward = case
        when city like '%,%' then trim(split_part (city, ',', 2))
        else ward
    end,
    city = case
        when city like '%,%'
        and province is not null then province
        when city like '%,%' then 'Vietnam'
        else city
    end
where
    city is not null
    and city like '%,%';

-- Step 3: Log the results (informational query - shows what was backfilled)
-- SELECT 
--   COUNT(*) as total_addresses,
--   COUNT(CASE WHEN ward IS NOT NULL THEN 1 END) as with_ward,
--   COUNT(CASE WHEN district IS NOT NULL THEN 1 END) as with_district,
--   COUNT(CASE WHEN country IS NOT NULL THEN 1 END) as with_country
-- FROM public.addresses;
commit;

-- Verification query (run separately):
-- SELECT id, receiver_name, address_line, ward, district, city, province, country, is_default
-- FROM public.addresses
-- ORDER BY created_at DESC
-- LIMIT 10;