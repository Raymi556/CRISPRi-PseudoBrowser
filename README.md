# CRISPRi-seq Data Browser (Django Version)

Interactive web application for exploring CRISPRi-seq screening data, built with Django 5.2 and Plotly.js.

## Technology Stack

- **Backend**: Django 5.2, Python 3.11
- **Data Processing**: Pandas, NumPy, Scipy
- **Visualization**: Plotly.js (client-side), Chart.js compatible
- **Styling**: Custom CSS with CSS variables for theming
- **Environment Management**: Mamba/Conda

## Installation & Setup

### 1. Create Mamba/Conda Environment

```bash
mamba create -n pseudoBrowser python=3.11 -y
mamba activate pseudoBrowser
```

### 2. Install Dependencies

```bash
cd /home/rgoitia/10_apps/CRISPRi-PseudoBrowser
pip install -r requirements.txt
```

Or using mamba:

```bash
mamba run -n pseudoBrowser pip install -r requirements.txt
```

### 3. Run Migrations

```bash
mamba run -n pseudoBrowser python manage.py migrate
```

Import the prepared browser and pathway data into SQLite:

```bash
mamba run -n pseudoBrowser python manage.py import_browser_data
mamba run -n pseudoBrowser python manage.py import_pathway_data
```

Normal browser requests and Downloads exports use the imported database
records. Developer import and backup instructions are in
`DATABASE_IMPORT.md`.

### 4. Start Development Server

```bash
mamba run -n pseudoBrowser python manage.py runserver
```

The browser will be available at: `http://127.0.0.1:8000/`

## Manuscript-subset browser data

The database is populated from prepared TSV files in
`data_import/prepared_browser/`. These files preserve the B1-B4 batch labels,
aminoglycoside/FBS treatment comparisons, matched controls, and mismatch-guide
records:

- `comparison_manifest.tsv`
- `condition_gene_data.tsv`
- `guide_data.tsv`
- `mismatch_data.tsv`

Regenerate the files from the analysis inputs in `data_import/` with:

```bash
mamba run -n pseudoBrowser python scripts/prepare_browser_data.py
```

Condition significance is fixed at `abs(log2FC) > 1` and Stouffer
`p < 0.05`. The Condition page displays the resulting volcano data, while
Mismatch Data at `/mismatch/` provides the graded mismatch-guide analysis.
Guides at `/guides/` ranks perfect guides for a gene using the available
Kawalek efficacy score and experimental guide metrics. The response shape
leaves room for additional model-score columns when those files are added.

For manual validation, open `/gene/`, `/condition/`, `/pathway/`, `/guides/`,
`/mismatch/`, `/compare/`, and `/downloads/`. Check the plots and verify that
each data table supports searching, sorting, paging, Copy, and Excel export
without a CSV action. Downloads provides on-demand, streamed CSV exports for
gene annotation, comparisons, guide metadata and observations, gene-condition
summaries, mismatch observations, COG, and Gene Ontology records. The large
guide-observation export is streamed in database-sized chunks instead of
building an XLSX workbook in memory.