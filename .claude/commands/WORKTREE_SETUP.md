# Git Worktree Aliases Setup Guide

## 🌳 Overview

This guide explains how to set up and use the comprehensive git worktree navigation aliases for the solomon_codes project.

## 📦 Installation

### Option 1: Automatic Setup (Recommended)

```bash
# Navigate to the project root
cd /Users/neo/Developer/experiments/solomon_codes

# Run the setup script
./claude/commands/setup-worktree-aliases.sh

# Add to your shell profile for permanent use
echo 'source /Users/neo/Developer/experiments/solomon_codes/.claude/commands/setup-worktree-aliases.sh' >> ~/.zshrc
# OR for bash users:
echo 'source /Users/neo/Developer/experiments/solomon_codes/.claude/commands/setup-worktree-aliases.sh' >> ~/.bashrc

# Reload your shell
source ~/.zshrc  # or ~/.bashrc
```

### Option 2: Manual Setup

Add these lines to your shell profile (`.zshrc` or `.bashrc`):

```bash
# Git Worktree Navigation Aliases
source /Users/neo/Developer/experiments/solomon_codes/.claude/commands/setup-worktree-aliases.sh
```

## 🧪 Testing Installation

Run the test suite to verify everything works:

```bash
./claude/commands/test-worktree-aliases.sh
```

You should see output indicating that 9/10 or 10/10 tests pass. Some aliases may not be testable in subshells but will work in your interactive shell.

## 📋 Available Commands

### Navigation Aliases

- `wtlist` - List all worktrees
- `wtpwd` - Show current worktree info
- `wtmain` - Navigate to main repository
- `wtdev` - Navigate to development worktree

### Management Functions

- `wtcreate <branch> [name]` - Create new worktree with branch
- `wtremove <name>` - Remove worktree and branch
- `wtstatus` - Show comprehensive worktree status
- `wtswitch <name|number>` - Switch between worktrees
- `wtsync` - Sync current worktree with main
- `wtcleanup` - Clean up stale references
- `wthelp` - Show help message

## 🚀 Quick Start Examples

```bash
# Create a new feature worktree
wtcreate feature/auth-system

# Create with custom name
wtcreate feature/auth-system auth-dev

# List all worktrees
wtlist

# Get detailed status
wtstatus

# Switch to a worktree
wtswitch serena
wtswitch 2  # by number

# Sync with main branch
wtsync

# Navigate quickly
wtmain  # go to main repository
wtdev   # go to development worktree

# Clean up when done
wtremove auth-system
```

## 🔧 Troubleshooting

### Aliases Not Working

If aliases like `wtlist` aren't working:

1. Make sure you've sourced the script in your current shell:

   ```bash
   source .claude/commands/setup-worktree-aliases.sh
   ```

2. Check if it's added to your shell profile:

   ```bash
   grep "setup-worktree-aliases" ~/.zshrc
   ```

3. Restart your terminal or run:

   ```bash
   source ~/.zshrc
   ```

### Functions Not Found

If you get "command not found" errors:

1. Verify the script is executable:

   ```bash
   ls -la .claude/commands/setup-worktree-aliases.sh
   ```

2. Run the test script to identify issues:

   ```bash
   ./.claude/commands/test-worktree-aliases.sh
   ```

### Permission Issues

If you get permission errors:

```bash
chmod +x .claude/commands/setup-worktree-aliases.sh
chmod +x .claude/commands/test-worktree-aliases.sh
```

## 📁 Project Structure

After setup, your project structure should look like:

```
experiments/
├── solomon_codes/              # Main repository (main branch)
│   ├── .claude/commands/
│   │   ├── setup-worktree-aliases.sh    # ✅ Main setup script
│   │   ├── test-worktree-aliases.sh     # ✅ Test suite
│   │   ├── worktree-helpers.md          # ✅ Documentation
│   │   └── worktree-workflow.md         # ✅ Workflow guide
│   └── ...
└── worktrees/                  # Worktree directory
    ├── serena-dev/            # Development worktree
    └── feature-x/             # Other feature worktrees
```

## 🔄 Workflow Integration

### Daily Development

```bash
# Start your day
wtdev                          # Go to dev worktree
wtstatus                       # Check status
wtsync                         # Sync with main

# Work on features
wtcreate feature/new-feature   # Create feature branch
# ... do development work ...

# When done
wtmain                         # Go back to main
wtremove feature/new-feature   # Clean up
```

### Parallel Development

```bash
# Multiple features simultaneously
wtcreate feature/auth          # Auth work
wtcreate feature/ui            # UI work
wtcreate hotfix/critical       # Critical fix

# Switch between them
wtswitch auth
wtswitch ui
wtswitch critical
```

## 📊 Monitoring

Use these commands to monitor your worktree ecosystem:

```bash
# Quick overview
wtlist

# Detailed status with git info
wtstatus

# Clean up stale references
wtcleanup
```

## 🎯 Best Practices

1. **Always sync before starting work**: `wtsync`
2. **Use descriptive branch names**: `feature/auth-system` not `fix`
3. **Clean up regularly**: Remove completed worktrees
4. **Monitor status**: Run `wtstatus` weekly
5. **Install dependencies**: Each worktree needs `bun install`

## 📚 Documentation

- **Setup Guide**: This file (WORKTREE_SETUP.md)
- **Helpers Reference**: `.claude/commands/worktree-helpers.md`
- **Workflow Guide**: `.claude/commands/worktree-workflow.md`
- **Help Command**: Type `wthelp` anytime

## ✅ Verification Checklist

After setup, verify these work:

- [ ] `wthelp` shows the help menu
- [ ] `wtlist` shows current worktrees
- [ ] `wtstatus` shows detailed status
- [ ] `wtmain` navigates to main repository
- [ ] `wtdev` navigates to development worktree
- [ ] `wtcreate test-branch` creates a new worktree
- [ ] `wtremove test-branch` removes the test worktree

If all items work, you're ready to use the worktree system!
