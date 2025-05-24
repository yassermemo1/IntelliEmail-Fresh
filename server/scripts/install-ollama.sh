#!/bin/bash

# Script to install Ollama in the Replit environment
# This allows direct testing of Ollama features without needing to run it on a local machine

echo "Installing Ollama in Replit environment..."

# Create install directory
mkdir -p /tmp/ollama

# Download latest Ollama binary for Linux
echo "Downloading Ollama..."
curl -L https://ollama.ai/download/linux/amd64 -o /tmp/ollama/ollama

# Make it executable
chmod +x /tmp/ollama/ollama

echo "Starting Ollama server..."
# Run Ollama in the background
/tmp/ollama/ollama serve &

# Wait for Ollama to start
sleep 5

echo "Installing a basic model (this may take a while)..."
# Pull a small model for testing
/tmp/ollama/ollama pull tinyllama

echo "Ollama installation complete!"
echo "Ollama server is running at: http://localhost:11434"
echo "You can now test the connection in the application."