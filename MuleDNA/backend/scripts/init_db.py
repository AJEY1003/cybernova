import sys
import os

# Add the backend directory to sys.path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import engine, Base, SessionLocal
from models.models import User, Transaction, Alert, RiskScore
from datetime import datetime

def init_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if we already have data
        if db.query(User).first():
            print("Database already initialized.")
            return

        print("Inserting sample data...")
        # Sample User
        sample_user = User(name="John Doe", account_id="ACC12345")
        db.add(sample_user)

        # Sample Risk Score
        sample_risk = RiskScore(account_id="ACC12345", score=0.15)
        db.add(sample_risk)

        # Sample Transaction
        sample_tx = Transaction(
            sender="ACC12345",
            receiver="ACC67890",
            amount=5000.0,
            device_id="DEV_X100",
            ip_address="192.168.1.1"
        )
        db.add(sample_tx)

        # Sample Alert
        sample_alert = Alert(
            account_id="ACC12345",
            risk_score=0.85,
            reason="High value transaction from new device"
        )
        db.add(sample_alert)

        db.commit()
        print("Database initialized successfully with sample data.")
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
