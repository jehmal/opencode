package main

// Example demonstrating BubbleTea rendering patterns
// This shows different ways to trigger UI re-renders in a BubbleTea application

import (
	"fmt"
	"time"

	tea "github.com/charmbracelet/bubbletea/v2"
)

// Custom messages
type tickMsg time.Time
type dataReceivedMsg string

// Model
type model struct {
	messages []string
	ticks    int
}

func (m model) Init() tea.Cmd {
	// Start a ticker that sends messages every second
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "q" {
			return m, tea.Quit
		}
		
	case tickMsg:
		m.ticks++
		// Continue ticking
		return m, tea.Tick(time.Second, func(t time.Time) tea.Msg {
			return tickMsg(t)
		})
		
	case dataReceivedMsg:
		m.messages = append(m.messages, string(msg))
		
		// PATTERN 1: Return nil to force re-render
		// This is the simplest way to ensure the UI updates
		return m, func() tea.Msg { return nil }
		
		// PATTERN 2: Return a batch with nil
		// Useful when you need to do multiple things
		// return m, tea.Batch(
		//     someOtherCommand(),
		//     func() tea.Msg { return nil },
		// )
		
		// PATTERN 3: Return a custom "refresh" message
		// More explicit but requires handling in Update()
		// return m, func() tea.Msg { return refreshUIMsg{} }
		
		// ANTI-PATTERN: Just returning the model
		// This does NOT trigger a re-render!
		// return m, nil
	}
	
	return m, nil
}

func (m model) View() string {
	s := "=== BubbleTea Rendering Example ===\n\n"
	s += fmt.Sprintf("Ticks: %d\n\n", m.ticks)
	s += "Messages:\n"
	for i, msg := range m.messages {
		s += fmt.Sprintf("%d. %s\n", i+1, msg)
	}
	s += "\nPress 'q' to quit\n"
	return s
}

func main() {
	p := tea.NewProgram(model{messages: []string{}})
	
	// Simulate receiving data from external source
	go func() {
		time.Sleep(2 * time.Second)
		p.Send(dataReceivedMsg("First message received!"))
		
		time.Sleep(2 * time.Second)
		p.Send(dataReceivedMsg("Second message received!"))
		
		time.Sleep(2 * time.Second)
		p.Send(dataReceivedMsg("Third message received!"))
	}()
	
	if _, err := p.Run(); err != nil {
		fmt.Printf("Error: %v", err)
	}
}

/*
Key Takeaways:

1. BubbleTea only re-renders when Update() returns a command that produces a message
2. Returning `nil` as a command does NOT trigger a re-render
3. Returning a function that returns `nil` message DOES trigger a re-render
4. Use tea.Batch() when you need multiple commands
5. The tick pattern shows continuous updates without user interaction

For real-time updates (like SSE/WebSocket messages):
- Process the incoming data in Update()
- Return a command that produces a message (even nil)
- This ensures View() is called with the latest state
*/