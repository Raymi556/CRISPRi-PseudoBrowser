from tempfile import SpooledTemporaryFile

from django.http import FileResponse, Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET
from openpyxl import Workbook

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
        "filename": "gene_annotation.xlsx",
        "queryset": Gene.objects.all().order_by("pao1_id"),
        "columns": [
            "pao1_id", "pa14_id", "gene_name", "product_name", "category",
            "feature_type", "start", "end", "strand",
        ],
    },
    "comparison_manifest": {
        "label": "Comparison manifest",
        "filename": "comparison_manifest.xlsx",
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
        "filename": "guide_metadata.xlsx",
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
        "filename": "guide_observations.xlsx",
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
        "filename": "gene_condition_summaries.xlsx",
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
        "filename": "mismatch_observations.xlsx",
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
        "filename": "pao1_cog.xlsx",
        "queryset": PathwayRecord.objects.filter(dataset="cog"),
        "columns": [
            "pao1_id", "gene_name", "product_name", "accession",
            "term_name", "category",
        ],
    },
    "pathway_go": {
        "label": "Gene Ontology pathway records",
        "filename": "pao1_gene_ontology.xlsx",
        "queryset": PathwayRecord.objects.filter(dataset="go"),
        "columns": [
            "pao1_id", "gene_name", "product_name", "accession",
            "term_name", "category",
        ],
    },
}

def create_excel_file(dataset):
    columns = DOWNLOAD_DATASETS[dataset]["columns"]
    file = SpooledTemporaryFile(max_size=10 * 1024 * 1024, mode="w+b")
    workbook = Workbook(write_only=True)
    worksheet = workbook.create_sheet(title="Data")
    worksheet.append(columns)
    values = DOWNLOAD_DATASETS[dataset]["queryset"].values_list(*columns)
    for row in values.iterator(chunk_size=1000):
        worksheet.append(row)
    workbook.save(file)
    file.seek(0)
    return file


def index(request):
    datasets = [
        {
            "key": key,
            "label": config["label"],
            "url": f"/downloads/{key}/",
        }
        for key, config in DOWNLOAD_DATASETS.items()
    ]
    return render(request, "downloads/index.html", {"datasets": datasets})


@require_GET
def download_dataset(request, dataset):
    if dataset not in DOWNLOAD_DATASETS:
        raise Http404("Download dataset not found.")

    file = create_excel_file(dataset)
    return FileResponse(
        file,
        as_attachment=True,
        filename=DOWNLOAD_DATASETS[dataset]["filename"],
        content_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    )
