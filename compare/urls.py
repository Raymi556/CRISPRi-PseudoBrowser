from django.urls import path
from . import views

app_name = 'compare'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/starred-genes/', views.get_starred_genes, name='starred_genes'),
    path('api/remove-starred-gene/', views.remove_starred_gene, name='remove_starred_gene'),
    path('api/heatmap/', views.get_heatmap, name='heatmap'),
]
