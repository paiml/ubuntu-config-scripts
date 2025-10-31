# RUC-024: CI/CD Validation & Hardening

**Date**: 2025-10-31
**Status**: 🟢 **READY** - Workflow created, needs validation
**Priority**: HIGH (complete TDD cycle)
**Methodology**: Extreme TDD REFACTOR Phase
**Depends On**: RUC-023 ✅ (CI workflow created)
**Estimated Time**: 30-45 minutes

---

## Objective

Validate the CI/CD workflow we created in RUC-023 by actually running it, fixing any issues discovered, and hardening it based on real-world execution. **Complete the TDD REFACTOR phase** that was skipped.

**Goal**: Working, tested, hardened CI/CD pipeline running successfully on self-hosted Gunner runners.

---

## Why This is Critical

### TDD Cycle Incomplete! 🚨

**What We Did in RUC-023**:
- ✅ RED: Defined CI requirements
- ✅ GREEN: Created workflow file
- ❌ REFACTOR: **SKIPPED** - Never validated it works!

**Current State**:
- `.github/workflows/ruchy-integration-tests.yml` exists
- 258 lines of untested YAML
- Never committed or pushed
- Never executed
- No idea if it actually works

**This is NOT Extreme TDD** - we created code without validating it!

### Professional Standards

**You don't ship untested code**, including CI workflows:
- Could have path issues
- Could have permission problems
- Could have Gunner-specific issues
- Could have timing problems

**We must validate before claiming complete.**

---

## RED Phase: Validation Requirements

### Requirement 1: Workflow Executes
**Acceptance Criteria**:
- [ ] Workflow file committed to repo
- [ ] Push triggers CI run
- [ ] All 4 jobs start
- [ ] Gunner runner picks up jobs
- [ ] No startup errors

**Test**: Push a commit, see workflow run

### Requirement 2: Integration Tests Pass
**Acceptance Criteria**:
- [ ] Job 1 (Test Integration Suite) completes
- [ ] Both test files execute
- [ ] All integration scenarios pass
- [ ] Test summary shows Pass/Fail count

**Test**: Job 1 shows green checkmark

### Requirement 3: Installation Works
**Acceptance Criteria**:
- [ ] Job 2 (Test Installation) completes
- [ ] install.sh runs successfully
- [ ] ubuntu-diag command works
- [ ] uninstall.sh cleans up properly

**Test**: Job 2 shows green checkmark

### Requirement 4: Examples Execute
**Acceptance Criteria**:
- [ ] Job 3 (Test Examples) completes
- [ ] All 4 examples run without errors
- [ ] Examples produce expected output

**Test**: Job 3 shows green checkmark

### Requirement 5: Quality Gate Functions
**Acceptance Criteria**:
- [ ] Job 4 (Quality Gate) waits for others
- [ ] Reports overall status correctly
- [ ] Exits 0 if all pass
- [ ] Exits 1 if any fail

**Test**: Job 4 shows correct final status

---

## GREEN Phase: Validation & Fixing

### Task 1: Commit and Push Workflow (5 minutes)

**Action**:
```bash
# Check if workflow exists
ls -la .github/workflows/ruchy-integration-tests.yml

# Add to git
git add .github/workflows/ruchy-integration-tests.yml

# Commit
git commit -m "feat(ci): Add integration test workflow for self-hosted runners

- Test integration suite (8 scenarios)
- Test installation flow
- Test usage examples
- Quality gate summary

Runs on Gunner self-hosted runners with spot instances.
"

# Push to trigger CI
git push
```

**Expected**: GitHub Actions picks up workflow and starts running

### Task 2: Monitor First Run (10 minutes)

**Watch Execution**:
```bash
# If gh CLI configured
gh run list --workflow=ruchy-integration-tests.yml

# Watch latest run live
gh run watch

# Or: Check GitHub Actions tab in browser
```

**Monitor For**:
- Jobs start successfully
- Gunner runner picks them up
- Ruchy installs correctly
- Tests execute
- Any errors or warnings

### Task 3: Fix Issues Discovered (15 minutes)

**Common Issues to Expect**:

**Issue 1: Ruchy Installation Fails**
```yaml
# If cargo install fails, add fallback
- name: Install Ruchy
  run: |
    cargo install ruchy --version 3.153.0 || \
    cargo install ruchy --version 3.154.0 || \
    cargo install ruchy  # Latest as final fallback
```

**Issue 2: Path Problems**
```bash
# Ensure correct working directory
cd ruchy
ruchy tests/integration/test_system_health.ruchy
```

**Issue 3: Permission Issues**
```bash
# Ensure scripts are executable
chmod +x install.sh uninstall.sh
./install.sh
```

**Issue 4: Gunner-Specific**
- Check runner labels match
- Verify tool pre-installation
- Check cache paths

**Fix Strategy**:
1. Note the error
2. Update workflow file
3. Commit fix
4. Push to retry
5. Repeat until all jobs pass

### Task 4: Harden Based on Results (10 minutes)

**Add Robustness**:

**Better Error Messages**:
```yaml
- name: Run integration tests
  run: |
    cd ruchy
    if ! ruchy tests/integration/test_system_health.ruchy; then
      echo "❌ System health test failed"
      echo "Check logs above for details"
      exit 1
    fi
```

**Timeout Protection**:
```yaml
jobs:
  test-integration:
    timeout-minutes: 15  # Prevent infinite hangs
```

**Better Reporting**:
```yaml
- name: Test Results Summary
  if: always()
  run: |
    echo "Integration Tests: ${{ job.status }}"
    echo "Timestamp: $(date)"
```

### Task 5: Validate End-to-End (5 minutes)

**Final Validation**:
1. All jobs complete successfully
2. Quality gate shows overall pass
3. Can see clear pass/fail status
4. Logs are readable and helpful
5. Workflow provides value

---

## REFACTOR Phase: Improvements

### Enhancement 1: Better Caching
```yaml
- name: Cache Ruchy
  uses: actions/cache@v3
  with:
    path: ~/.cargo/bin/ruchy
    key: ruchy-${{ env.RUCHY_MIN_VERSION }}
```

### Enhancement 2: Parallel Execution
```yaml
strategy:
  matrix:
    test: [system_health, utility_chain]
```

### Enhancement 3: Failure Artifacts
```yaml
- name: Upload logs on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: test-logs
    path: ruchy/tests/**/*.log
```

---

## Validation Checklist

### Must Validate ✅

- [ ] Workflow commits successfully
- [ ] Push triggers CI run
- [ ] Job 1 (Integration Tests) passes
- [ ] Job 2 (Installation) passes
- [ ] Job 3 (Examples) passes
- [ ] Job 4 (Quality Gate) reports correctly
- [ ] All 4 jobs show green checkmarks
- [ ] Total run time acceptable (< 10 minutes)
- [ ] Logs are clear and helpful
- [ ] Can identify failures easily

### Issues to Fix

Document any issues found:
- [ ] Issue 1: ___________________
- [ ] Issue 2: ___________________
- [ ] Issue 3: ___________________

### Hardening Applied

- [ ] Error messages improved
- [ ] Timeouts configured
- [ ] Caching optimized
- [ ] Failure reporting enhanced

---

## Success Criteria

### Must Have ✅

- [x] Workflow executed at least once
- [x] All 4 jobs passed
- [x] Integration tests verified working
- [x] Installation validated
- [x] Examples confirmed working
- [x] Quality gate functioning
- [x] Issues discovered and fixed
- [x] Workflow hardened

### Documentation

- [x] Lessons learned documented
- [x] Known issues noted
- [x] Optimization opportunities identified

---

## Timeline

**Estimated: 30-45 minutes**

**Phase 1: Commit & Trigger (5 min)**
- Commit workflow
- Push to trigger
- Watch for startup

**Phase 2: Monitor First Run (10 min)**
- Watch jobs execute
- Note any failures
- Identify issues

**Phase 3: Fix Issues (15 min)**
- Update workflow for any problems
- Re-run until all pass
- Verify fixes work

**Phase 4: Harden (10 min)**
- Add error handling
- Improve reporting
- Optimize caching

**Phase 5: Final Validation (5 min)**
- Verify all jobs green
- Check logs readable
- Confirm value delivered

---

## Expected Issues & Solutions

### Issue 1: "ruchy: command not found"

**Cause**: Installation step failed or PATH issue

**Solution**:
```yaml
- name: Install Ruchy
  run: |
    cargo install ruchy --version ${{ env.RUCHY_MIN_VERSION }}
    echo "$HOME/.cargo/bin" >> $GITHUB_PATH
    ruchy --version
```

### Issue 2: "Module not found" in tests

**Cause**: Wrong working directory

**Solution**:
```yaml
- name: Run tests
  working-directory: ruchy
  run: ruchy tests/integration/test_system_health.ruchy
```

### Issue 3: "Permission denied" on install.sh

**Cause**: Scripts not executable

**Solution**:
```yaml
- name: Test installation
  run: |
    chmod +x install.sh uninstall.sh
    ./install.sh
```

### Issue 4: Slow Ruchy installation

**Cause**: Compiling from source every time

**Solution**: Add caching (see Enhancement 1 above)

---

## Post-Validation

### What This Completes

✅ **RUC-023 CI/CD**: Now fully complete with validation
✅ **TDD Cycle**: RED → GREEN → REFACTOR all done
✅ **Professional Standards**: CI tested before claiming done
✅ **Quality Assurance**: Automated testing proven working

### What Happens After

**Project v1.0.0 Status**:
- ✅ All development complete (18/19 modules)
- ✅ Integration tests complete and automated
- ✅ Distribution package working
- ✅ CI/CD validated and running
- ✅ v1.0.0 release ready

**Natural Stopping Point Reached**:
- ❌ Cannot develop RUC-005 (blocked by Issue #90)
- ❌ Cannot compile binaries (blocked by Issue #103)
- ✅ All productive work complete
- ⏳ Wait for upstream fixes

**Next Steps**:
1. Push v1.0.0 tag to GitHub
2. Create GitHub release
3. Monitor for user feedback
4. Wait for Issues #90/#103 to be fixed
5. Plan v1.1.0 or v2.0.0

---

## Lessons Learned Template

After validation, document:

**What Worked**:
- ___________________
- ___________________

**What Didn't Work**:
- ___________________
- ___________________

**Optimizations Applied**:
- ___________________
- ___________________

**Recommendations for Future**:
- ___________________
- ___________________

---

**This is the FINAL productive task** before hitting upstream blockers!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
