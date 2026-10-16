"""
Data loading utilities for CRISPRi-seq Browser
"""
import pandas as pd
from pathlib import Path
from django.conf import settings

# Cache for loaded data to avoid reloading on every request
_data_cache = {}

PATHWAY_DATASETS = {
    'cog': {
        'label': 'COG',
        'file': 'PAO1_cog.tsv'
    },
    'go': {
        'label': 'Gene Ontology',
        'file': 'PAO1_gene_ontology.tsv'
    }
}


def _read_pathway_file(file_name):
    """Read pathway datasets as tab-separated files."""
    data_path = get_data_path() / file_name
    return pd.read_csv(data_path, sep='\t', on_bad_lines='skip')


def _normalize_columns(df):
    """Normalize column names used by COG/GO files."""
    normalized = df.copy()
    normalized.columns = [str(col).strip().replace('  ', ' ') for col in normalized.columns]
    return normalized


def _require_columns(df, required):
    """Validate required columns and raise a clear error on mismatch."""
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

def get_data_path():
    """Get the path to the dataFiles directory"""
    return Path(settings.BASE_DIR) / 'dataFiles'

def get_prepared_data_path():
    """Get the path to the prepared manuscript-subset browser data."""
    return Path(settings.BASE_DIR) / 'dataFiles2' / 'prepared_browser'

def load_pao1_annotation():
    """Load annotation embedded in the prepared browser data."""
    if 'pao1' not in _data_cache:
        data_path = get_prepared_data_path() / 'condition_gene_data.tsv'
        columns = [
            'PAO1_ID',
            'PA14_ID',
            'gene_name',
            'product_name',
            'category',
            'feature_type',
            'start',
            'end',
            'strand',
        ]
        annotation = pd.read_csv(data_path, sep='\t', usecols=columns)
        _data_cache['pao1'] = annotation.drop_duplicates('PAO1_ID')
    return _data_cache['pao1']

def load_fl_guides():
    """Load guide metadata embedded in the prepared browser data."""
    if 'fl_guides' not in _data_cache:
        data_path = get_prepared_data_path() / 'guide_data.tsv'
        columns = [
            'spacer',
            'pam',
            'downstream',
            'off_target_n',
            'mean_abund_50M',
            'offset',
            'gc',
            'predicted_efficacy_score',
        ]
        guides = pd.read_csv(data_path, sep='\t', usecols=columns)
        _data_cache['fl_guides'] = guides.drop_duplicates('spacer')
    return _data_cache['fl_guides']

def load_melted_results():
    """Load melted results (guide-level data)"""
    if 'melted_results' not in _data_cache:
        data_path = get_prepared_data_path() / 'guide_data.tsv'
        _data_cache['melted_results'] = pd.read_csv(data_path, sep='\t')
    return _data_cache['melted_results']

def load_condition_gene_data():
    """Load prepared gene-level condition data."""
    if 'condition_gene_data' not in _data_cache:
        data_path = get_prepared_data_path() / 'condition_gene_data.tsv'
        _data_cache['condition_gene_data'] = pd.read_csv(data_path, sep='\t')
    return _data_cache['condition_gene_data']


def load_pao1_cog():
    """Load PAO1 COG annotation data."""
    if 'pao1_cog' not in _data_cache:
        cog_df = _normalize_columns(_read_pathway_file(PATHWAY_DATASETS['cog']['file']))
        _require_columns(cog_df, ['PAO1 ID', 'Accession', 'Name', 'Category'])

        cog_df['PAO1 ID'] = cog_df['PAO1 ID'].fillna('').astype(str).str.strip()
        cog_df['Accession'] = cog_df['Accession'].fillna('').astype(str).str.strip()
        cog_df['Name'] = cog_df['Name'].fillna('').astype(str).str.strip()
        cog_df = cog_df[
            (cog_df['PAO1 ID'] != '')
            & (cog_df['PAO1 ID'].str.lower() != 'nan')
            & (cog_df['Accession'] != '')
            & (cog_df['Accession'].str.lower() != 'nan')
            & (cog_df['Name'] != '')
            & (cog_df['Name'].str.lower() != 'nan')
        ]

        _data_cache['pao1_cog'] = cog_df

    return _data_cache['pao1_cog']


def load_pao1_gene_ontology():
    """Load PAO1 Gene Ontology annotation data."""
    if 'pao1_go' not in _data_cache:
        go_df = _normalize_columns(_read_pathway_file(PATHWAY_DATASETS['go']['file']))
        _require_columns(go_df, ['PAO1 ID', 'Accession', 'Name', 'Category'])

        go_df['PAO1 ID'] = go_df['PAO1 ID'].fillna('').astype(str).str.strip()
        go_df['Accession'] = go_df['Accession'].fillna('').astype(str).str.strip()
        go_df['Name'] = go_df['Name'].fillna('').astype(str).str.strip()
        go_df['Category'] = go_df['Category'].fillna('').astype(str).str.strip().str.lower()
        go_df = go_df[
            (go_df['PAO1 ID'] != '')
            & (go_df['PAO1 ID'].str.lower() != 'nan')
            & (go_df['Accession'] != '')
            & (go_df['Accession'].str.lower() != 'nan')
            & (go_df['Name'] != '')
            & (go_df['Name'].str.lower() != 'nan')
        ]

        _data_cache['pao1_go'] = go_df

    return _data_cache['pao1_go']


def get_pathway_datasets():
    """Get available pathway data sources for UI dropdowns."""
    return [
        {'key': key, 'label': meta['label']}
        for key, meta in PATHWAY_DATASETS.items()
    ]


def get_pathway_terms(dataset, query=''):
    """Get unique term list by dataset, filtered by accession/name query."""
    dataset = (dataset or '').strip().lower()
    if dataset == 'cog':
        df = load_pao1_cog()
    elif dataset == 'go':
        df = load_pao1_gene_ontology()
    else:
        return []

    term_df = df[['Accession', 'Name']].drop_duplicates()
    if query:
        q = str(query).strip().lower()
        term_df = term_df[
            term_df['Accession'].str.lower().str.contains(q, na=False)
            | term_df['Name'].str.lower().str.contains(q, na=False)
        ]

    term_df = term_df.sort_values(['Accession', 'Name']).head(100)
    return [
        {
            'accession': row['Accession'],
            'name': row['Name'],
            'display': f"{row['Accession']} - {row['Name']}"
        }
        for _, row in term_df.iterrows()
    ]


def get_genes_for_pathway_term(dataset, accession, name):
    """Get genes linked to a selected COG/GO term."""
    dataset = (dataset or '').strip().lower()
    accession = str(accession or '').strip()
    name = str(name or '').strip()

    if dataset == 'cog':
        df = load_pao1_cog()
    elif dataset == 'go':
        df = load_pao1_gene_ontology()
    else:
        return []

    filtered = df[(df['Accession'] == accession) & (df['Name'] == name)]
    if filtered.empty:
        return []

    pao1 = load_pao1_annotation()[['PAO1_ID', 'gene_name', 'product_name']].drop_duplicates('PAO1_ID')
    genes = filtered.merge(pao1, left_on='PAO1 ID', right_on='PAO1_ID', how='left')

    genes['gene_name'] = genes['gene_name'].fillna('')
    genes['product_name'] = genes['product_name'].fillna('')

    records = []
    for _, row in genes.iterrows():
        records.append({
            'PAO1_ID': row['PAO1 ID'],
            'gene_name': row['gene_name'],
            'product_name': row['product_name'],
            'accession': row['Accession'],
            'term_name': row['Name'],
            'category': row.get('Category', '')
        })

    return sorted(records, key=lambda x: (x['gene_name'] or x['PAO1_ID'], x['PAO1_ID']))


def get_pathway_dataset_records(dataset):
    """Get the full dataset rows for the selected pathway source."""
    dataset = (dataset or '').strip().lower()

    if dataset == 'cog':
        df = load_pao1_cog().copy()
    elif dataset == 'go':
        df = load_pao1_gene_ontology().copy()
    else:
        return []

    df = df.fillna('')
    records = []
    for _, row in df.iterrows():
        row_dict = {str(col): str(row[col]) for col in df.columns}
        records.append(row_dict)

    return records

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
    """Load prepared gene-level data for a specific condition."""
    cache_key = f'condition_hits_{condition}'
    if cache_key not in _data_cache:
        data = load_condition_gene_data()
        _data_cache[cache_key] = data[data['condition'] == condition].copy()
    
    return _data_cache[cache_key]

def get_volcano_conditions():
    """Get prepared display conditions available for volcano plots."""
    if 'volcano_conditions' not in _data_cache:
        _data_cache['volcano_conditions'] = sorted(
            load_condition_gene_data()['condition'].dropna().unique().tolist()
        )
    
    return _data_cache['volcano_conditions']

def clear_cache():
    """Clear the data cache (useful for testing/development)"""
    _data_cache.clear()
