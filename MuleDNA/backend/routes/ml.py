from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ml_service import MLService

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

class PredictRequest(BaseModel):
    amount: float
    tx_frequency_5min: int = 0
    is_new_beneficiary: int = 0  # 0 or 1
    rapid_in_out: int = 0         # 0 or 1
    hour_of_day: int = 12         # 0-23
    ip_change: int = 0            # 0 or 1
    device_change: int = 0        # 0 or 1
    num_connections: int = 0

@router.post("/predict")
def predict_fraud(request: PredictRequest):
    """
    Predicts fraud probability for a given transaction feature set.
    Returns RandomForest probability, IsolationForest anomaly flag, and combined risk score.
    """
    try:
        result = MLService.predict(request.model_dump())
        return {
            "input_features": request.model_dump(),
            "prediction": result
        }
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )

@router.get("/status")
def ml_status():
    """Checks if the ML models are loaded and ready."""
    try:
        MLService.load_models()
        return {"status": "ready", "models": ["fraud_model.pkl", "anomaly_model.pkl", "scaler.pkl"]}
    except FileNotFoundError as e:
        return {"status": "not_trained", "message": str(e)}
