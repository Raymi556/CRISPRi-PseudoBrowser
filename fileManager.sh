#!/usr/bin/env bash

set -euo pipefail

DATA_DIR="dataFiles"
ARCHIVE_FILE="dataFiles.tar.gz"

usage() {
	cat <<'EOF'
Usage:
	./fileManager.sh -c | --compress
	./fileManager.sh -d | --decompress

Options:
	-c, --compress     Compress dataFiles into dataFiles.tar.gz
	-d, --decompress   Decompress dataFiles.tar.gz into dataFiles
	-h, --help         Show this help message
EOF
}

compress_data() {
	if [[ ! -d "$DATA_DIR" ]]; then
		echo "Error: directory '$DATA_DIR' not found."
		exit 1
	fi

	# Overwrite the archive to keep a single predictable file for GitHub workflows.
	tar -czf "$ARCHIVE_FILE" "$DATA_DIR"
	echo "Compressed '$DATA_DIR' -> '$ARCHIVE_FILE'"
}

decompress_data() {
	if [[ ! -f "$ARCHIVE_FILE" ]]; then
		echo "Error: archive '$ARCHIVE_FILE' not found."
		exit 1
	fi

	tar -xzf "$ARCHIVE_FILE"
	echo "Decompressed '$ARCHIVE_FILE' -> '$DATA_DIR'"
}

if [[ $# -ne 1 ]]; then
	usage
	exit 1
fi

case "$1" in
	-c|--compress)
		compress_data
		;;
	-d|--decompress)
		decompress_data
		;;
	-h|--help)
		usage
		;;
	*)
		echo "Error: unknown option '$1'"
		usage
		exit 1
		;;
esac
