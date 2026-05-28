package com.ecommerce.commerce.config;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
public class KafkaConsumerConfig {

    @Bean
    CommonErrorHandler kafkaCommonErrorHandler(
            KafkaOperations<Object, Object> kafkaOperations,
            KafkaEventProperties properties
    ) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaOperations,
                (record, exception) -> deadLetterTopic(record, properties)
        );
        long retries = Math.max(0, properties.getRetryMaxAttempts() - 1);
        return new DefaultErrorHandler(
                recoverer,
                new FixedBackOff(Math.max(0, properties.getRetryBackoffMs()), retries)
        );
    }

    @Bean
    ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory,
            CommonErrorHandler kafkaCommonErrorHandler,
            KafkaEventProperties properties
    ) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(kafkaCommonErrorHandler);
        factory.setConcurrency(Math.max(1, properties.getListenerConcurrency()));
        return factory;
    }

    private TopicPartition deadLetterTopic(
            ConsumerRecord<?, ?> record,
            KafkaEventProperties properties
    ) {
        return new TopicPartition(record.topic() + properties.getDeadLetterTopicSuffix(), record.partition());
    }
}
