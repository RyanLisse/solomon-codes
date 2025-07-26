# Cleanup Git Worktrees

Comprehensive cleanup of git worktrees, removing stale references and organizing structure.

## Usage
```
/worktree-cleanup [--dry-run] [--force]
```

## Instructions

You are a git worktree maintenance specialist. Follow these steps:

1. **Analyze current state**:
   ```bash
   # List all worktrees
   git worktree list --porcelain
   
   # Check for broken worktrees
   git worktree prune --dry-run
   ```

2. **Identify cleanup candidates**:
   - Broken worktree references
   - Empty worktree directories
   - Merged branches that can be removed
   - Stale feature branches
   - Worktrees with no recent activity

3. **Safety checks**:
   ```bash
   # For each worktree, check:
   # - Uncommitted changes
   # - Unmerged branches
   # - Recent activity
   # - Dependencies with other worktrees
   ```

4. **Perform cleanup operations**:
   ```bash
   # Remove broken references
   git worktree prune
   
   # Clean up empty directories
   find ../worktrees -type d -empty -delete
   
   # Optional: Remove merged branches
   git branch --merged | grep -v main | grep -v master
   ```

5. **Interactive cleanup**:
   - Present each cleanup candidate
   - Allow user to approve/skip each action
   - Provide reasoning for each suggestion
   - Show impact of each cleanup

6. **Post-cleanup verification**:
   ```bash
   # Verify everything is clean
   git worktree list
   git fsck
   ```

## Cleanup Categories

### Automatic (Safe)
- Remove broken worktree references
- Clean empty directories
- Update worktree metadata

### Interactive (Requires Confirmation)
- Remove merged feature branches
- Clean up stale worktrees (no activity > 30 days)
- Remove worktrees with only committed changes

### Manual (User Decision)
- Remove unmerged branches
- Clean up experimental branches
- Remove worktrees with uncommitted changes

## Output Format
```
🧹 Git Worktree Cleanup

🔍 Analysis Results:
├── ✅ 3 healthy worktrees
├── ⚠️  1 broken reference found
├── 🗑️  2 empty directories detected
└── 📅 1 stale worktree (45 days old)

🔧 Automatic Fixes:
├── ✅ Pruned broken worktree references
├── ✅ Removed empty directories
└── ✅ Updated worktree metadata

❓ Interactive Cleanup:
├── 🌿 feature/old-experiment (merged, 30 days old)
│   └── 💡 Safe to remove? [y/N]
├── 🌿 hotfix/legacy-fix (unmerged, uncommitted changes)
│   └── ⚠️  Has uncommitted changes, skip? [Y/n]

📊 Cleanup Summary:
├── 🗑️  Removed: 2 worktrees
├── 🌿 Cleaned: 3 branches
├── 💾 Saved: ~45MB disk space
└── ⏱️  Time: 12 seconds

💡 Next Steps:
└── Use /worktree-list to verify cleanup
```

## Advanced Options

- `--dry-run`: Show what would be cleaned without making changes
- `--force`: Skip interactive confirmations (dangerous)
- `--age-threshold=30`: Only suggest branches older than N days
- `--preserve-unmerged`: Never suggest removing unmerged branches