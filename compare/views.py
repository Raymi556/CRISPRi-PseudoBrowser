import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from pathway.models import StarredGene
from .heatmap_analysis import prepare_compare_heatmap_data


def index(request):
    """Gene comparison dashboard."""
    return render(request, 'compare/index.html')


@require_http_methods(["GET"])
def get_starred_genes(request):
    """Return all globally starred genes."""
    genes = list(
        StarredGene.objects.all().values(
            'PAO1_ID',
            'gene_name',
            'source_dataset',
            'source_accession',
            'source_term_name',
        )
    )
    return JsonResponse({'genes': genes})


@require_http_methods(["POST"])
def remove_starred_gene(request):
    """Remove one gene from the shared starred list."""
    try:
        payload = json.loads(request.body)
        pao1_id = str(payload.get('PAO1_ID', '')).strip()
        if not pao1_id:
            return JsonResponse({'error': 'PAO1_ID is required.'}, status=400)

        deleted, _ = StarredGene.objects.filter(PAO1_ID=pao1_id).delete()
        return JsonResponse({'success': True, 'deleted': deleted})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["POST"])
def get_heatmap(request):
    """Build clustered heatmap matrix from starred genes and all conditions."""
    try:
        starred = list(StarredGene.objects.all().values('PAO1_ID', 'gene_name'))
        payload = prepare_compare_heatmap_data(starred)
        return JsonResponse(payload)
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
