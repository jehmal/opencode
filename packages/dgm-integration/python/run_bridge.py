#!/usr/bin/env python3
"""
Simple launcher to ensure the bridge runs with correct Python environment
"""
import sys
import os

# Add the venv site-packages to sys.path if not already there
venv_site_packages = "/mnt/c/Users/jehma/Desktop/AI/DGMSTT/dgm/venv/lib/python3.12/site-packages"
if venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)

# Now import and run the bridge
from bridge import main

if __name__ == "__main__":
    main()