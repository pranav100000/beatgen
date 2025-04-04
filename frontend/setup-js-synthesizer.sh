#!/bin/bash

# Setup script for js-synthesizer
# This script copies the required js-synthesizer files to the public directory

# Create the target directory
mkdir -p public/js-synthesizer

echo "Installing js-synthesizer package..."
npm install --save js-synthesizer

echo "Copying files from node_modules to public/js-synthesizer..."

# Copy the main js-synthesizer files
cp node_modules/js-synthesizer/dist/js-synthesizer.js public/js-synthesizer/
cp node_modules/js-synthesizer/dist/js-synthesizer.js.map public/js-synthesizer/
cp node_modules/js-synthesizer/dist/js-synthesizer.min.js public/js-synthesizer/
cp node_modules/js-synthesizer/dist/js-synthesizer.min.js.map public/js-synthesizer/

# Copy worklet files
cp node_modules/js-synthesizer/dist/js-synthesizer.worklet.js public/js-synthesizer/
cp node_modules/js-synthesizer/dist/js-synthesizer.worklet.js.map public/js-synthesizer/
cp node_modules/js-synthesizer/dist/js-synthesizer.worklet.min.js public/js-synthesizer/
cp node_modules/js-synthesizer/dist/js-synthesizer.worklet.min.js.map public/js-synthesizer/

# Copy libfluidsynth files (from externals directory)
cp node_modules/js-synthesizer/externals/libfluidsynth-2.3.0.js public/js-synthesizer/

# Check if we have the required files
if [ ! -f public/js-synthesizer/libfluidsynth-2.3.0.js ]; then
  echo "Warning: libfluidsynth-2.3.0.js was not found or could not be copied."
  echo "Manually copy this file to public/js-synthesizer/ if needed."
fi

if [ ! -f public/js-synthesizer/js-synthesizer.js ]; then
  echo "Warning: js-synthesizer.js was not found or could not be copied."
  echo "Manually copy this file to public/js-synthesizer/ if needed."
fi

echo "All files copied successfully to public/js-synthesizer/"
echo "Don't forget to make this script executable with: chmod +x setup-js-synthesizer.sh"