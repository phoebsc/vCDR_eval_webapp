#!/bin/bash

# Test vCDR Integration Script
# This script tests the vCDR Python integration without needing a full benchmark run

echo "🧪 Testing vCDR Integration..."
echo "================================"

# Start the server in the background
echo "📡 Starting server..."
npm start &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 5

# Test the vCDR integration endpoint
echo "🔬 Testing vCDR integration endpoint..."
curl -X POST http://localhost:3000/api/test-vcdr-integration \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
echo "✅ Test completed!"
echo ""
echo "Check the server console output above for detailed logs including:"
echo "- [METRICS] Node.js processing logs"
echo "- [PYTHON STDOUT] Python script execution"
echo "- [PYTHON STDERR] Any Python errors"
echo ""

# Cleanup
echo "🧹 Stopping server..."
kill $SERVER_PID 2>/dev/null

echo "Done! 🎉"