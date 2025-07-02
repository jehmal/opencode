"""Test file for evolution_bridge.py"""

import asyncio
import json
from evolution_bridge import EvolutionBridge

async def test_json_rpc_handling():
    """Test JSON-RPC request handling."""
    bridge = EvolutionBridge(
        dgm_path="/tmp/dgm_test",
        orchestrator_url="http://localhost:3000"
    )
    
    # Test invalid JSON-RPC request
    invalid_request = {
        "method": "test"
    }
    response = await bridge.handle_request(invalid_request)
    print("Invalid request response:", json.dumps(response, indent=2))
    assert response["error"]["code"] == -32600
    
    # Test unknown method
    unknown_method = {
        "jsonrpc": "2.0",
        "method": "unknown_method",
        "id": 1
    }
    response = await bridge.handle_request(unknown_method)
    print("\nUnknown method response:", json.dumps(response, indent=2))
    assert response["error"]["code"] == -32601
    
    # Test valid method with missing params
    missing_params = {
        "jsonrpc": "2.0",
        "method": "evolve_agents",
        "id": 2
    }
    response = await bridge.handle_request(missing_params)
    print("\nMissing params response:", json.dumps(response, indent=2))
    assert "error" in response
    
    # Test type conversion
    test_data = {
        "max_generation": 10,
        "selfimprove_size": 5,
        "overall_performance": {
            "accuracy_score": 0.95,
            "total_resolved_ids": [1, 2, 3]
        }
    }
    
    # Convert to TypeScript format
    ts_data = bridge._convert_dgm_to_ts(test_data)
    print("\nDGM to TS conversion:", json.dumps(ts_data, indent=2))
    assert ts_data["maxGenerations"] == 10
    assert ts_data["selfImproveSize"] == 5
    assert ts_data["overallPerformance"]["accuracyScore"] == 0.95
    
    # Convert back to DGM format
    dgm_data = bridge._convert_ts_to_dgm(ts_data)
    print("\nTS to DGM conversion:", json.dumps(dgm_data, indent=2))
    assert dgm_data["max_generation"] == 10
    assert dgm_data["selfimprove_size"] == 5
    
    # Test case conversion
    assert bridge._camel_to_snake("camelCaseString") == "camel_case_string"
    assert bridge._snake_to_camel("snake_case_string") == "snakeCaseString"
    
    print("\nAll tests passed!")

if __name__ == "__main__":
    asyncio.run(test_json_rpc_handling())