#!/bin/bash

# CRISPRi-seq Browser - Start Development Server
# Activates the mamba environment and starts the Django server

echo "Starting CRISPRi-seq Data Browser..."
echo "=================================="
echo ""
echo "Activating pseudoBrowser environment..."

cd /home/rgoitia/10_apps/CRISPRi-PseudoBrowser

# Run the development server
mamba run -n pseudoBrowser python manage.py runserver

echo ""
echo "Server stopped."
