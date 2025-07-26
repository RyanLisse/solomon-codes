#!/bin/bash

# Test Script for Git Worktree Navigation Aliases
# ===============================================
# This script tests all the aliases and functions from setup-worktree-aliases.sh

echo "🧪 Testing Git Worktree Navigation Aliases..."
echo "=============================================="

# Source the main script
source .claude/commands/setup-worktree-aliases.sh

echo ""
echo "🔍 Testing Basic Aliases:"
echo "------------------------"

# Test wtlist alias
echo "📋 Testing 'wtlist' alias:"
if type wtlist >/dev/null 2>&1; then
    echo "✅ wtlist alias exists"
    wtlist
else
    echo "❌ wtlist alias not found"
fi

echo ""

# Test wtpwd alias  
echo "📍 Testing 'wtpwd' alias:"
if type wtpwd >/dev/null 2>&1; then
    echo "✅ wtpwd alias exists"
    wtpwd || echo "ℹ️  (No output - may not be in a worktree)"
else
    echo "❌ wtpwd alias not found"
fi

echo ""

echo "🔧 Testing Helper Functions:"
echo "----------------------------"

# Test wthelp function
echo "📖 Testing 'wthelp' function:"
if type wthelp >/dev/null 2>&1; then
    echo "✅ wthelp function exists"
    echo "ℹ️  Function output:"
    wthelp | head -10
    echo "   ... (output truncated)"
else
    echo "❌ wthelp function not found"
fi

echo ""

# Test wtstatus function
echo "📊 Testing 'wtstatus' function:"
if type wtstatus >/dev/null 2>&1; then
    echo "✅ wtstatus function exists"
    echo "ℹ️  Function output:"
    wtstatus
else
    echo "❌ wtstatus function not found"
fi

echo ""

# Test wtcleanup function
echo "🧹 Testing 'wtcleanup' function:"
if type wtcleanup >/dev/null 2>&1; then
    echo "✅ wtcleanup function exists"
    echo "ℹ️  (Not running - would modify repository state)"
else
    echo "❌ wtcleanup function not found"
fi

echo ""

# Test wtcreate function (without actually creating)
echo "🚀 Testing 'wtcreate' function (validation only):"
if type wtcreate >/dev/null 2>&1; then
    echo "✅ wtcreate function exists"
    echo "ℹ️  Testing error handling:"
    wtcreate  # Should show usage message
else
    echo "❌ wtcreate function not found"
fi

echo ""

# Test wtremove function (without actually removing)
echo "🗑️  Testing 'wtremove' function (validation only):"
if type wtremove >/dev/null 2>&1; then
    echo "✅ wtremove function exists"
    echo "ℹ️  Testing error handling:"
    wtremove  # Should show usage message
else
    echo "❌ wtremove function not found"
fi

echo ""

# Test wtswitch function
echo "🔄 Testing 'wtswitch' function (validation only):"
if type wtswitch >/dev/null 2>&1; then
    echo "✅ wtswitch function exists"
    echo "ℹ️  Testing list mode:"
    wtswitch  # Should show available worktrees
else
    echo "❌ wtswitch function not found"
fi

echo ""

# Test wtsync function (without actually syncing)
echo "🔄 Testing 'wtsync' function:"
if type wtsync >/dev/null 2>&1; then
    echo "✅ wtsync function exists"
    echo "ℹ️  (Not running - would modify repository state)"
else
    echo "❌ wtsync function not found"
fi

echo ""

echo "📁 Testing Navigation Aliases:"
echo "-----------------------------"

# Test wtmain alias (without actually changing directory)
echo "🏠 Testing 'wtmain' alias:"
if alias wtmain >/dev/null 2>&1; then
    echo "✅ wtmain alias exists"
    echo "ℹ️  Target: $(alias wtmain | cut -d"'" -f2)"
else
    echo "❌ wtmain alias not found"
fi

# Test wtdev alias (without actually changing directory)
echo "💻 Testing 'wtdev' alias:"
if alias wtdev >/dev/null 2>&1; then
    echo "✅ wtdev alias exists"
    echo "ℹ️  Target: $(alias wtdev | cut -d"'" -f2)"
    if [ -d "/Users/neo/Developer/experiments/worktrees/serena-dev" ]; then
        echo "✅ Target directory exists"
    else
        echo "⚠️  Target directory does not exist (worktree may not be created yet)"
    fi
else
    echo "❌ wtdev alias not found"
fi

echo ""

echo "📊 Test Summary:"
echo "==============="

# Count successful tests
total_tests=10
passed_tests=0

for cmd in wtlist wtpwd wthelp wtstatus wtcleanup wtcreate wtremove wtswitch wtsync; do
    if type "$cmd" >/dev/null 2>&1; then
        passed_tests=$((passed_tests + 1))
    fi
done

# Check aliases
for alias_name in wtmain wtdev; do
    if alias "$alias_name" >/dev/null 2>&1; then
        passed_tests=$((passed_tests + 1))
    fi
done

echo "✅ Passed: $passed_tests/$total_tests tests"

if [ "$passed_tests" -eq "$total_tests" ]; then
    echo "🎉 All tests passed! The worktree aliases are working correctly."
    echo ""
    echo "📖 Setup Instructions:"
    echo "====================="
    echo "To use these aliases permanently, add this line to your shell profile:"
    echo ""
    echo "For zsh users (.zshrc):"
    echo "  echo 'source $PWD/.claude/commands/setup-worktree-aliases.sh' >> ~/.zshrc"
    echo ""
    echo "For bash users (.bashrc):"
    echo "  echo 'source $PWD/.claude/commands/setup-worktree-aliases.sh' >> ~/.bashrc"
    echo ""
    echo "Then restart your shell or run: source ~/.zshrc (or ~/.bashrc)"
else
    echo "⚠️  Some tests failed. Please check the output above for details."
fi

echo ""
echo "🔗 Documentation:"
echo "=================="
echo "📚 Detailed docs: .claude/commands/worktree-helpers.md"
echo "📋 Workflow guide: .claude/commands/worktree-workflow.md"
echo "💡 For help anytime: wthelp"