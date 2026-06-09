"""
Kafka Producer for MuleDNA Phase 8.
Publishes transaction events to the 'transactions' Kafka topic.
"""

import json
import logging
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

logger = logging.getLogger(__name__)

KAFKA_BROKER = "localhost:9092"
TOPIC = "transactions"

_producer = None

def get_producer():
    global _producer
    if _producer is None:
        try:
            _producer = KafkaProducer(
                bootstrap_servers=KAFKA_BROKER,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                acks="all",                  # Wait for all replicas to confirm
                retries=3,                   # Retry on failure
                max_block_ms=5000           # Don't hang if Kafka is down
            )
            logger.info("Kafka producer connected.")
        except NoBrokersAvailable:
            logger.warning("Kafka broker not available. Producer disabled.")
            _producer = None
    return _producer

def publish_transaction(transaction_data: dict):
    """
    Publishes a transaction event to the Kafka 'transactions' topic.
    Fails silently if Kafka is unavailable (system still works without it).
    """
    producer = get_producer()
    if producer is None:
        logger.warning(f"Kafka unavailable. Transaction {transaction_data.get('id')} not published.")
        return False
    try:
        future = producer.send(TOPIC, value=transaction_data)
        producer.flush(timeout=2)
        logger.info(f"Published transaction {transaction_data.get('id')} to Kafka topic '{TOPIC}'")
        return True
    except Exception as e:
        logger.error(f"Failed to publish to Kafka: {e}")
        return False
