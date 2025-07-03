#!/usr/bin/env node

// Test DGMO Visual Mode Integration
const { spawn } = require('child_process');
const WebSocket = require('ws');

console.log('🧪 Testing DGMO Visual Mode Integration...\n');

// Start DGMO with visual mode
console.log('1. Starting DGMO with visual mode...');
const dgmo = spawn('./opencode/dgmo', ['run', '--visual', 'test visual mode'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
});

let port = null;

// Look for port in output
dgmo.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('DGMO Output:', output);

  // Look for port number
  const portMatch = output.match(/port (\d+)/i);
  if (portMatch) {
    port = portMatch[1];
    console.log(`✓ Visual mode server started on port ${port}`);
    testWebSocket();
  }
});

dgmo.stderr.on('data', (data) => {
  console.error('DGMO Error:', data.toString());
});

// Test WebSocket connection
async function testWebSocket() {
  console.log('\n2. Testing WebSocket connection...');

  try {
    // Test ping endpoint first
    const response = await fetch(`http://localhost:${port}/ping/stagewise`);
    const text = await response.text();

    if (text === 'stagewise') {
      console.log('✓ Ping endpoint working');
    } else {
      console.log('✗ Ping endpoint failed');
    }

    // Test WebSocket
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on('open', () => {
      console.log('✓ WebSocket connected');

      // Test getSessionInfo
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'getSessionInfo',
        }),
      );
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      console.log('✓ Received response:', response);

      if (response.result && response.result.appName === 'DGMO') {
        console.log('\n✅ Visual mode is working correctly!');
      } else {
        console.log('\n❌ Unexpected response');
      }

      ws.close();
      dgmo.kill();
      process.exit(0);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      dgmo.kill();
      process.exit(1);
    });
  } catch (error) {
    console.error('Test failed:', error);
    dgmo.kill();
    process.exit(1);
  }
}

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n❌ Test timed out');
  dgmo.kill();
  process.exit(1);
}, 10000);
