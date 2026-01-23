# Quick Start Guide - CRISPRi-seq Django Browser

## First Time Setup

```bash
# 1. Navigate to project directory
cd /home/rgoitia/10_apps/CRISPRi-PseudoBrowser

# 2. Activate the mamba environment
mamba activate pseudoBrowser

# 3. Run migrations (first time only)
python manage.py migrate

# 4. Start the development server
python manage.py runserver
```

Or use the convenience script:
```bash
./start_server.sh
```

## Access the Browser

Open your web browser and navigate to:
- **Local**: http://127.0.0.1:8000/
- **Network**: http://localhost:8000/

## Project Organization

### Apps & Their Purpose

- **gene/** - Main gene browser with genomic context visualization ✅ **IMPLEMENTED**
- **guides/** - Guide-level data browser (placeholder)
- **condition/** - Condition comparison and volcano plots (placeholder)
- **pathway/** - Pathway enrichment analysis (placeholder)
- **compare/** - Multi-gene comparison tools (placeholder)
- **downloads/** - Data downloads and documentation (placeholder)

### Key Files

- **gene/data_loader.py** - Handles loading and caching of data files
- **gene/gene_analysis.py** - Core data processing and analysis logic
- **gene/views.py** - Django view functions and API endpoints
- **static/js/gene_plot.js** - Plotly.js visualization code
- **static/css/main.css** - Global styles and theme variables
- **templates/base.html** - Base template with navigation

## Development Workflow

### Adding a New Feature to Gene App

1. **Backend Logic**: Add functions to `gene/gene_analysis.py`
2. **API Endpoint**: Create view in `gene/views.py` and add URL to `gene/urls.py`
3. **Frontend**: Update `static/js/gene_plot.js` for visualization
4. **Template**: Modify `gene/templates/gene/index.html` if needed

### Implementing a New App (e.g., Condition)

1. **Data Processing**:
   ```python
   # condition/analysis.py
   def get_volcano_data(condition):
       # Your analysis logic
       pass
   ```

2. **Create Views**:
   ```python
   # condition/views.py
   def index(request):
       return render(request, 'condition/index.html')
   
   def get_volcano_data(request):
       data = analysis.get_volcano_data(...)
       return JsonResponse(data)
   ```

3. **Update URLs**:
   ```python
   # condition/urls.py
   urlpatterns = [
       path('', views.index, name='index'),
       path('api/volcano/', views.get_volcano_data, name='volcano_data'),
   ]
   ```

4. **Create JavaScript**:
   ```javascript
   // static/js/condition_plot.js
   function createVolcanoPlot(data) {
       // Plotly visualization
   }
   ```

5. **Update Template**:
   ```html
   <!-- condition/templates/condition/index.html -->
   {% extends 'base.html' %}
   {% block extra_js %}
   <script src="{% static 'js/condition_plot.js' %}"></script>
   {% endblock %}
   ```

## Customizing the Theme

Edit color variables in `static/css/main.css`:

```css
:root {
    --bg-primary: #0a0a0a;        /* Main background */
    --bg-secondary: #1a1a1a;      /* Card background */
    --accent-red: #dc2626;         /* Primary accent */
    --accent-red-hover: #ef4444;   /* Hover state */
    --text-primary: #e0e0e0;       /* Main text */
    --text-secondary: #a0a0a0;     /* Secondary text */
}
```

## Common Django Commands

```bash
# Create migrations (if you add models)
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser (for admin access)
python manage.py createsuperuser

# Collect static files (for production)
python manage.py collectstatic

# Run tests
python manage.py test

# Django shell (for testing data processing)
python manage.py shell
```

## Testing Data Processing

Use Django shell to test your analysis functions:

```bash
python manage.py shell
```

```python
from gene.data_loader import *
from gene.gene_analysis import *

# Test data loading
pao1 = load_pao1_annotation()
print(pao1.head())

# Test gene finding
gene = find_gene('dnaN')
print(gene)

# Test plot data preparation
data = prepare_gene_plot_data('dnaN', window=5000, conditions=['None_E2_T1 - None_E2_T0'])
print(data.keys())
```

## API Endpoints

### Gene Browser API

**POST** `/gene/api/get-gene-data/`

Request body:
```json
{
    "gene": "dnaN",
    "window": 5000,
    "conditions": ["None_E2_T1 - None_E2_T0"]
}
```

Response:
```json
{
    "genes": [...],
    "guides": [...],
    "region": {"start": 2948, "end": 12948},
    "target_gene": {...}
}
```

## Troubleshooting

### Server won't start
- Check if port 8000 is already in use: `lsof -i :8000`
- Make sure mamba environment is activated: `mamba activate pseudoBrowser`

### Data not loading
- Verify data files exist in `dataFiles/` directory
- Check file paths in `gene/data_loader.py`
- Look for errors in server console output

### Plots not showing
- Open browser developer console (F12) for JavaScript errors
- Verify Plotly.js CDN is accessible
- Check that data is being returned from API endpoints

### Styling issues
- Clear browser cache
- Check that `static/css/main.css` is being loaded
- Verify `STATIC_URL` in settings.py

## Performance Tips

- Data is cached in memory after first load (see `gene/data_loader.py`)
- To clear cache during development: restart the server
- For large datasets, consider implementing pagination
- Use browser dev tools to monitor network requests

## Next Steps

1. **Implement Guides Browser**: Guide search and filtering
2. **Add Condition Browser**: Volcano plots and ranked lists
3. **Pathway Analysis**: KEGG/GO enrichment visualization
4. **Gene Comparison**: Multi-gene heatmaps
5. **Download Functionality**: Export data and plots

## Resources

- Django Documentation: https://docs.djangoproject.com/en/5.2/
- Plotly.js Documentation: https://plotly.com/javascript/
- Pandas Documentation: https://pandas.pydata.org/docs/

## Notes

- This is a **development server** - not for production use
- No authentication required - data is public
- All data processing happens server-side (Python/Pandas)
- Visualizations are client-side (Plotly.js)
