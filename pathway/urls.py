from django.urls import path
from . import views

app_name = 'pathway'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/dataset-records/', views.get_dataset_records, name='dataset_records'),
    path('api/terms/', views.get_terms, name='terms'),
    path('api/term-genes/', views.get_term_genes, name='term_genes'),
    path('api/sync-starred/', views.sync_starred_genes, name='sync_starred'),
    path('api/starred-genes/', views.get_starred_genes, name='starred_genes'),
]
