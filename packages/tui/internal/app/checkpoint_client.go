package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// CheckpointService provides checkpoint-related operations
type CheckpointService struct {
	serverPort int
}

// NewCheckpointService creates a new checkpoint service
func NewCheckpointService() *CheckpointService {
	// Default to standard port
	return &CheckpointService{serverPort: 5747}
}

// Checkpoint represents a checkpoint with all its metadata
type Checkpoint struct {
	ID          string             `json:"id"`
	SessionID   string             `json:"sessionId"`
	MessageID   string             `json:"messageId"`
	Timestamp   int64              `json:"timestamp"`
	Description string             `json:"description"`
	GitCommit   *string            `json:"gitCommit,omitempty"`
	Metadata    CheckpointMetadata `json:"metadata"`
}

// CheckpointMetadata contains additional checkpoint information
type CheckpointMetadata struct {
	UserPrompt    string   `json:"userPrompt"`
	ModelResponse string   `json:"modelResponse,omitempty"`
	ToolsUsed     []string `json:"toolsUsed,omitempty"`
	FileCount     int      `json:"fileCount"`
	MessageIndex  int      `json:"messageIndex"`
}

// ListCheckpoints retrieves all checkpoints for a session
func (s *CheckpointService) ListCheckpoints(ctx context.Context, sessionID string) ([]Checkpoint, error) {
	url := fmt.Sprintf("http://localhost:%d/session/%s/checkpoints", s.serverPort, sessionID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers that the SDK would normally add
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "opencode-go-sdk")

	// Use a standard HTTP client with timeout
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var checkpoints []Checkpoint
	if err := json.NewDecoder(resp.Body).Decode(&checkpoints); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return checkpoints, nil
}

// RestoreCheckpoint restores the session to a specific checkpoint
func (s *CheckpointService) RestoreCheckpoint(ctx context.Context, checkpointID string) error {
	url := fmt.Sprintf("http://localhost:%d/checkpoint/%s/restore", s.serverPort, checkpointID)

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "opencode-go-sdk")

	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var result struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil && result.Message != "" {
			return fmt.Errorf("failed to restore checkpoint: %s", result.Message)
		}
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
