import os
from dotenv import load_dotenv
from langchain_huggingface import HuggingFaceEndpointEmbeddings

load_dotenv()

hf_token = os.getenv("HUGGINGFACEHUB_API_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")

if not hf_token:
    print("WARNING: HUGGINGFACEHUB_API_TOKEN is not set. Hugging Face API might fail.")

# Create a module-level singleton for HuggingFaceEndpointEmbeddings to ensure the model
# uses the API instead of downloading a 90MB local model.
embeddings = HuggingFaceEndpointEmbeddings(
    model="sentence-transformers/all-MiniLM-L6-v2",
    task="feature-extraction",
    huggingfacehub_api_token=hf_token,
)
