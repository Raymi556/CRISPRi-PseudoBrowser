from django.shortcuts import render

def index(request):
    """Condition browser view - Coming Soon"""
    return render(request, 'condition/index.html')
