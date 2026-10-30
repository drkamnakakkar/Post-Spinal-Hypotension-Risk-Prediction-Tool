"""Local/deployable server for the thesis Random Forest risk calculator."""
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).parent
bundle = joblib.load(ROOT / "model" / "thesis_random_forest.joblib")
model = bundle["model"]
features = bundle["features"]

app = FastAPI(title="Spinal Hypotension Risk Screen")
app.mount("/static", StaticFiles(directory=ROOT), name="static")


class PredictionInput(BaseModel):
    age: float = Field(ge=18, le=55)
    bmi: float = Field(ge=15, le=60)
    parity: int = Field(ge=0, le=15)
    gestation: float = Field(ge=20, le=44)
    emergency: int = Field(ge=0, le=1)
    sbp: float = Field(ge=60, le=240)
    dbp: float = Field(ge=30, le=150)
    hr: float = Field(ge=35, le=220)
    map: float = Field(ge=40, le=180)
    shockIndex: float = Field(ge=0.2, le=3)


@app.get("/")
def home():
    return FileResponse(ROOT / "index.html")


@app.post("/api/predict")
def predict(payload: PredictionInput):
    if payload.dbp >= payload.sbp:
        raise HTTPException(status_code=422, detail="Diastolic BP must be below systolic BP")
    row = pd.DataFrame([[
        payload.age, payload.bmi, payload.parity, payload.gestation,
        payload.emergency, payload.sbp, payload.dbp, payload.map,
        payload.hr, payload.shockIndex,
    ]], columns=features)
    risk = float(model.predict_proba(row)[0, 1])
    return {"risk": risk, "model": "thesis-random-forest-300"}
