import json

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from gene.data_loader import get_available_conditions

from .analysis import prepare_mismatch_data


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

    gene = str(payload.get("gene", "")).strip()
    condition = str(payload.get("condition", "")).strip()
    if not gene or not condition:
        return JsonResponse({"error": "Gene and condition are required."}, status=400)

    result = prepare_mismatch_data(gene, condition)
    if "error" in result:
        return JsonResponse(result, status=404)
    return JsonResponse(result)
