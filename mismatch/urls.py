from django.urls import path

from . import views

app_name = "mismatch"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/data/", views.get_data, name="get_data"),
]
