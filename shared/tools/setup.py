"""
Setup configuration for shared tools package
"""

from setuptools import setup, find_packages

setup(
    name="dgmstt-shared-tools",
    version="1.0.0",
    description="Cross-language tool integration for DGMSTT",
    author="DGMSTT Team",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "pydantic>=2.0.0",
        "typing-extensions>=4.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "flake8>=6.0.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "dgmstt-tools-example=examples.python_example:main",
        ]
    }
)