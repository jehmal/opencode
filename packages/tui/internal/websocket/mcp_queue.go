package websocket

import (
	"context"
	"log/slog"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
)

// MCPEventQueueItem represents a queued MCP event
type MCPEventQueueItem struct {
	EventType string
	Data      MCPEventData
	Timestamp time.Time
	Retries   int
}

// MCPEventQueue provides reliable event processing with retry logic
type MCPEventQueue struct {
	queue      chan MCPEventQueueItem
	processor  *MCPEventProcessor
	program    *tea.Program
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	maxRetries int
	retryDelay time.Duration
	queueSize  int
}

// NewMCPEventQueue creates a new MCP event queue
func NewMCPEventQueue(processor *MCPEventProcessor, queueSize int) *MCPEventQueue {
	ctx, cancel := context.WithCancel(context.Background())

	return &MCPEventQueue{
		queue:      make(chan MCPEventQueueItem, queueSize),
		processor:  processor,
		ctx:        ctx,
		cancel:     cancel,
		maxRetries: 3,
		retryDelay: time.Second,
		queueSize:  queueSize,
	}
}

// NewMCPEventQueueWithProgram creates a new MCP event queue with TUI program
func NewMCPEventQueueWithProgram(processor *MCPEventProcessor, program *tea.Program, queueSize int) *MCPEventQueue {
	ctx, cancel := context.WithCancel(context.Background())

	return &MCPEventQueue{
		queue:      make(chan MCPEventQueueItem, queueSize),
		processor:  processor,
		program:    program,
		ctx:        ctx,
		cancel:     cancel,
		maxRetries: 3,
		retryDelay: time.Second,
		queueSize:  queueSize,
	}
}

// Start begins processing events from the queue
func (q *MCPEventQueue) Start() {
	q.wg.Add(1)
	go q.processEvents()
	slog.Info("MCP event queue started", "queueSize", q.queueSize)
}

// Stop stops the event queue processing
func (q *MCPEventQueue) Stop() {
	q.cancel()
	close(q.queue)
	q.wg.Wait()
	slog.Info("MCP event queue stopped")
}

// Enqueue adds an event to the processing queue
func (q *MCPEventQueue) Enqueue(eventType string, data MCPEventData) bool {
	item := MCPEventQueueItem{
		EventType: eventType,
		Data:      data,
		Timestamp: time.Now(),
		Retries:   0,
	}

	select {
	case q.queue <- item:
		slog.Debug("MCP event queued", "type", eventType, "id", data.ID)
		return true
	case <-q.ctx.Done():
		return false
	default:
		slog.Warn("MCP event queue full, dropping event", "type", eventType, "id", data.ID)
		return false
	}
}

// processEvents processes events from the queue with retry logic
func (q *MCPEventQueue) processEvents() {
	defer q.wg.Done()

	for {
		select {
		case <-q.ctx.Done():
			return
		case item, ok := <-q.queue:
			if !ok {
				return
			}

			q.processEvent(item)
		}
	}
}

// processEvent processes a single event with error handling
func (q *MCPEventQueue) processEvent(item MCPEventQueueItem) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("Panic processing MCP event", "error", r, "type", item.EventType, "id", item.Data.ID)
			q.retryEvent(item)
		}
	}()

	slog.Debug("Processing MCP event", "type", item.EventType, "id", item.Data.ID, "retries", item.Retries)

	// Process the event
	cmd := q.processor.HandleMCPEvent(item.EventType, item.Data)
	if cmd == nil {
		slog.Warn("No command generated for MCP event", "type", item.EventType, "id", item.Data.ID)
		return
	}

	// Execute the command and send to TUI program
	if msg := cmd(); msg == nil {
		slog.Warn("Command generated nil message", "type", item.EventType, "id", item.Data.ID)
		q.retryEvent(item)
		return
	} else {
		// Send message to TUI program if available
		if q.program != nil {
			q.program.Send(msg)
		}
	}

	slog.Debug("MCP event processed successfully", "type", item.EventType, "id", item.Data.ID)
}

// retryEvent handles event retry logic
func (q *MCPEventQueue) retryEvent(item MCPEventQueueItem) {
	if item.Retries >= q.maxRetries {
		slog.Error("MCP event exceeded max retries, dropping",
			"type", item.EventType,
			"id", item.Data.ID,
			"retries", item.Retries)
		return
	}

	item.Retries++

	// Exponential backoff
	delay := q.retryDelay * time.Duration(1<<uint(item.Retries-1))

	slog.Info("Retrying MCP event",
		"type", item.EventType,
		"id", item.Data.ID,
		"retry", item.Retries,
		"delay", delay)

	go func() {
		timer := time.NewTimer(delay)
		defer timer.Stop()

		select {
		case <-timer.C:
			select {
			case q.queue <- item:
				// Successfully re-queued
			case <-q.ctx.Done():
				// Queue is shutting down
			default:
				slog.Warn("Failed to re-queue MCP event, queue full", "type", item.EventType, "id", item.Data.ID)
			}
		case <-q.ctx.Done():
			// Queue is shutting down
		}
	}()
}

// GetQueueLength returns the current queue length
func (q *MCPEventQueue) GetQueueLength() int {
	return len(q.queue)
}

// GetQueueCapacity returns the queue capacity
func (q *MCPEventQueue) GetQueueCapacity() int {
	return q.queueSize
}
