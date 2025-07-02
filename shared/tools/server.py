#!/usr/bin/env python3
"""
Python Tool Server for Integration Testing
Implements JSON-RPC server for tool execution
"""

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from aiohttp import web
import glob as glob_module

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dgm.tools.bash import BashTool
from dgm.tools.edit import EditTool


class ToolServer:
    """JSON-RPC server for tool execution"""
    
    def __init__(self, port: int = 8001, session_id: str = "default"):
        self.port = port
        self.session_id = session_id
        self.app = web.Application()
        self.setup_routes()
        
        # Initialize tools
        self.tools = {
            "bash": BashTool(),
            "edit": EditTool(),
            "read": self.read_tool,
            "write": self.write_tool,
            "glob": self.glob_tool,
            "grep": self.grep_tool
        }
    
    def setup_routes(self):
        """Setup HTTP routes"""
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_post('/rpc', self.handle_rpc)
        
    async def health_check(self, request: web.Request) -> web.Response:
        """Health check endpoint"""
        return web.json_response({
            "status": "ok",
            "server": "python"
        })
    
    async def handle_rpc(self, request: web.Request) -> web.Response:
        """Handle JSON-RPC requests"""
        try:
            body = await request.json()
            
            # Validate JSON-RPC format
            if body.get("jsonrpc") != "2.0":
                return web.json_response({
                    "jsonrpc": "2.0",
                    "id": body.get("id", "unknown"),
                    "error": {
                        "code": -32600,
                        "message": "Invalid request: wrong jsonrpc version"
                    }
                })
            
            request_id = body.get("id")
            method = body.get("method")
            params = body.get("params", {})
            
            if method != "tool.execute":
                return web.json_response({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": "Method not found"
                    }
                })
            
            # Execute tool
            tool_name = params.get("tool")
            tool_params = params.get("parameters", {})
            
            if tool_name not in self.tools:
                return web.json_response({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Tool not found: {tool_name}"
                    }
                })
            
            # Execute the tool
            tool = self.tools[tool_name]
            
            if tool_name in ["bash", "edit"]:
                # Use existing tool classes
                result = tool.run(**tool_params)
                output = result if isinstance(result, str) else str(result)
                metadata = {"title": f"{tool_name} executed"}
            else:
                # Use custom tool functions
                result = await tool(tool_params)
                output = result["output"]
                metadata = result["metadata"]
            
            return web.json_response({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "output": output,
                    "metadata": metadata
                }
            })
            
        except Exception as e:
            return web.json_response({
                "jsonrpc": "2.0",
                "id": body.get("id", "unknown") if 'body' in locals() else "unknown",
                "error": {
                    "code": -32000,
                    "message": "Tool execution failed",
                    "data": {
                        "details": str(e)
                    }
                }
            })
    
    async def read_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Read file tool"""
        file_path = params["file_path"]
        offset = params.get("offset", 0)
        limit = params.get("limit", 2000)
        
        with open(file_path, 'r') as f:
            lines = f.readlines()
        
        selected_lines = lines[offset:offset + limit]
        
        return {
            "output": "".join(selected_lines),
            "metadata": {
                "title": "File read",
                "file_path": file_path,
                "totalLines": len(lines),
                "linesRead": len(selected_lines)
            }
        }
    
    async def write_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Write file tool"""
        file_path = params["file_path"]
        content = params["content"]
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        return {
            "output": "File written successfully",
            "metadata": {
                "title": "File written",
                "file_path": file_path,
                "size": len(content)
            }
        }
    
    async def glob_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Glob pattern matching tool"""
        pattern = params["pattern"]
        search_path = params.get("path", os.getcwd())
        
        matches = glob_module.glob(pattern, root_dir=search_path)
        
        if not matches:
            return {
                "output": "No files found",
                "metadata": {
                    "title": "Glob search",
                    "pattern": pattern,
                    "path": search_path,
                    "matches": 0
                }
            }
        
        return {
            "output": "\n".join(matches),
            "metadata": {
                "title": "Glob search",
                "pattern": pattern,
                "path": search_path,
                "matches": len(matches)
            }
        }
    
    async def grep_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Grep pattern search tool"""
        pattern = params["pattern"]
        search_path = params.get("path", os.getcwd())
        include = params.get("include", "**/*")
        
        # Get files to search
        if os.path.isdir(search_path):
            files = glob_module.glob(include, root_dir=search_path, recursive=True)
        else:
            files = [search_path]
        
        matches = []
        regex = re.compile(pattern, re.IGNORECASE)
        
        for file in files:
            file_path = os.path.join(search_path, file) if os.path.isdir(search_path) else file
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    if regex.search(content):
                        matches.append(file)
            except:
                # Skip files that can't be read
                pass
        
        if not matches:
            return {
                "output": "No matches found",
                "metadata": {
                    "title": "Grep search",
                    "pattern": pattern,
                    "path": search_path,
                    "filesSearched": len(files),
                    "matches": 0
                }
            }
        
        return {
            "output": "\n".join(matches),
            "metadata": {
                "title": "Grep search",
                "pattern": pattern,
                "path": search_path,
                "filesSearched": len(files),
                "matches": len(matches)
            }
        }
    
    def run(self):
        """Start the server"""
        print(f"Python tool server starting on port {self.port} (session: {self.session_id})")
        web.run_app(self.app, host='0.0.0.0', port=self.port)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Python Tool Server')
    parser.add_argument('--port', type=int, default=8001, help='Server port')
    parser.add_argument('--session-id', default='default', help='Session ID')
    
    args = parser.parse_args()
    
    server = ToolServer(port=args.port, session_id=args.session_id)
    server.run()


if __name__ == "__main__":
    main()