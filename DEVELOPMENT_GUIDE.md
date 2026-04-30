# CRISPRi-seq Data Browser - Development Guide

## Project Overview

**CRISPRi-PseudoBrowser** is a Django-based web application for exploring CRISPR interference (CRISPRi) guide effects in *Pseudomonas aeruginosa* genomic context. It provides interactive data visualization tools for analyzing gene expression, guide effects, and comparative studies across experimental conditions.

**Key Technologies:**
- Backend: Django 3.x with Python 3.8+
- Frontend: Plotly.js 2.27.0 for interactive visualizations, DataTables for data tables
- Data Format: Tab-separated values (TSV) files in `dataFiles/`
- Styling: Custom CSS with CSS variables for dark theme

---

## Visual Design & Aesthetic

### Color Scheme

The application follows a **minimalist dark theme** using CSS variables defined in `static/css/main.css`:

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--bg-primary` | `#0a0a0a` | Main background (very dark black) |
| `--bg-secondary` | `#1a1a1a` | Card backgrounds, input fields |
| `--bg-tertiary` | `#2a2a2a` | Table headers, hover states |
| `--text-primary` | `#e0e0e0` | Main text, headings |
| `--text-secondary` | `#a0a0a0` | Labels, secondary info |
| `--accent-red` | `#dc2626` | Primary interactive elements, links |
| `--accent-red-hover` | `#ef4444` | Hover state (lighter red) |
| `--accent-red-dark` | `#991b1b` | Dark red for pressed states |
| `--border-color` | `#333333` | Dividers, card borders |
| `--input-bg` | `#1a1a1a` | Form input backgrounds |
| `--input-border` | `#404040` | Form input borders |

**Design Principles:**
- **High contrast**: Dark backgrounds with light text for readability
- **Red accent**: Used for buttons, active links, and interactive elements (hover effects)
- **Minimal borders**: Subtle `#333333` borders to delineate sections
- **Consistent spacing**: 1.5rem gap in grid layouts, consistent padding in cards

### Component Styling

**Cards** (`.card`):
- Background: `--bg-secondary`
- Border: 1px `--border-color`
- Padding: 1.5rem
- Border-radius: 8px
- Minimum height: 700px (for control panels)

**Buttons** (`.btn`):
- Primary (`.btn-primary`): Red background, white text, hover lifting effect
- Secondary (`.btn-secondary`): Dark tertiary background with border
- All buttons use 0.2s ease transition

**Forms** (`.form-control`):
- Background: `--input-bg`
- Border: 1px `--input-border`
- Focus: Red border with red shadow (3px rgba 220,38,38,0.1)
- Padding: 0.75rem 1rem

**Tables** (`.table`):
- Headers: Dark tertiary background, 2px bottom border in `--border-color`
- Rows: 1px bottom border, light secondary text
- Row hover: Red tint background (rgba 220,38,38,0.05)
- Text alignment: Left for all cells

**Layouts:**
- Grid system: `.grid-2` for 2-column layouts (controls flex 1, plot flex 2)
- Responsive: Collapses to 1 column on screens < 768px
- Scrollable tables with `.table-container` wrapper

---

## Project Structure

```
CRISPRi-PseudoBrowser/
├── manage.py                           # Django management script
├── crispriseq_browser/                 # Main Django project settings
│   ├── settings.py                     # Database, apps, middleware config
│   ├── urls.py                         # Root URL routing
│   ├── views.py                        # Home view
│   ├── wsgi.py                         # Production WSGI entry
│   └── asgi.py                         # ASGI config
│
├── gene/                               # Gene Browser App
│   ├── data_loader.py                  # Data loading utilities
│   ├── gene_analysis.py                # Gene plot data preparation
│   ├── models.py                       # Database models (currently minimal)
│   ├── views.py                        # index() and get_gene_data() endpoints
│   ├── urls.py                         # URL routing
│   ├── templates/gene/
│   │   └── index.html                  # Gene browser interface
│   └── migrations/
│
├── condition/                          # Condition Browser App
│   ├── condition_analysis.py           # Volcano plot data preparation
│   ├── views.py                        # index() and get_volcano_data() endpoints
│   ├── urls.py                         # URL routing
│   ├── templates/condition/
│   │   └── index.html                  # Volcano plot interface
│   └── migrations/
│
├── guides/                             # Guides App (similar structure)
├── pathway/                            # Pathway App (similar structure)
├── compare/                            # Comparison App (similar structure)
├── downloads/                          # Downloads App (similar structure)
│
├── templates/
│   ├── base.html                       # Base template with navbar, styles, scripts
│   └── home.html                       # Home page
│
├── static/
│   ├── css/
│   │   └── main.css                    # Global styles (color vars, grid, components)
│   ├── js/
│   │   ├── custom_slider.js            # Decimal slider helper class
│   │   ├── gene_autocomplete.js        # Gene search autocomplete
│   │   ├── gene_plot.js                # Gene plot visualization + table
│   │   └── volcano_plot.js             # Volcano plot + threshold controls
│   └── images/
│
├── dataFiles/                          # Data directory (TSV files)
│   ├── PAO1_curated.tsv                # Gene annotation (PAO1 reference)
│   ├── Lib1_FLguides.tsv               # Guide sequences library
│   ├── melted_results_trim.tsv         # Guide-level experimental data
│   ├── P_significant_hits_*.tsv        # Condition-specific volcano plots
│   ├── PAO1_gene_ontology.tsv          # Gene ontology data
│   ├── pathways.tsv                    # Metabolic pathway data
│   └── thresholds_by_condition_with_BH.tsv  # Statistical thresholds
│
├── environment.yml                     # Conda environment definition
├── requirements.txt                    # Python dependencies
├── manage.py                           # Django CLI
└── README.md                           # Project documentation
```

---

## Data Files & Column Structures

### 1. PAO1_curated.tsv (Gene Annotation)

**Purpose:** Master annotation file for *Pseudomonas aeruginosa* PAO1 reference strain genes

**Key Columns:**
| Column | Type | Example | Usage |
|--------|------|---------|-------|
| `PAO1_ID` | str | `PA0001` | Gene identifier (unique) |
| `PA14_ID` | str | `PA14_00001` | PA14 reference strain ID |
| `feature_type` | str | `CDS`, `tRNA`, `rRNA` | Gene feature classification |
| `start` | int | `83` | Start position in genome |
| `end` | int | `906` | End position in genome |
| `strand` | str | `+` or `-` | DNA strand orientation |
| `gene_name` | str | `dnaN` | Short gene name (for searching) |
| `gene_synonyms` | str | `dnaD; dnaX` | Alternative gene names |
| `product_name` | str | `DNA polymerase III alpha subunit` | Protein product description |
| `refSeq_accession` | str | `NP_252043.1` | NCBI reference accession |
| `PGD_Gene_ID` | str | `PGD100001` | Pseudomonas Genome Database ID |
| `length` | int | `824` | Gene length in bp |
| `category` | str | `E_core`, `E_AMR_core` | Functional category |

**Usage:**
- Search results by gene name or PAO1_ID
- Gene information card display
- Filter by functional category

### 2. Lib1_FLguides.tsv (Guide Library)

**Purpose:** Full-length CRISPR guide sequences used in experiments

**Key Columns:**
| Column | Type | Usage |
|--------|------|-------|
| `PAO1_ID` | str | Gene targeted |
| `guide_sequence` | str | 20bp guide RNA sequence |
| `target_location` | int | Position in gene |

### 3. melted_results_trim.tsv (Guide-Level Experimental Data)

**Purpose:** Long-form data for all guides across all conditions

**Key Columns:**
| Column | Type | Example | Usage |
|--------|------|---------|-------|
| `PAO1_ID` | str | `PA0001` | Gene ID |
| `gene_name` | str | `dnaN` | Gene name |
| `condition` | str | `None_E2_T1 - None_E2_T0` | Experimental condition comparison |
| `guide_id` | int | `1` | Guide sequence identifier |
| `guide_sequence` | str | `ATCGATCGATCG...` | 20bp targeting sequence |
| `medLFC` | float | `-2.34` | Median log fold change |
| `FDR` | float | `1.2e-10` | False discovery rate |

**Condition Format:** `{TREATMENT}_T{n} - {CONTROL}_T{m}` (e.g., `AMK_2_T1 - None_E2_T1`)

### 4. P_significant_hits_*.tsv (Volcano Plot Data)

**Purpose:** Gene-level summary statistics for volcano plots (per condition)

**Files:** 
- `P_significant_hits_AMK_2.tsv`
- `P_significant_hits_ATM_2.tsv`
- `P_significant_hits_CAZ_1.tsv`
- ... (one per condition pair)

**Key Columns:**
| Column Pattern | Type | Example | Purpose |
|---|---|---|---|
| `PAO1_ID` | str | `PA0001` | Gene identifier |
| `gene_name` | str | `dnaN` | Gene name |
| `product_name` | str | `DNA polymerase III` | Protein product |
| `{condition}_medLFC` | float | `-1.5` | Log fold change for condition |
| `{condition}_FDR` | float | `1.3e-12` | FDR p-value |
| `{condition}_BH` | float | `1.8e-10` | Benjamini-Hochberg adjusted p-value |
| `category` | str | `E_core` | Gene category |

**Condition Columns Example** (from `P_significant_hits_CAZ_1.tsv`):
```
PAO1_ID  gene_name  product_name  CAZ_1_T1 - None_E2_T1_medLFC  CAZ_1_T1 - None_E2_T1_FDR  CAZ_1_T1 - None_E2_T1_BH  TOB_0.4_T1 - None_E1_T1_medLFC  ...
PA0001   dnaN       DNA pol III   -2.34                         1.2e-15                     2.1e-13                  -0.89                          ...
```

**Multiple Conditions:** Files contain columns for multiple condition pairs (e.g., `P_significant_hits_CAZ_1.tsv` has columns for CAZ_1, TOB_0.4, None_E1, AMK_2, etc.)

### 5. PAO1_gene_ontology.tsv

**Purpose:** Gene Ontology annotations for enrichment analysis

**Key Columns:**
| Column | Type | Usage |
|--------|------|-------|
| `PAO1_ID` | str | Gene ID |
| `GO_ID` | str | GO term identifier |
| `GO_term` | str | Human-readable GO term |
| `GO_category` | str | Biological Process, Molecular Function, etc. |

### 6. pathways.tsv

**Purpose:** Metabolic pathway assignments for pathway analysis

**Key Columns:**
| Column | Type | Usage |
|--------|------|-------|
| `PAO1_ID` | str | Gene ID |
| `pathway_id` | str | KEGG pathway ID |
| `pathway_name` | str | Pathway description |

---

## Data Loading Architecture

### gene/data_loader.py

Central module for caching and providing access to all TSV files. Uses in-memory caching via `_data_cache` dictionary to avoid redundant disk I/O.

**Key Functions:**

```python
load_pao1_annotation() -> pd.DataFrame
"""Load PAO1 gene annotation file"""
# Returns: DataFrame with PAO1_ID, gene_name, product_name, start, end, strand, etc.

load_fl_guides() -> pd.DataFrame
"""Load full-length guides library"""
# Returns: DataFrame with guide_sequence, target_location, etc.

load_melted_results() -> pd.DataFrame
"""Load melted results (long-form guide-level data)"""
# Returns: DataFrame with condition, medLFC, FDR for all guides

get_available_conditions() -> list[str]
"""Extract unique conditions from melted_results"""
# Returns: Sorted list like ['None_E2_T1 - None_E2_T0', 'AMK_2_T1 - None_E2_T1', ...]

get_gene_list() -> list[dict]
"""Generate autocomplete list of gene names and PAO1_IDs"""
# Returns: [{'value': 'dnaN', 'type': 'gene_name'}, {'value': 'PA0001', 'type': 'pao1_id'}, ...]

get_gene_length_limits() -> dict
"""Calculate min/max gene lengths for window size slider"""
# Returns: {'min': 100, 'max': 15000}

load_condition_hits(condition: str) -> pd.DataFrame
"""Load volcano plot data for a specific condition"""
# Args: condition = "CAZ_1_T1 - None_E2_T1"
# Returns: DataFrame from P_significant_hits_CAZ_1.tsv

get_volcano_conditions() -> list[str]
"""Get all available volcano plot conditions"""
# Returns: Sorted list extracted from P_significant_hits_*.tsv files

clear_cache()
"""Clear in-memory cache (for testing/development)"""
```

**Caching Strategy:**
- All data cached in `_data_cache` dict on first request
- Subsequent requests return cached object immediately
- Suitable for static data that doesn't change during app runtime
- Cache key format: `condition_hits_{condition_name}`, `gene_list`, `pao1`, etc.

---

## Analysis Modules

### condition/condition_analysis.py

Prepares volcano plot data with statistical calculations and filtering.

**Key Functions:**

```python
prepare_volcano_data(condition: str, lfc_threshold: float = 0.0, fdr_threshold: float = 0.05) -> dict
"""
Prepare volcano plot data for a specific condition

Args:
    condition: Full condition name (e.g., 'CAZ_1_T1 - None_E2_T1')
    lfc_threshold: Log fold change absolute value threshold
    fdr_threshold: FDR p-value threshold

Returns:
    {
        'condition': str,
        'records': [
            {
                'PAO1_ID': str,
                'gene_name': str,
                'product_name': str,
                'lfc': float,
                'fdr': float,
                'log10_fdr': float,  # -log10(FDR) transformation
                'is_significant': bool,  # meets both thresholds
                'category': str,
                'feature_type': str
            },
            ...
        ],
        'total_genes': int,
        'significant_genes': int,
        'lfc_threshold': float,
        'fdr_threshold': float,
        'max_log10_fdr': float  # Max -log10(FDR) in dataset for slider scaling
    }
"""
```

**Data Transformations:**
- **-log10(FDR):** FDR p-values converted to -log10 scale for volcano plot
- **Significance:** `|LFC| >= threshold AND FDR <= threshold`
- **Filtering:** Rows with NaN in LFC or FDR columns dropped
- **Capping:** Very small p-values (< 1e-300) capped to prevent overflow

### gene/gene_analysis.py

Prepares gene-level plot data for visualization across multiple conditions.

**Key Functions:**
```python
prepare_gene_plot_data(gene: str, window: int, conditions: list[str]) -> dict
"""
Prepare plot data for a gene across multiple conditions

Returns: Dict with plot traces, guide data, gene info
"""
```

---

## JavaScript Architecture

### static/js/custom_slider.js

**Purpose:** Reusable decimal slider component with synchronized input field

**Class: CustomSlider**

```javascript
constructor(sliderId, inputId, options = {})
```

**Options:**
- `min`: Minimum value (default: 0)
- `max`: Maximum value (default: 100)
- `step`: Step size (default: 1)
- `decimals`: Decimal places to display (default: 0)

**Methods:**

```javascript
setValue(value) {
  // Set both slider and input to value, with proper decimal formatting
  // Uses toFixed(this.decimals) for precision
}

updateLimits(newMin, newMax) {
  // Update slider and input min/max attributes
  // Triggers updateUI() to refresh display
}

attachEvents(onChangeCallback) {
  // Attach input and change listeners to slider and input
  // Callback fires on every input/change event
  // Ensures slider and input stay in sync
}
```

**Key Implementation Details:**
- Uses `parseFloat()` instead of `parseInt()` to preserve decimals
- `toFixed(decimals)` for consistent display formatting
- Event listeners on both slider (input/change) and number input (input/change)
- Trigger callback with `getValue()` on every change

**Example Usage:**
```javascript
const lfcSlider = new CustomSlider('lfc-slider', 'lfc-input', {
    min: 0,
    max: 5,
    step: 0.001,
    decimals: 3
});
lfcSlider.attachEvents(() => updatePlot());
```

### static/js/gene_autocomplete.js

**Purpose:** Autocomplete dropdown for gene search

**Features:**
- Matches gene names and PAO1_IDs
- Shows 10 results by default
- Arrow key navigation
- Enter to select, Escape to close
- Server call to `/gene/api/gene-list/` for suggestions

### static/js/gene_plot.js

**Purpose:** Gene browser visualization and interaction

**Key Components:**
- Plotly scatter plot of guides with LFC and conditions
- DataTables for guide data display
- Form handling for gene/condition selection
- PDF download functionality

**Pattern:**
```javascript
// Form submission listener
$('#gene-form').on('submit', function(e) {
    e.preventDefault();
    const geneInput = $('#gene-input').val();
    const conditions = $('#conditions-select').val();
    loadGeneData(geneInput, conditions);
});

function loadGeneData(gene, conditions) {
    $.ajax({
        url: window.GENE_DATA_URL,
        type: 'POST',
        data: JSON.stringify({gene, conditions}),
        success: (data) => createGeneplot(data)
    });
}
```

### static/js/volcano_plot.js

**Purpose:** Condition browser with volcano plot and threshold controls

**Key Components:**
- Plotly scatter plot with significant/non-significant coloring
- Threshold lines (vertical for LFC, horizontal for FDR)
- Real-time redraw on slider input
- DataTables for gene results
- Dynamic plot title with threshold values

**Architecture:**

```javascript
// Load condition data
function loadVolcanoData() {
    const condition = $('#condition-select').val();
    const lfc = lfcSlider.getValue();
    const fdr = fdrSlider.getValue();
    
    $.ajax({
        url: window.API_URL,
        type: 'POST',
        data: JSON.stringify({condition, lfc_threshold: lfc, fdr_threshold: fdr}),
        success: (data) => {
            currentData = data;
            fdrSlider.updateLimits(0, data.max_log10_fdr);
            redrawVolcanoPlot();
        }
    });
}

// Redraw plot with current thresholds
function redrawVolcanoPlot() {
    const lfc = lfcSlider.getValue();
    const fdr = fdrSlider.getValue();
    createVolcanoPlot(currentData.records, lfc, fdr);
}

// Create Plotly scatter
function createVolcanoPlot(records, lfc, fdr) {
    // Traces: significant (red) vs non-significant (gray)
    // Shapes: vertical line at ±LFC, horizontal line at log10_FDR
    // Title: "{Condition} (|LFC| ≥ X.XXX, -log10(FDR) ≥ Y.YYY)"
    Plotly.newPlot('plot-container', traces, layout);
}

// Create DataTables table
function createGenesTable(records) {
    // Sort by FDR ascending
    // Wrap gene names in `<a href="/gene/?gene={gene}&condition={condition}">`
    // Styled with red accent color
    $('#table').DataTable({
        data: sortedRecords,
        order: [[3, 'asc']]  // FDR column
    });
}
```

**Key Features:**
- **Real-time threshold visualization**: Shapes update as sliders move
- **Dynamic FDR slider max**: Updated from `data.max_log10_fdr` after API call
- **Clickable gene names**: Link to `/gene/?gene={gene_name}&condition={condition}`
- **Auto-submit on params**: Gene browser auto-renders when linked from volcano plot
- **Color scheme**: Red for significant genes, gray for non-significant

---

## Template Structure

### templates/base.html

**Purpose:** Base template with shared layout, styling, and scripts

**Includes:**
```html
<!-- CSS -->
<link rel="stylesheet" href="{% static 'css/main.css' %}">
<link rel="stylesheet" href="https://cdn.datatables.net/2.3.7/css/dataTables.dataTables.css">
<link rel="stylesheet" href="https://cdn.datatables.net/buttons/3.1.1/css/buttons.dataTables.css">

<!-- Libraries -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="https://cdn.datatables.net/2.3.7/js/dataTables.js"></script>
<script src="https://cdn.datatables.net/buttons/3.1.1/js/dataTables.buttons.js"></script>
<script src="https://cdn.datatables.net/buttons/3.1.1/js/buttons.html5.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>

<!-- Navigation -->
<nav class="navbar">Gene | Guides | Condition | Pathway | Compare | Downloads</nav>

<!-- Content blocks -->
{% block content %}{% endblock %}
{% block extra_js %}{% endblock %}
```

**Navbar:**
- Red underline border (2px `--accent-red`)
- Active link highlighted in red with bottom border
- Responsive flex layout

### condition/templates/condition/index.html

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Control Panel (flex 1)  │  Plot Area (flex 2)  │
├─────────────────────────────────────────────────┤
│ • Condition dropdown    │                       │
│ • LFC slider (decimals) │  Plotly Volcano Plot │
│ • FDR slider (decimals) │  Height: 700px       │
│ • Generate button       │  Threshold lines     │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│              Gene Results Table                  │
│  (Full width, 5 columns, sorted by FDR)        │
└─────────────────────────────────────────────────┘
```

**Controls:**
- Condition select: Single condition selection
- LFC threshold: 0–5.000 range, step 0.001, default 1.000
- FDR threshold: 0–`max_log10_fdr`, step 0.001, default 2.000
- Generate Plot button: Loads data and renders

**Plot:**
- Scatter trace: colored by significance (red vs gray)
- Vertical threshold lines: ±LFC
- Horizontal threshold line: FDR
- Title includes current thresholds

**Table:**
- Columns: Gene Name (clickable), PAO1_ID, LFC, FDR, Product Name
- Sorted by FDR ascending (smallest p-values first)
- DataTables with download buttons

### gene/templates/gene/index.html

**Layout:**
```
┌──────────────────────────┬──────────────────────────┐
│  Control Panel (flex 1)  │  Gene Info (flex 2)      │
├──────────────────────────┼──────────────────────────┤
│ • Gene input             │  • Gene Info Card        │
│   (autocomplete)         │  • Download Plot button  │
│ • Window slider          │  • Plotly Scatter plot   │
│ • Conditions multiselect │    (Height: 700px)       │
│ • Generate button        │                          │
└──────────────────────────┴──────────────────────────┘
┌───────────────────────────────────────────────────┐
│           Guide Data Table (Full Width)           │
└───────────────────────────────────────────────────┘
```

**Auto-Population from URL Parameters:**
- `?gene=PA0001` → Pre-fills gene input
- `?condition=CAZ_1_T1%20-%20None_E2_T1` → Pre-selects condition
- Auto-submits form when both parameters present

---

## View Architecture

### Views Pattern

Each app follows a consistent pattern:

```python
# views.py

def index(request):
    """Render the main page with context data"""
    conditions = get_available_conditions()
    
    # Handle URL parameters for pre-population
    param_value = request.GET.get('parameter')
    
    context = {
        'conditions': conditions,
        'default_param': param_value or 'default_value',
        'auto_submit': bool(param_value)
    }
    
    return render(request, 'app/index.html', context)

@require_http_methods(['POST'])
def get_api_data(request):
    """JSON API endpoint for data fetching"""
    try:
        data = json.loads(request.body)
        param1 = data.get('param1')
        param2 = data.get('param2')
        
        # Prepare data
        result = prepare_analysis_data(param1, param2)
        
        # Clean NaN/Inf for JSON serialization
        result = clean_nan_values(result)
        
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
```

**Key Points:**
- Template context includes `auto_submit` flag for URL parameters
- JavaScript checks `window.AUTO_SUBMIT` and triggers form submission
- API endpoints are POST-only with `@require_http_methods`
- Always use `clean_nan_values()` before returning JSON (handles NaN, Infinity)

---

## JavaScript Context Variables

All templates define global window variables for JavaScript access:

```javascript
// From Django context via <script> in base.html
window.CONDITIONS = {{ conditions|safe }};           // List of all conditions
window.GENE_DATA_URL = "{% url 'gene:get_gene_data' %}";  // API endpoint URLs
window.API_URL = "{% url 'condition:get_volcano_data' %}";
window.CSRF_TOKEN = '{{ csrf_token }}';              // For POST requests
window.MIN_GENE_LENGTH = {{ min_gene_length }};      // Slider limits
window.MAX_GENE_LENGTH = {{ max_gene_length }};
window.AUTO_SUBMIT = {{ auto_submit|lower }};        // Auto-submit flag
```

**Usage in JavaScript:**
```javascript
$.ajax({
    url: window.GENE_DATA_URL,
    type: 'POST',
    headers: {'X-CSRFToken': window.CSRF_TOKEN},
    data: JSON.stringify({...}),
    success: handleResponse
});
```

---

## Development Conventions

### Adding a New App/Feature

1. **Create Django app structure:**
   ```bash
   python manage.py startapp newapp
   ```

2. **Create data analysis module** (`newapp/analysis.py`):
   - Import from `gene/data_loader.py` for data access
   - Use pandas for data manipulation
   - Return JSON-serializable dicts
   - Apply `clean_nan_values()` before returning

3. **Add views** (`newapp/views.py`):
   - `index()`: Render template with context
   - `get_data()`: JSON API endpoint
   - Use `@require_http_methods(['POST'])`

4. **Create template** (`newapp/templates/newapp/index.html`):
   - Extend `base.html`
   - Use CSS classes: `.card`, `.grid-2`, `.btn-primary`, etc.
   - Follow 1:2 or 2:1 layout pattern
   - Set `min-height` on cards for consistent spacing

5. **Add JavaScript** (`static/js/newapp.js`):
   - Use global window variables for URLs/data
   - Follow jQuery AJAX pattern for API calls
   - Use Plotly for visualizations
   - Use DataTables for result tables

6. **Register URL** (`newapp/urls.py`):
   ```python
   app_name = 'newapp'
   urlpatterns = [
       path('', views.index, name='index'),
       path('api/get-data/', views.get_data, name='get_data'),
   ]
   ```

7. **Add to main URLs** (`crispriseq_browser/urls.py`):
   ```python
   path('newapp/', include('newapp.urls')),
   ```

8. **Add to navbar** (`templates/base.html`):
   ```html
   <a href="{% url 'newapp:index' %}" class="nav-link">New App</a>
   ```

### CSS Considerations

- **Always use CSS variables** for colors (don't hardcode hex values)
- **Maintain dark theme consistency**: Use `--bg-*` for backgrounds, `--text-*` for text
- **Interactive elements**: Use `--accent-red` for primary actions
- **Borders**: Use `--border-color` (#333333) for subtle dividers
- **Hover states**: Typically lighten/darken with `--accent-red-hover` or `rgba` transparency
- **Transitions**: Use `transition: all 0.2s ease` for smooth interactions

### Data Loading Patterns

- **Always cache data** using `_data_cache` dictionary in data_loader.py
- **Use pandas for TSV parsing**: `pd.read_csv(path, sep='\t')`
- **Handle missing values**: Check columns exist before accessing
- **Clean statistical values**: Apply `clean_nan_values()` before JSON serialization
- **Log important calculations**: Comment -log10 transformations, thresholds, filtering logic

### API Response Format

```python
{
    'success': True,
    'data': {
        'records': [...],      # Main data array
        'metadata': {...},     # Statistics, ranges, counts
        'max_value': float,    # For dynamic slider limits
        'count': int
    },
    'timestamp': str
}

# On error:
{
    'error': 'Human-readable error message',
    'status': 400
}
```

### Testing & Debugging

- **Clear cache during dev**: Call `gene.data_loader.clear_cache()` in Django shell
- **Check file paths**: Use `Path(settings.BASE_DIR) / 'dataFiles'` consistently
- **Validate TSV columns**: Always check column existence before accessing
- **Browser console**: Check for JavaScript errors with `Ctrl+Shift+K`
- **Network tab**: Inspect AJAX requests/responses in DevTools Network tab

---

## Libraries & Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Django | 3.x | Web framework |
| pandas | Latest | Data manipulation |
| numpy | Latest | Numerical operations |
| Plotly.js | 2.27.0 | Interactive visualizations |
| DataTables | 2.3.7 | Sortable tables with export |
| jQuery | 3.6.0 | DOM manipulation |
| jszip | 3.10.1 | ZIP file creation (for exports) |

---

## Common Tasks

### Query Parameter Passing

```python
# In views.py
param_value = request.GET.get('parameter_name')
if param_value:
    context['default_value'] = param_value
    context['auto_submit'] = True
```

```html
<!-- In template -->
<script>
    document.addEventListener('DOMContentLoaded', function() {
        if (window.AUTO_SUBMIT) {
            setTimeout(() => document.getElementById('form').dispatchEvent(new Event('submit')), 100);
        }
    });
</script>
```

### API Error Handling

```javascript
$.ajax({
    ...
    error: function(xhr, status, error) {
        const errorData = JSON.parse(xhr.responseText);
        showError(errorData.error);
    }
});
```

### Table Sorting with DataTables

```javascript
// Sort by column index 3 (FDR) in ascending order
table = $('#table-id').DataTable({
    data: processedData,
    order: [[3, 'asc']],  // Column 3, ascending
    columnDefs: [...]
});
```

### Exporting Plots

```javascript
// Plotly download button (built-in)
Plotly.downloadImage('plot-container', {format: 'png', width: 1200, height: 700});
```

---

## Performance Notes

- **Data caching**: All TSV files cached in memory after first load; suitable for static data
- **Large tables**: Use DataTables with server-side processing for > 10k rows
- **Slider updates**: Debounce threshold changes to reduce API calls
- **Plotly rendering**: Pre-sort data before chart creation for faster render

---

## Future Considerations

1. **Database models**: Currently using TSV files; consider migrating to PostgreSQL for real-time data
2. **Authentication**: Add user accounts and data permissions if needed
3. **Export functionality**: Extend download options (CSV, Excel, JSON)
4. **Batch analysis**: Support uploading custom guide libraries
5. **API versioning**: Plan for stable public API if exposing to external users
6. **Caching strategy**: Implement Redis for distributed caching if scaling
7. **Testing**: Add unit tests for data_loader, analysis modules, and views

---

**Last Updated:** April 30, 2026
**Project Status:** Condition Volcano Plot Feature Complete with clickable gene links to Gene Browser
