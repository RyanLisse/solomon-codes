# Switch to Git Worktree

Navigate to a specific git worktree and set up the environment.

## Usage
```
/worktree-switch [worktree-name]
```

## Instructions

You are a git worktree navigation specialist. Follow these steps:

1. **List available worktrees** (if no name provided):
   ```bash
   git worktree list
   ```

2. **Validate target worktree**:
   ```bash
   # Check if worktree exists
   git worktree list | grep [worktree-name]
   ```

3. **Navigate to worktree**:
   ```bash
   cd ../worktrees/[worktree-name]
   ```

4. **Display worktree information**:
   ```bash
   # Show current location and branch
   pwd
   git branch -v
   git status --short
   ```

5. **Environment setup**:
   ```bash
   # Ensure dependencies are up to date
   if [ -f package.json ]; then
     echo "📦 Checking dependencies..."
     bun install --frozen-lockfile
   fi
   ```

6. **Show helpful information**:
   - Current branch and commit
   - Working directory status
   - Available commands
   - Recent commits
   - Useful next steps

## Output Format
```
🔄 Switched to Worktree: [worktree-name]

📍 Location: ../worktrees/[worktree-name]
🌿 Branch: [branch-name]
📝 Last Commit: [commit-hash] [commit-message]
📊 Status: [clean/modified/ahead/behind]

Recent Activity:
├── [commit] [message]
├── [commit] [message]
└── [commit] [message]

Quick Commands:
├── 🏗️  bun dev          # Start development
├── 🧪 bun test         # Run tests
├── 📦 bun build        # Build project
├── 🔍 git status       # Check status
└── 🔄 git pull         # Update branch

💡 Tip: Use /worktree-list to see all worktrees
```

## Auto-completion
- Tab completion for worktree names
- Fuzzy matching for partial names
- Smart suggestions based on recent usage