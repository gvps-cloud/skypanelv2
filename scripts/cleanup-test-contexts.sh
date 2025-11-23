#!/bin/bash
# Cleanup test/dummy uncloud contexts

echo "🧹 Cleaning up test contexts..."
echo ""

# Ensure we're on default context
echo "Switching to default context..."
uc context use default

echo ""
echo "Current contexts:"
uc context list

echo ""
echo "To remove default-1 context, run manually:"
echo "  uc context rm default-1"
echo ""
echo "Note: This requires interactive confirmation"
