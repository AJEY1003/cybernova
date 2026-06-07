from fastapi import APIRouter, Request, BackgroundTasks, Depends
from typing import Dict, Any

from services.verification_engine import VerificationEngine
# Assuming get_db is a dependency from main or database module
# from backend.database import get_db

router = APIRouter(
    prefix="/elevenlabs",
    tags=["ElevenLabs Webhook"]
)

verification_engine = VerificationEngine()
WEBHOOK_LOGS = []

@router.get("/logs")
def get_webhook_logs():
    return WEBHOOK_LOGS

WEBHOOK_LOGS = []

@router.get("/logs")
def get_webhook_logs():
    return WEBHOOK_LOGS


@router.post("/call-completed")
async def elevenlabs_call_completed(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook endpoint hit by ElevenLabs when an outbound call completes.
    Contains the transcript and call details.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON payload"}
        
    print(f"📥 Received ElevenLabs Webhook for Call ID: {payload.get('call_id')}")
    WEBHOOK_LOGS.append(payload)
    WEBHOOK_LOGS.append(payload)
    
    # Run the verification and blocking logic in the background so we can return 200 OK to ElevenLabs immediately
    background_tasks.add_task(process_call_transcript, payload)
    
    return {"status": "received"}

async def process_call_transcript(payload: Dict[str, Any]):
    """
    Background task to process the transcript, run NER, calculate Risk Score, and block account if needed.
    """
    transcript = payload.get("transcript", "")
    call_id = payload.get("call_id")
    
    if not transcript:
        print(f"⚠️ No transcript found in webhook for call {call_id}.")
        return

    from services.elevenlabs_service import CALL_ACCOUNT_MAP
    from main import KYC_DATABASE
    from database.mongo_client import get_db

    account_id = CALL_ACCOUNT_MAP.get(call_id)
    if not account_id:
        print("⚠️ Could not find mapped account_id for this call_id! Cannot block.")
        return

    # Fetch ACTUAL KYC profile from database
    db = get_db()
    kyc_profile = KYC_DATABASE.get(account_id) or db.get_kyc_profile(account_id) or {}

    expected_context = {
        "amount": 50000,  # Cascade suspicious transaction amount
        "receiver_name": "Unknown Entity",
        "age": kyc_profile.get("age", 25),
        "marital_status": kyc_profile.get("marital_status", "single").lower(),
        "daily_wage": 500 if "2.5" in str(kyc_profile.get("annual_income", "")) else 2000,
        "occupation": kyc_profile.get("occupation", "unknown").lower()
    }
    
    # 1. Run NER Extraction
    extracted_data = await verification_engine.perform_ner_extraction(transcript, expected_context)
    
    # 2. Calculate Risk Score
    risk_result = await verification_engine.calculate_risk_score(extracted_data, expected_context)
    
    # 3. Block Account if necessary
    if risk_result.get("should_block"):
        print(f"🚫 ACTION REQUIRED: Blocking account due to high risk score ({risk_result['risk_score']}).")
        print(f"Reasons: {risk_result['reasons']}")
        
        # Actually block in database and application state!
        from database.mongo_client import get_db
        from services.elevenlabs_service import CALL_ACCOUNT_MAP
        from main import STATE
        db = get_db()
        
        account_id = CALL_ACCOUNT_MAP.get(call_id)
        if account_id:
            # Update state
            for cluster in STATE.get("clusters", []):
                if account_id in cluster.get("account_statuses", {}):
                    cluster["account_statuses"][account_id] = "BLOCKED"
                    break
            # Update DB
            if db.connected:
                db.update_account_status(account_id, "BLOCKED")
                print(f"✅ Account {account_id} successfully blocked in MuleShieldDB.")
            else:
                print(f"✅ Account {account_id} logically blocked in STATE, but MongoDB not connected.")
        else:
            print("⚠️ Could not find mapped account_id for this call_id! Cannot block.")
    else:
        print(f"✅ Call verified. Risk score ({risk_result['risk_score']}) is below threshold. Account remains active.")
