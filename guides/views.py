from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET
import pandas as pd

from gene.data_loader import load_melted_results


def index(request):
    return render(request, "guides/index.html")


@require_GET
def get_data(request):
    query = str(request.GET.get("gene", "")).strip().lower()
    if not query:
        return JsonResponse({"error": "Enter a gene name or PAO1 ID."}, status=400)

    data = load_melted_results()
    selected = data[
        data["type"].astype(str).str.lower().eq("perfect")
        & (
            data["PAO1_ID"].astype(str).str.lower().eq(query)
            | data["gene_name"].astype(str).str.lower().eq(query)
        )
    ].copy()
    if selected.empty:
        return JsonResponse({"error": f"No perfect guides found for {query}."}, status=404)

    selected["predicted_efficacy_score"] = pd.to_numeric(
        selected["predicted_efficacy_score"], errors="coerce"
    )
    grouped = (
        selected.groupby(["PAO1_ID", "gene_name", "spacer"], dropna=False)
        .agg(
            kawalek_score=("predicted_efficacy_score", "first"),
            off_target_n=("off_target_n", "min"),
            median_lfc=("LFC.adj", "median"),
            max_abs_lfc=("LFC.adj", lambda values: values.abs().max()),
            median_abundance=("mean_abund_50M", "median"),
            conditions=("condition", "nunique"),
            batches=("batch", lambda values: ", ".join(sorted(values.dropna().unique()))),
        )
        .reset_index()
        .sort_values(
            ["kawalek_score", "max_abs_lfc"],
            ascending=[False, False],
            na_position="last",
        )
    )

    records = grouped.fillna("").to_dict("records")
    return JsonResponse(
        {
            "gene": str(selected.iloc[0]["gene_name"]),
            "PAO1_ID": str(selected.iloc[0]["PAO1_ID"]),
            "records": records,
        }
    )
