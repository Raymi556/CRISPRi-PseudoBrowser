from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .data_loader import get_available_conditions, get_gene_list, get_gene_length_limits
from .gene_analysis import prepare_gene_plot_data
import json
import math

def index(request):
    """Main gene browser view"""
    conditions = get_available_conditions()
    gene_limits = get_gene_length_limits()
    
    context = {
        'conditions': conditions,
        'default_gene': 'dnaN',
        'default_window': 5000,
        'default_conditions': ['None_E2_T1 - None_E2_T0'] if 'None_E2_T1 - None_E2_T0' in conditions else [conditions[0]] if conditions else [],
        'min_gene_length': gene_limits['min'],
        'max_gene_length': gene_limits['max']
    }
    
    return render(request, 'gene/index.html', context)

@require_http_methods(["GET"])
def get_gene_list_api(request):
    """API endpoint to get gene list for autocomplete"""
    try:
        gene_list = get_gene_list()
        gene_limits = get_gene_length_limits()
        
        return JsonResponse({
            'genes': gene_list,
            'limits': gene_limits
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def clean_nan_values(obj):
    """Recursively replace NaN, Infinity values with None for JSON serialization"""
    if isinstance(obj, dict):
        return {key: clean_nan_values(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj

@require_http_methods(["POST"])
def get_gene_data(request):
    """API endpoint to get gene data for plotting"""
    try:
        data = json.loads(request.body)
        gene_input = data.get('gene', 'dnaN')
        window = int(data.get('window', 5000))
        conditions = data.get('conditions', [])
        
        # Prepare the plot data
        plot_data = prepare_gene_plot_data(gene_input, window, conditions)
        
        if 'error' in plot_data:
            return JsonResponse({'error': plot_data['error']}, status=400)
        
        # Clean NaN values before returning
        plot_data = clean_nan_values(plot_data)
        
        return JsonResponse(plot_data)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
