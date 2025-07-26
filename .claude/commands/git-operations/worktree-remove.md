# Remove Git Worktree

Safely remove a git worktree with cleanup and validation.

## Usage
```
/worktree-remove [worktree-name]
```

## Instructions

You are a git worktree cleanup specialist. Follow these steps carefully:

1. **Validate worktree exists**:
   ```bash
   git worktree list | grep [worktree-name]
   ```

2. **Check worktree status**:
   ```bash
   # Navigate to worktree and check status
   cd ../worktrees/[worktree-name]
   git status --porcelain
   ```

3. **Safety checks**:
   - Warn if there are uncommitted changes
   - Ask for confirmation if changes exist
   - Check if branch has unpushed commits
   - Verify if branch is merged

4. **Safe removal process**:
   ```bash
   # Go back to main repo
   cd [main-repo-path]
   
   # Remove the worktree
   git worktree remove ../worktrees/[worktree-name]
   
   # Clean up the directory if it still exists
   rm -rf ../worktrees/[worktree-name]
   ```

5. **Branch cleanup** (optional):
   ```bash
   # Ask if user wants to delete the branch too
   git branch -d [branch-name]  # Safe delete
   # OR
   git branch -D [branch-name]  # Force delete
   ```

6. **Post-cleanup verification**:
   ```bash
   # Verify removal
   git worktree list
   git worktree prune
   ```

## Safety Features

- **Uncommitted changes**: Warn and require confirmation
- **Unmerged branch**: Warn about potential data loss
- **Active worktree**: Check if currently in use
- **Backup option**: Offer to create backup before removal

## Examples

Remove completed feature:
```
/worktree-remove feature-auth
```

Force remove (with confirmation):
```
/worktree-remove experimental-feature --force
```