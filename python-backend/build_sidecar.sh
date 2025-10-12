#!/bin/bash
# Shell script to build BitBrowser API sidecar for Linux/macOS
# Usage: ./build_sidecar.sh

set -e  # Exit on error

echo "========================================"
echo "Building BitBrowser API Sidecar"
echo "========================================"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python3 not found. Please install Python 3.8+"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version)
echo "Using: $PYTHON_VERSION"

# Install/upgrade dependencies
echo ""
echo "Installing dependencies..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
python3 -m pip install pyinstaller

# Build the executable
echo ""
echo "Building executable with PyInstaller..."
pyinstaller bitbrowser_api.spec --clean

# Determine the target triple based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    TARGET_TRIPLE="x86_64-unknown-linux-gnu"
    BINARY_NAME="bitbrowser-api"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Check if ARM64 (M1/M2) or x86_64
    if [[ $(uname -m) == "arm64" ]]; then
        TARGET_TRIPLE="aarch64-apple-darwin"
    else
        TARGET_TRIPLE="x86_64-apple-darwin"
    fi
    BINARY_NAME="bitbrowser-api"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Check if build succeeded
if [ -f "dist/$BINARY_NAME" ]; then
    echo ""
    echo "Build successful!"
    echo "Executable location: dist/$BINARY_NAME"

    # Get file size
    FILE_SIZE=$(du -h "dist/$BINARY_NAME" | cut -f1)
    echo "File size: $FILE_SIZE"

    # Copy to Tauri binaries directory
    TARGET_DIR="../src-tauri/binaries"
    mkdir -p "$TARGET_DIR"

    cp "dist/$BINARY_NAME" "$TARGET_DIR/bitbrowser-api-$TARGET_TRIPLE"
    chmod +x "$TARGET_DIR/bitbrowser-api-$TARGET_TRIPLE"
    echo ""
    echo "Copied to Tauri binaries: $TARGET_DIR/bitbrowser-api-$TARGET_TRIPLE"

    # Test the executable
    echo ""
    echo "Testing executable..."
    TEST_RESULT=$("dist/$BINARY_NAME" check 2>&1 || true)
    echo "Test result: $TEST_RESULT"

    echo ""
    echo "========================================"
    echo "Build process completed!"
    echo "========================================"
else
    echo ""
    echo "Build failed! Check errors above."
    exit 1
fi
