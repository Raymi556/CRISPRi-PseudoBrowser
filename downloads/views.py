import csv

from django.http import Http404, StreamingHttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from .models import (
    Comparison,
    Gene,
    GeneConditionSummary,
    Guide,
    GuideObservation,
    PathwayRecord,
)


DOWNLOAD_DATASETS = {
    "gene_annotation": {
        "label": "Gene annotation",
        "description": "Reference identifiers, names, products, feature types, coordinates, and strands for joining results to the PAO1 genome.",
        "use": "Use this as the lookup table for gene identity and genomic context.",
        "filename": "gene_annotation.csv",
        "queryset": Gene.objects.all().order_by("pao1_id"),
        "columns": [
            "pao1_id", "pa14_id", "gene_name", "product_name", "category",
            "feature_type", "start", "end", "strand",
        ],
    },
    "comparison_manifest": {
        "label": "Comparison manifest",
        "description": "The condition and batch labels used throughout the browser, including display order and comparison class.",
        "use": "Use this to decode comparison IDs and preserve experimental context when joining exports.",
        "filename": "comparison_manifest.csv",
        "queryset": Comparison.objects.all().order_by(
            "batch", "comparison_order", "comparison_id"
        ),
        "columns": [
            "batch", "comparison_id", "raw_condition", "display_label",
            "comparison_class", "comparison_order",
        ],
    },
    "guide_metadata": {
        "label": "Guide metadata",
        "description": "Guide sequences, perfect or mismatch type, predicted efficacy, abundance, GC, PAM, and off-target metadata.",
        "use": "Use this to select or annotate guides before interpreting their measured effects.",
        "filename": "guide_metadata.csv",
        "queryset": Guide.objects.all().order_by("gene__pao1_id", "spacer"),
        "columns": [
            "gene__pao1_id", "gene__gene_name", "spacer", "original",
            "guide_type", "y_pred", "offset", "tu", "pam", "downstream",
            "off_target_n", "mean_abund_50m", "gc",
            "predicted_efficacy_score", "score_status",
        ],
    },
    "guide_observations": {
        "label": "Guide observations",
        "description": "Guide-level LFC and statistical measurements for every guide and comparison.",
        "use": "Use this for detailed guide-level analysis; it is the largest export.",
        "filename": "guide_observations.csv",
        "queryset": GuideObservation.objects.all().order_by(
            "guide__gene__pao1_id", "guide__spacer", "comparison__comparison_id"
        ),
        "columns": [
            "guide__gene__pao1_id", "guide__gene__gene_name", "guide__spacer",
            "guide__original", "guide__guide_type", "comparison__batch",
            "comparison__comparison_id", "comparison__display_label",
            "lfc", "pvalue", "lfc_adj", "shift", "base",
        ],
    },
    "gene_condition_summaries": {
        "label": "Gene-condition summaries",
        "description": "Gene-level median LFC, Stouffer p-values, significance flags, and condition metadata.",
        "use": "Use this for condition-wide screening, volcano-plot reproduction, and cross-condition summaries.",
        "filename": "gene_condition_summaries.csv",
        "queryset": GeneConditionSummary.objects.all().order_by(
            "gene__pao1_id", "comparison__comparison_id", "guide_type"
        ),
        "columns": [
            "gene__pao1_id", "gene__gene_name", "comparison__batch",
            "comparison__comparison_id", "comparison__display_label",
            "guide_type", "med_lfc", "p_stouffer", "log10_p_stouffer",
            "is_significant", "shift", "base",
        ],
    },
    "mismatch_observations": {
        "label": "Mismatch observations",
        "description": "The perfect and mismatch guide measurements used by the Mismatch Data tab.",
        "use": "Use this for mismatch-response analysis without downloading unrelated guide types.",
        "filename": "mismatch_observations.csv",
        "queryset": GuideObservation.objects.filter(
            guide__guide_type__in=["perfect", "mismatch"]
        ).order_by(
            "guide__gene__pao1_id", "guide__spacer", "comparison__comparison_id"
        ),
        "columns": [
            "guide__gene__pao1_id", "guide__gene__gene_name", "guide__spacer",
            "guide__original", "guide__guide_type", "guide__y_pred",
            "comparison__batch", "comparison__comparison_id",
            "comparison__display_label", "lfc", "pvalue", "lfc_adj",
            "shift", "base",
        ],
    },
    "pathway_cog": {
        "label": "COG pathway records",
        "description": "COG accessions, terms, categories, and linked PAO1 genes used by Pathway Analysis.",
        "use": "Use this to reproduce or annotate COG-based gene-set selection.",
        "filename": "pao1_cog.csv",
        "queryset": PathwayRecord.objects.filter(dataset="cog"),
        "columns": [
            "pao1_id", "gene_name", "product_name", "accession",
            "term_name", "category",
        ],
    },
    "pathway_go": {
        "label": "Gene Ontology pathway records",
        "description": "Gene Ontology accessions, terms, categories, and linked PAO1 genes used by Pathway Analysis.",
        "use": "Use this to reproduce or annotate GO-based gene-set selection.",
        "filename": "pao1_gene_ontology.csv",
        "queryset": PathwayRecord.objects.filter(dataset="go"),
        "columns": [
            "pao1_id", "gene_name", "product_name", "accession",
            "term_name", "category",
        ],
    },
}

class Echo:
    def write(self, value):
        return value


def stream_csv_rows(dataset):
    columns = DOWNLOAD_DATASETS[dataset]["columns"]
    writer = csv.writer(Echo())
    yield writer.writerow(columns)
    values = DOWNLOAD_DATASETS[dataset]["queryset"].values_list(*columns)
    for row in values.iterator(chunk_size=1000):
        yield writer.writerow(row)


def index(request):
    datasets = [
        {
            "key": key,
            "label": config["label"],
            "description": config["description"],
            "use": config["use"],
            "large": key == "guide_observations",
            "url": f"/downloads/{key}/",
        }
        for key, config in DOWNLOAD_DATASETS.items()
    ]
    return render(request, "downloads/index.html", {"datasets": datasets})


@require_GET
def download_dataset(request, dataset):
    if dataset not in DOWNLOAD_DATASETS:
        raise Http404("Download dataset not found.")

    response = StreamingHttpResponse(
        stream_csv_rows(dataset),
        content_type="text/csv; charset=utf-8",
    )
    response["Content-Disposition"] = (
        f'attachment; filename="{DOWNLOAD_DATASETS[dataset]["filename"]}"'
    )
    response["Content-Encoding"] = "identity"
    return response
