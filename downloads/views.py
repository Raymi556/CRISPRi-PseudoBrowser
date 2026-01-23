from django.shortcuts import render

def index(request):
    """Downloads view - Coming Soon"""
    return render(request, 'downloads/index.html')
