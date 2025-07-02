from setuptools import setup, find_packages

setup(
    name='dgmstt-tool-protocol',
    version='1.0.0',
    description='Python implementation of the cross-language tool protocol',
    author='DGMSTT Team',
    packages=find_packages(),
    python_requires='>=3.8',
    install_requires=[
        'jsonschema>=4.0.0',
    ],
    extras_require={
        'dev': [
            'pytest>=7.0.0',
            'pytest-asyncio>=0.20.0',
            'pytest-cov>=4.0.0',
        ]
    },
    entry_points={
        'console_scripts': [
            'tool-protocol-bridge=protocol.python.__main__:main',
        ],
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
)