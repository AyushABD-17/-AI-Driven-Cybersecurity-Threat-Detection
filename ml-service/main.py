"""
FastAPI Machine Learning Service
Scoring anomalies using Isolation Forest and classifying attack types
using Random Forest. Fully integrated via Redis Pub/Sub.
"""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

import joblib
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import redis.asyncio as redis
from feature_engineering import ATTACK_LABEL_REVERSE, transform_single

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

MODEL_DIR = os.getenv("MODEL_PATH", "./models")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Global model state
models = {}


def load_models():
    try:
        iso_path = os.path.join(MODEL_DIR, "isolation_forest.pkl")
        clf_path = os.path.join(MODEL_DIR, "random_forest.pkl")
        models["isolation_forest"] = joblib.load(iso_path)
        models["random_forest"] = joblib.load(clf_path)
        logger.info("✅ Models loaded successfully from disk.")
    except Exception as e:
        logger.error(f"❌ Failed to load models: {e}")
        # Not exiting immediately because this could be a bootstrap scenario
        models["isolation_forest"] = None
        models["random_forest"] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup
    load_models()
    
    # Initialize Redis connection for background tasks
    global redis_client
    try:
        redis_client = await redis.from_url(REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("✅ Connected to Redis.")
        # Start subscriber loop in background
        app.state.redis_task = asyncio.create_task(redis_subscriber_loop(redis_client))
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        
    yield
    
    # Teardown
    if hasattr(app.state, 'redis_task'):
        app.state.redis_task.cancel()
    if redis_client:
        await redis_client.close()
        logger.info("❌ Redis connection closed.")


app = FastAPI(title="ML Threat Detection Service", lifespan=lifespan)

# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class LogEvent(BaseModel):
    src_ip: str
    dst_ip: str
    protocol: str = "TCP"
    duration: float = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    flag: str = "SF"
    src_port: int = 0
    dst_port: int = 0
    num_failed_logins: int = 0
    is_host_login: bool = False
    is_guest_login: bool = False
    count: int = 0
    srv_count: int = 0
    timestamp: str | None = None
    label: str | None = None

class ScoredEvent(LogEvent):
    anomaly_score: float
    is_anomaly: bool
    attack_type: str
    confidence: float
    event_timestamp: str | None = None

# ── Core Scoring Logic ───────────────────────────────────────────────────────

def score_event(log_dict: dict) -> dict:
    """Passes raw log through feature engineering and model inference."""
    try:
        features = transform_single(log_dict)
        features_np = [features]  # 2D array for sklearn

        # 1. Isolation Forest Scoring (-1 is anomaly, 1 is normal)
        iso = models.get("isolation_forest")
        if not iso:
            raise ValueError("Isolation Forest model not loaded")
        
        # decision_function: lower is more anomalous (typically < 0)
        anomaly_score = float(iso.decision_function(features_np)[0])
        # Force a generic threshold of -0.05 for this demo; lower = stricter
        # Our bootstrap model often predicts tightly around normal.
        is_anomaly = anomaly_score < -0.05
        
        # 2. Attack Classification (only if anomalous)
        attack_type = "normal"
        confidence = 1.0

        if is_anomaly:
            clf = models.get("random_forest")
            if clf:
                # Predict attack class
                class_pred = clf.predict(features_np)[0]
                probs = clf.predict_proba(features_np)[0]
                
                # Retrieve label name
                predicted_label = ATTACK_LABEL_REVERSE.get(int(class_pred), "unknown")
                
                attack_type = predicted_label
                confidence = float(max(probs))
            else:
                attack_type = "unknown"
                confidence = 0.0

        scored = log_dict.copy()
        scored["anomaly_score"] = anomaly_score
        scored["is_anomaly"] = is_anomaly
        scored["attack_type"] = attack_type
        scored["confidence"] = confidence
        
        # Normalize timestamp field for Node.js backend
        scored["event_timestamp"] = scored.pop("timestamp", None)
        
        return scored
    except Exception as e:
        logger.error(f"Scoring error: {e}")
        # Default fallback
        fallback = log_dict.copy()
        fallback.update({
            "anomaly_score": 0.0,
            "is_anomaly": False,
            "attack_type": "error",
            "confidence": 0.0,
            "event_timestamp": log_dict.get("timestamp")
        })
        return fallback

# ── Redis Background Subscriber ──────────────────────────────────────────────

async def redis_subscriber_loop(client: redis.Redis):
    """Subscribes to logs:raw, scores logs, publishes to logs:scored."""
    pubsub = client.pubsub()
    await pubsub.subscribe("logs:raw")
    logger.info("🎧 Subscribed to Redis channel: logs:raw")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    payload = message["data"]
                    log_dict = json.loads(payload)
                    
                    # Offload strictly synchronous scoring to not block async loop
                    # But since it's just one sample, it's fast enough to run synchronously here
                    scored = score_event(log_dict)
                    
                    await client.publish("logs:scored", json.dumps(scored))
                except json.JSONDecodeError:
                    logger.error("Failed to decode JSON from Redis")
                except Exception as e:
                    logger.error(f"Subscriber processing error: {e}")
    except asyncio.CancelledError:
        logger.info("Redis subscriber loop gracefully stopped.")
    finally:
        await pubsub.unsubscribe("logs:raw")

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/score", response_model=ScoredEvent)
def score_single(event: LogEvent):
    """Fallback REST endpoint for synchronous scoring (used for testing)."""
    if not models.get("isolation_forest"):
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    scored = score_event(event.model_dump())
    return scored

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "models_loaded": bool(models.get("isolation_forest")),
    }

@app.post("/model/reload")
def reload_model_endpoint():
    load_models()
    return {"status": "success", "message": "Models reloaded from disk"}
