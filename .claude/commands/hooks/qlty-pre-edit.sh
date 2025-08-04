#!/bin/bash

# Pre-edit quality check hook using qlty CLI
# Runs before file modifications to ensure quality standards

set -e

# Default values
FILE_PATH=""
AUTO_FIX=true
VALIDATE_SYNTAX=true
FAIL_ON_ERROR=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --file|-f)
      FILE_PATH="$2"
      shift 2
      ;;
    --fix)
      AUTO_FIX=true
      shift
      ;;
    --no-fix)
      AUTO_FIX=false
      shift
      ;;
    --validate-syntax)
      VALIDATE_SYNTAX=true
      shift
      ;;
    --fail-on-error)
      FAIL_ON_ERROR=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$FILE_PATH" ]]; then
  echo "Error: --file parameter is required"
  exit 1
fi

# Check if file exists
if [[ ! -f "$FILE_PATH" ]]; then
  echo "Error: File does not exist: $FILE_PATH"
  exit 1
fi

echo "🔍 Running pre-edit quality checks for: $FILE_PATH"

# Initialize results
RESULTS='{
  "continue": true,
  "file": "'$FILE_PATH'",
  "syntaxValid": true,
  "formatted": false,
  "issues": [],
  "warnings": []
}'

# Check if qlty is available
if ! command -v qlty &> /dev/null; then
  echo "Warning: qlty CLI not found. Install from https://docs.qlty.sh/cli/quickstart"
  echo "$RESULTS"
  exit 0
fi

# Create temporary results file
TEMP_RESULTS=$(mktemp)
echo "$RESULTS" > "$TEMP_RESULTS"

# Run qlty check on the specific file
echo "📋 Checking code quality..."
if qlty check "$FILE_PATH" --format json > /tmp/qlty-check-results.json 2>/dev/null; then
  echo "✅ Quality check passed"
else
  echo "⚠️  Quality issues found"
  
  # Parse issues from qlty output
  if [[ -f /tmp/qlty-check-results.json ]]; then
    ISSUES_COUNT=$(jq -r '.issues | length' /tmp/qlty-check-results.json 2>/dev/null || echo "0")
    if [[ "$ISSUES_COUNT" -gt 0 ]]; then
      echo "Found $ISSUES_COUNT quality issues"
      
      # Add issues to results
      jq --argjson issues "$(jq '.issues' /tmp/qlty-check-results.json 2>/dev/null || echo '[]')" \
        '.issues = $issues' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
      
      if [[ "$FAIL_ON_ERROR" == "true" ]]; then
        jq '.continue = false' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
        echo "❌ Failing due to quality issues (--fail-on-error enabled)"
      fi
    fi
  fi
fi

# Auto-fix if enabled
if [[ "$AUTO_FIX" == "true" ]]; then
  echo "🔧 Auto-fixing issues..."
  if qlty fmt "$FILE_PATH" 2>/dev/null; then
    echo "✅ Code formatted successfully"
    jq '.formatted = true' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  else
    echo "⚠️  Could not auto-format file"
    jq '.warnings += ["Auto-formatting failed"]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  fi
fi

# Validate syntax if enabled
if [[ "$VALIDATE_SYNTAX" == "true" ]]; then
  echo "🔍 Validating syntax..."
  
  # Basic syntax validation based on file extension
  FILE_EXT="${FILE_PATH##*.}"
  case "$FILE_EXT" in
    js|jsx|ts|tsx)
      # Use Node.js to check JavaScript/TypeScript syntax
      if command -v node &> /dev/null; then
        if ! node -c "$FILE_PATH" 2>/dev/null; then
          echo "❌ JavaScript/TypeScript syntax error"
          jq '.syntaxValid = false | .warnings += ["Syntax validation failed"]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
        else
          echo "✅ Syntax validation passed"
        fi
      fi
      ;;
    py)
      # Use Python to check Python syntax
      if command -v python3 &> /dev/null; then
        if ! python3 -m py_compile "$FILE_PATH" 2>/dev/null; then
          echo "❌ Python syntax error"
          jq '.syntaxValid = false | .warnings += ["Python syntax validation failed"]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
        else
          echo "✅ Python syntax validation passed"
        fi
      fi
      ;;
    json)
      # Use jq to validate JSON
      if command -v jq &> /dev/null; then
        if ! jq empty "$FILE_PATH" 2>/dev/null; then
          echo "❌ JSON syntax error"
          jq '.syntaxValid = false | .warnings += ["JSON syntax validation failed"]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
        else
          echo "✅ JSON syntax validation passed"
        fi
      fi
      ;;
  esac
fi

# Output final results
echo "📊 Pre-edit quality check complete"
cat "$TEMP_RESULTS"

# Cleanup
rm -f "$TEMP_RESULTS" /tmp/qlty-check-results.json

# Exit with appropriate code
if jq -r '.continue' "$TEMP_RESULTS" | grep -q false; then
  exit 1
fi

exit 0