# hook quality-check

Execute comprehensive quality checks using qlty CLI for formatting, linting, and code analysis.

## Usage

```bash
npx claude-flow hook quality-check [options]
```

## Options

- `--path, -p <path>` - Path to check (default: current directory)
- `--fix` - Automatically fix issues where possible (default: true)
- `--format` - Run code formatting (default: true)
- `--lint` - Run linting checks (default: true)
- `--security` - Run security checks (default: true)
- `--fail-on-error` - Fail the hook if issues found (default: false)
- `--report-format <format>` - Output format: json, sarif, text (default: text)

## Examples

### Basic quality check

```bash
npx claude-flow hook quality-check --path "src/"
```

### Format and fix automatically

```bash
npx claude-flow hook quality-check -p "." --fix --format
```

### Security-focused check

```bash
npx claude-flow hook quality-check -p "src/" --security --fail-on-error
```

### Generate JSON report

```bash
npx claude-flow hook quality-check -p "." --report-format json
```

## Features

### Code Formatting

- Prettier for JavaScript/TypeScript/JSON/Markdown
- Biome for fast JS/TS formatting
- Language-specific formatters
- Consistent code style

### Linting Analysis

- ESLint equivalent checks
- TypeScript type checking
- React/Next.js specific rules
- Custom project rules

### Security Scanning

- Secret detection with TruffleHog
- Vulnerability scanning
- Dependency checks
- Configuration validation

### Performance Optimization

- Bundle size analysis
- Code quality metrics
- Technical debt identification
- Best practices enforcement

## Integration

This hook integrates with:

### Pre-edit Hook

- Runs quality checks before file modifications
- Validates syntax and formatting
- Identifies potential issues early

### Post-edit Hook

- Formats code after edits
- Validates changes meet quality standards
- Updates quality metrics

### Pre-task Hook

- Ensures codebase quality before starting work
- Identifies areas needing attention

- Sets quality baseline

### Post-task Hook

- Validates all changes meet quality standards
- Generates quality reports
- Updates project quality metrics

## qlty Configuration

Uses project configuration from `.qlty/qlty.toml`:

```toml
# Optimized for Solomon Codes project
config_version = "0"

exclude_patterns = [
  "**/.next/**",
  "**/.turbo/**",
  "**/node_modules/**",
  "**/.claude-flow/**",
  # ... project-specific excludes
]

[[plugin]]
name = "biome"        # Fast JS/TS formatting

[[plugin]]
name = "prettier"     # Markdown/JSON formatting

[[plugin]]
name = "trufflehog"   # Security scanning

[[plugin]]
name = "checkov"      # Infrastructure checks
```

## Implementation

The hook executes these qlty commands:

```bash
# Format code
qlty fmt --fix

# Run all quality checks
qlty check --fix

# Security scan
qlty secrets

# Generate report
qlty check --format json > quality-report.json
```

## Output

Returns JSON with:

```json
{
  "status": "success",
  "path": "src/",
  "checks": {
    "formatting": {
      "passed": true,
      "filesFormatted": 15,
      "formatter": "biome"
    },
    "linting": {
      "passed": true,
      "issues": 0,
      "warnings": 2
    },
    "security": {
      "passed": true,
      "secrets": 0,
      "vulnerabilities": 0
    }
  },
  "metrics": {
    "filesChecked": 145,
    "linesOfCode": 12500,
    "qualityScore": 0.95,
    "technicalDebt": "low"
  },
  "reportPath": "quality-report.json"
}
```

## Error Handling

If quality issues are found:

```json
{
  "status": "error",
  "message": "Quality issues found",
  "issues": [
    {
      "type": "linting",
      "file": "src/component.tsx",
      "line": 25,
      "message": "Missing return type annotation",
      "severity": "warning",
      "fixable": true
    }
  ],
  "fixesApplied": 8,
  "manualFixesNeeded": 2
}
```

## Integration with Existing Project

### Biome Integration

- Uses existing `biome.json` configuration
- Respects project's formatting rules
- Integrates with existing linting setup

### Project-Specific Optimizations

- Excludes build artifacts (`.next/`, `.turbo/`)
- Ignores generated files (`routeTree.gen.ts`)
- Focuses on source code quality
- Optimized for React/Next.js patterns

### Performance

- Fast execution with Biome
- Incremental checking when possible
- Parallel processing of files
- Smart caching of results

## See Also

- `hook pre-edit` - Pre-edit preparation with quality checks
- `hook post-edit` - Post-edit formatting and validation
- `hook pre-task` - Task preparation with quality baseline
- `hook post-task` - Task completion with quality metrics
- `qlty check` - Direct qlty CLI usage
- `qlty fmt` - Code formatting
- `qlty secrets` - Security scanning
