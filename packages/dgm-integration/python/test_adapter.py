#!/usr/bin/env python3
"""
Test script for DGMAgentAdapter
"""

import json
import sys
import os

# Add DGM directory to Python path
dgm_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../dgm'))
if dgm_path not in sys.path:
    sys.path.insert(0, dgm_path)

from adapter import DGMAgentAdapter


def test_adapter():
    """Test the DGMAgentAdapter"""
    adapter = DGMAgentAdapter()
    
    print("Testing DGMAgentAdapter...")
    print("-" * 50)
    
    # Test 1: Get initial stats
    print("\n1. Getting initial stats:")
    stats = adapter.get_stats()
    print(json.dumps(stats, indent=2))
    
    # Test 2: Execute a simple task
    print("\n2. Executing a test task:")
    test_task = {
        'id': 'test_task_001',
        'description': 'Create a simple Python function that adds two numbers',
        'files': {
            'main.py': '# Empty file\n'
        },
        'test_description': 'The function should be named add_numbers(a, b) and return a + b'
    }
    
    result = adapter.execute_task(test_task)
    print(json.dumps(result, indent=2))
    
    # Test 3: Get agent state
    print("\n3. Getting agent state:")
    state = adapter.get_agent_state('test_task_001')
    print(json.dumps({
        'task_id': state.get('task_id'),
        'status': state.get('status'),
        'created_at': state.get('created_at'),
        'logs_count': len(state.get('logs', [])),
        'has_diff': bool(state.get('current_diff'))
    }, indent=2))
    
    # Test 4: Get all agents state
    print("\n4. Getting all agents state:")
    all_state = adapter.get_agent_state()
    print(json.dumps(all_state, indent=2))
    
    # Test 5: Test evolution
    print("\n5. Testing evolution based on patterns:")
    patterns = [
        {'type': 'success', 'description': 'Task completed successfully'},
        {'type': 'success', 'description': 'Another successful task'},
        {'type': 'error', 'description': 'Error encountered'},
        {'type': 'performance', 'description': 'Slow execution'}
    ]
    evolution_result = adapter.evolve_based_on_patterns(patterns)
    print(json.dumps(evolution_result, indent=2))
    
    # Test 6: Cleanup
    print("\n6. Cleaning up test agent:")
    cleanup_result = adapter.cleanup_agent('test_task_001')
    print(json.dumps(cleanup_result, indent=2))
    
    # Test 7: Final stats
    print("\n7. Final stats:")
    final_stats = adapter.get_stats()
    print(json.dumps(final_stats, indent=2))
    
    print("\n" + "-" * 50)
    print("All tests completed!")


if __name__ == "__main__":
    try:
        test_adapter()
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()