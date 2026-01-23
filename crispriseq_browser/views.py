from django.shortcuts import render

def home(request):
    """Main landing page for CRISPRi-seq Browser"""
    return render(request, 'home.html')
