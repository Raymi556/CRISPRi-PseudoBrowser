from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET
import pandas as pd

from downloads.models import GuideObservation


def index(request):
    return render(request, "guides/index.html")


@require_GET
def get_data(request):
    query = str(request.GET.get("gene", "")).strip().lower()
    if not query:
        return JsonResponse({"error": "Enter a gene name or PAO1 ID."}, status=400)

    selected = pd.DataFrame.from_records(
        GuideObservation.objects.filter(
            Q(guide__gene__pao1_id__iexact=query)
            | Q(guide__gene__gene_name__iexact=query),
            guide__guide_type__iexact="perfect",
        ).values(
            "guide__gene__pao1_id",
            "guide__gene__gene_name",
            "guide__spacer",
            "guide__predicted_efficacy_score",
            "guide__off_target_n",
            "lfc_adj",
            "guide__mean_abund_50m",
            "comparison__display_label",
            "comparison__batch",
        )
    ).rename(
        columns={
            "guide__gene__pao1_id": "PAO1_ID",
            "guide__gene__gene_name": "gene_name",
            "guide__spacer": "spacer",
            "guide__predicted_efficacy_score": "predicted_efficacy_score",
            "guide__off_target_n": "off_target_n",
            "lfc_adj": "LFC.adj",
            "guide__mean_abund_50m": "mean_abund_50M",
            "comparison__display_label": "condition",
            "comparison__batch": "batch",
        }
    )
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
