"""
DGM Integration Python Package
"""

from .bridge import JSONRPCBridge
from .adapter import DGMAdapter

__version__ = "0.0.1"
__all__ = ["JSONRPCBridge", "DGMAdapter"]