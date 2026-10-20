from django.contrib import admin
from django.urls import path, include
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.home, name='home'),
    path('gene/', include('gene.urls')),
    path('guides/', include('guides.urls')),
    path('condition/', include('condition.urls')),
    path('pathway/', include('pathway.urls')),
    path('compare/', include('compare.urls')),
    path('downloads/', include('downloads.urls')),
    path('mismatch/', include('mismatch.urls')),
]
