from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from scipy.optimize import curve_fit


_data_cache = None


def load_mismatch_data():
    global _data_cache
    if _data_cache is None:
        path = (
            Path(settings.BASE_DIR)
            / "dataFiles2"
            / "prepared_browser"
            / "mismatch_data.tsv"
        )
        _data_cache = pd.read_csv(path, sep="\t")
    return _data_cache


def _crossing(bins, values, threshold):
    for left, right in zip(range(len(values) - 1), range(1, len(values))):
        y1, y2 = values[left], values[right]
        if not np.isfinite(y1) or not np.isfinite(y2):
            continue
        if (y1 - threshold) * (y2 - threshold) <= 0 and y1 != y2:
            x1, x2 = bins[left], bins[right]
            return float(x1 + (threshold - y1) * (x2 - x1) / (y2 - y1))
    return None


def _fit_sigmoid(points):
    if len(points) < 5 or points["type"].eq("mismatch").sum() == 0:
        return [], None

    x = points["y_pred"].to_numpy(dtype=float)
    y = points["LFC.adj"].to_numpy(dtype=float)

    def logistic(dose, bottom, top, ec50, slope):
        return bottom + (top - bottom) / (1 + (dose / ec50) ** slope)

    try:
        parameters, _ = curve_fit(
            logistic,
            x,
            y,
            p0=[float(y.min()), float(y.max()), 0.5, 1.0],
            bounds=([-30, -30, 0.05, 0.05], [30, 30, 1.0, 20]),
            maxfev=20000,
        )
    except (RuntimeError, ValueError):
        return [], None

    dose = np.linspace(0.05, 1.0, 96)
    predicted = logistic(dose, *parameters)
    half = (predicted.min() + predicted.max()) / 2
    ec50 = float(dose[np.argmin(np.abs(predicted - half))])
    return [
        {"dose": float(value), "p": float(prediction)}
        for value, prediction in zip(dose, predicted)
    ], ec50


def prepare_mismatch_data(gene_input, condition):
    data = load_mismatch_data()
    query = str(gene_input).strip().lower()
    selected = data[
        (data["condition"] == condition)
        & (
            data["PAO1_ID"].astype(str).str.lower().eq(query)
            | data["gene_name"].astype(str).str.lower().eq(query)
        )
    ].copy()
    if selected.empty:
        return {"error": f"No mismatch-guide data found for {gene_input} and {condition}."}

    selected["y_pred"] = selected["y_pred"].where(
        selected["type"].ne("perfect"), 1.0
    ).clip(0.05, 1.0)
    selected = selected.dropna(subset=["y_pred", "LFC.adj"])
    selected = selected.sort_values(["y_pred", "type", "spacer"])

    bins = np.arange(0.05, 1.0001, 0.05)
    selected["bin"] = pd.cut(
        selected["y_pred"], bins=np.r_[bins - 0.025, 1.025], labels=False
    )
    binned = (
        selected.groupby("bin", observed=True)
        .agg(y_pred=("y_pred", "mean"), med_LFC=("LFC.adj", "median"), n=("LFC.adj", "size"))
        .reset_index(drop=True)
    )
    predicted, ec50 = _fit_sigmoid(selected)
    perfect = selected[selected["type"] == "perfect"]["LFC.adj"]
    severity = float(perfect.median()) if not perfect.empty else None
    bin_x = binned["y_pred"].tolist()
    bin_y = binned["med_LFC"].tolist()
    summary = {
        "severity": severity,
        "ec50": ec50,
        "sensitivity": _crossing(bin_x, bin_y, -1.0),
        "protection": _crossing(bin_x, bin_y, 2.0),
    }
    columns = [
        "PAO1_ID",
        "gene_name",
        "spacer",
        "original",
        "type",
        "y_pred",
        "LFC.adj",
        "batch",
        "condition",
    ]
    records = selected[columns].fillna("").to_dict("records")
    return {
        "gene": str(selected.iloc[0]["gene_name"]),
        "PAO1_ID": str(selected.iloc[0]["PAO1_ID"]),
        "condition": condition,
        "records": records,
        "bins": binned.to_dict("records"),
        "predicted": predicted,
        "summary": summary,
    }
