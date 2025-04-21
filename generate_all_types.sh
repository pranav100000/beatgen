#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

MODELS_DIR="backend/app2/models"
TYPES_DIR="frontend/src/platform/types"
BASE_MODULE="app2.models"

echo "Generating TypeScript types for all models in $MODELS_DIR recursively..."

# Find all Python files recursively in the models directory, excluding __init__.py
find "$MODELS_DIR" -name '*.py' -not -name '__init__.py' | while IFS= read -r file_path; do
    # Get the relative path from the MODELS_DIR (e.g., subdir/mymodel.py)
    relative_path=${file_path#$MODELS_DIR/}
    
    # Get the relative path without the .py extension (e.g., subdir/mymodel)
    relative_path_no_ext=${relative_path%.py}

    # Extract the directory part (e.g., subdir or . if no subdir)
    relative_dir=$(dirname "$relative_path_no_ext")

    # Extract the filename base (e.g., mymodel)
    filename_base=$(basename "$relative_path_no_ext")

    # Convert slashes to dots for module path suffix (e.g., subdir.mymodel)
    module_suffix=$(echo "$relative_path_no_ext" | sed 's|/|.|g')

    # Construct the full Python module path (e.g., app2.models.subdir.mymodel)
    python_module="$BASE_MODULE.$module_suffix"

    # Construct the full output directory path
    output_dir_full="$TYPES_DIR/$relative_dir"
    # Construct the full output file path (e.g., frontend/src/platform/types/subdir/mymodel.ts)
    output_file_full="$output_dir_full/$filename_base.ts"

    echo "--------------------------------------------------"
    echo "Processing model: $python_module (from $file_path)"
    echo "Outputting to:  $output_file_full"

    # Run the generation script, passing the module and the FULL output path
    ./generate_types.sh "$python_module" "$output_file_full"

done

echo "--------------------------------------------------"
echo "All TypeScript types generated successfully in $TYPES_DIR."

exit 0 