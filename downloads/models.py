from django.db import models


class Gene(models.Model):
    pao1_id = models.CharField(max_length=32, unique=True)
    pa14_id = models.CharField(max_length=32, blank=True)
    gene_name = models.CharField(max_length=255, blank=True, db_index=True)
    product_name = models.TextField(blank=True)
    category = models.CharField(max_length=255, blank=True)
    feature_type = models.CharField(max_length=64, blank=True)
    start = models.IntegerField(null=True, blank=True)
    end = models.IntegerField(null=True, blank=True)
    strand = models.CharField(max_length=8, blank=True)

    class Meta:
        ordering = ["pao1_id"]


class Comparison(models.Model):
    batch = models.CharField(max_length=16, db_index=True)
    comparison_id = models.CharField(max_length=255, unique=True)
    raw_condition = models.CharField(max_length=255)
    display_label = models.CharField(max_length=255)
    comparison_class = models.CharField(max_length=32)
    comparison_order = models.PositiveIntegerField()

    class Meta:
        ordering = ["batch", "comparison_order", "comparison_id"]


class Guide(models.Model):
    identity_key = models.CharField(max_length=512, unique=True)
    gene = models.ForeignKey(
        Gene, null=True, blank=True, on_delete=models.PROTECT, related_name="guides"
    )
    spacer = models.CharField(max_length=64, db_index=True)
    original = models.CharField(max_length=64, blank=True)
    guide_type = models.CharField(max_length=32, db_index=True)
    y_pred = models.FloatField(null=True, blank=True)
    offset = models.FloatField(null=True, blank=True)
    tu = models.CharField(max_length=255, blank=True)
    pam = models.CharField(max_length=32, blank=True)
    downstream = models.CharField(max_length=255, blank=True)
    off_target_n = models.FloatField(null=True, blank=True)
    mean_abund_50m = models.FloatField(null=True, blank=True)
    gc = models.FloatField(null=True, blank=True)
    predicted_efficacy_score = models.FloatField(null=True, blank=True)
    score_status = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["gene", "guide_type"]),
            models.Index(fields=["spacer", "guide_type"]),
        ]


class GuideObservation(models.Model):
    guide = models.ForeignKey(
        Guide, on_delete=models.CASCADE, related_name="observations"
    )
    comparison = models.ForeignKey(
        Comparison, on_delete=models.CASCADE, related_name="guide_observations"
    )
    lfc = models.FloatField(null=True, blank=True)
    pvalue = models.FloatField(null=True, blank=True)
    lfc_adj = models.FloatField(null=True, blank=True)
    shift = models.CharField(max_length=255, blank=True)
    base = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["guide", "comparison"],
                name="unique_guide_comparison_observation",
            )
        ]
        indexes = [
            models.Index(fields=["comparison", "lfc_adj"]),
            models.Index(fields=["guide", "comparison"]),
        ]


class GeneConditionSummary(models.Model):
    gene = models.ForeignKey(
        Gene, on_delete=models.CASCADE, related_name="condition_summaries"
    )
    comparison = models.ForeignKey(
        Comparison, on_delete=models.CASCADE, related_name="gene_summaries"
    )
    guide_type = models.CharField(max_length=32)
    med_lfc = models.FloatField(null=True, blank=True)
    p_stouffer = models.FloatField(null=True, blank=True)
    log10_p_stouffer = models.FloatField(null=True, blank=True)
    is_significant = models.BooleanField(default=False)
    shift = models.CharField(max_length=255, blank=True)
    base = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["gene", "comparison", "guide_type"],
                name="unique_gene_comparison_summary",
            )
        ]
        indexes = [
            models.Index(fields=["comparison", "is_significant"]),
            models.Index(fields=["gene", "comparison"]),
        ]


class PathwayRecord(models.Model):
    dataset = models.CharField(max_length=16, db_index=True)
    pao1_id = models.CharField(max_length=32, db_index=True)
    gene_name = models.CharField(max_length=255, blank=True)
    product_name = models.TextField(blank=True)
    accession = models.CharField(max_length=128, db_index=True)
    term_name = models.TextField()
    category = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "dataset",
                    "pao1_id",
                    "accession",
                    "term_name",
                    "category",
                ],
                name="unique_pathway_record",
            )
        ]
        indexes = [
            models.Index(fields=["dataset", "accession", "term_name"]),
            models.Index(fields=["dataset", "pao1_id"]),
        ]
