const { VisualModeServer } = require('./opencode/packages/opencode/src/visual/server.js');

async function test() {
    console.log('Testing Visual Mode Server...');
    const server = new VisualModeServer({ sessionId: 'test-123' });
    
    try {
        const port = await server.start();
        console.log(`✓ Server started on port ${port}`);
        
        // Test ping
        const response = await fetch(`http://localhost:${port}/ping/stagewise`);
        const text = await response.text();
        console.log(`✓ Ping response: ${text}`);
        
        await server.stop();
        console.log('✓ Server stopped');
        console.log('\n✅ Visual mode is working!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

test();
