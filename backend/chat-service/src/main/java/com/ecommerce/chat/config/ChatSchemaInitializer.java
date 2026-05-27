package com.ecommerce.chat.config;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ChatSchemaInitializer {

    private final JdbcTemplate jdbcTemplate;

    public ChatSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void initialize() {
        jdbcTemplate.execute("""
                create table if not exists public.chat_conversation_deletions (
                  conversation_id bigint not null references public.chat_conversations(id) on delete cascade,
                  user_id uuid not null references public.users(id) on delete cascade,
                  deleted_at timestamp with time zone not null default now(),
                  primary key (conversation_id, user_id)
                )
                """);
        jdbcTemplate.execute("""
                create index if not exists idx_chat_conversation_deletions_user
                on public.chat_conversation_deletions (user_id, deleted_at desc)
                """);
    }
}
