from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from models.models import Transaction, Alert, RiskScore, User

class FraudDetector:
    @staticmethod
    def calculate_risk_score(db: Session, sender_id: str, receiver_id: str, amount: float, current_tx_id: int):
        score = 0
        reasons = []
        
        # Rule 1: High Transaction Frequency (> 3 in 5 minutes)
        # We exclude the current transaction from the count to see "previous" frequency
        five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
        recent_tx_count = db.query(Transaction).filter(
            Transaction.sender == sender_id,
            Transaction.timestamp >= five_mins_ago,
            Transaction.id != current_tx_id  # Exclude self
        ).count()
        
        if recent_tx_count >= 2: # If there were already 2, this is the 3rd+
            score += 40
            reasons.append(f"High frequency: {recent_tx_count + 1} tx in 5 mins")

        # Rule 2: Sudden Large Transaction (> 50,000)
        if amount > 50000:
            score += 30
            reasons.append(f"Large transaction: {amount}")

        # Rule 3: New Beneficiary Addition
        # Check if sender has ever sent to this receiver BEFORE this transaction
        previous_interaction = db.query(Transaction).filter(
            Transaction.sender == sender_id,
            Transaction.receiver == receiver_id,
            Transaction.id != current_tx_id  # Exclude self
        ).first()
        
        if not previous_interaction:
            score += 20
            reasons.append("First-time interaction with beneficiary")

        # Rule 4: Rapid In-and-Out (Account receives and sends in < 1 hour)
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        # Check if the sender received a similar amount recently (excluding self if it was a self-transfer, though unlikely)
        recent_receipt = db.query(Transaction).filter(
            Transaction.receiver == sender_id,
            Transaction.timestamp >= one_hour_ago,
            Transaction.id != current_tx_id
        ).first()
        
        if recent_receipt:
            score += 35
            reasons.append("Rapid in-and-out transfer detected")

        # Cap score at 100
        final_score = min(score, 100)
        
        return final_score, reasons

    @staticmethod
    def process_transaction(db: Session, transaction: Transaction):
        # Flush to DB so the current transaction is visible for history checks (Rule 1 & 4)
        db.flush()
        
        # Calculate risk (returns integer 0-100)
        risk_score, reasons = FraudDetector.calculate_risk_score(
            db, 
            transaction.sender, 
            transaction.receiver, 
            transaction.amount,
            transaction.id
        )
        
        # Convert to decimal for DB storage (0.0 to 1.0)
        db_risk_score = risk_score / 100.0
        
        # Update Risk Score Table
        existing_risk = db.query(RiskScore).filter(RiskScore.account_id == transaction.sender).first()
        if existing_risk:
            # Update score (keeping it as a moving weight)
            existing_risk.score = (existing_risk.score + db_risk_score) / 2
        else:
            new_risk = RiskScore(account_id=transaction.sender, score=db_risk_score)
            db.add(new_risk)

        # Categorize Risk Level
        if risk_score >= 70:
            level = "HIGH"
        elif risk_score >= 30:
            level = "MEDIUM"
        else:
            level = "LOW"

        # Create Alert (We now log All transactions as events for forensic timeline)
        new_alert = Alert(
            account_id=transaction.sender,
            risk_score=db_risk_score,
            risk_level=level,
            reason="; ".join(reasons) if reasons else "Normal Transaction"
        )
        db.add(new_alert)
        
        return (level == "HIGH"), risk_score, reasons
