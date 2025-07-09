package layout

import (
	"testing"
)

func TestDynamicSizer(t *testing.T) {
	config := DefaultDynamicSizingConfig()
	sizer := NewDynamicSizer(config)

	// Test basic sizing calculation
	t.Run("BasicSizing", func(t *testing.T) {
		// Small content should use minimum height
		size := sizer.CalculateSize(1, 100, 80)
		if size < config.MinHeight {
			t.Errorf("Expected size >= %d, got %d", config.MinHeight, size)
		}

		// Large content should be capped by percentage
		size = sizer.CalculateSize(50, 100, 80)
		maxExpected := int(float64(100) * config.MaxHeightPercent)
		if size > maxExpected {
			t.Errorf("Expected size <= %d, got %d", maxExpected, size)
		}
	})

	t.Run("SmoothTransitions", func(t *testing.T) {
		config := DynamicSizingConfig{
			MaxHeightPercent: 0.5,
			MinHeight:        5,
			MaxHeight:        0,
			ContentPadding:   2,
			SmoothTransition: true,
			TransitionStep:   2,
		}
		sizer := NewDynamicSizer(config)

		// Start with small size
		sizer.SetCurrentSize(5)

		// Request large size
		size := sizer.CalculateSize(20, 100, 80)

		// Should not jump immediately to target
		if size == 22 { // 20 + 2 padding
			t.Error("Expected smooth transition, but size jumped immediately")
		}

		// Should be transitioning
		if !sizer.IsTransitioning() {
			t.Error("Expected sizer to be transitioning")
		}
	})

	t.Run("Presets", func(t *testing.T) {
		presets := []string{"compact", "normal", "generous", "fullscreen"}

		for _, presetName := range presets {
			config, exists := GetPreset(presetName)
			if !exists {
				t.Errorf("Preset %s does not exist", presetName)
				continue
			}

			sizer := NewDynamicSizer(config)
			size := sizer.CalculateSize(10, 100, 80)

			if size < config.MinHeight {
				t.Errorf("Preset %s: size %d below minimum %d", presetName, size, config.MinHeight)
			}

			maxExpected := int(float64(100) * config.MaxHeightPercent)
			if size > maxExpected {
				t.Errorf("Preset %s: size %d above maximum %d", presetName, size, maxExpected)
			}
		}
	})
}

func TestCalculateContentHeight(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected int
	}{
		{"Empty", "", 0},
		{"Single line", "Hello world", 1},
		{"Multiple lines", "Line 1\nLine 2\nLine 3", 3},
		{"Trailing newline", "Line 1\nLine 2\n", 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateContentHeight(tt.content)
			if result != tt.expected {
				t.Errorf("Expected %d, got %d for content: %q", tt.expected, result, tt.content)
			}
		})
	}
}

func TestCalculateContentHeightWithWidth(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		width    int
		expected int
	}{
		{"Empty", "", 10, 0},
		{"Short line", "Hello", 10, 1},
		{"Exact width", "1234567890", 10, 1},
		{"Word wrap", "This is a long line that should wrap", 10, 5},
		{"Multiple paragraphs", "Short line\n\nAnother paragraph that is longer", 15, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateContentHeightWithWidth(tt.content, tt.width)
			if result != tt.expected {
				t.Errorf("Expected %d, got %d for content: %q (width: %d)", tt.expected, result, tt.content, tt.width)
			}
		})
	}
}

func TestDynamicSizerEdgeCases(t *testing.T) {
	t.Run("ZeroScreenHeight", func(t *testing.T) {
		config := DefaultDynamicSizingConfig()
		sizer := NewDynamicSizer(config)

		size := sizer.CalculateSize(10, 0, 80)
		if size != config.MinHeight {
			t.Errorf("Expected minimum height %d for zero screen, got %d", config.MinHeight, size)
		}
	})

	t.Run("VerySmallScreen", func(t *testing.T) {
		config := DefaultDynamicSizingConfig()
		sizer := NewDynamicSizer(config)

		size := sizer.CalculateSize(10, 5, 80)
		if size > 5 {
			t.Errorf("Expected size <= 5 for small screen, got %d", size)
		}
	})

	t.Run("AbsoluteMaxHeight", func(t *testing.T) {
		config := DynamicSizingConfig{
			MaxHeightPercent: 0.8,
			MinHeight:        3,
			MaxHeight:        15, // Absolute maximum
			ContentPadding:   2,
			SmoothTransition: false,
			TransitionStep:   1,
		}
		sizer := NewDynamicSizer(config)

		size := sizer.CalculateSize(50, 100, 80) // Large content, large screen
		if size > 15 {
			t.Errorf("Expected size <= 15 (absolute max), got %d", size)
		}
	})
}

func BenchmarkDynamicSizing(b *testing.B) {
	config := DefaultDynamicSizingConfig()
	sizer := NewDynamicSizer(config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sizer.CalculateSize(20, 100, 80)
	}
}

func BenchmarkContentHeightCalculation(b *testing.B) {
	content := "This is a sample text that will be used for benchmarking the content height calculation function. It contains multiple sentences and should provide a realistic test case for performance measurement."

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		CalculateContentHeightWithWidth(content, 80)
	}
}
