create or replace function public.notify_chat_message_insert()
returns trigger
language plpgsql
as $$
begin
  perform pg_notify('chat_messages_insert', new.id::text);
  return new;
end;
$$;

drop trigger if exists trg_notify_chat_message_insert on public.chat_messages;

create trigger trg_notify_chat_message_insert
after insert on public.chat_messages
for each row
execute function public.notify_chat_message_insert();

create index if not exists idx_chat_conversations_customer_updated
on public.chat_conversations (customer_id, updated_at desc);

create index if not exists idx_chat_conversations_seller_updated
on public.chat_conversations (seller_id, updated_at desc);

create index if not exists idx_chat_messages_conversation_created
on public.chat_messages (conversation_id, created_at asc, id asc)
where is_deleted = false;

create unique index if not exists idx_chat_conversations_customer_seller_product_unique
on public.chat_conversations (customer_id, seller_id, product_id)
where product_id is not null;

create table if not exists public.chat_conversation_deletions (
  conversation_id bigint not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  deleted_at timestamp with time zone not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_chat_conversation_deletions_user
on public.chat_conversation_deletions (user_id, deleted_at desc);
