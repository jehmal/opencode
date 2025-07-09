package layout

import (
	"math"
	"strings"
)

// DynamicSizingConfig holds configuration for dynamic panel sizing
type DynamicSizingConfig struct {
	// MaxHeightPercent is the maximum height as a percentage of screen height (0.0-1.0)
	MaxHeightPercent float64
	// MinHeight is the minimum height in lines
	MinHeight int
	// MaxHeight is the absolute maximum height in lines (0 = no limit)
	MaxHeight int
	// ContentPadding is extra padding to add to content height
	ContentPadding int
	// SmoothTransition enables gradual size changes
	SmoothTransition bool
	// TransitionStep is the maximum change per update when smooth transition is enabled
	TransitionStep int
}

// DefaultDynamicSizingConfig returns sensible defaults for dynamic sizing
func DefaultDynamicSizingConfig() DynamicSizingConfig {
	return DynamicSizingConfig{
		MaxHeightPercent: 0.3,  // 30% of screen height
		MinHeight:        3,    // Minimum 3 lines
		MaxHeight:        0,    // No absolute maximum
		ContentPadding:   2,    // 2 lines of padding
		SmoothTransition: true, // Enable smooth transitions
		TransitionStep:   2,    // Change by max 2 lines per update
	}
}

// DynamicSizer manages dynamic sizing for UI panels
type DynamicSizer struct {
	config      DynamicSizingConfig
	currentSize int
	targetSize  int
}

// NewDynamicSizer creates a new dynamic sizer with the given configuration
func NewDynamicSizer(config DynamicSizingConfig) *DynamicSizer {
	return &DynamicSizer{
		config:      config,
		currentSize: config.MinHeight,
		targetSize:  config.MinHeight,
	}
}

// CalculateSize determines the optimal size for a panel based on content and screen constraints
func (ds *DynamicSizer) CalculateSize(contentHeight, screenHeight, screenWidth int) int {
	// Start with content height plus padding
	desiredHeight := contentHeight + ds.config.ContentPadding

	// Apply minimum height constraint first
	if desiredHeight < ds.config.MinHeight {
		desiredHeight = ds.config.MinHeight
	}

	// Handle edge case: zero or very small screen height
	if screenHeight <= 0 {
		ds.targetSize = ds.config.MinHeight
		ds.currentSize = ds.config.MinHeight
		return ds.config.MinHeight
	}

	// Apply maximum height percentage constraint
	maxHeightFromPercent := int(float64(screenHeight) * ds.config.MaxHeightPercent)
	if maxHeightFromPercent < ds.config.MinHeight {
		maxHeightFromPercent = ds.config.MinHeight
	}

	if desiredHeight > maxHeightFromPercent {
		desiredHeight = maxHeightFromPercent
	}

	// Apply absolute maximum height constraint if set
	if ds.config.MaxHeight > 0 && desiredHeight > ds.config.MaxHeight {
		desiredHeight = ds.config.MaxHeight
	}

	// Ensure we don't exceed screen height
	if desiredHeight > screenHeight {
		desiredHeight = screenHeight
	}

	ds.targetSize = desiredHeight

	// Apply smooth transition if enabled
	if ds.config.SmoothTransition {
		return ds.getSmoothedSize()
	}

	ds.currentSize = desiredHeight
	return desiredHeight
}

// getSmoothedSize applies smooth transitions to size changes
func (ds *DynamicSizer) getSmoothedSize() int {
	if ds.currentSize == ds.targetSize {
		return ds.currentSize
	}

	diff := ds.targetSize - ds.currentSize
	step := ds.config.TransitionStep

	if diff > 0 {
		// Growing
		ds.currentSize += int(math.Min(float64(step), float64(diff)))
	} else {
		// Shrinking
		ds.currentSize -= int(math.Min(float64(step), float64(-diff)))
	}

	return ds.currentSize
}

// GetCurrentSize returns the current size
func (ds *DynamicSizer) GetCurrentSize() int {
	return ds.currentSize
}

// GetTargetSize returns the target size
func (ds *DynamicSizer) GetTargetSize() int {
	return ds.targetSize
}

// IsTransitioning returns true if the sizer is currently transitioning between sizes
func (ds *DynamicSizer) IsTransitioning() bool {
	return ds.currentSize != ds.targetSize
}

// SetCurrentSize manually sets the current size (useful for initialization)
func (ds *DynamicSizer) SetCurrentSize(size int) {
	ds.currentSize = size
}

// UpdateConfig updates the sizing configuration
func (ds *DynamicSizer) UpdateConfig(config DynamicSizingConfig) {
	ds.config = config
}

// ResponsiveSizingPresets provides common sizing configurations for different use cases
var ResponsiveSizingPresets = map[string]DynamicSizingConfig{
	"compact": {
		MaxHeightPercent: 0.25, // 25% max
		MinHeight:        2,
		MaxHeight:        10,
		ContentPadding:   1,
		SmoothTransition: true,
		TransitionStep:   1,
	},
	"normal": DefaultDynamicSizingConfig(),
	"generous": {
		MaxHeightPercent: 0.4, // 40% max
		MinHeight:        5,
		MaxHeight:        0, // No absolute limit
		ContentPadding:   3,
		SmoothTransition: true,
		TransitionStep:   3,
	},
	"fullscreen": {
		MaxHeightPercent: 0.8, // 80% max
		MinHeight:        10,
		MaxHeight:        0,
		ContentPadding:   5,
		SmoothTransition: true,
		TransitionStep:   5,
	},
}

// GetPreset returns a preset configuration by name
func GetPreset(name string) (DynamicSizingConfig, bool) {
	config, exists := ResponsiveSizingPresets[name]
	return config, exists
}

// CalculateContentHeight estimates content height from a string
func CalculateContentHeight(content string) int {
	if content == "" {
		return 0
	}

	lines := 1
	for _, char := range content {
		if char == '\n' {
			lines++
		}
	}
	return lines
}

// CalculateContentHeightWithWidth estimates content height considering word wrapping
func CalculateContentHeightWithWidth(content string, width int) int {
	if content == "" || width <= 0 {
		return 0
	}

	// Split content by explicit newlines first
	paragraphs := strings.Split(content, "\n")
	totalLines := 0

	for _, paragraph := range paragraphs {
		if paragraph == "" {
			// Empty line (like between paragraphs)
			totalLines++
			continue
		}

		// Calculate wrapped lines for this paragraph
		paragraphLines := 0
		currentLineLength := 0

		words := strings.Fields(paragraph)
		if len(words) == 0 {
			paragraphLines = 1 // Empty paragraph still takes one line
		} else {
			for _, word := range words {
				wordLength := len(word)

				// If adding this word would exceed width, start new line
				if currentLineLength > 0 && currentLineLength+1+wordLength > width {
					paragraphLines++
					currentLineLength = wordLength
				} else {
					// Add word to current line
					if currentLineLength > 0 {
						currentLineLength++ // Space before word
					}
					currentLineLength += wordLength
				}
			}

			// Count the last line if there's content
			if currentLineLength > 0 {
				paragraphLines++
			}
		}

		totalLines += paragraphLines
	}

	return totalLines
}
