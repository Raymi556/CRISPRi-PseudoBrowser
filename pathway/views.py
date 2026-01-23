from django.shortcuts import render

def index(request):
    """Pathway browser view - Coming Soon"""
    return render(request, 'pathway/index.html')
