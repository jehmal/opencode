"""
Evolution Bridge: Connects DGM evolution system with TypeScript orchestrator.

This module provides the interface between the Python-based DGM (Darwin Godel Machine)
evolution system and the TypeScript orchestrator, handling data conversion and 
communication between the two systems.
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime
import aiohttp
import subprocess

from .dgm_adapter import DGMAdapter

logger = logging.getLogger(__name__)

# Configure logging format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class EvolutionBridgeError(Exception):
    """Base exception for Evolution Bridge errors."""
    pass


class ValidationError(EvolutionBridgeError):
    """Raised when input validation fails."""
    pass


class DGMConnectionError(EvolutionBridgeError):
    """Raised when connection to DGM system fails."""
    pass


class EvolutionBridge:
    """Bridge between DGM evolution system and TypeScript orchestrator."""
    
    def __init__(self, dgm_path: str, orchestrator_url: str):
        """
        Initialize the Evolution Bridge.
        
        Args:
            dgm_path: Path to the DGM repository root
            orchestrator_url: URL of the TypeScript orchestrator service
        """
        self.dgm_path = dgm_path
        self.orchestrator_url = orchestrator_url
        self.dgm_adapter = DGMAdapter(dgm_path)
        self.evolution_process: Optional[subprocess.Popen] = None
        self.current_config: Optional[Dict[str, Any]] = None
        
        # Ensure required paths exist
        self.output_dir = os.path.join(dgm_path, "output_dgm")
        os.makedirs(self.output_dir, exist_ok=True)
        
        logger.info(f"Evolution Bridge initialized with DGM path: {dgm_path}")
        
    async def start_evolution(self, config: dict) -> dict:
        """
        Start a new evolution run with the given configuration.
        
        Args:
            config: Evolution configuration from TypeScript orchestrator
                Expected keys:
                - maxGenerations: Maximum number of generations
                - selfImproveSize: Number of self-improvement attempts per generation
                - selfImproveWorkers: Number of parallel workers
                - chooseSelfImprovesMethod: Method for selecting improvements
                - updateArchive: Archive update method
                - numSweEvals: Number of evaluations per improvement
                - evalNoise: Evaluation noise threshold
                - polyglot: Whether to use polyglot mode
                - continueFrom: Optional directory to continue from
                
        Returns:
            Dict with evolution run metadata
        """
        try:
            # Validate configuration
            self._validate_evolution_config(config)
            
            # Convert TypeScript config to DGM format
            dgm_config = self._convert_ts_to_dgm(config)
            self.current_config = dgm_config
            
            # Prepare command line arguments for DGM
            cmd = [
                "python", os.path.join(self.dgm_path, "dgm", "DGM_outer.py"),
                "--max_generation", str(dgm_config.get("max_generation", 80)),
                "--selfimprove_size", str(dgm_config.get("selfimprove_size", 2)),
                "--selfimprove_workers", str(dgm_config.get("selfimprove_workers", 2)),
                "--choose_selfimproves_method", dgm_config.get("choose_selfimproves_method", "score_child_prop"),
                "--update_archive", dgm_config.get("update_archive", "keep_all"),
                "--num_swe_evals", str(dgm_config.get("num_swe_evals", 1)),
                "--eval_noise", str(dgm_config.get("eval_noise", 0.1)),
            ]
            
            # Add optional flags
            if dgm_config.get("post_improve_diagnose", False):
                cmd.append("--post_improve_diagnose")
            if dgm_config.get("shallow_eval", False):
                cmd.append("--shallow_eval")
            if dgm_config.get("polyglot", False):
                cmd.append("--polyglot")
            if dgm_config.get("no_full_eval", False):
                cmd.append("--no_full_eval")
            if dgm_config.get("continue_from"):
                cmd.extend(["--continue_from", dgm_config["continue_from"]])
            if dgm_config.get("run_baseline"):
                cmd.extend(["--run_baseline", dgm_config["run_baseline"]])
                
            # Start the evolution process
            self.evolution_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=self.dgm_path,
                text=True
            )
            
            # Get run ID from output directory
            run_id = datetime.now().strftime("%Y%m%d%H%M%S_%f")
            
            # Notify orchestrator of evolution start
            await self._notify_orchestrator("evolution_started", {
                "runId": run_id,
                "config": config,
                "startTime": datetime.now().isoformat()
            })
            
            return {
                "status": "started",
                "runId": run_id,
                "config": config,
                "processId": self.evolution_process.pid
            }
            
        except Exception as e:
            logger.error(f"Failed to start evolution: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def get_status(self) -> dict:
        """
        Get the current status of the evolution run.
        
        Returns:
            Dict with current evolution status
        """
        if not self.evolution_process:
            return {
                "status": "not_running",
                "message": "No evolution process is currently running"
            }
            
        # Check if process is still running
        poll_result = self.evolution_process.poll()
        if poll_result is None:
            # Process is still running
            status = "running"
            
            # Try to read the latest generation info from dgm_metadata.jsonl
            latest_generation = self._get_latest_generation_info()
            
            return {
                "status": status,
                "processId": self.evolution_process.pid,
                "currentGeneration": latest_generation.get("generation", 0) if latest_generation else 0,
                "archive": latest_generation.get("archive", []) if latest_generation else [],
                "lastUpdate": datetime.now().isoformat()
            }
        else:
            # Process has finished
            stdout, stderr = self.evolution_process.communicate()
            
            return {
                "status": "completed" if poll_result == 0 else "failed",
                "exitCode": poll_result,
                "stdout": stdout[-1000:] if stdout else "",  # Last 1000 chars
                "stderr": stderr[-1000:] if stderr else "",
                "endTime": datetime.now().isoformat()
            }
    
    def stop_evolution(self):
        """Stop the current evolution run."""
        if self.evolution_process:
            logger.info("Stopping evolution process...")
            self.evolution_process.terminate()
            try:
                self.evolution_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                logger.warning("Evolution process did not terminate, killing...")
                self.evolution_process.kill()
            self.evolution_process = None
            
    def _deep_convert_keys(self, data: Any, converter_func) -> Any:
        """
        Recursively convert dictionary keys using the provided converter function.
        
        Args:
            data: Data structure to convert
            converter_func: Function to convert key names
            
        Returns:
            Data with converted keys
        """
        if isinstance(data, dict):
            return {converter_func(k): self._deep_convert_keys(v, converter_func) 
                    for k, v in data.items()}
        elif isinstance(data, list):
            return [self._deep_convert_keys(item, converter_func) for item in data]
        else:
            return data
    
    def _camel_to_snake(self, name: str) -> str:
        """Convert camelCase to snake_case."""
        result = []
        for i, char in enumerate(name):
            if char.isupper() and i > 0:
                result.append('_')
            result.append(char.lower())
        return ''.join(result)
    
    def _snake_to_camel(self, name: str) -> str:
        """Convert snake_case to camelCase."""
        components = name.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])
    
    def _convert_dgm_to_ts(self, dgm_data: dict) -> dict:
        """
        Convert DGM data format to TypeScript format.
        
        Args:
            dgm_data: Data in DGM format
            
        Returns:
            Data in TypeScript orchestrator format
        """
        # Map DGM field names to TypeScript field names
        field_mapping = {
            "max_generation": "maxGenerations",
            "selfimprove_size": "selfImproveSize",
            "selfimprove_workers": "selfImproveWorkers",
            "choose_selfimproves_method": "chooseSelfImprovesMethod",
            "update_archive": "updateArchive",
            "num_swe_evals": "numSweEvals",
            "eval_noise": "evalNoise",
            "post_improve_diagnose": "postImproveDiagnose",
            "shallow_eval": "shallowEval",
            "no_full_eval": "noFullEval",
            "run_baseline": "runBaseline",
            "continue_from": "continueFrom"
        }
        
        ts_data = {}
        for dgm_key, ts_key in field_mapping.items():
            if dgm_key in dgm_data:
                ts_data[ts_key] = dgm_data[dgm_key]
                
        # Handle nested structures
        if "overall_performance" in dgm_data:
            ts_data["overallPerformance"] = {
                "accuracyScore": dgm_data["overall_performance"].get("accuracy_score", 0),
                "totalResolvedIds": dgm_data["overall_performance"].get("total_resolved_ids", []),
                "totalUnresolvedIds": dgm_data["overall_performance"].get("total_unresolved_ids", []),
                "totalEmptyPatchIds": dgm_data["overall_performance"].get("total_emptypatch_ids", [])
            }
            
        return ts_data
    
    def _convert_ts_to_dgm(self, ts_data: dict) -> dict:
        """
        Convert TypeScript data format to DGM format.
        
        Args:
            ts_data: Data in TypeScript format
            
        Returns:
            Data in DGM format
        """
        # Reverse mapping
        field_mapping = {
            "maxGenerations": "max_generation",
            "selfImproveSize": "selfimprove_size",
            "selfImproveWorkers": "selfimprove_workers",
            "chooseSelfImprovesMethod": "choose_selfimproves_method",
            "updateArchive": "update_archive",
            "numSweEvals": "num_swe_evals",
            "evalNoise": "eval_noise",
            "postImproveDiagnose": "post_improve_diagnose",
            "shallowEval": "shallow_eval",
            "noFullEval": "no_full_eval",
            "runBaseline": "run_baseline",
            "continueFrom": "continue_from",
            "polyglot": "polyglot"
        }
        
        dgm_data = {}
        for ts_key, dgm_key in field_mapping.items():
            if ts_key in ts_data:
                dgm_data[dgm_key] = ts_data[ts_key]
                
        return dgm_data
    
    def _get_latest_generation_info(self) -> Optional[Dict[str, Any]]:
        """Read the latest generation info from dgm_metadata.jsonl."""
        metadata_path = os.path.join(self.output_dir, "dgm_metadata.jsonl")
        if not os.path.exists(metadata_path):
            return None
            
        try:
            with open(metadata_path, 'r') as f:
                lines = f.readlines()
                if lines:
                    # Get the last line
                    return json.loads(lines[-1])
        except Exception as e:
            logger.error(f"Failed to read generation metadata: {e}")
            
        return None
    
    async def _notify_orchestrator(self, event_type: str, data: Dict[str, Any]):
        """
        Send notification to TypeScript orchestrator.
        
        Args:
            event_type: Type of event (e.g., "evolution_started", "generation_completed")
            data: Event data
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.orchestrator_url}/events",
                    json={
                        "type": event_type,
                        "timestamp": datetime.now().isoformat(),
                        "data": data
                    }
                ) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to notify orchestrator: {response.status}")
        except Exception as e:
            logger.error(f"Error notifying orchestrator: {e}")
    
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle JSON-RPC request from TypeScript orchestrator.
        
        Args:
            request: JSON-RPC request with method and params
            
        Returns:
            JSON-RPC response
        """
        # Validate JSON-RPC structure
        if "jsonrpc" not in request or request["jsonrpc"] != "2.0":
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32600,
                    "message": "Invalid Request: Not a valid JSON-RPC 2.0 request"
                },
                "id": request.get("id")
            }
        
        method = request.get("method")
        params = request.get("params", {})
        request_id = request.get("id")
        
        # Route to appropriate method
        method_handlers = {
            "evolve_agents": self.evolve_agents,
            "get_population_state": self.get_population_state,
            "update_fitness": self.update_fitness,
            "start_evolution": self.start_evolution,
            "get_status": self.get_status,
            "stop_evolution": lambda: {"status": "stopped"},
            "get_evolution_metrics": self.get_evolution_metrics,
            "save_checkpoint": self.save_checkpoint,
            "load_checkpoint": self.load_checkpoint
        }
        
        if method not in method_handlers:
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                },
                "id": request_id
            }
        
        try:
            # Handle async methods
            handler = method_handlers[method]
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**params) if params else await handler()
            else:
                result = handler(**params) if params else handler()
            
            return {
                "jsonrpc": "2.0",
                "result": result,
                "id": request_id
            }
        except Exception as e:
            logger.error(f"Error handling request {method}: {e}")
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                },
                "id": request_id
            }
    
    async def evolve_agents(self, population: List[Dict[str, Any]], 
                          generation: int, 
                          config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Evolve a population of agents.
        
        Args:
            population: Current population of agents
            generation: Current generation number
            config: Evolution configuration
            
        Returns:
            Evolved population and metrics
        """
        try:
            # Validate population
            self._validate_population(population)
            
            # Convert TypeScript format to DGM format
            dgm_population = []
            for agent in population:
                dgm_agent = {
                    "id": agent.get("id"),
                    "generation": agent.get("generation"),
                    "fitness": agent.get("fitness", 0.0),
                    "policy": agent.get("policy", {}),
                    "parent_id": agent.get("parentId"),
                    "mutations": agent.get("mutations", [])
                }
                dgm_population.append(dgm_agent)
            
            # Perform evolution using dgm_adapter
            evolved_population = []
            
            # Choose parents using DGM's selection method
            parent_commits = await self.dgm_adapter.choose_parents(
                [agent["id"] for agent in dgm_population],
                method=config.get("chooseSelfImprovesMethod", "score_child_prop"),
                selfimprove_size=config.get("selfImproveSize", 2)
            )
            
            # Run self-improvement for each parent
            for parent_commit in parent_commits:
                parent_agent = next((a for a in dgm_population if a["id"] == parent_commit), None)
                if not parent_agent:
                    continue
                    
                # Get agent code (could be from file or policy)
                agent_code = parent_agent.get("code", "")
                if not agent_code and "policy" in parent_agent:
                    # Generate code from policy if needed
                    agent_code = f"# Agent {parent_agent['id']}\n# Policy: {parent_agent['policy']}"
                
                # Run self-improvement
                result = await self.dgm_adapter.self_improve(
                    agent_code=agent_code,
                    task_description=f"Improve agent performance for generation {generation + 1}",
                    parent_commit=parent_commit,
                    num_evals=config.get("numSweEvals", 1),
                    polyglot=config.get("polyglot", False)
                )
                
                if result["success"]:
                    evolved_agent = {
                        "id": result["run_id"],
                        "generation": generation + 1,
                        "fitness": result.get("performance", {}).get("accuracy_score", parent_agent["fitness"]),
                        "policy": parent_agent["policy"],
                        "parent_id": parent_commit,
                        "mutations": [{"type": "self-improve", "timestamp": datetime.now().isoformat()}],
                        "code": result.get("improved_code", agent_code)
                    }
                    evolved_population.append(evolved_agent)
            
            # Convert back to TypeScript format
            ts_population = []
            for agent in evolved_population:
                ts_agent = {
                    "id": agent["id"],
                    "generation": agent["generation"],
                    "fitness": agent["fitness"],
                    "policy": agent["policy"],
                    "parentId": agent.get("parent_id"),
                    "mutations": agent.get("mutations", [])
                }
                ts_population.append(ts_agent)
            
            return {
                "population": ts_population,
                "generation": generation + 1,
                "metrics": {
                    "avgFitness": sum(a["fitness"] for a in ts_population) / len(ts_population),
                    "maxFitness": max(a["fitness"] for a in ts_population),
                    "minFitness": min(a["fitness"] for a in ts_population),
                    "populationSize": len(ts_population)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to evolve agents: {e}")
            raise
    
    async def get_population_state(self) -> Dict[str, Any]:
        """
        Get the current state of the evolution population.
        
        Returns:
            Current population state
        """
        try:
            # Read from the latest generation metadata
            latest_gen = self._get_latest_generation_info()
            
            if not latest_gen:
                return {
                    "generation": 0,
                    "population": [],
                    "archive": [],
                    "metrics": {}
                }
            
            # Convert DGM format to TypeScript format
            ts_data = self._convert_dgm_to_ts(latest_gen)
            
            return {
                "generation": latest_gen.get("generation", 0),
                "population": ts_data.get("population", []),
                "archive": ts_data.get("archive", []),
                "metrics": {
                    "generationTime": latest_gen.get("generation_time", 0),
                    "evaluationsPerformed": latest_gen.get("evaluations_performed", 0),
                    "improvementsFound": latest_gen.get("improvements_found", 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get population state: {e}")
            raise
    
    async def update_fitness(self, agent_id: str, fitness: float, 
                           metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Update fitness score for an agent.
        
        Args:
            agent_id: ID of the agent
            fitness: New fitness score
            metadata: Additional metadata about the fitness evaluation
            
        Returns:
            Update confirmation
        """
        try:
            # Validate inputs
            if not isinstance(agent_id, str) or not agent_id:
                raise ValidationError("agent_id must be a non-empty string")
            
            if not isinstance(fitness, (int, float)):
                raise ValidationError("fitness must be numeric")
            
            if fitness < 0:
                raise ValidationError("fitness must be non-negative")
            
            # In a real implementation, this would update the DGM system
            # For now, log the update
            logger.info(f"Updating fitness for agent {agent_id}: {fitness}")
            
            # Write fitness update to a file for DGM to pick up
            fitness_update = {
                "agent_id": agent_id,
                "fitness": fitness,
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata or {}
            }
            
            fitness_file = os.path.join(self.output_dir, "fitness_updates.jsonl")
            with open(fitness_file, "a") as f:
                f.write(json.dumps(fitness_update) + "\n")
            
            return {
                "status": "updated",
                "agentId": agent_id,
                "fitness": fitness,
                "timestamp": fitness_update["timestamp"]
            }
            
        except Exception as e:
            logger.error(f"Failed to update fitness: {e}")
            raise
    
    async def get_evolution_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive evolution metrics.
        
        Returns:
            Evolution metrics and statistics
        """
        try:
            # Read all generation metadata
            metadata_path = os.path.join(self.output_dir, "dgm_metadata.jsonl")
            generations = []
            
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    for line in f:
                        if line.strip():
                            generations.append(json.loads(line))
            
            if not generations:
                return {
                    "totalGenerations": 0,
                    "metrics": {}
                }
            
            # Calculate metrics
            fitness_history = []
            improvement_counts = []
            generation_times = []
            
            for gen in generations:
                if "archive" in gen:
                    fitness_values = [a.get("fitness", 0) for a in gen["archive"]]
                    if fitness_values:
                        fitness_history.append({
                            "generation": gen.get("generation", 0),
                            "avgFitness": sum(fitness_values) / len(fitness_values),
                            "maxFitness": max(fitness_values),
                            "minFitness": min(fitness_values)
                        })
                
                improvement_counts.append(gen.get("improvements_found", 0))
                generation_times.append(gen.get("generation_time", 0))
            
            return {
                "totalGenerations": len(generations),
                "currentGeneration": generations[-1].get("generation", 0),
                "fitnessHistory": fitness_history,
                "metrics": {
                    "avgGenerationTime": sum(generation_times) / len(generation_times) if generation_times else 0,
                    "totalImprovements": sum(improvement_counts),
                    "avgImprovementsPerGeneration": sum(improvement_counts) / len(improvement_counts) if improvement_counts else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get evolution metrics: {e}")
            raise
    
    async def save_checkpoint(self, checkpoint_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Save evolution checkpoint.
        
        Args:
            checkpoint_name: Optional name for the checkpoint
            
        Returns:
            Checkpoint information
        """
        try:
            if not checkpoint_name:
                checkpoint_name = f"checkpoint_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            checkpoint_dir = os.path.join(self.output_dir, "checkpoints", checkpoint_name)
            os.makedirs(checkpoint_dir, exist_ok=True)
            
            # Copy current state files
            files_to_copy = ["dgm_metadata.jsonl", "fitness_updates.jsonl"]
            for file_name in files_to_copy:
                src_path = os.path.join(self.output_dir, file_name)
                if os.path.exists(src_path):
                    dst_path = os.path.join(checkpoint_dir, file_name)
                    with open(src_path, 'r') as src, open(dst_path, 'w') as dst:
                        dst.write(src.read())
            
            # Save config
            if self.current_config:
                config_path = os.path.join(checkpoint_dir, "config.json")
                with open(config_path, 'w') as f:
                    json.dump(self.current_config, f, indent=2)
            
            return {
                "checkpointName": checkpoint_name,
                "path": checkpoint_dir,
                "timestamp": datetime.now().isoformat(),
                "status": "saved"
            }
            
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            raise
    
    async def load_checkpoint(self, checkpoint_name: str) -> Dict[str, Any]:
        """
        Load evolution checkpoint.
        
        Args:
            checkpoint_name: Name of the checkpoint to load
            
        Returns:
            Load status
        """
        try:
            checkpoint_dir = os.path.join(self.output_dir, "checkpoints", checkpoint_name)
            
            if not os.path.exists(checkpoint_dir):
                raise ValueError(f"Checkpoint not found: {checkpoint_name}")
            
            # Restore state files
            files_to_restore = ["dgm_metadata.jsonl", "fitness_updates.jsonl"]
            for file_name in files_to_restore:
                src_path = os.path.join(checkpoint_dir, file_name)
                if os.path.exists(src_path):
                    dst_path = os.path.join(self.output_dir, file_name)
                    with open(src_path, 'r') as src, open(dst_path, 'w') as dst:
                        dst.write(src.read())
            
            # Load config
            config_path = os.path.join(checkpoint_dir, "config.json")
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    self.current_config = json.load(f)
            
            return {
                "checkpointName": checkpoint_name,
                "status": "loaded",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            raise
    
    def _validate_evolution_config(self, config: Dict[str, Any]) -> None:
        """
        Validate evolution configuration.
        
        Args:
            config: Configuration to validate
            
        Raises:
            ValidationError: If configuration is invalid
        """
        required_fields = ["maxGenerations", "selfImproveSize", "selfImproveWorkers"]
        
        for field in required_fields:
            if field not in config:
                raise ValidationError(f"Missing required field: {field}")
        
        # Validate numeric fields
        numeric_fields = {
            "maxGenerations": (1, 1000),
            "selfImproveSize": (1, 100),
            "selfImproveWorkers": (1, 32),
            "numSweEvals": (1, 10),
            "evalNoise": (0.0, 1.0)
        }
        
        for field, (min_val, max_val) in numeric_fields.items():
            if field in config:
                value = config[field]
                if not isinstance(value, (int, float)):
                    raise ValidationError(f"Field {field} must be numeric, got {type(value).__name__}")
                if value < min_val or value > max_val:
                    raise ValidationError(f"Field {field} must be between {min_val} and {max_val}, got {value}")
        
        # Validate string fields
        string_fields = {
            "chooseSelfImprovesMethod": ["score_child_prop", "score_based", "random"],
            "updateArchive": ["keep_all", "keep_best", "tournament"]
        }
        
        for field, valid_values in string_fields.items():
            if field in config:
                value = config[field]
                if not isinstance(value, str):
                    raise ValidationError(f"Field {field} must be string, got {type(value).__name__}")
                if value not in valid_values:
                    raise ValidationError(f"Field {field} must be one of {valid_values}, got {value}")
    
    def _validate_population(self, population: List[Dict[str, Any]]) -> None:
        """
        Validate population data structure.
        
        Args:
            population: Population to validate
            
        Raises:
            ValidationError: If population is invalid
        """
        if not isinstance(population, list):
            raise ValidationError(f"Population must be a list, got {type(population).__name__}")
        
        if not population:
            raise ValidationError("Population cannot be empty")
        
        for i, agent in enumerate(population):
            if not isinstance(agent, dict):
                raise ValidationError(f"Agent {i} must be a dict, got {type(agent).__name__}")
            
            required_fields = ["id", "generation", "fitness"]
            for field in required_fields:
                if field not in agent:
                    raise ValidationError(f"Agent {i} missing required field: {field}")
            
            if not isinstance(agent["fitness"], (int, float)):
                raise ValidationError(f"Agent {i} fitness must be numeric")
            
            if not isinstance(agent["generation"], int) or agent["generation"] < 0:
                raise ValidationError(f"Agent {i} generation must be non-negative integer")
    
    async def _safe_subprocess_run(self, cmd: List[str], timeout: int = 300) -> subprocess.CompletedProcess:
        """
        Safely run a subprocess with timeout and error handling.
        
        Args:
            cmd: Command to run
            timeout: Timeout in seconds
            
        Returns:
            Completed process result
            
        Raises:
            DGMConnectionError: If subprocess fails
        """
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.dgm_path
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                raise DGMConnectionError(f"Process timed out after {timeout} seconds")
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise DGMConnectionError(f"Process failed with code {process.returncode}: {error_msg}")
            
            return subprocess.CompletedProcess(
                cmd, process.returncode,
                stdout.decode() if stdout else "",
                stderr.decode() if stderr else ""
            )
            
        except Exception as e:
            logger.error(f"Subprocess execution failed: {e}")
            raise DGMConnectionError(f"Failed to execute subprocess: {str(e)}")
    
    def _sanitize_input(self, data: Any) -> Any:
        """
        Sanitize input data to prevent injection attacks.
        
        Args:
            data: Data to sanitize
            
        Returns:
            Sanitized data
        """
        if isinstance(data, str):
            # Remove potentially dangerous characters
            dangerous_chars = [';', '&&', '||', '`', '$', '(', ')', '{', '}']
            sanitized = data
            for char in dangerous_chars:
                sanitized = sanitized.replace(char, '')
            return sanitized
        elif isinstance(data, dict):
            return {k: self._sanitize_input(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_input(item) for item in data]
        else:
            return data


async def main():
    """Example usage of Evolution Bridge."""
    # Initialize the bridge
    bridge = EvolutionBridge(
        dgm_path="/path/to/dgm",
        orchestrator_url="http://localhost:3000"
    )
    
    # Example JSON-RPC request
    request = {
        "jsonrpc": "2.0",
        "method": "start_evolution",
        "params": {
            "maxGenerations": 10,
            "selfImproveSize": 2,
            "selfImproveWorkers": 2,
            "chooseSelfImprovesMethod": "score_child_prop",
            "updateArchive": "keep_all",
            "numSweEvals": 1,
            "evalNoise": 0.1,
            "polyglot": False
        },
        "id": 1
    }
    
    # Handle the request
    response = await bridge.handle_request(request)
    print(f"Response: {json.dumps(response, indent=2)}")
    
    # Example of evolving agents
    population = [
        {
            "id": "agent_1",
            "generation": 0,
            "fitness": 0.5,
            "policy": {"param1": 0.1, "param2": 0.2},
            "parentId": None,
            "mutations": []
        },
        {
            "id": "agent_2", 
            "generation": 0,
            "fitness": 0.6,
            "policy": {"param1": 0.3, "param2": 0.4},
            "parentId": None,
            "mutations": []
        }
    ]
    
    evolution_request = {
        "jsonrpc": "2.0",
        "method": "evolve_agents",
        "params": {
            "population": population,
            "generation": 0,
            "config": {"maxGenerations": 10}
        },
        "id": 2
    }
    
    evolution_response = await bridge.handle_request(evolution_request)
    print(f"Evolution Response: {json.dumps(evolution_response, indent=2)}")


if __name__ == "__main__":
    # Set up async event loop and run main
    asyncio.run(main())