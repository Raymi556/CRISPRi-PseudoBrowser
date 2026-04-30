from django.urls import path
from . import views

app_name = 'condition'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/get-volcano-data/', views.get_volcano_data, name='get_volcano_data'),
]
