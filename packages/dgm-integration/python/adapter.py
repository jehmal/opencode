"""
DGM Agent Adapter - Real interface to DGM functionality
"""

import json
import time
import os
import sys
import uuid
import tempfile
import shutil
import subprocess
from typing import Any, Dict, List, Optional
from datetime import datetime
from pathlib import Path

# Add DGM directory to Python path
dgm_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../dgm'))
if dgm_path not in sys.path:
    sys.path.insert(0, dgm_path)

# Import DGM modules
from coding_agent import AgenticSystem
from utils.git_utils import get_git_commit_hash, diff_versus_commit, reset_to_commit


class DGMAgentAdapter:
    """Real DGM Agent Adapter - wraps AgenticSystem functionality"""
    
    def __init__(self):
        # Track active agents and their states
        self.agents: Dict[str, Dict[str, Any]] = {}
        self.agent_logs: Dict[str, List[str]] = {}
        self.stats = {
            'tasks_executed': 0,
            'evolutions': 0,
            'start_time': time.time()
        }
        
        # Create a temporary directory for agent workspaces
        self.workspace_root = tempfile.mkdtemp(prefix='dgm_workspace_')
        
    def __del__(self):
        """Cleanup temporary workspace on deletion"""
        if hasattr(self, 'workspace_root') and os.path.exists(self.workspace_root):
            shutil.rmtree(self.workspace_root, ignore_errors=True)
    
    def _create_workspace(self, task_id: str, initial_files: Optional[Dict[str, str]] = None) -> tuple:
        """Create a git-initialized workspace for a task"""
        workspace_path = os.path.join(self.workspace_root, task_id)
        os.makedirs(workspace_path, exist_ok=True)
        
        # Initialize git repository
        subprocess.run(['git', 'init'], cwd=workspace_path, capture_output=True, text=True)
        subprocess.run(['git', 'config', 'user.email', 'dgm@example.com'], cwd=workspace_path, capture_output=True, text=True)
        subprocess.run(['git', 'config', 'user.name', 'DGM Agent'], cwd=workspace_path, capture_output=True, text=True)
        
        # Create initial files if provided
        if initial_files:
            for filepath, content in initial_files.items():
                full_path = os.path.join(workspace_path, filepath)
                # Create directory if it doesn't exist
                dir_path = os.path.dirname(full_path)
                if dir_path:
                    os.makedirs(dir_path, exist_ok=True)
                with open(full_path, 'w') as f:
                    f.write(content)
        else:
            # Create at least one file for git to track
            with open(os.path.join(workspace_path, '.gitkeep'), 'w') as f:
                f.write('')
        
        # Create initial commit
        subprocess.run(['git', 'add', '.'], cwd=workspace_path, capture_output=True, text=True)
        subprocess.run(['git', 'commit', '-m', 'Initial commit'], cwd=workspace_path, capture_output=True, text=True)
        
        # Get commit hash
        base_commit = get_git_commit_hash(workspace_path)
        
        return workspace_path, base_commit
    
    def execute_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a task using DGM agent"""
        self.stats['tasks_executed'] += 1
        
        task_id = task.get('id', str(uuid.uuid4()))
        problem_statement = task.get('description', '')
        initial_files = task.get('files', {})
        test_description = task.get('test_description', None)
        
        try:
            # Create workspace with initial files
            workspace_path, base_commit = self._create_workspace(task_id, initial_files)
            
            # Create chat history file
            chat_history_file = os.path.join(workspace_path, 'chat_history.md')
            
            # Initialize AgenticSystem
            agent = AgenticSystem(
                problem_statement=problem_statement,
                git_tempdir=workspace_path,
                base_commit=base_commit,
                chat_history_file=chat_history_file,
                test_description=test_description,
                self_improve=False,
                instance_id=task_id
            )
            
            # Store agent info
            self.agents[task_id] = {
                'agent': agent,
                'workspace': workspace_path,
                'base_commit': base_commit,
                'created_at': datetime.now().isoformat(),
                'status': 'executing',
                'task': task
            }
            
            # Execute the task
            agent.forward()
            
            # Get the resulting changes
            diff = diff_versus_commit(workspace_path, base_commit)
            
            # Read chat history for logs
            logs = []
            if os.path.exists(chat_history_file):
                with open(chat_history_file, 'r') as f:
                    logs = f.read().splitlines()
            
            self.agent_logs[task_id] = logs
            
            # Update agent status
            self.agents[task_id]['status'] = 'completed'
            self.agents[task_id]['completed_at'] = datetime.now().isoformat()
            
            # Get modified files
            modified_files = {}
            if diff:
                # Walk through all files in workspace to get their contents
                for root, dirs, files in os.walk(workspace_path):
                    # Skip .git directory
                    if '.git' in root:
                        continue
                    for filename in files:
                        if filename == 'chat_history.md' or filename == '.gitkeep':
                            continue
                        full_path = os.path.join(root, filename)
                        # Get relative path from workspace root
                        rel_path = os.path.relpath(full_path, workspace_path)
                        try:
                            with open(full_path, 'r', encoding='utf-8') as f:
                                modified_files[rel_path] = f.read()
                        except Exception:
                            # Skip files that can't be read as text
                            pass
            
            return {
                'task_id': task_id,
                'status': 'completed',
                'result': {
                    'files': modified_files,
                    'diff': diff,
                    'logs': logs[-100:] if logs else [],  # Last 100 log lines
                    'summary': f"Task executed successfully. Modified {len(modified_files)} files."
                },
                'execution_time': time.time() - self.stats['start_time']
            }
            
        except Exception as e:
            # Update agent status on error
            if task_id in self.agents:
                self.agents[task_id]['status'] = 'failed'
                self.agents[task_id]['error'] = str(e)
            
            return {
                'task_id': task_id,
                'status': 'failed',
                'error': str(e),
                'execution_time': time.time() - self.stats['start_time']
            }
    
    def get_agent_state(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Get the current state of an agent or all agents"""
        if task_id:
            if task_id not in self.agents:
                return {
                    'error': f'Agent for task {task_id} not found',
                    'available_agents': list(self.agents.keys())
                }
            
            agent_info = self.agents[task_id]
            logs = self.agent_logs.get(task_id, [])
            
            # Get current diff if workspace exists
            current_diff = ""
            if os.path.exists(agent_info['workspace']):
                current_diff = diff_versus_commit(agent_info['workspace'], agent_info['base_commit'])
            
            return {
                'task_id': task_id,
                'status': agent_info['status'],
                'created_at': agent_info['created_at'],
                'workspace': agent_info['workspace'],
                'task': agent_info['task'],
                'current_diff': current_diff,
                'logs': logs[-50:] if logs else [],  # Last 50 log lines
                'completed_at': agent_info.get('completed_at'),
                'error': agent_info.get('error')
            }
        
        else:
            # Return summary of all agents
            return {
                'total_agents': len(self.agents),
                'agents': [
                    {
                        'task_id': tid,
                        'status': info['status'],
                        'created_at': info['created_at'],
                        'task_description': info['task'].get('description', '')[:100] + '...'
                    }
                    for tid, info in self.agents.items()
                ],
                'stats': {
                    'active': sum(1 for a in self.agents.values() if a['status'] == 'executing'),
                    'completed': sum(1 for a in self.agents.values() if a['status'] == 'completed'),
                    'failed': sum(1 for a in self.agents.values() if a['status'] == 'failed')
                }
            }
    
    def evolve_based_on_patterns(self, patterns: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Trigger DGM evolution based on observed patterns"""
        self.stats['evolutions'] += 1
        
        # This is a placeholder for the evolution mechanism
        # In a real implementation, this would analyze patterns and trigger
        # appropriate adaptations in the AgenticSystem
        
        evolution_id = str(uuid.uuid4())
        
        # Analyze patterns
        pattern_types = [p.get('type', 'unknown') for p in patterns]
        pattern_counts = {}
        for ptype in pattern_types:
            pattern_counts[ptype] = pattern_counts.get(ptype, 0) + 1
        
        # Simulate evolution based on patterns
        evolution_result = {
            'evolution_id': evolution_id,
            'timestamp': datetime.now().isoformat(),
            'patterns_analyzed': len(patterns),
            'pattern_types': pattern_counts,
            'adaptations': []
        }
        
        # Example adaptations based on patterns
        if pattern_counts.get('error', 0) > 5:
            evolution_result['adaptations'].append({
                'type': 'error_handling',
                'description': 'Enhanced error recovery mechanisms'
            })
        
        if pattern_counts.get('performance', 0) > 3:
            evolution_result['adaptations'].append({
                'type': 'optimization',
                'description': 'Improved execution efficiency'
            })
        
        if pattern_counts.get('success', 0) > 10:
            evolution_result['adaptations'].append({
                'type': 'pattern_reinforcement',
                'description': 'Reinforced successful strategies'
            })
        
        return {
            'status': 'evolved',
            'evolution': evolution_result,
            'message': f"Evolved based on {len(patterns)} patterns"
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get adapter statistics"""
        uptime = time.time() - self.stats['start_time']
        
        return {
            'uptime_seconds': uptime,
            'operations': {
                'tasks_executed': self.stats['tasks_executed'],
                'evolutions': self.stats['evolutions']
            },
            'agents': {
                'total': len(self.agents),
                'active': sum(1 for a in self.agents.values() if a['status'] == 'executing'),
                'completed': sum(1 for a in self.agents.values() if a['status'] == 'completed'),
                'failed': sum(1 for a in self.agents.values() if a['status'] == 'failed')
            },
            'workspace': {
                'root': self.workspace_root,
                'size_bytes': sum(
                    os.path.getsize(os.path.join(dirpath, filename))
                    for dirpath, dirnames, filenames in os.walk(self.workspace_root)
                    for filename in filenames
                ) if os.path.exists(self.workspace_root) else 0
            }
        }
    
    # Additional helper methods
    
    def cleanup_agent(self, task_id: str) -> Dict[str, Any]:
        """Clean up an agent's workspace and data"""
        if task_id not in self.agents:
            return {'error': f'Agent for task {task_id} not found'}
        
        agent_info = self.agents[task_id]
        
        # Remove workspace
        if os.path.exists(agent_info['workspace']):
            shutil.rmtree(agent_info['workspace'], ignore_errors=True)
        
        # Remove from tracking
        del self.agents[task_id]
        if task_id in self.agent_logs:
            del self.agent_logs[task_id]
        
        return {
            'status': 'cleaned',
            'task_id': task_id
        }
    
    def reset_agent(self, task_id: str) -> Dict[str, Any]:
        """Reset an agent's workspace to initial state"""
        if task_id not in self.agents:
            return {'error': f'Agent for task {task_id} not found'}
        
        agent_info = self.agents[task_id]
        
        # Reset to base commit
        reset_to_commit(agent_info['workspace'], agent_info['base_commit'])
        
        # Update status
        agent_info['status'] = 'reset'
        agent_info['reset_at'] = datetime.now().isoformat()
        
        return {
            'status': 'reset',
            'task_id': task_id,
            'base_commit': agent_info['base_commit']
        }
    
    def get_agent_diff(self, task_id: str) -> Dict[str, Any]:
        """Get the current diff for an agent's workspace"""
        if task_id not in self.agents:
            return {'error': f'Agent for task {task_id} not found'}
        
        agent_info = self.agents[task_id]
        
        if not os.path.exists(agent_info['workspace']):
            return {'error': 'Workspace no longer exists'}
        
        diff = diff_versus_commit(agent_info['workspace'], agent_info['base_commit'])
        
        return {
            'task_id': task_id,
            'diff': diff,
            'base_commit': agent_info['base_commit']
        }