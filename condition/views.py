from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .condition_analysis import get_volcano_conditions, prepare_volcano_data
import json
import math

def index(request):
    """Main condition browser view"""
    conditions = get_volcano_conditions()
    
    context = {
        'conditions': conditions,
        'default_condition': conditions[0] if conditions else '',
        'default_lfc_threshold': 0,
        'default_fdr_threshold': 0,
    }
    
    return render(request, 'condition/index.html', context)

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
def get_volcano_data(request):
    """API endpoint to get volcano plot data"""
    try:
        data = json.loads(request.body)
        condition = data.get('condition', '')
        lfc_threshold = float(data.get('lfc_threshold', 0.0))
        fdr_threshold = float(data.get('fdr_threshold', 0.05))
        
        if not condition:
            return JsonResponse({'error': 'Condition is required'}, status=400)
        
        # Prepare the volcano plot data
        plot_data = prepare_volcano_data(condition, lfc_threshold, fdr_threshold)
        
        if 'error' in plot_data:
            return JsonResponse({'error': plot_data['error']}, status=400)
        
        # Clean NaN values before returning
        plot_data = clean_nan_values(plot_data)
        
        return JsonResponse(plot_data)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
