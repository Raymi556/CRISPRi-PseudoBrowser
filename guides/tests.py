from django.test import TestCase


class GuidesViewTests(TestCase):
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
