from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models.models import UserActivity, RiskScore

class BehavioralAnalyzer:

    @staticmethod
    def extract_features(db: Session, account_id: str, current_ip: str, current_device: str):
        """
        Extracts behavioral features for an account and returns a risk score (0-30).
        Features:
          - Login time anomaly (activity between midnight and 5AM = +15 pts)
          - Activity frequency spike (>5 events in 10 mins = +10 pts)
          - IP/Device change (different IP or device from last event = +10 pts)
        """
        score = 0
        reasons = []
        now = datetime.utcnow()

        # Feature 1: Login Time Anomaly (midnight to 5AM IST = ~6:30PM to 11:30PM UTC)
        # Using UTC: unusual hours are 18:30 to 23:30 UTC (which is 12AM–5AM IST)
        if now.hour >= 18 or now.hour < 0:
            # Simpler: flag if UTC hour is between 18 (midnight IST) and 23 (5AM IST)
            if 18 <= now.hour <= 23:
                score += 15
                reasons.append(f"Unusual login time: {now.strftime('%H:%M')} UTC (midnight–5AM IST)")

        # Feature 2: Activity Frequency Spike (>5 events in 10 minutes)
        ten_mins_ago = now - timedelta(minutes=10)
        recent_events = db.query(UserActivity).filter(
            UserActivity.account_id == account_id,
            UserActivity.timestamp >= ten_mins_ago
        ).count()

        if recent_events >= 5:
            score += 10
            reasons.append(f"Activity spike: {recent_events} events in 10 mins")

        # Feature 3: IP/Device Change from last known activity
        last_activity = db.query(UserActivity).filter(
            UserActivity.account_id == account_id
        ).order_by(UserActivity.timestamp.desc()).first()

        if last_activity:
            if last_activity.ip_address and last_activity.ip_address != current_ip:
                score += 5
                reasons.append(f"IP change: {last_activity.ip_address} → {current_ip}")
            if last_activity.device_id and last_activity.device_id != current_device:
                score += 5
                reasons.append(f"Device change: {last_activity.device_id} → {current_device}")

        return min(score, 30), reasons

    @staticmethod
    def log_and_score(db: Session, account_id: str, event_type: str, ip_address: str, device_id: str):
        """
        Logs an activity event, calculates behavioral risk, and updates the risk score.
        """
        # Score it BEFORE logging to avoid counting itself
        behavioral_score, reasons = BehavioralAnalyzer.extract_features(
            db, account_id, ip_address, device_id
        )

        # Log this activity
        new_event = UserActivity(
            account_id=account_id,
            event_type=event_type,
            ip_address=ip_address,
            device_id=device_id
        )
        db.add(new_event)

        # Update the RiskScore with behavioral contribution
        if behavioral_score > 0:
            existing_risk = db.query(RiskScore).filter(RiskScore.account_id == account_id).first()
            behavioral_contribution = behavioral_score / 100.0

            if existing_risk:
                existing_risk.score = min(existing_risk.score + behavioral_contribution, 1.0)
            else:
                db.add(RiskScore(account_id=account_id, score=behavioral_contribution))

        db.commit()
        return behavioral_score, reasons
