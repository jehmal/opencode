#!/usr/bin/env node

const WebSocket = require('ws');

console.log('Testing DGMO Continue Event Flow');
console.log('================================\n');

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:5747');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server on port 5747\n');
    console.log('Listening for task events...\n');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        const timestamp = new Date().toISOString();
        
        switch(message.type) {
            case 'heartbeat':
                console.log(`[${timestamp}] 💓 Heartbeat received`);
                break;
                
            case 'task.started':
                console.log(`[${timestamp}] 🚀 Task Started`);
                console.log(`   Task ID: ${message.data.taskID}`);
                console.log(`   Session: ${message.data.sessionID}`);
                console.log(`   Agent: ${message.data.agentName}`);
                console.log(`   Description: ${message.data.taskDescription}\n`);
                break;
                
            case 'task.progress':
                console.log(`[${timestamp}] 📊 Task Progress`);
                console.log(`   Task ID: ${message.data.taskID}`);
                console.log(`   Progress: ${message.data.progress}%`);
                console.log(`   Message: ${message.data.message || 'N/A'}\n`);
                break;
                
            case 'task.completed':
                console.log(`[${timestamp}] ✅ Task Completed`);
                console.log(`   Task ID: ${message.data.taskID}`);
                console.log(`   Duration: ${message.data.duration}ms`);
                console.log(`   Success: ${message.data.success}`);
                console.log(`   Summary: ${message.data.summary || 'N/A'}\n`);
                break;
                
            case 'task.failed':
                console.log(`[${timestamp}] ❌ Task Failed`);
                console.log(`   Task ID: ${message.data.taskID}`);
                console.log(`   Error: ${message.data.error}`);
                console.log(`   Recoverable: ${message.data.recoverable}\n`);
                break;
                
            default:
                console.log(`[${timestamp}] 📨 Unknown event type: ${message.type}`);
                console.log(`   Data: ${JSON.stringify(message.data, null, 2)}\n`);
        }
    } catch (error) {
        console.error('Failed to parse message:', error);
        console.error('Raw data:', data.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
    console.log('\n🔌 WebSocket connection closed');
});

// Test the continue endpoint after connection
setTimeout(async () => {
    console.log('\n🧪 Testing /continue endpoint...\n');
    
    try {
        // First, we need a valid session ID
        // You'll need to replace this with an actual session ID
        const sessionId = 'test-session-' + Date.now();
        
        const response = await fetch(`http://localhost:4096/session/${sessionId}/continuation-prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                projectName: "Test Project",
                projectGoal: "Testing event flow",
                completionPercentage: 50
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Continue endpoint responded successfully');
            console.log(`   Prompt length: ${result.prompt.length} characters`);
        } else {
            console.error('❌ Continue endpoint failed:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('❌ Failed to test continue endpoint:', error.message);
    }
}, 2000);

// Keep the script running
console.log('Press Ctrl+C to exit\n');