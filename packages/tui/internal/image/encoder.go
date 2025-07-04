package image

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const MaxImageSize = 5 * 1024 * 1024 // 5MB

// GetMimeType returns the MIME type for an image file
func GetMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	default:
		return "application/octet-stream"
	}
}

// ReadImageAsBase64 reads an image file and returns it as a base64 data URL
func ReadImageAsBase64(filePath string) (string, error) {
	// Convert Windows path if needed
	normalizedPath := ConvertWindowsPath(filePath)

	// Check if file exists
	info, err := os.Stat(normalizedPath)
	if err != nil {
		return "", fmt.Errorf("image file not found: %s", filePath)
	}

	// Check file size
	if info.Size() > MaxImageSize {
		return "", fmt.Errorf("image file too large: %d bytes (max: %d bytes)", info.Size(), MaxImageSize)
	}

	// Read file
	data, err := os.ReadFile(normalizedPath)
	if err != nil {
		return "", fmt.Errorf("failed to read image: %w", err)
	}

	// Encode to base64
	base64Data := base64.StdEncoding.EncodeToString(data)
	mimeType := GetMimeType(normalizedPath)

	// Return as data URL
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data), nil
}
