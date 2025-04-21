#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if the correct number of arguments is provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <python_module> <full_output_path>"
    echo "Example: $0 app2.models.project frontend/src/platform/types/project.ts"
    exit 1
fi

PYTHON_MODULE=$1
FULL_OUTPUT_PATH=$2 # Second argument is now the full path

# Ensure the output directory exists
OUTPUT_DIR=$(dirname "$FULL_OUTPUT_PATH")
mkdir -p "$OUTPUT_DIR"

echo "Generating TypeScript types for module '$PYTHON_MODULE'..."
echo "Outputting to '$FULL_OUTPUT_PATH'..."

# Run the pydantic2ts command
# Assumes the script is run from the root directory where 'backend' is a subdirectory
PYTHONPATH=${PYTHONPATH:-"."}:./backend pydantic2ts --module "$PYTHON_MODULE" --output "$FULL_OUTPUT_PATH"

echo "Successfully generated TypeScript types to $FULL_OUTPUT_PATH."

exit 0 