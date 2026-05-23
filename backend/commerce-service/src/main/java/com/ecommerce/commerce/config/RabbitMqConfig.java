package com.ecommerce.commerce.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "events.rabbit", name = "enabled", havingValue = "true", matchIfMissing = true)
public class RabbitMqConfig {

    @Bean
    TopicExchange ecommerceEventsExchange(RabbitEventProperties properties) {
        return new TopicExchange(properties.getExchange(), true, false);
    }

    @Bean
    Queue notificationEmailOrderQueue(RabbitEventProperties properties) {
        return new Queue(properties.getNotificationEmailQueue(), true);
    }

    @Bean
    Binding notificationEmailOrderBinding(Queue notificationEmailOrderQueue, TopicExchange ecommerceEventsExchange) {
        return BindingBuilder.bind(notificationEmailOrderQueue)
                .to(ecommerceEventsExchange)
                .with("order.#");
    }

    @Bean
    MessageConverter rabbitMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter rabbitMessageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(rabbitMessageConverter);
        return rabbitTemplate;
    }

    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            MessageConverter rabbitMessageConverter
    ) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(rabbitMessageConverter);
        return factory;
    }
}
