from django.shortcuts import render

def index(request):
    """Guides browser view - Coming Soon"""
    return render(request, 'guides/index.html')
