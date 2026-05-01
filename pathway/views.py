import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from gene.data_loader import (
    get_pathway_datasets,
    get_pathway_terms,
    get_genes_for_pathway_term,
    get_pathway_dataset_records,
)
from .models import StarredGene


def index(request):
    """Pathway browser view."""
    datasets = get_pathway_datasets()
    default_dataset = datasets[0]['key'] if datasets else 'cog'

    context = {
        'datasets': datasets,
        'default_dataset': default_dataset,
    }
    return render(request, 'pathway/index.html', context)


@require_http_methods(["GET"])
def get_terms(request):
    """Search pathway terms by accession or name for selected dataset."""
    try:
        dataset = request.GET.get('dataset', 'cog')
        query = request.GET.get('q', '')
        terms = get_pathway_terms(dataset, query)
        return JsonResponse({'terms': terms})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["GET"])
def get_dataset_records(request):
    """Return the full pathway dataset for the selected source."""
    try:
        dataset = request.GET.get('dataset', 'cog')
        records = get_pathway_dataset_records(dataset)
        return JsonResponse({'records': records})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["POST"])
def get_term_genes(request):
    """Get genes and source records associated with a selected term."""
    try:
        payload = json.loads(request.body)
        dataset = payload.get('dataset', '')
        accession = payload.get('accession', '')
        term_name = payload.get('name', '')

        if not dataset or not accession or not term_name:
            return JsonResponse({'error': 'Dataset, accession, and term name are required.'}, status=400)

        genes = get_genes_for_pathway_term(dataset, accession, term_name)
        starred_ids = set(StarredGene.objects.values_list('PAO1_ID', flat=True))

        for gene in genes:
            gene['starred'] = gene['PAO1_ID'] in starred_ids

        return JsonResponse({
            'genes': genes,
            'selected_term': {
                'dataset': dataset,
                'accession': accession,
                'name': term_name,
            }
        })
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["POST"])
def sync_starred_genes(request):
    """Synchronize visible term genes against checkbox selection."""
    try:
        payload = json.loads(request.body)
        dataset = payload.get('dataset', '')
        accession = payload.get('accession', '')
        term_name = payload.get('name', '')
        visible_gene_ids = payload.get('visible_gene_ids', [])
        selected_gene_ids = payload.get('selected_gene_ids', [])
        selected_gene_map = payload.get('selected_gene_map', {})

        if not dataset or not accession or not term_name:
            return JsonResponse({'error': 'Dataset and term information are required.'}, status=400)

        visible_ids = {str(gid).strip() for gid in visible_gene_ids if str(gid).strip()}
        selected_ids = {str(gid).strip() for gid in selected_gene_ids if str(gid).strip()}

        # Remove deselected genes from the currently visible set.
        to_remove = visible_ids - selected_ids
        if to_remove:
            StarredGene.objects.filter(PAO1_ID__in=to_remove).delete()

        # Upsert selected genes.
        added_count = 0
        for pao1_id in selected_ids:
            defaults = {
                'gene_name': str(selected_gene_map.get(pao1_id, '')).strip(),
                'source_dataset': str(dataset),
                'source_accession': str(accession),
                'source_term_name': str(term_name),
            }
            _, created = StarredGene.objects.update_or_create(PAO1_ID=pao1_id, defaults=defaults)
            if created:
                added_count += 1

        return JsonResponse({
            'success': True,
            'added': added_count,
            'removed': len(to_remove),
            'total_starred': StarredGene.objects.count()
        })
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@require_http_methods(["GET"])
def get_starred_genes(request):
    """List all starred genes for pathway and compare integrations."""
    genes = list(
        StarredGene.objects.all().values(
            'PAO1_ID',
            'gene_name',
            'source_dataset',
            'source_accession',
            'source_term_name',
            'updated_at',
        )
    )
    return JsonResponse({'genes': genes})
