from django.test import TestCase

from downloads.models import Comparison, Gene, Guide, GuideObservation


class GuidesViewTests(TestCase):
    def setUp(self):
        gene = Gene.objects.create(pao1_id="PA2019", gene_name="mexX")
        comparison = Comparison.objects.create(
            batch="B1",
            comparison_id="B1_test",
            raw_condition="test",
            display_label="Test",
            comparison_class="treatment",
            comparison_order=1,
        )
        guide = Guide.objects.create(
            identity_key="PA2019|ACGT|perfect|",
            gene=gene,
            spacer="ACGT",
            guide_type="perfect",
            predicted_efficacy_score=0.9,
            off_target_n=1,
            mean_abund_50m=100,
        )
        GuideObservation.objects.create(
            guide=guide,
            comparison=comparison,
            lfc_adj=-2,
        )

    def test_guides_page_and_ranked_data_endpoint(self):
        page = self.client.get("/guides/")
        self.assertEqual(page.status_code, 200)

        response = self.client.get("/guides/api/data/?gene=mexX")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreater(len(payload["records"]), 0)
        self.assertIn("kawalek_score", payload["records"][0])
        self.assertIn("median_lfc", payload["records"][0])

    def test_guides_endpoint_requires_gene(self):
        response = self.client.get("/guides/api/data/")
        self.assertEqual(response.status_code, 400)

    def test_guides_endpoint_reports_unknown_gene(self):
        response = self.client.get("/guides/api/data/?gene=__missing_gene__")
        self.assertEqual(response.status_code, 404)
