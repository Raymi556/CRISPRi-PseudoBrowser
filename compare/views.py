from django.shortcuts import render

def index(request):
    """Compare view - Coming Soon"""
    return render(request, 'compare/index.html')
