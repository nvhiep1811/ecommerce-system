package com.ecommerce.commerce.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.ContainerProperties;

import java.util.Properties;

@Configuration
@ConditionalOnProperty(prefix = "flash-sale.events", name = "kafka-enabled", havingValue = "true")
public class FlashSaleKafkaConfig {

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> flashSaleKafkaBatchListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory,
            FlashSaleProperties properties
    ) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setBatchListener(true);
        factory.setConcurrency(Math.max(1, properties.getEvents().getReservationSyncConcurrency()));
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.BATCH);
        factory.getContainerProperties().setPollTimeout(properties.getEvents().getReservationSyncPollTimeoutMs());
        Properties consumerProperties = new Properties();
        consumerProperties.put(
                ConsumerConfig.MAX_POLL_RECORDS_CONFIG,
                String.valueOf(Math.max(1, properties.getEvents().getReservationSyncMaxPollRecords()))
        );
        factory.getContainerProperties().setKafkaConsumerProperties(consumerProperties);
        return factory;
    }
}
