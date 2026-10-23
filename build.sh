#!/usr/bin/env bash

set -euo pipefail

if command -v conda >/dev/null 2>&1; then
    conda_base="$(conda info --base)"
else
    conda_base=""
    for candidate in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda"; do
        if [ -f "$candidate/etc/profile.d/conda.sh" ]; then
            conda_base="$candidate"
            break
        fi
    done
fi

if [ -z "$conda_base" ] || [ ! -f "$conda_base/etc/profile.d/conda.sh" ]; then
    printf '%s\n' "Error: Conda installation was not found." >&2
    exit 1
fi

source "$conda_base/etc/profile.d/conda.sh"
conda create -n pseudoBrowser python=3.11 -y
conda activate pseudoBrowser
pip install -r requirements.txt

database_parts=(data_import/db_part_*.gz)
if [ ${#database_parts[@]} -eq 0 ]; then
    printf '%s\n' "Error: No database parts were found in data_import/." >&2
    exit 1
fi

cat data_import/db_part_*.gz | gunzip > db.sqlite3

printf '%s\n' \
    "Build complete." \
    "Run: conda activate pseudoBrowser" \
    "Then run: python manage.py runserver" \
    "Open: http://127.0.0.1:8000/"
