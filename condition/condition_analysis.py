"""
Condition analysis utilities for CRISPRi-seq Browser
"""
import pandas as pd
import numpy as np
import math
from django.conf import settings
from pathlib import Path

def get_data_path():
    """Get the path to the dataFiles directory"""
    return Path(settings.BASE_DIR) / 'dataFiles'

def load_pao1_annotation():
    """Load PAO1 genome annotation"""
    data_path = get_data_path() / 'PAO1_curated.tsv'
    return pd.read_csv(data_path, sep='\t')

def load_condition_hits(condition):
    """Load volcano plot data for a specific condition"""
    # The condition parameter is the full condition name like "CAZ_1_T1 - None_E2_T1"
    # We need to find which file contains it
    data_path = get_data_path()
    
    # Try to find the file that contains this condition
    for file in data_path.glob('P_significant_hits_*.tsv'):
        if '_curated' not in file.name:
            try:
                df = pd.read_csv(file, sep='\t', nrows=1)  # Read just header
                # Check if this file has columns for this condition
                if f'{condition}_medLFC' in df.columns:
                    return pd.read_csv(file, sep='\t')
            except:
                continue
    
    return None

def prepare_volcano_data(condition, lfc_threshold=0.0, fdr_threshold=0.05):
    """
    Prepare volcano plot data for a specific condition
    
    Args:
        condition: Full condition name (e.g., 'CAZ_1_T1 - None_E2_T1')
        lfc_threshold: Log fold change threshold
        fdr_threshold: FDR p-value threshold
    
    Returns:
        dict with volcano data ready for Plotly
    """
    # Load the hits data
    df = load_condition_hits(condition)
    
    if df is None or df.empty:
        return {'error': f'No data found for condition {condition}'}
    
    # Get the column names for this condition
    lfc_col = f'{condition}_medLFC'
    fdr_col = f'{condition}_FDR'
    
    # Check if columns exist
    if lfc_col not in df.columns or fdr_col not in df.columns:
        return {'error': f'Missing LFC or FDR columns for condition {condition}. Available columns: {", ".join(df.columns[:10])}'}
    
    # Create a copy and prepare the data
    df = df.copy()
    
    # Filter out rows with NaN values in key columns
    df = df.dropna(subset=[lfc_col, fdr_col])
    
    # Calculate -log10(FDR)
    df['log10_fdr'] = df[fdr_col].apply(
        lambda x: -np.log10(x) if x > 0 else 300  # Cap at 300 for very small p-values
    )
    
    # Determine significance status
    df['is_significant'] = (
        (abs(df[lfc_col]) >= abs(lfc_threshold)) & 
        (df[fdr_col] <= fdr_threshold)
    )
    
    # Prepare the output records
    records = []
    for idx, row in df.iterrows():
        record = {
            'PAO1_ID': row.get('PAO1_ID', ''),
            'gene_name': row.get('gene_name', row.get('PAO1_ID', '')),
            'product_name': row.get('product_name', ''),
            'lfc': float(row[lfc_col]) if pd.notna(row[lfc_col]) else 0,
            'fdr': float(row[fdr_col]) if pd.notna(row[fdr_col]) else 1,
            'log10_fdr': float(row['log10_fdr']) if pd.notna(row['log10_fdr']) else 0,
            'is_significant': bool(row['is_significant']),
            'category': row.get('category', ''),
            'feature_type': row.get('feature_type', ''),
        }
        records.append(record)
    
    return {
        'condition': condition,
        'records': records,
        'total_genes': len(records),
        'significant_genes': sum(1 for r in records if r['is_significant']),
        'lfc_threshold': lfc_threshold,
        'fdr_threshold': fdr_threshold,
        'max_log10_fdr': float(df['log10_fdr'].max()) if len(df) else 0.0,
    }

def get_volcano_conditions():
    """Get list of conditions available for volcano plot (from P_significant_hits files)"""
    data_path = get_data_path()
    conditions = set()
    
    # Look for all P_significant_hits_*.tsv files and extract actual condition names from columns
    for file in sorted(data_path.glob('P_significant_hits_*.tsv')):
        if '_curated' not in file.name:
            try:
                df = pd.read_csv(file, sep='\t', nrows=1)  # Read just header
                # Look for columns with _medLFC suffix
                for col in df.columns:
                    if col.endswith('_medLFC'):
                        # Extract the condition name
                        condition = col.replace('_medLFC', '')
                        conditions.add(condition)
            except:
                continue
    
    return sorted(list(conditions))
