# CRISPRi-seq Data Browser (Django Version)

A modern, interactive web application for exploring CRISPRi-seq screening data, built with Django 5.2 and Plotly.js.

## Features

- **Gene Browser**: Visualize CRISPRi guide effects in genomic context with interactive plots
- **Minimalist Design**: Black and red theme optimized for data visualization
- **Modular Architecture**: Separate Django apps for each analysis module
- **Interactive Visualizations**: Dynamic Plotly.js plots generated from server-side processed data
- **Public Data Access**: No authentication required for browsing public datasets

## Technology Stack

- **Backend**: Django 5.2, Python 3.11
- **Data Processing**: Pandas, NumPy
- **Visualization**: Plotly.js (client-side), Chart.js compatible
- **Styling**: Custom CSS with CSS variables for theming
- **Environment Management**: Mamba/Conda

## Project Structure

```
CRISPRi-PseudoBrowser/
├── crispriseq_browser/      # Main Django project
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── gene/                     # Gene browser app (primary)
│   ├── data_loader.py       # Data loading utilities
│   ├── gene_analysis.py     # Gene analysis logic
│   ├── views.py
│   ├── urls.py
│   └── templates/
├── guides/                   # Guides browser (coming soon)
├── condition/                # Condition comparison (coming soon)
├── pathway/                  # Pathway analysis (coming soon)
├── compare/                  # Gene set comparison (coming soon)
├── downloads/                # Data downloads & docs (coming soon)
├── templates/                # Shared templates
│   └── base.html
├── static/
│   ├── css/
│   │   └── main.css         # Global styles
│   └── js/
│       └── gene_plot.js     # Plotly visualization logic
├── dataFiles/                # Data directory
│   ├── PAO1_curated.tsv
│   ├── Lib1_FLguides.xlsx
│   ├── melted_results_trim.tsv.gz
│   └── ...
├── manage.py
└── requirements.txt
```

## Installation & Setup

### 1. Create Mamba Environment

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

### 4. Start Development Server

```bash
mamba run -n pseudoBrowser python manage.py runserver
```

The browser will be available at: `http://127.0.0.1:8000/`

## Usage

### Gene Browser

1. Navigate to the Gene tab (default view)
2. Enter a gene name (e.g., `dnaN`) or PAO1 ID (e.g., `PA0003`)
3. Adjust the genomic window size (default: 5000 bp)
4. Select one or more experimental conditions
5. Click "Generate Plots" to visualize:
   - **Gene Context**: Genomic region with gene annotations
   - **Log2 Fold Change**: Guide-level effects across the region
   - **Data Table**: Detailed guide information with export option

### Data Processing

The application uses a caching system to efficiently load and process data:

- Data files are loaded once and cached in memory
- Pandas DataFrames are used for efficient filtering and merging
- Guide positions are calculated on-the-fly based on gene coordinates

## Development

### Adding New Apps

Each analysis module (Guides, Condition, Pathway, etc.) is a separate Django app:

1. Create views in `<app>/views.py`
2. Define URL patterns in `<app>/urls.py`
3. Create templates in `<app>/templates/<app>/`
4. Add JavaScript logic in `static/js/` if needed

### Customizing the Theme

Edit `/static/css/main.css` to modify colors and styling:

```css
:root {
    --bg-primary: #0a0a0a;      /* Main background */
    --accent-red: #dc2626;       /* Primary accent color */
    /* ... */
}
```

### Data Format

The application expects the following data files in `dataFiles/`:

- **PAO1_curated.tsv**: Genome annotation with columns: PAO1_ID, gene_name, start, end, strand, operon
- **Lib1_FLguides.xlsx**: Guide library metadata
- **melted_results_trim.tsv.gz**: Guide-level results with LFC values
- **P_PAO1_enriched.xlsx**: Enriched gene lists
- **median_melted_results_trim.tsv.gz**: Gene-level summaries

## Deployment Considerations

For production deployment:

1. Set `DEBUG = False` in settings.py
2. Configure `ALLOWED_HOSTS`
3. Set up proper secret key management
4. Configure static file serving (collectstatic)
5. Use a production-grade server (Gunicorn, uWSGI)
6. Set up reverse proxy (Nginx, Apache)

## License

[Add license information]

## Citation

[Add citation information]

## Contact

[Add contact information]
