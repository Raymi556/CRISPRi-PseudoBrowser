#!/usr/bin/env bash

set -euo pipefail

environment_name="pseudoBrowser"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${CONDA_DEFAULT_ENV:-}" != "$environment_name" ]]; then
    if command -v conda >/dev/null 2>&1; then
        conda_base="$(conda info --base)"
    else
        conda_base=""
        for candidate in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda"; do
            if [[ -f "$candidate/etc/profile.d/conda.sh" ]]; then
                conda_base="$candidate"
                break
            fi
        done
    fi

    if [[ -z "$conda_base" || ! -f "$conda_base/etc/profile.d/conda.sh" ]]; then
        printf '%s\n' "Error: Conda installation was not found." >&2
        exit 1
    fi

    # shellcheck source=/dev/null
    source "$conda_base/etc/profile.d/conda.sh"
    conda activate "$environment_name"
fi

cd "$script_dir"
printf '%s\n' \
    "Running server in Conda environment: $environment_name" \
    "Open: http://127.0.0.1:8000/" \
    "Stop the server with ctrl+C (or cmd+C on macOS)."

python manage.py runserver --insecure
