"""
DGM Adapter for Evolution Engine Integration
Bridges the Evolution Engine with DGM functionality
"""

import os
import sys
import json
import logging
import shutil
import datetime
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import subprocess

# Add DGM to path
dgm_path = Path(__file__).parent.parent.parent.parent / "dgm"
if str(dgm_path) not in sys.path:
    sys.path.insert(0, str(dgm_path))

# Import DGM modules
try:
    from DGM_outer import initialize_run, choose_selfimproves
    from self_improve_step import self_improve, diagnose_problem
    from utils.common_utils import load_json_file
    from utils.evo_utils import load_dgm_metadata, get_model_patch_paths
except ImportError as e:
    logging.warning(f"Could not import DGM modules: {e}")
    # Define stubs for development
    def initialize_run(*args, **kwargs):
        return ['initial'], 0
    def choose_selfimproves(*args, **kwargs):
        return []
    def self_improve(*args, **kwargs):
        return {"success": False, "error": "DGM not available"}

logger = logging.getLogger(__name__)


class DGMAdapter:
    """Adapter for DGM evolution functionality"""
    
    def __init__(self, base_output_dir: str = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/output_dgm"):
        """
        Initialize DGM adapter
        
        Args:
            base_output_dir: Base directory for DGM outputs
        """
        self.base_output_dir = Path(base_output_dir)
        self.base_output_dir.mkdir(parents=True, exist_ok=True)
        self.current_run_id = None
        self.archive = []
        self.generation = 0
        
    async def initialize(self, prevrun_dir: Optional[str] = None, polyglot: bool = False) -> Dict[str, Any]:
        """
        Initialize a new evolution run
        
        Args:
            prevrun_dir: Previous run directory to continue from
            polyglot: Whether to use polyglot benchmarks
            
        Returns:
            Initialization status and metadata
        """
        try:
            # Create new run directory
            self.current_run_id = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            run_dir = self.base_output_dir / self.current_run_id
            run_dir.mkdir(parents=True, exist_ok=True)
            
            # Initialize DGM run
            self.archive, self.generation = initialize_run(
                str(run_dir), 
                prevrun_dir=prevrun_dir,
                polyglot=polyglot
            )
            
            return {
                "success": True,
                "run_id": self.current_run_id,
                "archive": self.archive,
                "generation": self.generation,
                "output_dir": str(run_dir)
            }
        except Exception as e:
            logger.error(f"Failed to initialize DGM run: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def self_improve(
        self, 
        agent_code: str,
        task_description: str,
        parent_commit: str = 'initial',
        num_evals: int = 1,
        polyglot: bool = False
    ) -> Dict[str, Any]:
        """
        Run self-improvement on agent code
        
        Args:
            agent_code: The agent code to improve
            task_description: Task/problem description for improvement
            parent_commit: Parent commit ID
            num_evals: Number of evaluations to run
            polyglot: Whether to use polyglot benchmarks
            
        Returns:
            Improved code and metadata
        """
        try:
            if not self.current_run_id:
                await self.initialize()
            
            run_dir = self.base_output_dir / self.current_run_id
            
            # Save agent code to temporary file
            agent_file = run_dir / f"agent_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.py"
            agent_file.write_text(agent_code)
            
            # Run self-improvement
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._run_self_improve,
                str(agent_file),
                task_description,
                parent_commit,
                str(run_dir),
                num_evals,
                polyglot
            )
            
            if result.get("success"):
                # Read improved code
                improved_file = run_dir / result["run_id"] / "model_patch.txt"
                if improved_file.exists():
                    improved_code = improved_file.read_text()
                else:
                    improved_code = agent_code  # No improvement
                
                return {
                    "success": True,
                    "improved_code": improved_code,
                    "run_id": result["run_id"],
                    "metadata": result.get("metadata", {}),
                    "performance": result.get("performance", {})
                }
            else:
                return result
                
        except Exception as e:
            logger.error(f"Self-improvement failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "improved_code": agent_code
            }
    
    def _run_self_improve(
        self,
        agent_file: str,
        task_description: str, 
        parent_commit: str,
        output_dir: str,
        num_evals: int,
        polyglot: bool
    ) -> Dict[str, Any]:
        """Synchronous wrapper for self_improve"""
        try:
            # Create entry for self-improvement
            entry = {
                "task": task_description,
                "file": agent_file
            }
            
            # Run self-improvement
            result = self_improve(
                parent_commit=parent_commit,
                output_dir=output_dir,
                num_evals=num_evals,
                entry=entry,
                polyglot=polyglot
            )
            
            # Extract metadata
            metadata_file = Path(output_dir) / result / "metadata.json"
            if metadata_file.exists():
                metadata = load_json_file(str(metadata_file))
                performance = metadata.get("overall_performance", {})
            else:
                metadata = {}
                performance = {}
            
            return {
                "success": True,
                "run_id": result,
                "metadata": metadata,
                "performance": performance
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def evaluate_agent(
        self,
        agent_code: str,
        benchmark_type: str = "swe-bench"
    ) -> Dict[str, Any]:
        """
        Evaluate agent performance on benchmarks
        
        Args:
            agent_code: Agent code to evaluate
            benchmark_type: Type of benchmark (swe-bench or polyglot)
            
        Returns:
            Fitness score and evaluation results
        """
        try:
            # For now, return mock evaluation
            # In production, this would run actual benchmarks
            return {
                "success": True,
                "fitness_score": 0.65,
                "resolved_issues": 13,
                "total_issues": 20,
                "benchmark_type": benchmark_type,
                "details": {
                    "accuracy_score": 0.65,
                    "total_resolved_ids": 13,
                    "total_unresolved_ids": 7,
                    "total_emptypatch_ids": 0
                }
            }
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "fitness_score": 0.0
            }
    
    async def get_metadata(self, agent_id: str) -> Dict[str, Any]:
        """
        Get metadata for a specific agent
        
        Args:
            agent_id: Agent/commit ID
            
        Returns:
            Agent metadata
        """
        try:
            # Look for metadata in output directories
            for run_dir in self.base_output_dir.iterdir():
                if run_dir.is_dir():
                    metadata_file = run_dir / agent_id / "metadata.json"
                    if metadata_file.exists():
                        metadata = load_json_file(str(metadata_file))
                        return {
                            "success": True,
                            "metadata": metadata,
                            "agent_id": agent_id,
                            "run_id": run_dir.name
                        }
            
            return {
                "success": False,
                "error": f"Metadata not found for agent {agent_id}"
            }
        except Exception as e:
            logger.error(f"Failed to get metadata: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def manage_agent_files(
        self,
        operation: str,
        agent_id: str,
        content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Manage agent code files
        
        Args:
            operation: Operation type (read, write, list, delete)
            agent_id: Agent/commit ID
            content: Content for write operations
            
        Returns:
            Operation result
        """
        try:
            agent_dir = self.base_output_dir / self.current_run_id / agent_id
            
            if operation == "read":
                # Read agent files
                files = {}
                if agent_dir.exists():
                    for file in agent_dir.glob("*.py"):
                        files[file.name] = file.read_text()
                    
                    # Also check for patches
                    patch_file = agent_dir / "model_patch.txt"
                    if patch_file.exists():
                        files["model_patch.txt"] = patch_file.read_text()
                
                return {
                    "success": True,
                    "files": files
                }
                
            elif operation == "write":
                # Write agent file
                agent_dir.mkdir(parents=True, exist_ok=True)
                agent_file = agent_dir / f"agent_{agent_id}.py"
                agent_file.write_text(content or "")
                
                return {
                    "success": True,
                    "file_path": str(agent_file)
                }
                
            elif operation == "list":
                # List agent files
                files = []
                if agent_dir.exists():
                    files = [f.name for f in agent_dir.iterdir()]
                
                return {
                    "success": True,
                    "files": files
                }
                
            elif operation == "delete":
                # Delete agent directory
                if agent_dir.exists():
                    shutil.rmtree(agent_dir)
                
                return {
                    "success": True,
                    "deleted": True
                }
                
            else:
                return {
                    "success": False,
                    "error": f"Unknown operation: {operation}"
                }
                
        except Exception as e:
            logger.error(f"File operation failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def choose_parents(
        self,
        archive: List[str],
        method: str = "score_prop",
        selfimprove_size: int = 1
    ) -> List[str]:
        """
        Choose parent agents for next generation
        
        Args:
            archive: List of agent IDs in archive
            method: Selection method (score_prop, score_child_prop, random)
            selfimprove_size: Number of parents to select
            
        Returns:
            List of selected parent IDs
        """
        try:
            if not self.current_run_id:
                return []
            
            run_dir = self.base_output_dir / self.current_run_id
            
            # Use DGM's parent selection
            parents = choose_selfimproves(
                str(run_dir),
                archive,
                selfimprove_size,
                method=method
            )
            
            return parents
            
        except Exception as e:
            logger.error(f"Parent selection failed: {e}")
            # Fallback to last agent in archive
            return [archive[-1]] if archive else []


# Singleton instance
_adapter_instance = None

def get_dgm_adapter() -> DGMAdapter:
    """Get singleton DGM adapter instance"""
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = DGMAdapter()
    return _adapter_instance