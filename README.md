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

### 4. Start Development Server

```bash
mamba run -n pseudoBrowser python manage.py runserver
```

The browser will be available at: `http://127.0.0.1:8000/`