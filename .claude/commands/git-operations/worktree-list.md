# List Git Worktrees

Display all git worktrees with detailed information and navigation helpers.

## Usage
```
/worktree-list
```

## Instructions

You are a git worktree information specialist. Follow these steps:

1. **List all worktrees**:
   ```bash
   git worktree list
   ```

2. **Show detailed information for each worktree**:
   ```bash
   # For each worktree, show:
   git worktree list --porcelain
   ```

3. **Display branch information**:
   ```bash
   # Show branch status for each worktree
   git branch -a -v
   ```

4. **Check worktree health**:
   ```bash
   # Check for any issues
   git worktree prune --dry-run
   ```

5. **Format output nicely**:
   - Show path to each worktree
   - Show active branch
   - Show last commit
   - Show working directory status
   - Provide quick navigation commands

6. **Navigation helpers**:
   - Provide cd commands for each worktree
   - Show relative paths
   - Suggest useful commands for each

## Output Format
```
📁 Git Worktrees Overview

Main Repository:
├── 📍 /Users/user/project [main] ✓ clean
└── 🔗 Origin: https://github.com/user/project.git

Active Worktrees:
├── 📂 ../worktrees/feature-a [feature/new-feature] ✓ clean
│   └── 💡 cd ../worktrees/feature-a
├── 📂 ../worktrees/hotfix [hotfix/urgent] ⚠️  2 uncommitted
│   └── 💡 cd ../worktrees/hotfix
└── 📂 ../worktrees/experimental [feature/experiment] ✓ clean
    └── 💡 cd ../worktrees/experimental

Quick Commands:
- Create new: /worktree-create [branch] [name]
- Remove: /worktree-remove [name]
- Switch: /worktree-switch [name]
- Cleanup: /worktree-cleanup
```