# Git Worktree Navigation Helpers

Quick commands and aliases for managing git worktrees efficiently.

## Navigation Aliases

Add these to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Worktree navigation aliases
alias wtlist='git worktree list'
alias wtpwd='git worktree list | grep $(pwd)'
alias wtmain='cd /Users/neo/Developer/experiments/solomon_codes'
alias wtdev='cd /Users/neo/Developer/experiments/worktrees/serena-dev'

# Quick worktree creation
wtcreate() {
    local branch_name="$1"
    local worktree_name="${2:-$1}"
    git worktree add "../worktrees/$worktree_name" -b "$branch_name"
    cd "../worktrees/$worktree_name"
    bun install
}

# Quick worktree removal
wtremove() {
    local worktree_name="$1"
    if [ -z "$worktree_name" ]; then
        echo "Usage: wtremove <worktree-name>"
        return 1
    fi

    cd /Users/neo/Developer/experiments/solomon_codes
    git worktree remove "../worktrees/$worktree_name"
    git branch -d "$worktree_name" 2>/dev/null || git branch -D "$worktree_name"
}

# Worktree status overview
wtstatus() {
    echo "🌳 Git Worktree Overview"
    echo "========================"
    git worktree list | while read -r worktree branch commit; do
        echo "📁 $worktree"
        echo "   Branch: $branch"
        echo "   Commit: $commit"
        if [ -d "$worktree" ]; then
            cd "$worktree"
            local status=$(git status --porcelain | wc -l | tr -d ' ')
            if [ "$status" -eq 0 ]; then
                echo "   Status: ✅ Clean"
            else
                echo "   Status: ⚠️ $status changes"
            fi
            cd - > /dev/null
        fi
        echo ""
    done
}
```

## VS Code Integration

Add to your VS Code settings for multi-root workspace support:

```json
{
  "workbench.startupEditor": "newUntitledFile",
  "window.openFoldersInNewWindow": "on",
  "files.autoSave": "afterDelay",
  "multiroot.workspace.paths": [
    "/Users/neo/Developer/experiments/solomon_codes",
    "/Users/neo/Developer/experiments/worktrees/serena-dev"
  ]
}
```

## Workflow Scripts

### Initialize Development Environment

```bash
#!/bin/bash
# init-dev-env.sh

echo "🚀 Initializing Development Environment..."

# Switch to development worktree
cd /Users/neo/Developer/experiments/worktrees/serena-dev

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Run initial checks
echo "🔍 Running initial checks..."
bun run typecheck
bun run lint

echo "✅ Development environment ready!"
echo "📍 Location: $(pwd)"
echo "🌿 Branch: $(git branch --show-current)"
```

### Sync Main Changes

```bash
#!/bin/bash
# sync-main.sh

echo "🔄 Syncing changes from main..."

current_dir=$(pwd)
main_dir="/Users/neo/Developer/experiments/solomon_codes"

# Update main branch
cd "$main_dir"
git fetch origin
git pull origin main

# Switch back to current worktree
cd "$current_dir"

# Merge main changes
git merge main

echo "✅ Sync completed!"
```

## Directory Structure

```text
experiments/
├── solomon_codes/          # Main repository
│   ├── .git/              # Git metadata
│   ├── src/               # Source code
│   └── ...
└── worktrees/             # Worktree directory
    ├── serena-dev/        # Development worktree
    ├── feature-x/         # Other feature worktrees
    └── hotfix-y/          # Hotfix worktrees
```

## Best Practices

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `experiment/description` - Experimental work

### Worktree Naming

- Use kebab-case: `serena-dev`, `auth-system`
- Keep names short but descriptive
- Match branch name when possible

### Cleanup Schedule

- Weekly: Run worktree cleanup
- After feature completion: Remove worktree
- Before releases: Verify all worktrees are clean

## Troubleshooting

### Worktree Not Found

```bash
# Clean up stale references
git worktree prune

# List current worktrees
git worktree list
```

### Branch Conflicts

```bash
# Force remove problematic worktree
git worktree remove --force ../worktrees/problematic

# Delete branch if needed
git branch -D problematic-branch
```

### Dependency Issues

```bash
# Reinstall dependencies in worktree
cd ../worktrees/serena-dev
rm -rf node_modules bun.lock
bun install
```
