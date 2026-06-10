from typing import Any
from rag.document_builder import build_account_document
from rag.vector_store import upsert_account, upsert_batch

def full_sync(db, neo4j_driver: Any) -> None:
    """
    Performs a full synchronization by querying all unique accounts from MongoDB,
    building documents, and upserting them to Qdrant in batches of 20.
    """
    accounts = set()
    for user in db.users.find({}, {"account_id": 1}):
        accounts.add(user.get("account_id"))
    for tx in db.transactions.find({}, {"sender": 1, "receiver": 1}):
        if tx.get("sender"):
            accounts.add(tx["sender"])
        if tx.get("receiver"):
            accounts.add(tx["receiver"])
            
    account_ids = list(accounts)
    total_accounts = len(account_ids)
    
    batch_size = 20
    for i in range(0, total_accounts, batch_size):
        batch_ids = account_ids[i:i + batch_size]
        docs = []
        for account_id in batch_ids:
            try:
                doc = build_account_document(account_id, db, neo4j_driver)
                docs.append(doc)
            except Exception as e:
                print(f"Error building document for account {account_id} during full sync: {e}")
        
        try:
            upsert_batch(docs)
        except Exception as e:
            print(f"Error upserting batch to Qdrant: {e}")
            
    print(f"Full sync complete: {total_accounts} accounts indexed.")

def sync_single_account(account_id: str, db, neo4j_driver: Any) -> None:
    """
    Synchronizes a single account profile to the Qdrant vector store.
    This can be hooked into the Kafka consumer or event triggers.
    """
    try:
        doc = build_account_document(account_id, db, neo4j_driver)
        upsert_account(doc)
        print(f"Synced account {account_id} to Qdrant.")
    except Exception as e:
        print(f"Error syncing account {account_id}: {e}")
