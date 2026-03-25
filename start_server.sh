#!/bin/bash

# CRISPRi-seq Browser - Start Development Server
# Activates the mamba environment and starts the Django server

echo "Starting CRISPRi-seq Data Browser..."
echo "=================================="
echo ""
echo "Activating pseudoBrowser environment..."

# Run the development server
conda run -n pseudoBrowser python manage.py runserver

echo "Server stopped."
