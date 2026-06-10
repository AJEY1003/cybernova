import sys
import os

# Add parent directory of this file (which is backend/) to sys.path
# to ensure imports like database.connection, models.models work regardless of the Cwd.
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from dotenv import load_dotenv
load_dotenv()

from database.connection import SessionLocal
from database.neo4j_connection import driver as neo4j_driver
from rag.sync import full_sync

def main() -> None:
    """
    Main entry point to trigger the full database-to-vector-store synchronization.
    """
    print("Initializing DB session and Neo4j driver...")
    db = SessionLocal()
    try:
        print("Starting full synchronization...")
        full_sync(db, neo4j_driver)
        print("MuleDNA RAG vector sync complete.")
    except Exception as e:
        print(f"Error during synchronization process: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
