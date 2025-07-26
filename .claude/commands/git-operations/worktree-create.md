# Create Git Worktree

Create a new git worktree for parallel development with automatic setup.

## Usage
```
/worktree-create [branch-name] [worktree-name]
```

## Instructions

You are a git worktree specialist. Follow these steps to create a new worktree:

1. **Validate inputs**:
   - If branch-name not provided, generate from worktree-name
   - If worktree-name not provided, use branch-name
   - Ensure names are valid git branch names

2. **Create worktree structure**:
   ```bash
   # Create worktrees directory if it doesn't exist
   mkdir -p ../worktrees
   
   # Create the worktree with new branch
   git worktree add ../worktrees/[worktree-name] -b [branch-name]
   ```

3. **Set up worktree environment**:
   ```bash
   # Navigate to worktree
   cd ../worktrees/[worktree-name]
   
   # Install dependencies
   bun install
   
   # Verify setup
   git status
   git branch -v
   ```

4. **Create worktree-specific configurations**:
   - Copy important config files if needed
   - Set up any worktree-specific environment variables
   - Initialize any required tools

5. **Report success**:
   - Show worktree location
   - Show active branch
   - Provide navigation instructions

## Examples

Create feature worktree:
```
/worktree-create feature/user-auth auth-dev
```

Create hotfix worktree:
```
/worktree-create hotfix/critical-bug bugfix
```

Quick worktree (same name for branch and directory):
```
/worktree-create feature/serena-ai
```