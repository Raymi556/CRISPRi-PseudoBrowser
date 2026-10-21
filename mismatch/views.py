import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from gene.data_loader import get_available_conditions

from .analysis import prepare_mismatch_data, prepare_mismatch_panels


def index(request):
    conditions = get_available_conditions()
    return render(
        request,
        "mismatch/index.html",
        {
            "conditions": conditions,
            "default_condition": conditions[0] if conditions else "",
        },
    )


@require_http_methods(["POST"])
def get_data(request):
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Request body must be valid JSON."}, status=400)

    raw_genes = payload.get("genes")
    raw_conditions = payload.get("conditions")
    genes = raw_genes if isinstance(raw_genes, list) else [payload.get("gene", "")]
    conditions = (
        raw_conditions
        if isinstance(raw_conditions, list)
        else [payload.get("condition", "")]
    )
    genes = [str(gene).strip() for gene in genes if str(gene).strip()]
    conditions = [
        str(condition).strip()
        for condition in conditions
        if str(condition).strip()
    ]
    if not genes or not conditions:
        return JsonResponse({"error": "Gene and condition are required."}, status=400)

    if len(genes) == 1 and len(conditions) == 1:
        result = prepare_mismatch_data(genes[0], conditions[0])
    else:
        result = prepare_mismatch_panels(genes, conditions)
    if "error" in result:
        return JsonResponse(result, status=404 if len(genes) == 1 and len(conditions) == 1 else 400)
    return JsonResponse(result)
