from django.urls import path
from . import views

app_name = 'gene'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/get-gene-data/', views.get_gene_data, name='get_gene_data'),
    path('api/gene-list/', views.get_gene_list_api, name='gene_list'),
]
