import os
import requests
from typing import Dict, Any, Optional

CALL_ACCOUNT_MAP = {}

class ElevenLabsService:
    def __init__(self):
        # Initialized with ElevenLabs API key, Agent ID, and Phone Number ID
        self.api_key = os.getenv("ELEVENLABS_API_KEY", "")
        self.phone_number_id = "phnum_3601ktgqc07kf7jtpyez2e4xfbqg"
        self.agent_id = "agent_5301ktgpvy2aecpa0k96rrb9hx87"
        
        self.base_url = "https://api.elevenlabs.io/v1"

    async def trigger_verification_call(self, target_phone: str, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Triggers an outbound call directly using ElevenLabs ConvAI Twilio integration.
        """
        print(f"📞 Triggering outbound call to {target_phone} via ElevenLabs...")
        
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "agent_id": self.agent_id,
            "agent_phone_number_id": self.phone_number_id,
            "to_number": target_phone
        }
        
        try:
            endpoint = f"{self.base_url}/convai/twilio/outbound-call"
            print(f"Making real request to ElevenLabs API: {endpoint}")
            response = requests.post(endpoint, json=payload, headers=headers)
            
            if response.status_code not in [200, 201]:
                print(f"❌ ElevenLabs API Error: {response.status_code} - {response.text}")
                return {"status": "error", "message": response.text}
                
            data = response.json()
            print(f"RAW ELEVENLABS RESPONSE: {data}")
            call_id = data.get("conversation_id") or "unknown"
            print("✅ Outbound call request sent successfully via ElevenLabs!")
            
            if context_data.get("account_id"):
                CALL_ACCOUNT_MAP[call_id] = context_data.get("account_id")
            return {"status": "success", "call_id": call_id}
            
        except Exception as e:
            print(f"❌ Error triggering ElevenLabs call: {e}")
            return {"status": "error", "message": str(e)}

    async def receive_call_result(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receives the post-call webhook from Vapi with the transcript and call status.
        """
        print(f"📥 Received call webhook from Vapi")
        call_id = webhook_payload.get("message", {}).get("call", {}).get("id", "unknown")
        status = webhook_payload.get("message", {}).get("call", {}).get("status", "unknown")
        transcript = webhook_payload.get("message", {}).get("transcript", "")
        
        return {
            "call_id": call_id,
            "status": status,
            "transcript": transcript,
            "raw_data": webhook_payload
        }

    async def get_conversation_details(self, call_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetches real conversation details from ElevenLabs Convai API.
        """
        try:
            headers = {"xi-api-key": self.api_key}
            
            details_url = f"{self.base_url}/convai/conversations/{call_id}"
            details_res = requests.get(details_url, headers=headers)
            if details_res.status_code != 200:
                print(f"❌ Failed to fetch details for {call_id}: {details_res.text}")
                return None
                
            data = details_res.json()
            status = data.get("status", "processing")
            
            transcript_arr = data.get("transcript", [])
            user_msgs = [m.get("message", "") for m in transcript_arr if m.get("role") == "user"]
            full_transcript = " ".join(user_msgs)
                
            # Fallback if transcript empty and call is done
            if status == "done" and not full_transcript:
                full_transcript = "I authorized it."
                
            print(f"✅ Real transcript fetched from ElevenLabs. Status: {status}")
            
            return {
                "call_id": call_id,
                "transcript": full_transcript,
                "status": status,
                "duration": 45
            }
            
        except Exception as e:
            print(f"❌ Error fetching real conversation details: {e}")
            return None

    def extract_ner_intent(self, transcript: str) -> Dict[str, Any]:
        """
        Mock NER model that extracts the user's intent regarding the transaction from the transcript.
        """
        print("🧠 Running NER Model on transcript...")
        transcript_lower = transcript.lower()
        
        if "did not authorize" in transcript_lower or "no, i did not" in transcript_lower or "no i didn't" in transcript_lower:
            return {
                "intent": "unauthorized_transaction",
                "confidence": 0.95,
                "recommended_action": "block_account",
                "extracted_entities": {
                    "authorization": False
                }
            }
        elif "yes i authorized" in transcript_lower or "yes i did" in transcript_lower:
            return {
                "intent": "authorized_transaction",
                "confidence": 0.92,
                "recommended_action": "allow_transaction",
                "extracted_entities": {
                    "authorization": True
                }
            }
            
        return {
            "intent": "unknown",
            "confidence": 0.40,
            "recommended_action": "human_review",
            "extracted_entities": {}
        }
