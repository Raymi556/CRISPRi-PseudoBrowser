"""Condition-level analysis for the manuscript-subset browser data."""

import numpy as np
from downloads.models import Comparison, GeneConditionSummary


def prepare_volcano_data(condition, lfc_threshold=1.0, fdr_threshold=0.05):
    """Prepare fixed-threshold volcano data for one display condition."""
    del lfc_threshold, fdr_threshold
    selected = list(
        GeneConditionSummary.objects.filter(
            comparison__display_label=condition,
            guide_type__iexact="perfect",
        ).values(
            "gene__pao1_id",
            "gene__gene_name",
            "gene__product_name",
            "gene__category",
            "gene__feature_type",
            "comparison__batch",
            "comparison__comparison_class",
            "med_lfc",
            "p_stouffer",
            "log10_p_stouffer",
            "is_significant",
        )
    )
    if not selected:
        return {'error': f'No data found for condition {condition}'}

    records = []
    for row in selected:
        if row["med_lfc"] is None or row["p_stouffer"] is None:
            continue
        log10_p = row["log10_p_stouffer"]
        if log10_p is None:
            log10_p = -np.log10(max(row["p_stouffer"], 1e-300))
        records.append({
            'PAO1_ID': row['gene__pao1_id'],
            'gene_name': row['gene__gene_name'] or row['gene__pao1_id'],
            'product_name': row['gene__product_name'],
            'lfc': float(row['med_lfc']),
            'fdr': float(row['p_stouffer']),
            'log10_fdr': float(log10_p),
            'is_significant': bool(row['is_significant']),
            'category': row['gene__category'],
            'feature_type': row['gene__feature_type'],
            'batch': row['comparison__batch'],
            'comparison_class': row['comparison__comparison_class'],
        })

    return {
        'condition': condition,
        'records': records,
        'total_genes': len(records),
        'significant_genes': sum(record['is_significant'] for record in records),
        'lfc_threshold': 1.0,
        'fdr_threshold': 0.05,
        'significance_rule': 'abs(log2FC) > 1 and Stouffer p-value < 0.05',
        'max_log10_fdr': max(
            (record['log10_fdr'] for record in records), default=0.0
        ),
    }


def get_volcano_conditions():
    """Return all prepared display conditions."""
    return list(
        Comparison.objects.order_by("batch", "comparison_order")
        .values_list("display_label", flat=True)
    )
