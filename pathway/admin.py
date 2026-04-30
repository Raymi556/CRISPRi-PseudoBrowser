from django.contrib import admin
from .models import StarredGene


@admin.register(StarredGene)
class StarredGeneAdmin(admin.ModelAdmin):
	list_display = ('PAO1_ID', 'gene_name', 'source_dataset', 'source_accession', 'updated_at')
	search_fields = ('PAO1_ID', 'gene_name', 'source_accession', 'source_term_name')
	list_filter = ('source_dataset',)
