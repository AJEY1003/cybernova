from langchain_huggingface import HuggingFaceEmbeddings

# Create a module-level singleton for HuggingFaceEmbeddings to ensure the model
# is loaded only once across the entire application runtime.
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)
