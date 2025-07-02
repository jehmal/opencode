#!/usr/bin/env python3
"""
Test script for JSON-RPC Bridge with DGMAgentAdapter
"""

import json
import subprocess
import time
import os


def send_json_rpc_request(process, method, params=None):
    """Send a JSON-RPC request to the bridge process"""
    request = {
        'jsonrpc': '2.0',
        'method': method,
        'params': params or {},
        'id': int(time.time() * 1000)
    }
    
    # Send request
    process.stdin.write(json.dumps(request) + '\n')
    process.stdin.flush()
    
    # Read response
    response_line = process.stdout.readline()
    if response_line:
        return json.loads(response_line.strip())
    return None


def test_bridge():
    """Test the JSON-RPC bridge"""
    print("Starting JSON-RPC Bridge test...")
    print("-" * 50)
    
    # Start the bridge process
    bridge_path = os.path.join(os.path.dirname(__file__), 'bridge.py')
    process = subprocess.Popen(
        ['python3', bridge_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1
    )
    
    # Wait for ready signal
    ready_line = process.stdout.readline()
    ready_signal = json.loads(ready_line.strip())
    if ready_signal.get('type') == 'ready':
        print("Bridge is ready!")
    
    try:
        # Test 1: Health check
        print("\n1. Health check:")
        response = send_json_rpc_request(process, 'health')
        print(json.dumps(response, indent=2))
        
        # Test 2: Echo test
        print("\n2. Echo test:")
        response = send_json_rpc_request(process, 'echo', {'message': 'Hello DGM!'})
        print(json.dumps(response, indent=2))
        
        # Test 3: Get stats
        print("\n3. Get stats:")
        response = send_json_rpc_request(process, 'get_stats')
        print(json.dumps(response, indent=2))
        
        # Test 4: Execute task
        print("\n4. Execute task:")
        task = {
            'id': 'bridge_test_001',
            'description': 'Create a hello world function',
            'files': {
                'hello.py': '# Create a hello_world() function here\n'
            }
        }
        response = send_json_rpc_request(process, 'execute_task', {'task': task})
        print(json.dumps({
            'jsonrpc': response.get('jsonrpc'),
            'id': response.get('id'),
            'result': {
                'task_id': response.get('result', {}).get('task_id'),
                'status': response.get('result', {}).get('status'),
                'has_result': 'result' in response.get('result', {})
            }
        }, indent=2))
        
        # Test 5: Get agent state
        print("\n5. Get agent state:")
        response = send_json_rpc_request(process, 'get_agent_state', {'task_id': 'bridge_test_001'})
        if 'result' in response:
            result = response['result']
            print(json.dumps({
                'jsonrpc': response.get('jsonrpc'),
                'id': response.get('id'),
                'result': {
                    'task_id': result.get('task_id'),
                    'status': result.get('status'),
                    'workspace': result.get('workspace'),
                    'has_logs': bool(result.get('logs'))
                }
            }, indent=2))
        
        # Test 6: Cleanup
        print("\n6. Cleanup agent:")
        response = send_json_rpc_request(process, 'cleanup_agent', {'task_id': 'bridge_test_001'})
        print(json.dumps(response, indent=2))
        
        # Test 7: Shutdown
        print("\n7. Shutdown:")
        response = send_json_rpc_request(process, 'shutdown')
        print(json.dumps(response, indent=2))
        
    finally:
        # Ensure process is terminated
        process.terminate()
        process.wait(timeout=5)
        
    print("\n" + "-" * 50)
    print("Bridge test completed!")


if __name__ == "__main__":
    try:
        test_bridge()
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()