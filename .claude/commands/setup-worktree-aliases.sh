#!/bin/bash

# Git Worktree Navigation Aliases Setup Script
# ============================================
# This script sets up shell aliases and functions for efficient git worktree management.
# Source this file in your shell profile (.bashrc, .zshrc, etc.) or run it directly.

echo "🌳 Setting up Git Worktree Navigation Helpers..."

# ============================================
# NAVIGATION ALIASES
# ============================================

# List all worktrees
alias wtlist='git worktree list'

# Show current worktree info
alias wtpwd='git worktree list | grep $(pwd)'

# Quick navigation to main repository
alias wtmain='cd /Users/neo/Developer/experiments/solomon_codes'

# Quick navigation to development worktree
alias wtdev='cd /Users/neo/Developer/experiments/worktrees/serena-dev'

# ============================================
# HELPER FUNCTIONS
# ============================================

# Create a new worktree with branch
# Usage: wtcreate <branch-name> [worktree-name]
wtcreate() {
    local branch_name="$1"
    local worktree_name="${2:-$1}"
    
    if [ -z "$branch_name" ]; then
        echo "❌ Error: Branch name is required"
        echo "📖 Usage: wtcreate <branch-name> [worktree-name]"
        echo "📝 Example: wtcreate feature/auth-system"
        echo "📝 Example: wtcreate feature/auth-system auth-dev"
        return 1
    fi
    
    echo "🚀 Creating worktree '$worktree_name' with branch '$branch_name'..."
    
    # Ensure we're in the main repository
    if [ ! -d ".git" ] && [ ! -f ".git" ]; then
        echo "⚠️  Not in a git repository. Switching to main repository..."
        cd /Users/neo/Developer/experiments/solomon_codes || {
            echo "❌ Error: Could not find main repository"
            return 1
        }
    fi
    
    # Create worktrees directory if it doesn't exist
    mkdir -p "../worktrees"
    
    # Create the worktree
    if git worktree add "../worktrees/$worktree_name" -b "$branch_name"; then
        echo "✅ Worktree created successfully!"
        echo "📁 Location: ../worktrees/$worktree_name"
        echo "🌿 Branch: $branch_name"
        
        # Navigate to the new worktree
        cd "../worktrees/$worktree_name" || {
            echo "❌ Error: Could not navigate to worktree"
            return 1
        }
        
        echo "📦 Installing dependencies..."
        if command -v bun >/dev/null 2>&1; then
            bun install
        elif command -v npm >/dev/null 2>&1; then
            npm install
        else
            echo "⚠️  Warning: No package manager found (bun/npm)"
        fi
        
        echo "🎉 Ready to work in $worktree_name!"
        echo "📍 Current location: $(pwd)"
    else
        echo "❌ Error: Failed to create worktree"
        return 1
    fi
}

# Remove a worktree and its branch
# Usage: wtremove <worktree-name>
wtremove() {
    local worktree_name="$1"
    
    if [ -z "$worktree_name" ]; then
        echo "❌ Error: Worktree name is required"
        echo "📖 Usage: wtremove <worktree-name>"
        echo "📝 Example: wtremove auth-system"
        return 1
    fi
    
    echo "🗑️  Removing worktree '$worktree_name'..."
    
    # Save current directory
    local current_dir=$(pwd)
    
    # Switch to main repository
    cd /Users/neo/Developer/experiments/solomon_codes || {
        echo "❌ Error: Could not find main repository"
        return 1
    }
    
    # Check if worktree exists
    if ! git worktree list | grep -q "../worktrees/$worktree_name"; then
        echo "⚠️  Warning: Worktree '$worktree_name' not found in git worktree list"
        echo "📋 Available worktrees:"
        git worktree list
        cd "$current_dir"
        return 1
    fi
    
    # Remove worktree
    if git worktree remove "../worktrees/$worktree_name"; then
        echo "✅ Worktree removed successfully!"
        
        # Try to delete the branch
        echo "🌿 Attempting to delete branch '$worktree_name'..."
        if git branch -d "$worktree_name" 2>/dev/null; then
            echo "✅ Branch '$worktree_name' deleted successfully!"
        elif git branch -D "$worktree_name" 2>/dev/null; then
            echo "⚠️  Branch '$worktree_name' force deleted (had unmerged changes)"
        else
            echo "ℹ️  Branch '$worktree_name' may not exist or already deleted"
        fi
    else
        echo "❌ Error: Failed to remove worktree"
        cd "$current_dir"
        return 1
    fi
    
    # Return to original directory if it still exists
    if [ -d "$current_dir" ]; then
        cd "$current_dir"
    else
        echo "📍 Original directory no longer exists, staying in main repository"
    fi
    
    echo "🎉 Cleanup completed!"
}

# Show comprehensive worktree status
# Usage: wtstatus
wtstatus() {
    echo "🌳 Git Worktree Overview"
    echo "========================"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "❌ Error: Not in a git repository"
        return 1
    fi
    
    local worktree_count=0
    local clean_count=0
    local dirty_count=0
    
    # Process each worktree
    git worktree list | while read -r worktree branch commit; do
        worktree_count=$((worktree_count + 1))
        
        echo "📁 $worktree"
        echo "   🌿 Branch: $branch"
        echo "   📝 Commit: $commit"
        
        if [ -d "$worktree" ]; then
            # Save current directory and switch to worktree
            local original_dir=$(pwd)
            cd "$worktree" 2>/dev/null || {
                echo "   ❌ Status: Cannot access directory"
                echo ""
                continue
            }
            
            # Check git status
            local status_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            
            if [ "$status_count" -eq 0 ]; then
                echo "   ✅ Status: Clean"
                clean_count=$((clean_count + 1))
            else
                echo "   ⚠️  Status: $status_count changes"
                dirty_count=$((dirty_count + 1))
                
                # Show brief status
                echo "   📋 Changes:"
                git status --porcelain 2>/dev/null | head -5 | while read -r line; do
                    echo "      $line"
                done
                
                # Show if there are more changes
                if [ "$status_count" -gt 5 ]; then
                    echo "      ... and $((status_count - 5)) more"
                fi
            fi
            
            # Check if branch is ahead/behind
            local upstream=$(git rev-parse --abbrev-ref @{upstream} 2>/dev/null)
            if [ -n "$upstream" ]; then
                local ahead=$(git rev-list --count HEAD.."$upstream" 2>/dev/null || echo "0")
                local behind=$(git rev-list --count "$upstream"..HEAD 2>/dev/null || echo "0")
                
                if [ "$ahead" -gt 0 ] || [ "$behind" -gt 0 ]; then
                    echo "   🔄 Sync: $behind ahead, $ahead behind $upstream"
                else
                    echo "   ✅ Sync: Up to date with $upstream"
                fi
            else
                echo "   ⚠️  Sync: No upstream branch set"
            fi
            
            # Return to original directory
            cd "$original_dir"
        else
            echo "   ❌ Status: Directory not found"
        fi
        
        echo ""
    done
    
    # Summary would be nice, but subshell variables don't persist
    echo "📊 Summary available by running 'git worktree list | wc -l'"
}

# Quick worktree switcher with fuzzy finding
# Usage: wtswitch [partial-name]
wtswitch() {
    local target="$1"
    
    if [ -z "$target" ]; then
        echo "📋 Available worktrees:"
        git worktree list | nl -w2 -s". "
        echo ""
        echo "📖 Usage: wtswitch <worktree-name-or-number>"
        echo "📝 Example: wtswitch serena"
        echo "📝 Example: wtswitch 2"
        return 0
    fi
    
    # If target is a number, select by line number
    if [[ "$target" =~ ^[0-9]+$ ]]; then
        local worktree_path=$(git worktree list | sed -n "${target}p" | awk '{print $1}')
        if [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
            echo "🚀 Switching to worktree #$target: $worktree_path"
            cd "$worktree_path"
            echo "📍 Current location: $(pwd)"
            echo "🌿 Current branch: $(git branch --show-current)"
            return 0
        else
            echo "❌ Error: Worktree #$target not found"
            return 1
        fi
    fi
    
    # Otherwise, search for matching worktree name
    local matches=$(git worktree list | grep "$target")
    local match_count=$(echo "$matches" | grep -c .)
    
    if [ "$match_count" -eq 0 ]; then
        echo "❌ Error: No worktree found matching '$target'"
        echo "📋 Available worktrees:"
        git worktree list
        return 1
    elif [ "$match_count" -eq 1 ]; then
        local worktree_path=$(echo "$matches" | awk '{print $1}')
        echo "🚀 Switching to: $worktree_path"
        cd "$worktree_path"
        echo "📍 Current location: $(pwd)"
        echo "🌿 Current branch: $(git branch --show-current)"
    else
        echo "⚠️  Multiple matches found:"
        echo "$matches" | nl -w2 -s". "
        echo ""
        echo "📖 Please be more specific or use the number"
    fi
}

# Sync worktree with main branch
# Usage: wtsync
wtsync() {
    echo "🔄 Syncing current worktree with main branch..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "❌ Error: Not in a git repository"
        return 1
    fi
    
    local current_branch=$(git branch --show-current)
    local current_dir=$(pwd)
    local main_dir="/Users/neo/Developer/experiments/solomon_codes"
    
    echo "📍 Current worktree: $current_dir"
    echo "🌿 Current branch: $current_branch"
    
    # Update main branch
    echo "📡 Fetching latest changes..."
    cd "$main_dir" || {
        echo "❌ Error: Could not access main repository"
        return 1
    }
    
    git fetch origin || {
        echo "❌ Error: Failed to fetch from origin"
        cd "$current_dir"
        return 1
    }
    
    git checkout main && git pull origin main || {
        echo "❌ Error: Failed to update main branch"
        cd "$current_dir"
        return 1
    }
    
    # Return to worktree and merge
    cd "$current_dir"
    echo "🔄 Merging main into $current_branch..."
    
    if git merge main; then
        echo "✅ Sync completed successfully!"
        echo "🌿 Branch $current_branch is now up to date with main"
    else
        echo "⚠️  Merge conflicts detected!"
        echo "📖 Please resolve conflicts and commit the merge"
        echo "💡 Use 'git status' to see conflicted files"
        return 1
    fi
}

# ============================================
# UTILITY FUNCTIONS
# ============================================

# Clean up stale worktree references
# Usage: wtcleanup
wtcleanup() {
    echo "🧹 Cleaning up stale worktree references..."
    
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "❌ Error: Not in a git repository"
        return 1
    fi
    
    # Switch to main repository for cleanup
    local current_dir=$(pwd)
    local main_dir="/Users/neo/Developer/experiments/solomon_codes"
    
    cd "$main_dir" || {
        echo "❌ Error: Could not access main repository"
        return 1
    }
    
    echo "🔍 Pruning stale worktree references..."
    git worktree prune
    
    echo "📋 Current worktrees after cleanup:"
    git worktree list
    
    # Return to original directory
    cd "$current_dir"
    
    echo "✅ Cleanup completed!"
}

# Show worktree help
# Usage: wthelp
wthelp() {
    cat << 'EOF'
🌳 Git Worktree Navigation Helpers
==================================

📋 Available Commands:
├── wtlist          - List all worktrees
├── wtpwd           - Show current worktree info
├── wtmain          - Navigate to main repository
├── wtdev           - Navigate to development worktree
├── wtcreate        - Create new worktree with branch
├── wtremove        - Remove worktree and branch
├── wtstatus        - Show comprehensive worktree status
├── wtswitch        - Switch between worktrees
├── wtsync          - Sync current worktree with main
├── wtcleanup       - Clean up stale references
└── wthelp          - Show this help message

📖 Usage Examples:
├── wtcreate feature/auth-system
├── wtcreate feature/auth auth-dev
├── wtremove auth-system
├── wtswitch serena
├── wtswitch 2
└── wtsync

🔗 Quick Navigation:
├── wtmain          - /Users/neo/Developer/experiments/solomon_codes
└── wtdev           - /Users/neo/Developer/experiments/worktrees/serena-dev

💡 Pro Tips:
├── Use tab completion for worktree names
├── Run wtstatus regularly to monitor worktrees
├── Always sync before starting new work
└── Clean up completed worktrees promptly

📚 Documentation:
├── .claude/commands/worktree-helpers.md
└── .claude/commands/worktree-workflow.md
EOF
}

# ============================================
# INITIALIZATION
# ============================================

# Check if running in bash or zsh
if [ -n "$BASH_VERSION" ]; then
    SHELL_TYPE="bash"
    PROFILE_FILE="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_TYPE="zsh"
    PROFILE_FILE="$HOME/.zshrc"
else
    SHELL_TYPE="unknown"
    PROFILE_FILE="$HOME/.profile"
fi

echo "✅ Git Worktree Navigation Helpers loaded successfully!"
echo "🐚 Shell: $SHELL_TYPE"
echo "📁 Main repository: /Users/neo/Developer/experiments/solomon_codes"
echo "📁 Worktrees directory: /Users/neo/Developer/experiments/worktrees"
echo ""
echo "📖 Type 'wthelp' for available commands"
echo "💡 To make these aliases permanent, add this to your $PROFILE_FILE:"
if command -v realpath >/dev/null 2>&1; then
    echo "   source $(realpath "$0")"
else
    # Fallback for systems without realpath (like macOS)
    echo "   source $PWD/.claude/commands/setup-worktree-aliases.sh"
fi
echo ""

# Show current worktree status if in a git repository
if git rev-parse --git-dir >/dev/null 2>&1; then
    echo "📍 Current location: $(pwd)"
    if git worktree list | grep -q "$(pwd)"; then
        echo "🌿 Current branch: $(git branch --show-current)"
        echo "📋 Worktree status: $(git status --porcelain | wc -l | tr -d ' ') changes"
    fi
    echo ""
fi