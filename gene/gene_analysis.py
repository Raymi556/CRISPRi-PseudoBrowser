"""
Gene analysis utilities for CRISPRi-seq Browser
"""
import pandas as pd
import numpy as np
from .data_loader import (
    load_pao1_annotation,
    load_melted_results,
    load_fl_guides
)

def find_gene(gene_input):
    """
    Find gene information from PAO1 annotation
    
    Args:
        gene_input: Either a gene name (e.g., 'dnaN') or PAO1_ID (e.g., 'PA0003')
    
    Returns:
        DataFrame with matching gene(s) information
    """
    pao1 = load_pao1_annotation()
    
    # Check if input is PAO1_ID format (PA followed by 4 digits)
    if isinstance(gene_input, str) and gene_input.upper().startswith('PA') and len(gene_input) == 6:
        matches = pao1[pao1['PAO1_ID'].str.upper() == gene_input.upper()]
    else:
        # Search by gene name (case-insensitive)
        matches = pao1[pao1['gene_name'].str.lower() == str(gene_input).lower()]
    
    return matches

def get_genomic_region(gene_row, window=5000):
    """
    Calculate genomic region around a gene
    
    Args:
        gene_row: Single row from PAO1 annotation DataFrame
        window: Number of base pairs to extend on each side
    
    Returns:
        dict with start, end coordinates
    """
    region_start = max(0, min(gene_row['start'], gene_row['end']) - window)
    region_end = max(gene_row['start'], gene_row['end']) + window
    
    return {
        'start': int(region_start),
        'end': int(region_end)
    }

def get_genes_in_region(region_start, region_end):
    """
    Get all genes that overlap with a genomic region
    
    Args:
        region_start: Start coordinate
        region_end: End coordinate
    
    Returns:
        DataFrame with genes in the region
    """
    pao1 = load_pao1_annotation()
    
    # Find genes that overlap with the region
    genes_in_region = pao1[
        (pao1['start'] >= region_start) & (pao1['end'] <= region_end)
    ].copy()
    
    # Normalize strand information
    # genes_in_region['strand'] = genes_in_region['strand'].apply(
    #     lambda x: 'forward' if x == '+' else 'reverse'
    # )
    
    return genes_in_region

def get_guides_for_genes(pao1_ids, conditions, guide_type='perfect'):
    """
    Get guide-level data for specific genes and conditions
    
    Args:
        pao1_ids: List of PAO1_IDs
        conditions: List of experimental conditions
        guide_type: Type of guides to include (default: 'perfect')
    
    Returns:
        DataFrame with guide information and log2FC values
    """
    melted = load_melted_results()
    fl_guides = load_fl_guides()
    pao1 = load_pao1_annotation()
    
    # Filter for perfect guides targeting genes of interest in selected conditions
    guides_df = melted[
        (melted['type'] == guide_type) &
        (melted['condition'].isin(conditions)) &
        (melted['PAO1_ID'].isin(pao1_ids))
    ].copy()
    
    # Select relevant columns
    guides_df = guides_df[['PAO1_ID', 'spacer', 'condition', 'LFC.adj', 'gene_name']]
    
    # Join with PAO1 annotation to get gene coordinates
    guides_df = guides_df.merge(
        pao1[['PAO1_ID', 'start', 'end', 'strand']],
        on='PAO1_ID',
        how='left'
    )
    
    # Join with guide library metadata
    guides_df = guides_df.merge(
        fl_guides[['spacer', 'pam', 'downstream', 'off_target_n', 
                   'mean_abundance_in_library', 'offset', 'gc']],
        on='spacer',
        how='left'
    )
    
    # Remove duplicates
    guides_df = guides_df.drop_duplicates()
    
    # Calculate guide positions
    guides_df['guide_start'] = guides_df.apply(
        lambda row: row['start'] + row['offset'] if row['strand'] == '+' 
                   else row['end'] - row['offset'] - 20,
        axis=1
    )
    guides_df['guide_end'] = guides_df['guide_start'] + 20
    guides_df['guide_center'] = (guides_df['guide_start'] + guides_df['guide_end']) / 2
    
    # Normalize strand
    guides_df['forward'] = guides_df['strand'] == '+'
    
    return guides_df


def calculate_median_lfc_per_condition(guides_df):
    """
    Calculate median LFC per condition
    
    Args:
        guides_df: DataFrame with guide information and LFC values
    
    Returns:
        dict with condition as key and median LFC as value
    """
    if guides_df.empty:
        return {}
    
    medians = guides_df.groupby('condition')['LFC.adj'].median().to_dict()
    return medians


def prepare_gene_plot_data(gene_input, window=5000, conditions=None):
    """
    Prepare all data needed for gene visualization
    
    Args:
        gene_input: Gene name or PAO1_ID
        window: Window size around gene (bp)
        conditions: List of conditions to include
    
    Returns:
        dict with 'genes', 'guides', 'region', 'target_gene' keys
    """
    # Find the target gene
    gene_matches = find_gene(gene_input)
    
    if len(gene_matches) == 0:
        return {'error': 'No gene found matching the input'}
    
    if len(gene_matches) > 1:
        return {
            'error': 'Multiple genes found',
            'matches': gene_matches.to_dict('records')
        }
    
    target_gene = gene_matches.iloc[0]
    
    # Get genomic region
    region = get_genomic_region(target_gene, window)
    
    # Get all genes in the region
    genes_in_region = get_genes_in_region(region['start'], region['end'])
    
    # Get guides data
    if conditions:
        guides_data = get_guides_for_genes(
            genes_in_region['PAO1_ID'].tolist(),
            conditions
        )
    else:
        guides_data = pd.DataFrame()
    
    # Calculate median LFC per condition
    median_lfc = calculate_median_lfc_per_condition(guides_data) if not guides_data.empty else {}
    
    return {
        'genes': genes_in_region.to_dict('records'),
        'guides': guides_data.to_dict('records'),
        'region': region,
        'target_gene': target_gene.to_dict(),
        'median_lfc': median_lfc
    }
