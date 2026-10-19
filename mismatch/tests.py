import json

from django.test import TestCase

from downloads.models import Comparison, Gene, Guide, GuideObservation

from .analysis import prepare_mismatch_data


class MismatchAnalysisTests(TestCase):
    def setUp(self):
        gene = Gene.objects.create(pao1_id="PA2019", gene_name="mexX")
        comparison = Comparison.objects.create(
            batch="B1",
            comparison_id="B1_test",
            raw_condition="test",
            display_label="Test condition",
            comparison_class="treatment",
            comparison_order=1,
        )
        perfect = Guide.objects.create(
            identity_key="PA2019|PERFECT|perfect|",
            gene=gene,
            spacer="PERFECT",
            guide_type="perfect",
            y_pred=1,
        )
        mismatch = Guide.objects.create(
            identity_key="PA2019|MISMATCH|mismatch|PERFECT",
            gene=gene,
            spacer="MISMATCH",
            original="PERFECT",
            guide_type="mismatch",
            y_pred=0.5,
        )
        GuideObservation.objects.create(
            guide=perfect,
            comparison=comparison,
            lfc_adj=-2,
        )
        GuideObservation.objects.create(
            guide=mismatch,
            comparison=comparison,
            lfc_adj=-1,
        )

    def test_mismatch_data_returns_records_and_summary(self):
        result = prepare_mismatch_data("PA2019", "Test condition")

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
