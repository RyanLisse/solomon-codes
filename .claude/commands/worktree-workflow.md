# Git Worktree Workflow Documentation

Complete guide for using git worktrees in the solomon_codes project.

## Overview

Git worktrees allow multiple working directories for the same repository,
enabling parallel development on different branches.

## Setup

### Initial Setup

1. Ensure you're on the main branch: `git checkout main`
2. Create worktrees directory: `mkdir -p ../worktrees`
3. Create development worktree:

```bash
git worktree add ../worktrees/serena-dev -b feature/serena-dev
```

### Current Structure

```text
experiments/
├── solomon_codes/    # Main repository (main branch)
└── worktrees/
    └── serena-dev/   # Development worktree
```

## Available Commands

### Core Commands

- **Create**: `/worktree-create [branch-name] [worktree-name]`
- **List**: `/worktree-list` - Show all worktrees with status
- **Switch**: `/worktree-switch [worktree-name]` - Navigate to worktree
- **Remove**: `/worktree-remove [worktree-name]` - Safely remove worktree
- **Cleanup**: `/worktree-cleanup` - Clean up stale worktrees

### Navigation Helpers

See `.claude/commands/worktree-helpers.md` for shell aliases and functions.

## Workflow Examples

### Feature Development

1. Create feature worktree:

```bash
git worktree add ../worktrees/auth-system -b feature/auth-system
```

1. Work in the worktree:

```bash
cd ../worktrees/auth-system
bun install
# Make changes...
git add .
git commit -m "Add authentication system"
```

1. Push and create PR:

```bash
git push -u origin feature/auth-system
# Create PR via GitHub
```

1. Clean up after merge:

```bash
cd ../../solomon_codes
git worktree remove ../worktrees/auth-system
git branch -d feature/auth-system
```

### Parallel Development

```bash
# Main development
cd /Users/neo/Developer/experiments/worktrees/serena-dev

# Hotfix in separate worktree
git worktree add ../worktrees/hotfix-critical -b hotfix/critical-bug
cd ../worktrees/hotfix-critical
# Fix critical issue...

# Experiment in another worktree
git worktree add ../worktrees/experiment -b feature/experimental
cd ../worktrees/experiment
# Try new approaches...
```

## Best Practices

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes
- `experiment/description` - Experimental work

### Worktree Management

- Keep worktrees synchronized with main branch regularly
- Use descriptive worktree names
- Clean up completed worktrees promptly
- Run dependency installation in each worktree

### Development Flow

1. Always start from updated main branch
2. Create worktree for each major feature/fix
3. Install dependencies: `bun install`
4. Make focused commits
5. Push and create PR
6. Clean up after merge

## Synchronization

### Updating Worktrees from Main

```bash
# In any worktree
git fetch origin
git merge origin/main
```

### Keeping Dependencies Updated

```bash
# In each worktree
bun install --frozen-lockfile
```

## Troubleshooting

### Common Issues

#### Worktree Directory Exists

```bash
# Remove stale directory
rm -rf ../worktrees/problematic-name
git worktree prune
```

#### Branch Already Exists

```bash
# Use existing branch
git worktree add ../worktrees/existing-work existing-branch

# Or create with different name
git worktree add ../worktrees/existing-work-v2 -b feature/existing-work-v2
```

#### Dependency Conflicts

```bash
# Clean install in worktree
cd ../worktrees/problematic
rm -rf node_modules bun.lock
bun install
```

### Recovery Commands

```bash
# List all worktrees
git worktree list

# Prune stale references
git worktree prune

# Force remove problematic worktree
git worktree remove --force ../worktrees/problematic

# Check repository health
git fsck
```

## Integration with Tools

### VS Code

- Use multi-root workspaces
- Configure workspace settings per worktree
- Use separate terminal sessions

### Claude Code

- Each worktree maintains its own `.claude/` configuration
- Memory is shared across worktrees
- Commands work within each worktree context

## Performance Tips

### Disk Space Management

- Regular cleanup of completed worktrees
- Share node_modules when possible
- Use `.gitignore` appropriately

### Development Efficiency

- Use shell aliases for quick navigation
- Set up environment-specific configurations
- Leverage IDE multi-root support

## Security Considerations

- Each worktree shares the same git history
- Sensitive files affect all worktrees
- Environment variables should be worktree-specific
- Use `.env.local` for worktree-specific secrets
