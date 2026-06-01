-- Phase 6: PostgreSQL performance fixes.
-- These indexes cover hot foreign-key lookups and the flash-sale projection cleanup path
-- used by commerce-service.

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_message_id
  ON public.chat_messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flash_sale_items_variant_id
  ON public.flash_sale_items(variant_id)
  WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_order_id
  ON public.flash_sale_reservations(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_projection_cleanup
  ON public.flash_sale_reservations(campaign_id, item_id)
  WHERE order_id IS NULL;
