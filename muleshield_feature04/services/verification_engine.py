import random
import json
from typing import Dict, Any

class VerificationEngine:
    """
    Handles Named Entity Recognition (NER) and ML Risk Scoring
    for the voice agent's conversation transcript, using a comprehensive 
    set of fraud-detection data points.
    """
    
    def __init__(self):
        self.ner_model_loaded = True
        self.risk_model_loaded = True

    async def perform_ner_extraction(self, transcript: str, expected_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simulates an advanced NER/NLP model extracting behavioral, demographic, 
        and transactional data points from the transcript.
        """
        print(f"🧠 Running Advanced NLP/NER extraction on transcript: {transcript[:50]}...")
        
        transcript_lower = transcript.lower()
        
        extracted_data = {
            # --- 1. Transaction Facts (Stated vs Actual) ---
            "authorized": " did not " not in transcript_lower and " didn't " not in transcript_lower and " unauthorized " not in transcript_lower,
            "stated_amount": expected_context.get("amount", 0), 
            "stated_receiver": "friend" if "friend" in transcript_lower else "business" if "business" in transcript_lower else expected_context.get("receiver_name", "Unknown"),
            "stated_purpose": "business" if "business" in transcript_lower else "education" if "tuition" in transcript_lower else "personal", 
            
            # --- 2. Behavioral & Psychological Indicators ---
            # Signs of duress or coercion (e.g., "police", "safe account", "arrest")
            "duress_detected": any(word in transcript_lower for word in ["police", "arrest", "safe account", "hurry"]),
            # Signs of coaching (e.g., "what should I say?", background voices)
            "coaching_detected": "what do i say" in transcript_lower,
            # Hesitation or confusion (lots of "um", "uh", "I don't know")
            "high_hesitation": transcript_lower.count("um") + transcript_lower.count("uh") > 3,
            
            # --- 3. Demographic/Profile Discrepancies ---
            # Stated purpose conflicts with profile (e.g., single person paying daughter's fees)
            "demographic_conflict": ("daughter" in transcript_lower and expected_context.get("marital_status") == "single"),
            # Technical knowledge mismatch (e.g., elderly user doing complex API transfers)
            "tech_knowledge_mismatch": ("api" in transcript_lower and expected_context.get("age", 30) > 70),
            
            # --- 4. Relationship & Context ---
            "prior_interaction": False,
            "knows_receiver_personally": False,
            
            # --- 5. Operational Discrepancies ---
            # Income mismatch (e.g., shopkeeper sending 10x daily wage)
            "amount_vs_income_ratio": float(expected_context.get("amount", 0)) / expected_context.get("daily_wage", 1000),
        }
            
        return extracted_data

    async def calculate_risk_score(self, extracted_data: Dict[str, Any], expected_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates a risk score from 0.0 to 1.0 based on the comprehensive extracted data points.
        """
        print("🧮 Calculating ML Risk Score based on advanced data points...")
        
        score = 0.0
        reasons = []
        
        # 1. Base Authorization
        if not extracted_data.get("authorized"):
            score += 0.9
            reasons.append("CRITICAL: User denied authorizing the transaction.")
            
        # 2. Fact Mismatches
        if str(extracted_data.get("stated_amount")) != str(expected_context.get("amount")):
            score += 0.15
            reasons.append("Amount mismatch: Stated amount differs from actual.")
        if str(extracted_data.get("stated_receiver")).lower() != str(expected_context.get("receiver_name")).lower():
            score += 0.15
            reasons.append("Receiver mismatch: User does not know the true receiver.")
            
        # 3. Psychological & Behavioral (High Risk Fraud Indicators)
        if extracted_data.get("duress_detected"):
            score += 0.5
            reasons.append("Duress Indicator: Transcript contains words associated with scam coercion (e.g. police, safe account).")
        if extracted_data.get("coaching_detected"):
            score += 0.4
            reasons.append("Coaching Indicator: User appears to be coached by a third party.")
        if extracted_data.get("high_hesitation"):
            score += 0.1
            reasons.append("Hesitation: High level of confusion or hesitation in speech.")
            
        # 4. Profile & Demographic Discrepancies
        if extracted_data.get("demographic_conflict"):
            score += 0.3
            reasons.append("Demographic Conflict: Stated purpose contradicts known user profile.")
            
        # Additional KYC check: if they mention a profession that contradicts KYC
        transcript_lower = str(extracted_data.get("stated_purpose", "")).lower() + str(extracted_data.get("stated_receiver", "")).lower()
        kyc_occ = expected_context.get("occupation", "").lower()
        if "business" in transcript_lower and "student" in kyc_occ:
            score += 0.4
            reasons.append("KYC Mismatch: Student claims to be paying for business invoices.")
        if "education" in transcript_lower and "retired" in kyc_occ:
            score += 0.4
            reasons.append("KYC Mismatch: Retired person paying tuition fees (anomaly).")
            
        # Additional KYC check: if they mention a profession that contradicts KYC
        transcript_lower = str(extracted_data.get("stated_purpose", "")).lower() + str(extracted_data.get("stated_receiver", "")).lower()
        kyc_occ = expected_context.get("occupation", "").lower()
        if "business" in transcript_lower and "student" in kyc_occ:
            score += 0.4
            reasons.append("KYC Mismatch: Student claims to be paying for business invoices.")
        if "education" in transcript_lower and "retired" in kyc_occ:
            score += 0.4
            reasons.append("KYC Mismatch: Retired person paying tuition fees (anomaly).")
        if extracted_data.get("tech_knowledge_mismatch"):
            score += 0.2
            reasons.append("Technical Mismatch: User age/profile conflicts with the nature of the digital transfer.")
            
        # 5. Financial Discrepancies
        ratio = extracted_data.get("amount_vs_income_ratio", 0)
        if ratio > 5.0:
            score += 0.3
            reasons.append(f"Financial Anomaly: Transaction is {ratio:.1f}x the user's daily wage.")
            
        # 6. Relationship Context
        if not extracted_data.get("prior_interaction") and not extracted_data.get("knows_receiver_personally"):
            score += 0.1
            reasons.append("First-time transaction to an unknown entity.")
            
        # Cap score at 1.0
        final_score = min(score, 1.0)
        
        # Threshold for blocking lowered so KYC mismatches trigger it easily
        should_block = final_score >= 0.40
        
        result = {
            "risk_score": final_score,
            "should_block": should_block,
            "reasons": reasons
        }
        
        print(f"✅ Risk calculation complete. Score: {final_score:.2f}, Block: {should_block}")
        return result
