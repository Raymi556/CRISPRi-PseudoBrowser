from django.test import TestCase

from downloads.models import Comparison, Gene, GeneConditionSummary
from pathway.models import StarredGene

from .heatmap_analysis import prepare_compare_heatmap_data


class CompareHeatmapTests(TestCase):
    def setUp(self):
        self.gene = Gene.objects.create(
            pao1_id="PA2019",
            gene_name="mexX",
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
            gene=self.gene,
            comparison=comparison,
            guide_type="perfect",
            med_lfc=1.5,
        )
        StarredGene.objects.create(PAO1_ID="PA2019", gene_name="mexX")

    def test_heatmap_uses_database_gene_summaries(self):
        result = prepare_compare_heatmap_data(
            [{"PAO1_ID": "PA2019", "gene_name": "mexX"}]
        )

        self.assertEqual(result["conditions"], ["Test condition"])
        self.assertEqual(result["pao1_ids"], ["PA2019"])
        self.assertEqual(result["z_lfc"], [[1.5]])

    def test_heatmap_requires_starred_genes(self):
        with self.assertRaisesMessage(
            ValueError, "No starred genes found. Add genes in Pathway first."
        ):
            prepare_compare_heatmap_data([])
