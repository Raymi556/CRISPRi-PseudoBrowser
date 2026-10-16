# Manuscript-subset browser update

This is the living implementation and checkpoint record for the manuscript-subset
data update. It is updated after each implementation step and is the only
continuation note for this work.

## Scope

- Preserve the existing Django browser layout, styling, and simple request flow.
- Replace the legacy condition data with the four batch datasets (`B1`-`B4`).
- Keep only the aminoglycoside/FBS treatment comparisons and their matched
  untreated controls.
- Use one significance rule everywhere: `abs(log2FC) > 1` and
  `Stouffer p-value < 0.05`.
- Add a separate Mismatch Data tab for gene-level exploration across the
  graded mismatch-guide series.
- Keep generated browser inputs as inspectable, uncompressed TSV files for now.
- Run commands with the `pseudoBrowser` conda environment.

## Implementation sequence and review gates

### Step 1 - Prepare browser TSV datasets

Create a reproducible data-preparation script and a small manifest describing
the selected batch/comparison inputs. The script will:

1. Read the four batch `melted_results` and `median_melted_results` inputs.
2. Select the treatment comparisons and the four matched control comparisons.
3. Preserve batch, raw condition, display condition, guide type, mismatch
   parent/original guide, predicted activity, log2FC, p-value, and Stouffer
   p-value fields needed by the current and planned views.
4. Join the available gene annotation and guide metadata where those fields
   are present in the repository.
5. Write explicit TSV outputs for:
   - condition/gene-level volcano data;
   - guide-level gene-browser data;
   - mismatch-series data;
   - a comparison manifest and row-count/column audit.
6. Fail clearly when an expected comparison or required column is absent.

**Manual review gate:** inspect the generated TSV headers and representative
rows, verify that all four batches and matched controls are present, verify
that only aminoglycoside/FBS treatments remain, and confirm that no required
guide or annotation information was discarded. Do not continue until this
check is approved.

### Step 2 - Wire the prepared TSVs into shared data loading

Update the data loader and condition/gene analysis code to read the prepared
TSVs, expose batch/comparison metadata, and apply the fixed significance rule
without retaining the legacy FDR/threshold discovery logic.

**Manual review gate:** run the Django checks and inspect the existing Gene and
Condition pages/API responses. Confirm that condition names, gene searches,
guide rows, and significant-hit counts match the reviewed TSVs.

### Step 3 - Update existing browser surfaces

Adapt the Condition, Gene, Compare, Pathway, and Downloads surfaces only where
their current data contracts depend on the old condition files. Keep the
existing visual language and interactions. Make significant hits use the
fixed `abs(log2FC) > 1` plus Stouffer rule; avoid exposing unnecessary
threshold controls if the rule is no longer user-configurable.

**Manual review gate:** manually exercise each affected page, including
condition-to-gene links, gene plots with multiple batches, starred genes, and
comparison/heatmap behavior. Record any data or presentation discrepancy before
continuing.

### Step 4 - Implement the Mismatch Data tab

Add a dedicated Django app/page or an equivalent isolated tab using the
existing project routing conventions. Provide:

- gene/PAO1-ID selection;
- treatment/control comparison selection;
- graded mismatch-guide points;
- perfect-guide reference points;
- the simple plot/table response needed to reproduce the useful part of
  `AMG_sensitivity_single_genes_plots`;
- explicit handling for genes or comparisons with no mismatch rows.

The first implementation will use preprocessed TSV rows rather than executing
R from a web request. Curve fitting/EC50 behavior will only be added if the
reviewed data and manual evaluation show that it is necessary.

**Manual review gate:** compare selected genes and comparison series against
the R analysis inputs/plots, check missing-data behavior, and verify that the
new tab does not alter the existing tabs.

### Step 5 - Validate and document the completed data contract

Add focused Django/Python tests for dataset selection, significance
classification, mismatch filtering, and malformed-input errors. Run Django
checks and the smallest relevant test set in `pseudoBrowser`. Update the
project README and architecture documentation with the final TSV names,
preparation command, endpoints, and manual verification instructions.

**Final review gate:** manually start the development server, exercise every
tab and download/API path, and approve the browser behavior before any
cleanup or compression of the TSVs.

## Current status

- Plan created.
- Step 1 completed: `scripts/prepare_browser_data.py` now generates
  `dataFiles2/prepared_browser/comparison_manifest.tsv`,
  `condition_gene_data.tsv`, `guide_data.tsv`, `mismatch_data.tsv`, and
  `data_audit.tsv`.
- Step 1 validation completed in the `pseudoBrowser` environment:
  the preparation script compiles and runs successfully.
- Step 1 manual review approved.
- Step 2 completed for the shared Gene and Condition data path:
  prepared guide/gene TSVs are loaded by Django, the fixed significance rule
  is returned by the volcano API, and gene data uses the prepared guide rows.
- Step 2 automated validation completed: `manage.py check`, loader calls, and
  both JSON endpoints succeeded in `pseudoBrowser`.
- Step 2 manual review is pending. Check the existing Gene and Condition
  pages and their displayed/API data before Step 3 changes the controls and
  remaining browser surfaces.
- Manual review feedback fixed before Step 3: the Gene window numeric input
  now accepts integer values from 100 to the maximum, while the range slider
  remains on its existing 1,000-bp increments. Django checks and rendered
  template validation passed.
- Step 3 implementation completed for the current browser surfaces:
  Condition now uses only the fixed `abs(log2FC) > 1` and Stouffer
  `p < 0.05` rule, its client-side volcano plot uses server-provided
  significance flags, and Compare uses prepared gene-level medians.
- Step 3 automated validation completed: Django checks, prepared-data
  loader checks, and rendered-page smoke tests passed.
- Step 3 review adjustments completed: Condition threshold controls are
  restored with defaults matching the fixed significance rule, and Compare
  renders genes on the X axis and conditions on the Y axis.
- Step 3 latest review adjustments completed: Condition now keeps only the
  condition selector and Generate Plot action inside the expanded volcano
  card, the first condition loads automatically, the volcano uses
  `-log10(Stouffer p)` with the equivalent `p = 0.05` threshold, and its
  table retains raw Stouffer p-values while containing only rows passing
  `abs(log2FC) > 1` and `p_stouffer < 0.05`. The Compare dendrogram is above
  the heatmap with roots at the top and leaves aligned toward the heatmap.
- Step 3 final manual review is pending before adding the Mismatch Data tab.
- Step 3 final manual review approved.
- Step 4 revised implementation completed: Guides is restored as its own
  unchanged route, while Mismatch Data is a separate app and navigation tab.
  Its Python payload follows the R analysis flow with normalized guide
  activity, binned medians, severity, sensitivity/protection crossings,
  sigmoid predictions, and EC50, plus GeneAutocomplete and a compact
  selector card.
- Step 4 revised automated validation completed: Django checks, Python
  compilation, both page routes, and the representative mismatch endpoint
  passed.
- Step 4 manual review is pending against representative R-analysis genes
  and comparison series.
- Step 4 table review adjustment completed: Gene, Condition, Pathway, and
  Mismatch Data tables use the shared DataTables behavior with search,
  ordering, pagination, Copy, and Excel actions; CSV actions are absent.
- Step 5 completed: focused Django tests cover the fixed significance rule,
  prepared data loading, mismatch normalization and summaries, missing-data
  errors, and endpoint validation. README and architecture documentation now
  describe the prepared TSVs, regeneration command, `/mismatch/` route, and
  manual table checks.
- Guides follow-up completed: the existing Guides app now ranks perfect
  guides by the available Kawalek score and experimental metrics through
  `/guides/api/data/`, with a searchable/exportable comparison table. The
  response is ready for additional model-score columns when supplied.
