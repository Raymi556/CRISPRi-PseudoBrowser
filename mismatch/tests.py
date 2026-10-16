import json

from django.test import TestCase

from gene.data_loader import load_melted_results

from .analysis import prepare_mismatch_data


class MismatchAnalysisTests(TestCase):
    def test_mismatch_data_returns_records_and_summary(self):
        data = load_melted_results()
        row = data[data["type"].isin(["perfect", "mismatch"])].iloc[0]
        result = prepare_mismatch_data(row["PAO1_ID"], row["condition"])

        self.assertNotIn("error", result)
        self.assertGreater(len(result["records"]), 0)
        self.assertIn("severity", result["summary"])
        self.assertTrue(
            all(0.05 <= record["y_pred"] <= 1.0 for record in result["records"])
        )

    def test_missing_mismatch_gene_returns_error(self):
        result = prepare_mismatch_data("__missing_gene__", "B1_missing")
        self.assertIn("error", result)

    def test_data_endpoint_validates_requests(self):
        response = self.client.post(
            "/mismatch/api/data/",
            data=json.dumps({"gene": "", "condition": ""}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_data_endpoint_returns_not_found_for_missing_data(self):
        response = self.client.post(
            "/mismatch/api/data/",
            data=json.dumps({"gene": "__missing_gene__", "condition": "B1_missing"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)
