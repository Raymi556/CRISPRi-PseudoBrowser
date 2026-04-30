"""
Data loading utilities for CRISPRi-seq Browser
"""
import pandas as pd
from pathlib import Path
from django.conf import settings

# Cache for loaded data to avoid reloading on every request
_data_cache = {}

def get_data_path():
    """Get the path to the dataFiles directory"""
    return Path(settings.BASE_DIR) / 'dataFiles'

def load_pao1_annotation():
    """Load PAO1 genome annotation"""
    if 'pao1' not in _data_cache:
        data_path = get_data_path() / 'PAO1_curated.tsv'
        _data_cache['pao1'] = pd.read_csv(data_path, sep='\t')
    return _data_cache['pao1']

def load_fl_guides():
    """Load full-length guides library data"""
    if 'fl_guides' not in _data_cache:
        data_path = get_data_path() / 'Lib1_FLguides.tsv'
        _data_cache['fl_guides'] = pd.read_csv(data_path, sep='\t')
    return _data_cache['fl_guides']

def load_melted_results():
    """Load melted results (guide-level data)"""
    if 'melted_results' not in _data_cache:
        data_path = get_data_path() / 'melted_results_trim.tsv'
        _data_cache['melted_results'] = pd.read_csv(data_path, sep='\t')
    return _data_cache['melted_results']

def get_available_conditions():
    """Get list of available experimental conditions"""
    melted = load_melted_results()
    return sorted(melted['condition'].unique().tolist())

def get_gene_list():
    """Get cached list of genes for autocomplete"""
    if 'gene_list' not in _data_cache:
        pao1 = load_pao1_annotation()
        
        # Create list of gene entries for autocomplete
        gene_list = []
        
        # Add all unique gene names (non-empty)
        for gene_name in pao1['gene_name'].dropna().unique():
            if gene_name and gene_name.strip():
                gene_list.append({
                    'value': gene_name,
                    'type': 'gene_name'
                })
        
        # Add all PAO1 IDs
        for pao1_id in pao1['PAO1_ID'].unique():
            gene_list.append({
                'value': pao1_id,
                'type': 'pao1_id'
            })
        
        _data_cache['gene_list'] = gene_list
    
    return _data_cache['gene_list']

def get_gene_length_limits():
    """Get min and max gene lengths from the dataset"""
    if 'gene_length_limits' not in _data_cache:
        pao1 = load_pao1_annotation()
        gene_lengths = (pao1['end'] - pao1['start']).abs()
        _data_cache['gene_length_limits'] = {
            'min': int(gene_lengths.min()),
            'max': int(gene_lengths.max())
        }
    return _data_cache['gene_length_limits']

def load_condition_hits(condition):
    """Load volcano plot data for a specific condition"""
    cache_key = f'condition_hits_{condition}'
    if cache_key not in _data_cache:
        # Map condition names to file names
        # Condition names like "CAZ_1_T1 - None_E2_T1" map to "P_significant_hits_CAZ_1.tsv"
        condition_base = condition.split('_T')[0].split(' -')[0].strip()
        
        data_path = get_data_path() / f'P_significant_hits_{condition_base}.tsv'
        
        if not data_path.exists():
            return None
        
        _data_cache[cache_key] = pd.read_csv(data_path, sep='\t')
    
    return _data_cache[cache_key]

def get_volcano_conditions():
    """Get list of conditions available for volcano plot (from P_significant_hits files)"""
    if 'volcano_conditions' not in _data_cache:
        data_path = get_data_path()
        conditions = []
        
        # Look for all P_significant_hits_*.tsv files
        for file in data_path.glob('P_significant_hits_*.tsv'):
            if '_curated' not in file.name:  # Skip curated versions
                # Extract condition name from filename
                condition = file.name.replace('P_significant_hits_', '').replace('.tsv', '')
                conditions.append(condition)
        
        _data_cache['volcano_conditions'] = sorted(conditions)
    
    return _data_cache['volcano_conditions']

def clear_cache():
    """Clear the data cache (useful for testing/development)"""
    _data_cache.clear()
