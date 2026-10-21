"""
Data loading utilities for CRISPRi-seq Browser
"""
import pandas as pd

# Cache for loaded data to avoid reloading on every request
_data_cache = {}

PATHWAY_DATASETS = {
    'cog': {
        'label': 'COG',
    },
    'go': {
        'label': 'Gene Ontology',
    }
}

def load_pao1_annotation():
    """Load gene annotation from the Downloads database."""
    if 'pao1' not in _data_cache:
        from downloads.models import Gene
        rows = Gene.objects.values(
            'pao1_id', 'pa14_id', 'gene_name', 'product_name', 'category',
            'feature_type', 'start', 'end', 'strand', 'operon', 'tu'
        )
        _data_cache['pao1'] = pd.DataFrame.from_records(rows).rename(
            columns={
                'pao1_id': 'PAO1_ID',
                'pa14_id': 'PA14_ID',
                'gene_name': 'gene_name',
                'product_name': 'product_name',
                'category': 'category',
                'feature_type': 'feature_type',
                'start': 'start',
                'end': 'end',
                'strand': 'strand',
                'operon': 'operon',
                'tu': 'TU',
            }
        )
    return _data_cache['pao1']

def load_pao1_cog():
    """Load PAO1 COG annotation data."""
    if 'pao1_cog' not in _data_cache:
        from downloads.models import PathwayRecord
        rows = PathwayRecord.objects.filter(dataset='cog').values(
            'pao1_id', 'product_name', 'accession', 'term_name', 'category'
        )
        _data_cache['pao1_cog'] = pd.DataFrame.from_records(rows).rename(
            columns={
                'pao1_id': 'PAO1 ID',
                'product_name': 'Product Description',
                'accession': 'Accession',
                'term_name': 'Name',
                'category': 'Category',
            }
        )

    return _data_cache['pao1_cog']


def load_pao1_gene_ontology():
    """Load PAO1 Gene Ontology annotation data."""
    if 'pao1_go' not in _data_cache:
        from downloads.models import PathwayRecord
        rows = PathwayRecord.objects.filter(dataset='go').values(
            'pao1_id', 'gene_name', 'product_name',
            'accession', 'term_name', 'category'
        )
        _data_cache['pao1_go'] = pd.DataFrame.from_records(rows).rename(
            columns={
                'pao1_id': 'PAO1 ID',
                'gene_name': 'Gene Name',
                'product_name': 'Product Description',
                'accession': 'Accession',
                'term_name': 'Name',
                'category': 'Category',
            }
        )

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
    from downloads.models import Comparison
    return list(
        Comparison.objects.order_by('batch', 'comparison_order')
        .values_list('display_label', flat=True)
    )

def get_gene_list():
    """Get cached list of genes for autocomplete"""
    if 'gene_list' not in _data_cache:
        from downloads.models import Gene
        gene_list = [
            {'value': gene_name, 'type': 'gene_name'}
            for gene_name in Gene.objects.exclude(
                gene_name=''
            ).values_list('gene_name', flat=True)
        ]
        gene_list.extend(
            {'value': pao1_id, 'type': 'pao1_id'}
            for pao1_id in Gene.objects.values_list('pao1_id', flat=True)
        )
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
