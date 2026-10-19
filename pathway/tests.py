from django.test import TestCase

from downloads.models import PathwayRecord


class PathwayDatabaseTests(TestCase):
    def test_pathway_records_store_page_fields_for_each_dataset(self):
        PathwayRecord.objects.bulk_create(
            [
                PathwayRecord(
                    dataset="cog",
                    pao1_id="PA0001",
                    product_name="DnaA",
                    accession="COG0593",
                    term_name="Replication",
                    category="replication",
                ),
                PathwayRecord(
                    dataset="go",
                    pao1_id="PA0001",
                    gene_name="dnaA",
                    product_name="DnaA",
                    accession="GO:0005524",
                    term_name="ATP binding",
                    category="molecular_function",
                ),
            ]
        )

        self.assertEqual(PathwayRecord.objects.values("dataset").distinct().count(), 2)
