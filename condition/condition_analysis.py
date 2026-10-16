"""Condition-level analysis for the manuscript-subset browser data."""

import numpy as np
from gene.data_loader import load_condition_gene_data


def prepare_volcano_data(condition, lfc_threshold=1.0, fdr_threshold=0.05):
    """Prepare fixed-threshold volcano data for one display condition."""
    del lfc_threshold, fdr_threshold
    data = load_condition_gene_data()
    selected = data[data['condition'] == condition].copy()
    if selected.empty:
        return {'error': f'No data found for condition {condition}'}

    selected = selected.dropna(subset=['medLFC', 'p_stouffer'])
    selected['log10_p_stouffer'] = -np.log10(
        selected['p_stouffer'].clip(lower=1e-300)
    )
    records = []
    for _, row in selected.iterrows():
        records.append({
            'PAO1_ID': row.get('PAO1_ID', ''),
            'gene_name': row.get('gene_name', row.get('PAO1_ID', '')),
            'product_name': row.get('product_name', ''),
            'lfc': float(row['medLFC']),
            'fdr': float(row['p_stouffer']),
            'log10_fdr': float(row['log10_p_stouffer']),
            'is_significant': bool(row['is_significant']),
            'category': row.get('category', ''),
            'feature_type': row.get('feature_type', ''),
            'batch': row.get('batch', ''),
            'comparison_class': row.get('comparison_class', ''),
        })

    return {
        'condition': condition,
        'records': records,
        'total_genes': len(records),
        'significant_genes': sum(record['is_significant'] for record in records),
        'lfc_threshold': 1.0,
        'fdr_threshold': 0.05,
        'significance_rule': 'abs(log2FC) > 1 and Stouffer p-value < 0.05',
        'max_log10_fdr': float(selected['log10_p_stouffer'].max()),
    }


def get_volcano_conditions():
    """Return all prepared display conditions."""
    data = load_condition_gene_data()
    return sorted(data['condition'].dropna().unique().tolist())
