#!/bin/bash

# Post-edit quality processing hook using qlty CLI
# Runs after file modifications to ensure quality standards and format code

set -e

# Default values
FILE_PATH=""
AUTO_FORMAT=true
MEMORY_KEY=""
VALIDATE_OUTPUT=true
GENERATE_REPORT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --file|-f)
      FILE_PATH="$2"
      shift 2
      ;;
    --auto-format)
      AUTO_FORMAT=true
      shift
      ;;
    --no-format)
      AUTO_FORMAT=false
      shift
      ;;
    --memory-key|-m)
      MEMORY_KEY="$2"
      shift 2
      ;;
    --validate-output)
      VALIDATE_OUTPUT=true
      shift
      ;;
    --generate-report)
      GENERATE_REPORT=true
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

echo "🔧 Running post-edit quality processing for: $FILE_PATH"

# Initialize results
RESULTS='{
  "file": "'$FILE_PATH'",
  "formatted": false,
  "formatterUsed": null,
  "lintPassed": true,
  "memorySaved": null,
  "validationPassed": true,
  "warnings": [],
  "stats": {
    "linesChanged": 0,
    "charactersAdded": 0
  }
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

# Get file stats before formatting
if [[ -f "$FILE_PATH" ]]; then
  LINES_BEFORE=$(wc -l < "$FILE_PATH" 2>/dev/null || echo "0")
  CHARS_BEFORE=$(wc -c < "$FILE_PATH" 2>/dev/null || echo "0")
fi

# Auto-format if enabled
if [[ "$AUTO_FORMAT" == "true" ]]; then
  echo "🎨 Formatting code..."
  
  # Determine formatter based on file extension
  FILE_EXT="${FILE_PATH##*.}"
  FORMATTER_USED=""
  
  case "$FILE_EXT" in
    js|jsx|ts|tsx)
      FORMATTER_USED="biome"
      ;;
    json|md|yaml|yml)
      FORMATTER_USED="prettier"
      ;;
    *)
      FORMATTER_USED="qlty"
      ;;
  esac
  
  if qlty fmt "$FILE_PATH" 2>/dev/null; then
    echo "✅ Code formatted successfully with $FORMATTER_USED"
    jq --arg formatter "$FORMATTER_USED" '.formatted = true | .formatterUsed = $formatter' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  else
    echo "⚠️  Could not format file"
    jq '.warnings += ["Auto-formatting failed"]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  fi
fi

# Calculate stats after formatting
if [[ -f "$FILE_PATH" ]]; then
  LINES_AFTER=$(wc -l < "$FILE_PATH" 2>/dev/null || echo "0")
  CHARS_AFTER=$(wc -c < "$FILE_PATH" 2>/dev/null || echo "0")
  
  LINES_CHANGED=$((LINES_AFTER - LINES_BEFORE))
  CHARS_CHANGED=$((CHARS_AFTER - CHARS_BEFORE))
  
  jq --argjson lines "$LINES_CHANGED" --argjson chars "$CHARS_CHANGED" \
    '.stats.linesChanged = $lines | .stats.charactersAdded = $chars' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
fi

# Validate output if enabled
if [[ "$VALIDATE_OUTPUT" == "true" ]]; then
  echo "🔍 Validating output..."
  
  # Run qlty check to validate the formatted file
  if qlty check "$FILE_PATH" --format json > /tmp/qlty-post-check.json 2>/dev/null; then
    echo "✅ Output validation passed"
    jq '.validationPassed = true' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  else
    echo "⚠️  Output validation found issues"
    jq '.validationPassed = false | .lintPassed = false' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
    
    # Add validation issues to warnings
    if [[ -f /tmp/qlty-post-check.json ]]; then
      ISSUES_COUNT=$(jq -r '.issues | length' /tmp/qlty-post-check.json 2>/dev/null || echo "0")
      if [[ "$ISSUES_COUNT" -gt 0 ]]; then
        jq --arg warning "Found $ISSUES_COUNT validation issues after formatting" \
          '.warnings += [$warning]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
      fi
    fi
  fi
fi

# Store in memory if memory key provided
if [[ -n "$MEMORY_KEY" ]]; then
  echo "💾 Storing edit context in memory..."
  
  # Create memory entry with file context
  MEMORY_CONTENT="File: $FILE_PATH
Edit completed: $(date)
Formatted: $(jq -r '.formatted' "$TEMP_RESULTS")
Formatter: $(jq -r '.formatterUsed' "$TEMP_RESULTS")
Lines changed: $(jq -r '.stats.linesChanged' "$TEMP_RESULTS")
Characters added: $(jq -r '.stats.charactersAdded' "$TEMP_RESULTS")
Validation passed: $(jq -r '.validationPassed' "$TEMP_RESULTS")"

  # Store using claude-flow memory system if available
  if command -v npx &> /dev/null && npx claude-flow memory usage --action store --key "$MEMORY_KEY" --value "$MEMORY_CONTENT" 2>/dev/null; then
    echo "✅ Memory stored successfully"
    jq --arg key "$MEMORY_KEY" '.memorySaved = $key' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  else
    echo "⚠️  Could not store memory"
    jq '.warnings += ["Memory storage failed"]' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  fi
fi

# Generate report if requested
if [[ "$GENERATE_REPORT" == "true" ]]; then
  echo "📊 Generating quality report..."
  
  REPORT_FILE="/tmp/post-edit-report-$(basename "$FILE_PATH" | sed 's/[^a-zA-Z0-9.-]/_/g').json"
  
  # Create comprehensive report
  REPORT='{
    "file": "'$FILE_PATH'",
    "timestamp": "'$(date -Iseconds)'",
    "processing": {
      "formatted": '$(jq '.formatted' "$TEMP_RESULTS")',
      "formatter": '$(jq '.formatterUsed' "$TEMP_RESULTS")',
      "validated": '$(jq '.validationPassed' "$TEMP_RESULTS")'
    },
    "stats": '$(jq '.stats' "$TEMP_RESULTS")',
    "warnings": '$(jq '.warnings' "$TEMP_RESULTS")'
  }'
  
  echo "$REPORT" > "$REPORT_FILE"
  jq --arg path "$REPORT_FILE" '.reportPath = $path' "$TEMP_RESULTS" > "$TEMP_RESULTS.tmp" && mv "$TEMP_RESULTS.tmp" "$TEMP_RESULTS"
  echo "✅ Report saved to: $REPORT_FILE"
fi

# Output final results
echo "📊 Post-edit quality processing complete"
cat "$TEMP_RESULTS"

# Cleanup
rm -f "$TEMP_RESULTS" /tmp/qlty-post-check.json

exit 0