from django.urls import path
from . import views

app_name = 'downloads'

urlpatterns = [
    path('', views.index, name='index'),
    path('<slug:dataset>/', views.download_dataset, name='download_dataset'),
]
