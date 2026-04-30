from django.db import models


class StarredGene(models.Model):
	"""Global list of user-selected genes from pathway term selections."""
	PAO1_ID = models.CharField(max_length=64, unique=True)
	gene_name = models.CharField(max_length=255, blank=True)
	source_dataset = models.CharField(max_length=32, blank=True)
	source_accession = models.CharField(max_length=128, blank=True)
	source_term_name = models.CharField(max_length=512, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['PAO1_ID']

	def __str__(self):
		if self.gene_name:
			return f"{self.PAO1_ID} ({self.gene_name})"
		return self.PAO1_ID
