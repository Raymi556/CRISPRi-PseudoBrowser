from django.test import TestCase

from .condition_analysis import prepare_volcano_data
from gene.data_loader import load_condition_gene_data


class ConditionAnalysisTests(TestCase):
    def test_prepared_data_contains_exact_significance_rule(self):
        data = load_condition_gene_data()
        expected = data["medLFC"].abs().gt(1) & data["p_stouffer"].lt(0.05)
        self.assertTrue(data["is_significant"].equals(expected))

    def test_volcano_data_uses_prepared_condition(self):
        condition = load_condition_gene_data()["condition"].iloc[0]
        result = prepare_volcano_data(condition)

        self.assertEqual(result["condition"], condition)
        self.assertEqual(result["lfc_threshold"], 1.0)
        self.assertEqual(result["fdr_threshold"], 0.05)
        self.assertIn("significance_rule", result)
        self.assertGreater(result["total_genes"], 0)

    def test_unknown_condition_returns_error(self):
        self.assertIn("error", prepare_volcano_data("__missing_condition__"))
