const WebSocket = require('ws');

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:5747');

console.log('Connecting to WebSocket server at ws://localhost:5747...');

ws.on('open', () => {
    console.log('Connected to WebSocket server');
    console.log('Listening for task events...');
});

ws.on('message', (data) => {
    try {
        const event = JSON.parse(data.toString());
        const timestamp = new Date().toISOString();
        
        if (event.type === 'heartbeat') {
            console.log(`[${timestamp}] Heartbeat received`);
            return;
        }
        
        console.log(`\n[${timestamp}] Event received:`);
        console.log('Type:', event.type);
        
        if (event.data) {
            console.log('Data:', JSON.stringify(event.data, null, 2));
            
            // Highlight continuation tasks
            if (event.data.taskID && event.data.taskID.includes('continuation')) {
                console.log('>>> THIS IS A CONTINUATION TASK <<<');
            }
        }
        
        console.log('-'.repeat(50));
    } catch (error) {
        console.error('Failed to parse message:', error);
        console.log('Raw message:', data.toString());
    }
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('Disconnected from WebSocket server');
});

// Keep the script running
process.on('SIGINT', () => {
    console.log('\nClosing connection...');
    ws.close();
    process.exit(0);
});

console.log('Press Ctrl+C to exit');