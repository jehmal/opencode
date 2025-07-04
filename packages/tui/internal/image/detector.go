package image

import (
	"path/filepath"
	"regexp"
	"strings"
)

// IsImageFile checks if a file has an image extension
func IsImageFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp":
		return true
	default:
		return false
	}
}

// ConvertWindowsPath converts Windows paths to WSL format
func ConvertWindowsPath(path string) string {
	// Check if it's a Windows path (e.g., C:\path\to\file)
	windowsPathRegex := regexp.MustCompile(`^([A-Za-z]):\\(.*)`)
	matches := windowsPathRegex.FindStringSubmatch(path)

	if len(matches) == 3 {
		// Convert to WSL format: /mnt/c/path/to/file
		drive := strings.ToLower(matches[1])
		pathPart := strings.ReplaceAll(matches[2], "\\", "/")
		return "/mnt/" + drive + "/" + pathPart
	}

	// If not a Windows path, return as-is
	return path
}

// ExtractImagePaths extracts image file paths from text
func ExtractImagePaths(text string) []string {
	var paths []string

	// Regex patterns for different path formats
	patterns := []string{
		// Quoted paths (single or double quotes)
		`["']([^"']*\.(?:png|jpg|jpeg|gif|webp|bmp))["']`,
		// Backtick paths
		"`([^`]*\\.(?:png|jpg|jpeg|gif|webp|bmp))`",
		// Unquoted paths with full path
		`(?:^|\s)((?:[A-Za-z]:[\\\/]|\/)[^\s]*\.(?:png|jpg|jpeg|gif|webp|bmp))(?:\s|$)`,
		// Simple filenames
		`(?:^|\s)([^\s]+\.(?:png|jpg|jpeg|gif|webp|bmp))(?:\s|$)`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile("(?i)" + pattern)
		matches := re.FindAllStringSubmatch(text, -1)
		for _, match := range matches {
			if len(match) > 1 {
				path := strings.TrimSpace(match[1])
				// Convert Windows paths to WSL format
				path = ConvertWindowsPath(path)
				paths = append(paths, path)
			}
		}
	}

	// Remove duplicates
	seen := make(map[string]bool)
	var uniquePaths []string
	for _, path := range paths {
		if !seen[path] {
			seen[path] = true
			uniquePaths = append(uniquePaths, path)
		}
	}

	return uniquePaths
}
