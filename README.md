# CRISPRi-seq Data Browser

The CRISPRi-seq Data Browser is a Django application for exploring
CRISPR-interference screening data from *Pseudomonas aeruginosa*. It connects
gene context, guide-level measurements, mismatch behavior, experimental
conditions, pathway annotations, and cross-condition comparisons in one
interactive browser.

## What the browser provides

- **Gene Browser**: Search by gene name or PAO1 identifier, inspect genomic
  context and guide positions, compare conditions, and view guide-level
  effects.
- **Guides Browser**: Find perfect guides for a gene and compare efficacy,
  off-target counts, abundance, and observed effects.
- **Mismatch Data**: Examine perfect and mismatch guide series for one gene
  and condition.
- **Condition Browser**: Explore a condition-wide volcano plot and identify
  significant genes.
- **Pathway Analysis**: Search COG or Gene Ontology terms, inspect linked
  genes, and create a focused gene set.
- **Gene Set Comparison**: Use starred genes to generate a clustered heatmap
  across conditions.
- **Downloads**: Export the records needed for external analysis as streamed
  CSV files.

## Requirements

- Linux OS
- Conda or Miniconda
- Python 3.11

The application uses Django, Pandas, NumPy, SciPy, OpenPyXL, and Plotly. The
required versions are defined in `requirements.txt`.

## Quick setup

The repository includes `build.sh` to create the environment, install
dependencies, and reconstruct `db.sqlite3` from the compressed database parts
in `data_import/`.

Database population uses only the prepared-browser files in
`data_import/prepared_browser/`. Supplemental legacy files used to create
those artifacts are not read by Django at runtime.

From the repository root, run:

```bash
./build.sh
```

The script stops and displays the error if Conda, the dependencies, or the
database parts cannot be found.

Start the browser:

```bash
./run_server.sh
```

or

```bash
/path/to/CRISPRi-PseudoBrowser/run_server.sh
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a browser.
Stop the server with `ctrl+C` (or `cmd+C` on macOS).

## Manual installation

From the repository root:

```bash
conda create -n pseudoBrowser python=3.11 -y
conda activate pseudoBrowser
pip install -r requirements.txt
```

Reconstruct the database if the compressed database parts are present:

```bash
cat data_import/db_part_*.gz | gunzip > db.sqlite3
```

Apply Django migrations:

```bash
python manage.py migrate
```

Start the development server:

```bash
python manage.py runserver --insecure
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in a browser.
Stop the server with `ctrl+C` (or `cmd+C` on macOS).

## Using the browser for different questions

### Investigate one gene

Open **Gene Browser**, search by gene name or PAO1 ID, choose the genomic
window and conditions, then generate the plots. Use the genomic view to
inspect nearby features and guide placement, and use the guide table to
compare individual measurements. Click plot points to locate the matching
guide in the table.

### Select a guide

Open **Guides Browser** and search for the target gene. Compare the guide
efficacy score, off-target count, median abundance, median LFC, maximum
absolute LFC, conditions, and batches before choosing a guide for follow-up
work.

### Assess mismatch effects

Open **Mismatch Data**, select a gene and condition, and generate the plot.
Compare the perfect guide with the mismatch series to assess how mismatches
alter the measured effect. Click a mismatch point to highlight its parent
guide in the table.

### Find condition-wide hits

Open **Condition Browser**, select an experimental condition, and generate the
volcano plot. Use effect size and statistical significance together when
interpreting hits. Click a point to find the gene in the significant-gene
table, then filter the table for a focused result set.

### Add functional context

Open **Pathway Analysis**, select COG or Gene Ontology, and search by
accession or term name. Inspect the linked genes, select the genes relevant
to the question, and import them into the shared starred-gene list.

### Compare a gene set

Open **Compare** after curating genes in Gene Browser or Pathway Analysis.
Review and remove unwanted starred genes, generate the heatmap, and inspect
clusters for shared response patterns across conditions.

### Perform external analysis

Open **Downloads** and choose the smallest export that answers the question:

- Use **Gene annotation** for identifiers and genomic features.
- Use **Comparison manifest** to decode conditions, batches, and comparison
  classes.
- Use **Guide metadata** for guide design and quality information.
- Use **Gene-condition summaries** for compact condition-wide analysis.
- Use **Guide observations** for detailed guide-level measurements.
- Use **Mismatch observations** for focused mismatch analysis.
- Use **COG** or **Gene Ontology records** for pathway annotations.

Downloads are streamed CSV files.