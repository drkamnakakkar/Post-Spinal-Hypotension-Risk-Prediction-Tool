"""Train the thesis Random Forest without copying patient records into this project."""
import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

FEATURES = [
    "age_years", "bmi", "parity", "gestational_age_weeks", "emergency",
    "preop_sbp_mmhg", "preop_dbp_mmhg", "preop_map_mmhg", "preop_hr_bpm",
    "shock_index",
]

parser = argparse.ArgumentParser()
parser.add_argument("input_xlsx", type=Path)
parser.add_argument("--output", type=Path, default=Path("model/thesis_random_forest.joblib"))
args = parser.parse_args()

data = pd.read_excel(args.input_xlsx)
data["severe_hypotension"] = (
    (data["min_sbp_mmhg"] < 80)
    | (data["min_sbp_mmhg"] < 0.7 * data["preop_sbp_mmhg"])
).astype(int)

X = data[FEATURES].copy()
X["emergency"] = X["emergency"].astype(int)
model = RandomForestClassifier(n_estimators=300, random_state=42)
model.fit(X, data["severe_hypotension"])

args.output.parent.mkdir(parents=True, exist_ok=True)
joblib.dump({"model": model, "features": FEATURES}, args.output, compress=3)
print(f"Saved 300-tree Random Forest to {args.output}")
