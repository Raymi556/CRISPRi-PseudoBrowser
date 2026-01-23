"""
Data loading utilities for CRISPRi-seq Browser
"""
import pandas as pd
import gzip
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

def load_pao1_enriched():
    """Load PAO1 enriched data"""
    if 'pao1_enriched' not in _data_cache:
        data_path = get_data_path() / 'P_PAO1_enriched.xlsx'
        _data_cache['pao1_enriched'] = pd.read_excel(data_path)
    return _data_cache['pao1_enriched']

def load_fl_guides():
    """Load full-length guides library data"""
    if 'fl_guides' not in _data_cache:
        data_path = get_data_path() / 'Lib1_FLguides.xlsx'
        _data_cache['fl_guides'] = pd.read_excel(data_path)
    return _data_cache['fl_guides']

def load_melted_results():
    """Load melted results (guide-level data)"""
    if 'melted_results' not in _data_cache:
        data_path = get_data_path() / 'melted_results_trim.tsv.gz'
        with gzip.open(data_path, 'rt') as f:
            _data_cache['melted_results'] = pd.read_csv(f, sep='\t')
    return _data_cache['melted_results']

def load_median_melted_results():
    """Load median melted results"""
    if 'median_melted' not in _data_cache:
        data_path = get_data_path() / 'median_melted_results_trim.tsv.gz'
        with gzip.open(data_path, 'rt') as f:
            _data_cache['median_melted'] = pd.read_csv(f, sep='\t')
    return _data_cache['median_melted']

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
def clear_cache():
    """Clear the data cache (useful for testing/development)"""
    _data_cache.clear()
