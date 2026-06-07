from typing import Dict, Any
from services.elevenlabs_service import ElevenLabsService

class TransactionService:
    def __init__(self, db):
        self.db = db
        self.elevenlabs = ElevenLabsService()
        
    async def process_new_transaction(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Simulates processing a new transaction in real-time.
        1. Saves transaction to DB.
        2. Checks against graph-based Mule Network detection.
        3. If suspicious, triggers ElevenLabs voice agent.
        """
        print(f"💸 Processing new transaction: {transaction.get('transaction_id')} for {transaction.get('amount')}")
        
        # 1. Insert into database
        if self.db and hasattr(self.db, 'db') and self.db.db is not None:
            self.db.db.transactions.insert_one(transaction)
        
        # 2. Graph-based Suspicion Check
        # If the transaction interacts with known mules, or forms a new suspicious cluster
        is_suspicious, reason = await self.check_graph_suspicion(transaction)
        
        if is_suspicious:
            print(f"🚨 SUSPICIOUS TRANSACTION DETECTED: {reason}")
            
            # Fetch user context for the verification engine (mocked here, would be queried from DB)
            user_context = await self.get_user_context(transaction["from_account"])
            
            # Context data to pass to ElevenLabs agent
            context_data = {
                "amount": transaction.get("amount"),
                "recipient_name": transaction.get("to_account") # In reality, get account holder name
            }
            
            # 3. Trigger ElevenLabs Call
            # We assume user_context has a phone number
            target_phone = user_context.get("phone_number", "+13074051852")
            call_result = {'call_id': 'dummy'} # REMOVED AUTOMATIC CALL
            
            return {
                "status": "suspicious_call_triggered",
                "call_id": call_result.get("call_id"),
                "reason": reason
            }
            
        return {
            "status": "cleared",
            "message": "Transaction processed normally."
        }

    async def trigger_call_only(self, transaction: Dict[str, Any]):
        """
        Triggers ElevenLabs voice agent directly, assuming graph detection was already done by the main pipeline.
        """
        print(f"📞 External Trigger: Initiating ElevenLabs call for transaction {transaction.get('transaction_id')}")
        user_context = await self.get_user_context(transaction.get("sender_upi", transaction.get("from_account", "")))
        
        kyc_profile = user_context.get("kyc_data", {})
        
        context_data = {
            "amount": transaction.get("amount"),
            "recipient_name": transaction.get("receiver_upi", transaction.get("to_account", "")),
            "kyc_occupation": kyc_profile.get("occupation", "Unknown"),
            "kyc_father_name": kyc_profile.get("parents_name", "Unknown"),
            "kyc_income": kyc_profile.get("annual_income", "Unknown")
        }
        
        # Pull phone number directly from the frontend request payload, or fallback
        target_phone = transaction.get("phone_number", user_context.get("phone_number", "+917810018691"))
        # await self.elevenlabs.trigger_verification_call(...) # REMOVED AUTOMATIC CALL


    async def check_graph_suspicion(self, transaction: Dict[str, Any]) -> tuple[bool, str]:
        """
        Real-time graph check.
        Checks if the from_account or to_account belongs to a known mule network.
        """
        from_acc = transaction.get("from_account")
        to_acc = transaction.get("to_account")
        
        # Check if either account is flagged in a mule network
        network = None
        if self.db and hasattr(self.db, 'db') and self.db.db is not None:
            network = self.db.db.mule_networks.find_one({
                "accounts": {"$in": [from_acc, to_acc]}
            })
        
        if network:
            return True, f"Account linked to known Mule Network: {network.get('network_id')}"
            
        # We can also check if this transaction suddenly connects two previously unlinked clusters
        # For simulation purposes, we'll randomly flag large transactions as suspicious
        if float(transaction.get("amount", 0)) > 50000:
             return True, "High-value transaction flagged by heuristic."
             
        return False, ""
        
    async def get_user_context(self, account_id: str) -> Dict[str, Any]:
        """
        Fetches demographic and behavioral context for the user to be used by the ML Risk Engine later.
        """
        kyc_data = {}
        if self.db and hasattr(self.db, 'get_kyc_profile'):
            kyc_data = self.db.get_kyc_profile(account_id)
            
        return {
            "account_id": account_id,
            "phone_number": kyc_data.get("phone_number", "+917810018691"),
            "kyc_data": kyc_data
        }
