# Git History Cleanup Plan - PII Removal

**Date**: 2025-10-31
**Purpose**: Remove PII from git history before making repository public
**Risk Level**: 🔴 **HIGH** - This is a DESTRUCTIVE operation

---

## Executive Summary

**Commits to Rewrite**: 114 (entire repository history)
**PII Found**:
- Author names: "Noah Gift", "Noah"
- Author emails: "noah.gift@gmail.com", "noah@example.com"

**Replacement Values**:
- Author name: "Project Contributor"
- Author email: "contributor@ubuntu-config-scripts.dev"

**Risk**: This operation will rewrite ALL commit hashes. Anyone with existing clones will need to re-clone.

---

## ⚠️ CRITICAL WARNINGS

### 🔴 THIS OPERATION IS IRREVERSIBLE

Once you rewrite history and force-push, **you CANNOT undo it**. Make sure you:

1. ✅ Have a complete backup of the repository
2. ✅ Understand all consequences
3. ✅ Have tested the procedure on a test branch
4. ✅ Are prepared to notify all collaborators
5. ✅ Are ready to handle breaking changes

### What Will Break

- ❌ **All commit SHAs will change** - Every commit gets a new hash
- ❌ **Existing clones become invalid** - Others must delete and re-clone
- ❌ **GitHub PRs/Issues references may break** - Links to specific commits won't work
- ❌ **Git tags will be lost** - Unless specifically preserved
- ❌ **Signed commits lose signatures** - GPG signatures invalidated

### What Will Remain

- ✅ Commit messages (except PII in them)
- ✅ File contents and changes
- ✅ Commit timestamps
- ✅ Branch structure
- ✅ Commit graph/parentage

---

## Analysis of PII in Git History

### Author Information

| Field | Current Value | New Value | Occurrences |
|-------|--------------|-----------|-------------|
| Author Name | "Noah Gift" | "Project Contributor" | ~100+ commits |
| Author Name | "Noah" | "Project Contributor" | ~10+ commits |
| Author Email | noah.gift@gmail.com | contributor@ubuntu-config-scripts.dev | ~100+ commits |
| Author Email | noah@example.com | contributor@ubuntu-config-scripts.dev | ~10+ commits |

### Commit Messages with PII

Need to check if commit messages contain PII:

```bash
# Scan commit messages for PII
git log --all --format='%s' | grep -i "noah\|noahehall" | wc -l
```

**Result**: TBD (needs verification)

---

## Recommended Approach: git-filter-repo

**Tool**: `git-filter-repo` (recommended by Git project, faster than filter-branch)

**Why not filter-branch?**
- filter-branch is slow and deprecated
- filter-repo is 10-100x faster
- filter-repo has better safety checks

### Installation

```bash
# Ubuntu/Debian
sudo apt install git-filter-repo

# Or via pip
pip3 install git-filter-repo
```

---

## Step-by-Step Procedure

### Phase 1: Preparation (MANDATORY)

#### 1. Create Complete Backup

```bash
# Create backup in different location
cd /tmp
git clone --mirror /home/noah/src/ubuntu-config-scripts ubuntu-config-scripts-BACKUP.git
cd ubuntu-config-scripts-BACKUP.git
tar czf ~/ubuntu-config-scripts-BACKUP-$(date +%Y%m%d-%H%M%S).tar.gz .

# Verify backup
tar tzf ~/ubuntu-config-scripts-BACKUP-*.tar.gz | head
```

**Result**: You should have a .tar.gz file in your home directory

#### 2. Create Test Branch

```bash
cd /home/noah/src/ubuntu-config-scripts

# Create test branch from current state
git checkout -b test-history-rewrite
git push origin test-history-rewrite  # Optional: push to GitHub for safety
```

#### 3. Install git-filter-repo

```bash
# Check if installed
git-filter-repo --version

# If not installed
sudo apt update
sudo apt install -y git-filter-repo
```

---

### Phase 2: Test Rewrite (on test-history-rewrite branch)

#### 4. Prepare Mailmap File

Create a mailmap file to handle author rewrites:

```bash
cat > /tmp/mailmap.txt << 'EOF'
Project Contributor <contributor@ubuntu-config-scripts.dev> Noah Gift <noah.gift@gmail.com>
Project Contributor <contributor@ubuntu-config-scripts.dev> Noah <noah@example.com>
EOF
```

#### 5. Test git-filter-repo

```bash
cd /home/noah/src/ubuntu-config-scripts

# IMPORTANT: git-filter-repo requires a fresh clone
# Create fresh clone for testing
cd /tmp
git clone /home/noah/src/ubuntu-config-scripts ubuntu-config-scripts-TEST
cd ubuntu-config-scripts-TEST

# Apply mailmap rewrite
git-filter-repo --mailmap /tmp/mailmap.txt --force

# Verify results
git log --all --format='%H %an %ae %s' | head -20
```

**Expected Output**: All commits should show "Project Contributor <contributor@ubuntu-config-scripts.dev>"

#### 6. Verify Test Results

```bash
cd /tmp/ubuntu-config-scripts-TEST

# Check author names
git log --all --format='%an' | sort -u
# Expected: Only "Project Contributor"

# Check author emails
git log --all --format='%ae' | sort -u
# Expected: Only "contributor@ubuntu-config-scripts.dev"

# Check commit count
git rev-list --all --count
# Expected: 114 (same as original)

# Check recent commits
git log --oneline -10
# Expected: Commit messages intact, only authors changed
```

#### 7. Test Build & Tests

```bash
cd /tmp/ubuntu-config-scripts-TEST

# Verify repository still works
make check-deps
make validate

# Check Ruchy files
cd ruchy
make test
```

**If ANY tests fail, DO NOT proceed to Phase 3**

---

### Phase 3: Production Rewrite (ONLY IF PHASE 2 SUCCEEDS)

#### 8. Fresh Clone for Production

```bash
# Create production rewrite clone
cd /tmp
git clone /home/noah/src/ubuntu-config-scripts ubuntu-config-scripts-PRODUCTION
cd ubuntu-config-scripts-PRODUCTION

# Verify it's clean
git status
git log --oneline -5
```

#### 9. Apply Production Rewrite

```bash
cd /tmp/ubuntu-config-scripts-PRODUCTION

# Apply mailmap (removes origin automatically)
git-filter-repo --mailmap /tmp/mailmap.txt --force

# Verify results
git log --all --format='%an %ae' | sort -u
# Should show ONLY: Project Contributor contributor@ubuntu-config-scripts.dev
```

#### 10. Re-add Remote

```bash
cd /tmp/ubuntu-config-scripts-PRODUCTION

# Add remote back
git remote add origin git@github.com:paiml/ubuntu-config-scripts.git

# Verify remote
git remote -v
```

---

### Phase 4: Force Push (POINT OF NO RETURN)

#### 11. Final Verification Before Push

```bash
cd /tmp/ubuntu-config-scripts-PRODUCTION

# Final checks
echo "Commit count: $(git rev-list --all --count)"  # Should be 114
echo "Authors: $(git log --all --format='%an' | sort -u)"  # Should be "Project Contributor"
echo "Emails: $(git log --all --format='%ae' | sort -u)"  # Should be "contributor@ubuntu-config-scripts.dev"
echo ""
echo "Last 10 commits:"
git log --oneline -10
```

**STOP HERE**: Review output carefully. Once you force-push, there's no going back.

#### 12. Force Push (DESTRUCTIVE)

```bash
cd /tmp/ubuntu-config-scripts-PRODUCTION

# ⚠️ POINT OF NO RETURN ⚠️
# This will overwrite all history on GitHub

git push origin --force --all
git push origin --force --tags  # If you have tags
```

---

### Phase 5: Update Working Directory

#### 13. Update Original Repository

```bash
cd /home/noah/src/ubuntu-config-scripts

# Add rewritten repo as new remote
git remote add rewritten /tmp/ubuntu-config-scripts-PRODUCTION

# Fetch rewritten history
git fetch rewritten

# Hard reset to rewritten main
git checkout main
git reset --hard rewritten/main

# Clean up
git remote remove rewritten

# Verify
git log --oneline -10
git log --all --format='%an %ae' | sort -u
```

---

## Alternative: Less Destructive Approach

If you don't want to rewrite history, you can:

### Option A: Start Fresh

1. Create new repository with clean history
2. Copy current state (not git history)
3. Make single initial commit with generic author
4. Archive old repository

```bash
# Create new clean repo
mkdir /tmp/ubuntu-config-scripts-CLEAN
cd /tmp/ubuntu-config-scripts-CLEAN
git init
git config user.name "Project Contributor"
git config user.email "contributor@ubuntu-config-scripts.dev"

# Copy all files (except .git)
rsync -av --exclude='.git' /home/noah/src/ubuntu-config-scripts/ .

# Create clean commit
git add .
git commit -m "Initial commit: Ubuntu Config Scripts v1.1.0

Complete system configuration and management tools for Ubuntu.

Features:
- TypeScript implementation (production-ready)
- Ruchy implementation (97% complete)
- Audio/video configuration
- System diagnostics
- Semantic search with MCP

Documentation: See README.md for full details"

# Push to GitHub
git remote add origin git@github.com:paiml/ubuntu-config-scripts.git
git push -u origin main --force
```

**Pros**:
- Clean history from day one
- No complex rewrite operations
- Simple and safe

**Cons**:
- Lose all commit history (114 commits)
- Lose development timeline
- Lose detailed change tracking

---

## Recommendation

### For Public Release: Option A (Start Fresh)

**Recommended Approach**: Start with a clean repository

**Reasoning**:
1. **Simpler**: No complex git rewrite operations
2. **Safer**: No risk of corrupting history
3. **Cleaner**: Professional appearance for new users
4. **Practical**: For public release, users don't need 114 commits of history

**Process**:
```bash
# 1. Create clean repo (see Option A above)
# 2. Tag old repo for archival
cd /home/noah/src/ubuntu-config-scripts
git tag archive/pre-public-release
git push origin archive/pre-public-release

# 3. Replace with clean history
# Follow Option A steps above

# 4. Update documentation
# README.md, CLAUDE.md, etc. already updated
```

### For Preserving History: git-filter-repo

If you absolutely need to preserve the 114 commits of development history:

**Use git-filter-repo** (Phase 1-5 above)

**But be aware**:
- High complexity
- High risk of errors
- All collaborators must re-clone
- Not critical for public release

---

## Testing Checklist

Before declaring success, verify:

- [ ] All commits show generic author
- [ ] All commits show generic email
- [ ] Commit count matches original (114)
- [ ] All files present and correct
- [ ] `make validate` passes
- [ ] Ruchy integration tests pass (`cd ruchy && make test`)
- [ ] No PII in `git log --all`
- [ ] No PII in `git show` (random commits)
- [ ] README.md accurately reflects status
- [ ] GitHub Actions still work (may need re-trigger)

---

## Rollback Plan (if needed)

### If Force-Push Fails or Has Issues

```bash
# Restore from backup
cd /tmp
tar xzf ~/ubuntu-config-scripts-BACKUP-*.tar.gz -C ubuntu-config-scripts-RESTORE.git

# Push backup back to GitHub
cd ubuntu-config-scripts-RESTORE.git
git push origin --mirror --force

# Restore working directory
cd /home/noah/src/ubuntu-config-scripts
git fetch origin --all
git reset --hard origin/main
```

---

## Post-Cleanup Tasks

After successful history rewrite:

1. **Notify Collaborators**:
   ```markdown
   ⚠️ Repository history has been rewritten to remove PII.

   Action required:
   1. Delete your local clone
   2. Re-clone from GitHub
   3. All commit SHAs have changed
   ```

2. **Update GitHub Settings**:
   - Change repository visibility to Public
   - Add repository description
   - Add topics/tags
   - Enable issues/discussions

3. **Verify No PII Remains**:
   ```bash
   git log --all --format='%an %ae %s' | grep -i "noah\|noahehall"
   # Expected: No output
   ```

4. **Tag Release**:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

---

## Estimated Time

- **Preparation**: 15 minutes
- **Testing (Phase 2)**: 30 minutes
- **Production Rewrite (Phase 3-4)**: 15 minutes
- **Verification (Phase 5)**: 15 minutes

**Total**: ~1.5 hours for cautious, tested approach

---

## Final Decision Required

**Choose One**:

### ⭐ Option A: Start Fresh (RECOMMENDED)
- Clean, simple, safe
- Single commit with current state
- No complex rewrite operations
- Best for public release

### Option B: Rewrite History (COMPLEX)
- Preserves 114 commits of development
- Complex, risky operation
- Requires careful testing
- May not add value for public users

**Recommendation**: Use **Option A** unless you have specific reasons to preserve detailed development history.

---

**Next Step**: Wait for user confirmation on which approach to use before proceeding.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
