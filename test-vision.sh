#!/bin/bash

# Test script for DGMO vision capabilities

echo "Testing DGMO Vision Capabilities"
echo "================================"

# Create a simple test image using ImageMagick (if available) or download one
if command -v convert &> /dev/null; then
    echo "Creating test image with ImageMagick..."
    convert -size 200x100 xc:lightblue -pointsize 20 -draw "text 20,50 'DGMO Vision Test'" test-image.png
    echo "Created test-image.png"
else
    echo "ImageMagick not found. Please create a test image manually."
    echo "You can use any PNG, JPG, or other supported image format."
fi

echo ""
echo "Test Commands:"
echo "=============="
echo ""
echo "1. Test with quoted path:"
echo '   dgmo run "Look at this image and tell me what you see: \"test-image.png\""'
echo ""
echo "2. Test with backtick path:"
echo '   dgmo run "Analyze `test-image.png` and describe its contents"'
echo ""
echo "3. Test with full path:"
echo '   dgmo run "What is in C:\\Users\\jehma\\Desktop\\AI\\DGMSTT\\test-image.png"'
echo ""
echo "4. Test with multiple images:"
echo '   dgmo run "Compare \"image1.png\" and \"image2.png\""'
echo ""
echo "5. Test with non-existent image (error handling):"
echo '   dgmo run "Look at \"nonexistent.png\""'
echo ""
echo "6. Test with the screenshot provided:"
echo '   dgmo run "Analyze the screenshot at \"Screenshot 2025-07-03 095403.png\""'

chmod +x test-vision.sh