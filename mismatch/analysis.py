import numpy as np
import pandas as pd
from django.db.models import Q
from downloads.models import GuideObservation
from scipy.optimize import curve_fit


def load_mismatch_data(gene_input, condition):
    """Load mismatch and perfect observations for one gene and condition."""
    query = str(gene_input).strip()
    rows = GuideObservation.objects.filter(
        Q(guide__gene__pao1_id__iexact=query)
        | Q(guide__gene__gene_name__iexact=query),
        comparison__display_label=condition,
        guide__guide_type__in=["perfect", "mismatch"],
    ).values(
        "guide__gene__pao1_id",
        "guide__gene__gene_name",
        "guide__spacer",
        "guide__original",
        "guide__guide_type",
        "guide__y_pred",
        "lfc_adj",
        "comparison__batch",
        "comparison__display_label",
    )
    return pd.DataFrame.from_records(rows).rename(
        columns={
            "guide__gene__pao1_id": "PAO1_ID",
            "guide__gene__gene_name": "gene_name",
            "guide__spacer": "spacer",
            "guide__original": "original",
            "guide__guide_type": "type",
            "guide__y_pred": "y_pred",
            "lfc_adj": "LFC.adj",
            "comparison__batch": "batch",
            "comparison__display_label": "condition",
        }
    )


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
        return [], None, None

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
        return [], None, None

    dose = np.linspace(0.05, 1.0, 96)
    predicted = logistic(dose, *parameters)
    half = (predicted.min() + predicted.max()) / 2
    ec50 = float(dose[np.argmin(np.abs(predicted - half))])
    return [
        {"dose": float(value), "p": float(prediction)}
        for value, prediction in zip(dose, predicted)
    ], ec50, float(parameters[1])


def prepare_mismatch_data(gene_input, condition):
    selected = load_mismatch_data(gene_input, condition)
    if selected.empty:
        return {"error": f"No mismatch-guide data found for {gene_input} and {condition}."}

    selected["type"] = selected["type"].str.lower()
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
    predicted, ec50, emax = _fit_sigmoid(selected)
    perfect = selected[selected["type"] == "perfect"]["LFC.adj"]
    severity = float(perfect.median()) if not perfect.empty else None
    bin_x = binned["y_pred"].tolist()
    bin_y = binned["med_LFC"].tolist()
    summary = {
        "severity": severity,
        "ec50": ec50,
        "emax": emax,
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


def prepare_mismatch_panels(genes, conditions, max_pairs=12):
    """Prepare bounded mismatch results for each requested gene/comparison pair."""
    pairs = [(gene, condition) for gene in genes for condition in conditions]
    if len(pairs) > max_pairs:
        return {
            "error": (
                f"Too many mismatch panels requested ({len(pairs)}); "
                f"the maximum is {max_pairs}."
            )
        }

    panels = []
    for gene, condition in pairs:
        result = prepare_mismatch_data(gene, condition)
        if "error" in result:
            panels.append({
                "gene_input": gene,
                "condition": condition,
                "error": result["error"],
            })
        else:
            panels.append({
                "gene_input": gene,
                "condition": condition,
                "data": result,
            })
    return {"panels": panels}
