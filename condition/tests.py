from django.test import TestCase

from downloads.models import Comparison, Gene, GeneConditionSummary
from .condition_analysis import prepare_volcano_data


class ConditionAnalysisTests(TestCase):
    def setUp(self):
        gene = Gene.objects.create(
            pao1_id="PA2019",
            gene_name="mexX",
            product_name="efflux protein",
            category="C",
            feature_type="CDS",
        )
        comparison = Comparison.objects.create(
            batch="B1",
            comparison_id="B1_test",
            raw_condition="test",
            display_label="Test condition",
            comparison_class="treatment",
            comparison_order=1,
        )
        GeneConditionSummary.objects.create(
            gene=gene,
            comparison=comparison,
            guide_type="perfect",
            med_lfc=2,
            p_stouffer=0.01,
            log10_p_stouffer=2,
            is_significant=True,
        )

    def test_prepared_data_contains_exact_significance_rule(self):
        result = prepare_volcano_data("Test condition")
        self.assertTrue(result["records"][0]["is_significant"])

    def test_volcano_data_uses_prepared_condition(self):
        condition = "Test condition"
        result = prepare_volcano_data(condition)

        self.assertEqual(result["condition"], condition)
        self.assertEqual(result["lfc_threshold"], 1.0)
        self.assertEqual(result["fdr_threshold"], 0.05)
        self.assertIn("significance_rule", result)
        self.assertGreater(result["total_genes"], 0)

    def test_unknown_condition_returns_error(self):
        self.assertIn("error", prepare_volcano_data("__missing_condition__"))
