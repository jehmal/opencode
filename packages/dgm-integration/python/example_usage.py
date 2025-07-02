#!/usr/bin/env python3
"""
Example usage of the DGM Agent Integration
"""

import json
import os
import sys

# Add DGM directory to Python path
dgm_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../dgm'))
if dgm_path not in sys.path:
    sys.path.insert(0, dgm_path)

from adapter import DGMAgentAdapter


def example_simple_task():
    """Example: Execute a simple coding task"""
    print("=" * 60)
    print("Example 1: Simple Coding Task")
    print("=" * 60)
    
    adapter = DGMAgentAdapter()
    
    # Define a simple task
    task = {
        'id': 'example_fibonacci',
        'description': '''Create a Python function that generates Fibonacci numbers.
The function should be called fibonacci(n) and return the nth Fibonacci number.
Use an efficient iterative approach.
Also create a test function that verifies fibonacci(10) returns 55.''',
        'files': {
            'fibonacci.py': '''# Implement the fibonacci function here
def fibonacci(n):
    pass

# Add test function
def test_fibonacci():
    pass
'''
        }
    }
    
    # Execute the task
    print("\nExecuting task...")
    result = adapter.execute_task(task)
    
    # Display results
    if result['status'] == 'completed':
        print("\nTask completed successfully!")
        print(f"Modified files: {list(result['result']['files'].keys())}")
        print("\nGenerated code:")
        print("-" * 40)
        for filename, content in result['result']['files'].items():
            print(f"\n{filename}:")
            print(content)
        print("-" * 40)
    else:
        print(f"\nTask failed: {result.get('error', 'Unknown error')}")
    
    # Cleanup
    adapter.cleanup_agent(task['id'])
    return adapter


def example_multi_file_task():
    """Example: Task with multiple files"""
    print("\n" + "=" * 60)
    print("Example 2: Multi-File Project")
    print("=" * 60)
    
    adapter = DGMAgentAdapter()
    
    # Define a task with multiple files
    task = {
        'id': 'example_calculator',
        'description': '''Create a simple calculator module with the following:
1. operations.py - Basic arithmetic operations (add, subtract, multiply, divide)
2. calculator.py - Main calculator class that uses the operations
3. test_calculator.py - Unit tests for the calculator

The calculator should handle division by zero gracefully.''',
        'files': {
            'operations.py': '# Implement arithmetic operations here\n',
            'calculator.py': '# Implement Calculator class here\n',
            'test_calculator.py': '# Implement tests here\n'
        }
    }
    
    # Execute the task
    print("\nExecuting multi-file task...")
    result = adapter.execute_task(task)
    
    # Display results
    if result['status'] == 'completed':
        print("\nTask completed successfully!")
        print(f"Modified files: {list(result['result']['files'].keys())}")
        print(f"\nSummary: {result['result']['summary']}")
        
        # Show a sample of the logs
        logs = result['result'].get('logs', [])
        if logs:
            print(f"\nLast 5 log entries:")
            for log in logs[-5:]:
                print(f"  - {log[:80]}...")
    else:
        print(f"\nTask failed: {result.get('error', 'Unknown error')}")
    
    # Get agent state
    print("\nChecking agent state...")
    state = adapter.get_agent_state(task['id'])
    print(f"Agent status: {state['status']}")
    print(f"Workspace: {state['workspace']}")
    
    # Cleanup
    adapter.cleanup_agent(task['id'])
    return adapter


def example_evolution():
    """Example: Pattern-based evolution"""
    print("\n" + "=" * 60)
    print("Example 3: Pattern-Based Evolution")
    print("=" * 60)
    
    adapter = DGMAgentAdapter()
    
    # Simulate collecting patterns from multiple task executions
    patterns = [
        {'type': 'success', 'description': 'Completed fibonacci implementation'},
        {'type': 'success', 'description': 'Completed calculator implementation'},
        {'type': 'error', 'description': 'Import error in test file'},
        {'type': 'error', 'description': 'Syntax error in generated code'},
        {'type': 'performance', 'description': 'Slow execution on large input'},
        {'type': 'success', 'description': 'Fixed all test failures'},
        {'type': 'success', 'description': 'Optimized algorithm performance'},
    ]
    
    # Trigger evolution
    print("\nTriggering evolution based on patterns...")
    evolution_result = adapter.evolve_based_on_patterns(patterns)
    
    print("\nEvolution Result:")
    print(json.dumps(evolution_result, indent=2))
    
    return adapter


def main():
    """Run all examples"""
    print("DGM Agent Integration Examples")
    print("=" * 60)
    
    try:
        # Run examples
        adapter1 = example_simple_task()
        adapter2 = example_multi_file_task()
        adapter3 = example_evolution()
        
        # Show final stats
        print("\n" + "=" * 60)
        print("Final Statistics")
        print("=" * 60)
        
        # Since we used different adapter instances, let's create one final one
        # In real usage, you'd typically use a single adapter instance
        final_adapter = DGMAgentAdapter()
        stats = final_adapter.get_stats()
        print(json.dumps(stats, indent=2))
        
    except Exception as e:
        print(f"\nError in example: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()