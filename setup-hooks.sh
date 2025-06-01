#!/bin/bash

echo "🔧 Setting up git hooks..."

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy our custom hooks to .git/hooks
cp .githooks/pre-push .git/hooks/pre-push

# Make sure hooks are executable
chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed successfully!"
echo "📝 Now when you 'git push', the version will auto-increment"