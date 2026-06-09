"""
Kafka Consumer for MuleDNA Phase 8.
Listens to the 'transactions' topic and runs full fraud detection pipeline.
Runs as a background thread alongside FastAPI.
"""

import json
import logging
import threading
from datetime import datetime
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

logger = logging.getLogger(__name__)

KAFKA_BROKER = "localhost:9092"
TOPIC = "transactions"

def process_message(message_data: dict):
    """
    Runs full fraud detection pipeline on incoming Kafka message.
    Has its own DB session since it runs in a separate thread.
    """
    try:
        from database.connection import SessionLocal
        from models.models import Transaction, Alert, RiskScore
        from services.fraud_detector import FraudDetector
        from services.ml_service import MLService

        db = SessionLocal()
        try:
            tx_id = message_data.get("id")
            sender = message_data.get("sender")
            receiver = message_data.get("receiver")
            amount = message_data.get("amount", 0)
            device_id = message_data.get("device_id", "UNKNOWN")
            ip_address = message_data.get("ip_address", "UNKNOWN")

            logger.info(f"[Kafka Consumer] Processing tx {tx_id}: {sender} → {receiver} (₹{amount})")

            # 1. Run Rule-Based Detection
            tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
            if tx:
                is_alert, risk_score, reasons = FraudDetector.process_transaction(db, tx)

                # 2. Run ML Prediction
                hour = datetime.utcnow().hour
                try:
                    ml_result = MLService.predict({
                        "amount": amount,
                        "tx_frequency_5min": 1,
                        "is_new_beneficiary": 1 if "New beneficiary" in str(reasons) else 0,
                        "rapid_in_out": 1 if "Rapid" in str(reasons) else 0,
                        "hour_of_day": hour,
                        "ip_change": 0,
                        "device_change": 0,
                        "num_connections": 0
                    })
                    ml_score = ml_result.get("combined_risk_score", 0)
                    ml_verdict = ml_result.get("verdict", "NORMAL")
                    logger.info(f"[Kafka Consumer] ML verdict for tx {tx_id}: {ml_verdict} (score={ml_score})")
                except Exception as ml_err:
                    logger.warning(f"ML prediction skipped: {ml_err}")

                db.commit()
                logger.info(f"[Kafka Consumer] tx {tx_id} processed. Risk score: {risk_score}. Alert: {is_alert}")
            else:
                logger.warning(f"[Kafka Consumer] Transaction {tx_id} not found in DB.")
        finally:
            db.close()

    except Exception as e:
        logger.error(f"[Kafka Consumer] Error processing message: {e}")


def start_consumer():
    """
    Starts the Kafka consumer in a blocking loop.
    Designed to run as a daemon thread.
    """
    try:
        consumer = KafkaConsumer(
            TOPIC,
            bootstrap_servers=KAFKA_BROKER,
            group_id="muledna-fraud-detector",
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            consumer_timeout_ms=1000  # Poll every 1 second
        )
        logger.info(f"[Kafka Consumer] Listening on topic '{TOPIC}'...")

        while True:
            for message in consumer:
                process_message(message.value)

    except NoBrokersAvailable:
        logger.warning("[Kafka Consumer] Kafka broker unavailable. Consumer not started.")
    except Exception as e:
        logger.error(f"[Kafka Consumer] Fatal error: {e}")


def start_consumer_thread():
    """Starts the consumer as a background daemon thread."""
    thread = threading.Thread(target=start_consumer, daemon=True)
    thread.start()
    logger.info("[Kafka Consumer] Background thread started.")
    return thread
