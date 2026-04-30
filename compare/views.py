import json
import hashlib
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from gene.data_loader import get_available_conditions
from pathway.models import StarredGene


def index(request):
    """Gene comparison dashboard."""
    conditions = get_available_conditions()
    context = {
        'conditions': conditions,
        'default_conditions': conditions[:1],
    }
    return render(request, 'compare/index.html', context)


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


def _dummy_heat_value(gene_id, condition):
    """Generate a stable placeholder value in [-2, 2] for heatmap cells."""
    digest = hashlib.md5(f"{gene_id}|{condition}".encode('utf-8')).hexdigest()
    raw = int(digest[:8], 16) / 0xFFFFFFFF
    return round((raw * 4.0) - 2.0, 3)


@require_http_methods(["POST"])
def get_dummy_heatmap(request):
    """Build placeholder heatmap matrix for selected genes and conditions."""
    try:
        payload = json.loads(request.body)
        condition_list = payload.get('conditions', [])

        if not isinstance(condition_list, list) or not condition_list:
            return JsonResponse({'error': 'At least one condition must be selected.'}, status=400)

        starred = list(StarredGene.objects.all().values('PAO1_ID', 'gene_name'))
        if not starred:
            return JsonResponse({'error': 'No starred genes found. Add genes in Pathway first.'}, status=400)

        y_labels = [f"{g['gene_name']} ({g['PAO1_ID']})" if g['gene_name'] else g['PAO1_ID'] for g in starred]
        z_values = []
        for gene in starred:
            row = [_dummy_heat_value(gene['PAO1_ID'], cond) for cond in condition_list]
            z_values.append(row)

        return JsonResponse({
            'genes': y_labels,
            'conditions': condition_list,
            'z': z_values,
            'tree_placeholder': {
                'message': 'Hierarchy tree placeholder for future clustering implementation.'
            }
        })
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
