#!/bin/bash

set -e

PROJECT_DIR="/Users/robpacey/Projects/9. Pacey32 Agency/pacey32_agency"
PYTHON="$PROJECT_DIR/.venv/bin/python"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR"

echo "=================================================="
echo "Cap refresh started: $(date)"
echo "=================================================="

echo ""
echo "Refreshing Team..."
"$PYTHON" -m cap.teamcap

echo ""
echo "Refreshing Player..."
"$PYTHON" -m cap.playercap

echo ""
echo "Refreshing Player Detail..."
"$PYTHON" -m cap.playercapdetail

echo ""
echo "=================================================="
echo "Cap refresh completed successfully: $(date)"
echo "=================================================="
