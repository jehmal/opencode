#!/bin/bash

echo "DGMO TUI Vision Test Script"
echo "==========================="
echo ""
echo "This script demonstrates the TUI vision capabilities."
echo ""
echo "Test cases:"
echo "1. Single image: Type 'analyze test-image.png'"
echo "2. Multiple images: Type 'compare before.png and after.png'"
echo "3. Windows path: Type 'look at C:\\Users\\name\\image.jpg'"
echo "4. Invalid path: Type 'analyze missing.png' (should show error)"
echo ""
echo "Starting DGMO TUI..."
echo ""

# Create a test image if it doesn't exist
if [ ! -f "test-image.png" ]; then
    echo "Creating test-image.png..."
    # Create a simple 1x1 pixel PNG
    printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > test-image.png
fi

echo "Test image created. You can now run 'dgmo' and test with:"
echo "  - analyze test-image.png"
echo "  - analyze $PWD/test-image.png"
echo ""