# Schema-Based Testing Infrastructure Roadmap

**Objective**: End the whack-a-mole cycle by implementing comprehensive automated testing for Ruchy bugs

**Status**: 🔴 NOT STARTED
**Priority**: CRITICAL - Blocks all conversions
**Time Investment**: 2-3 hours
**Time Saved**: Infinite (ends whack-a-mole cycle)

---

## Problem Statement

**Current Reality** (Manual Testing):
- Testing 1-2 variants per Ruchy version
- Spending 1+ hour per version on manual iteration
- Missing edge cases consistently
- Issue #79: 4 versions, still only 4/15 variants verified (26.7%)

**Time Wasted So Far**:
- v3.147.3: 30 minutes
- v3.147.4: 2 hours
- v3.147.5: 1.5 hours
- v3.147.6: 1.5 hours
- **Total**: 5.5 hours = almost 1 full workday

**Result**: Still broken, 73% of variants untested

---

## Solution: Comprehensive Schema-Based Testing

Per [RuchyRuchy Whack-A-Mole Guide](https://github.com/paiml/ruchyruchy/blob/main/WHACK_A_MOLE_BUG_HUNTERS_GUIDE.md):

1. **Define comprehensive schemas** for all bug variants
2. **Generate test cases automatically** (100+ per pattern)
3. **Run with timeout detection** (<5 minutes total)
4. **Track variant coverage** (X/Y passing)
5. **ONLY close issues** when Y/Y variants pass (100%)

**Expected Outcome**: Find ALL variants in one test run

---

## Roadmap

### Phase 1: Core Infrastructure (1-2 hours)

**INFRA-001**: Schema Format & Parser
- [ ] Define YAML schema format for test variants
- [ ] Implement schema parser in Rust
- [ ] Validate schema structure
- **Time**: 30 minutes

**INFRA-002**: Test Generator
- [ ] Generate Ruchy code from schema
- [ ] Support parameterized variants
- [ ] Handle enum definitions, struct definitions, impl blocks
- **Time**: 45 minutes

**INFRA-003**: Timeout Runner
- [ ] Run generated tests with timeout
- [ ] Capture stdout/stderr
- [ ] Track pass/fail/timeout status
- **Time**: 30 minutes

**INFRA-004**: Coverage Tracker
- [ ] Track X/Y variants passing
- [ ] Generate coverage report
- [ ] Identify untested variants
- **Time**: 15 minutes

### Phase 2: Issue #79 Implementation (30-60 minutes)

**TEST-001**: Create Comprehensive Schema
- [ ] Document all 15+ Issue #79 variants
- [ ] Create `schemas/issue79_comprehensive.yaml`
- [ ] Include discovered and hypothetical variants
- **Time**: 30 minutes

**TEST-002**: Generate & Run Tests
- [ ] Generate 100+ test cases from schema
- [ ] Run against Ruchy v3.147.6
- [ ] Collect results (pass/fail/timeout)
- **Time**: 10 minutes

**TEST-003**: Report Results
- [ ] Generate variant coverage matrix
- [ ] Identify all failing variants
- [ ] Create minimal reproductions for each
- **Time**: 20 minutes

### Phase 3: Integration & Sharing (30 minutes)

**SHARE-001**: Update Issue #79
- [ ] Post comprehensive test results
- [ ] Share schema and methodology
- [ ] Offer to help integrate into Ruchy CI/CD

**SHARE-002**: Contribute to RuchyRuchy
- [ ] PR with Issue #79 schema
- [ ] Share implementation approach
- [ ] Help implement missing tooling

---

## Technical Design

### Schema Format (YAML)

```yaml
# schemas/issue79_comprehensive.yaml
name: "Issue #79 - Enum Cast Variants"
description: "Comprehensive testing of all enum-to-integer cast patterns"

enum_definition: |
  enum LogLevel {
      Debug = 0,
      Info = 1,
      Warn = 2,
      Error = 3,
  }

struct_definition: |
  struct Logger {
      level: LogLevel,
      prefix: String,
  }

variants:
  - id: variant_1
    name: "Direct field cast"
    enabled: true
    expected: pass
    impl_method: |
      fun test(&self) {
          let val = self.level as i32;
          println!("Value: {}", val);
      }
    test_code: |
      let logger = Logger { level: LogLevel::Info, prefix: String::new() };
      logger.test();

  - id: variant_2
    name: "Variable intermediate"
    enabled: true
    expected: pass
    impl_method: |
      fun test(&self) {
          let level = self.level;
          let val = level as i32;
          println!("Value: {}", val);
      }
    test_code: |
      let logger = Logger { level: LogLevel::Info, prefix: String::new() };
      logger.test();

  - id: variant_4
    name: "Nested method enum param"
    enabled: true
    expected: pass
    impl_method: |
      fun inner(&self, param: LogLevel) {
          let val = param as i32;
          println!("Value: {}", val);
      }
      fun outer(&self) {
          self.inner(LogLevel::Debug);
      }
    test_code: |
      let logger = Logger { level: LogLevel::Info, prefix: String::new() };
      logger.outer();

  - id: variant_5
    name: "Enum compare + external crate call"
    enabled: true
    expected: fail  # Known to fail in v3.147.6
    dependencies: ["chrono"]
    impl_method: |
      fun test(&self) {
          use chrono::Utc;
          let level_value = LogLevel::Info as i32;
          let min_level_value = self.level as i32;
          if level_value >= min_level_value {
              let timestamp = Utc::now().to_rfc3339();
              println!("Time: {}", timestamp);
          }
      }
    test_code: |
      let logger = Logger { level: LogLevel::Info, prefix: String::new() };
      logger.test();

  # ... 10+ more variants
```

### Generator (Rust)

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize, Serialize)]
struct TestSchema {
    name: String,
    description: String,
    enum_definition: String,
    struct_definition: String,
    variants: Vec<TestVariant>,
}

#[derive(Debug, Deserialize, Serialize)]
struct TestVariant {
    id: String,
    name: String,
    enabled: bool,
    expected: TestExpectation,
    dependencies: Option<Vec<String>>,
    impl_method: String,
    test_code: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum TestExpectation {
    Pass,
    Fail,
    Timeout,
}

fn generate_test_file(schema: &TestSchema, variant: &TestVariant) -> String {
    let mut code = String::new();

    // Add dependencies
    if let Some(deps) = &variant.dependencies {
        for dep in deps {
            code.push_str(&format!("use {};\n", dep));
        }
        code.push('\n');
    }

    // Add enum definition
    code.push_str(&schema.enum_definition);
    code.push_str("\n\n");

    // Add struct definition
    code.push_str(&schema.struct_definition);
    code.push_str("\n\n");

    // Add impl block
    code.push_str("impl Logger {\n");
    code.push_str(&variant.impl_method);
    code.push_str("\n}\n\n");

    // Add main function
    code.push_str("fun main() {\n");
    code.push_str(&variant.test_code);
    code.push_str("\n}\n");

    code
}

fn run_test(code: &str, timeout_ms: u64) -> TestResult {
    use std::process::{Command, Stdio};
    use std::time::Duration;

    let mut child = Command::new("ruchy")
        .arg("run")
        .arg("-")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to spawn ruchy");

    // Write code to stdin
    use std::io::Write;
    child.stdin.as_mut().unwrap().write_all(code.as_bytes()).unwrap();

    // Wait with timeout
    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return if status.success() {
                    TestResult::Pass
                } else {
                    TestResult::Fail(format!("Exit code: {}", status.code().unwrap_or(-1)))
                };
            }
            Ok(None) => {
                if start.elapsed() > Duration::from_millis(timeout_ms) {
                    let _ = child.kill();
                    return TestResult::Timeout;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                return TestResult::Fail(format!("Process error: {}", e));
            }
        }
    }
}

#[derive(Debug)]
enum TestResult {
    Pass,
    Fail(String),
    Timeout,
}

fn main() {
    // Load schema
    let schema_yaml = std::fs::read_to_string("schemas/issue79_comprehensive.yaml")
        .expect("Failed to read schema");
    let schema: TestSchema = serde_yaml::from_str(&schema_yaml)
        .expect("Failed to parse schema");

    println!("Testing: {}", schema.name);
    println!("Description: {}", schema.description);
    println!("Variants: {}\n", schema.variants.len());

    let mut results = HashMap::new();

    for variant in &schema.variants {
        if !variant.enabled {
            println!("⏭️  {} (disabled)", variant.name);
            continue;
        }

        print!("🧪 Testing {}... ", variant.name);

        let code = generate_test_file(&schema, variant);
        let result = run_test(&code, 5000);

        let status = match (&result, &variant.expected) {
            (TestResult::Pass, TestExpectation::Pass) => "✅ PASS",
            (TestResult::Timeout, TestExpectation::Timeout) => "✅ EXPECTED TIMEOUT",
            (TestResult::Fail(_), TestExpectation::Fail) => "✅ EXPECTED FAIL",
            (TestResult::Pass, _) => "⚠️  UNEXPECTED PASS",
            (TestResult::Timeout, _) => "❌ UNEXPECTED TIMEOUT",
            (TestResult::Fail(_), _) => "❌ UNEXPECTED FAIL",
        };

        println!("{}", status);
        results.insert(variant.id.clone(), result);
    }

    // Summary
    println!("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Summary:");

    let passed = results.values().filter(|r| matches!(r, TestResult::Pass)).count();
    let failed = results.values().filter(|r| matches!(r, TestResult::Fail(_))).count();
    let timeout = results.values().filter(|r| matches!(r, TestResult::Timeout)).count();
    let total = results.len();

    println!("  ✅ Passed: {}", passed);
    println!("  ❌ Failed: {}", failed);
    println!("  ⏱️  Timeout: {}", timeout);
    println!("  📊 Coverage: {}/{} ({:.1}%)", passed, total, (passed as f64 / total as f64) * 100.0);

    if passed == total {
        println!("\n🎉 ALL VARIANTS PASS!");
    } else {
        println!("\n🚨 {} variants still broken", total - passed);
    }
}
```

### Usage

```bash
# Step 1: Create schema
vim schemas/issue79_comprehensive.yaml

# Step 2: Run comprehensive tests
cargo run --bin schema_test schemas/issue79_comprehensive.yaml

# Output:
# Testing: Issue #79 - Enum Cast Variants
# Description: Comprehensive testing of all enum-to-integer cast patterns
# Variants: 15
#
# 🧪 Testing Direct field cast... ✅ PASS
# 🧪 Testing Variable intermediate... ✅ PASS
# 🧪 Testing Parameter cast direct... ✅ PASS
# 🧪 Testing Nested method enum param... ✅ PASS
# 🧪 Testing Enum compare + external crate call... ❌ UNEXPECTED TIMEOUT
# 🧪 Testing Return value cast... ✅ PASS
# ... (10 more)
#
# Summary:
#   ✅ Passed: 14
#   ❌ Failed: 0
#   ⏱️  Timeout: 1
#   📊 Coverage: 14/15 (93.3%)
#
# 🚨 1 variants still broken
```

---

## Milestones

### M1: Infrastructure Complete (1-2 hours)
- Schema parser implemented
- Test generator working
- Timeout runner functional
- Coverage tracking ready

**Success Criteria**: Can load schema, generate tests, run with timeout, report results

### M2: Issue #79 Tests Complete (30-60 minutes)
- All 15+ variants documented in schema
- Tests generated and run against v3.147.6
- Comprehensive coverage report generated
- All failing variants have minimal reproductions

**Success Criteria**: Know EXACTLY which variants fail in v3.147.6

### M3: Shared with Community (30 minutes)
- Posted to Issue #79 with results
- Shared schema and tooling approach
- Offered to help integrate into Ruchy CI/CD
- Contributed to RuchyRuchy project

**Success Criteria**: Ruchy team has tools to end whack-a-mole

---

## Success Metrics

**Time Investment**: 2-3 hours (one-time)
**Time Saved**: 1+ hour per Ruchy version (recurring)
**Break-Even**: After 2-3 Ruchy versions
**Long-Term ROI**: Infinite (prevents all future whack-a-mole cycles)

**Coverage Goal**: 15/15 Issue #79 variants (100%)
**Current**: 4/15 (26.7%)
**Gap**: 11 variants untested

**Quality Goal**: ONLY close Issue #79 when 15/15 variants pass
**Current Practice**: Close after testing 1-2 variants
**Improvement**: Prevent 4+ regression cycles

---

## Risk Mitigation

**Risk 1**: Schema format too complex
- **Mitigation**: Start with simple YAML, iterate
- **Fallback**: Use Rust structs instead of YAML

**Risk 2**: Test generation too hard
- **Mitigation**: Start with template strings, add sophistication later
- **Fallback**: Manual test files, automated running only

**Risk 3**: Takes longer than estimated
- **Mitigation**: Ship incremental improvements
- **Fallback**: Even partial automation saves time

**Risk 4**: Ruchy team doesn't adopt
- **Mitigation**: We benefit even if only we use it
- **Fallback**: Use for our project, share if interested

---

## Next Actions

1. ✅ **Create this roadmap** (done)
2. 🔄 **Start INFRA-001** (schema format & parser)
3. ⏳ **Implement core infrastructure** (1-2 hours)
4. ⏳ **Create Issue #79 schema** (30 minutes)
5. ⏳ **Run comprehensive tests** (5 minutes)
6. ⏳ **Share with Ruchy team** (30 minutes)

**Total Time**: 2.5-3 hours
**Total Benefit**: End whack-a-mole cycle forever

---

## References

- [RuchyRuchy Whack-A-Mole Guide](https://github.com/paiml/ruchyruchy/blob/main/WHACK_A_MOLE_BUG_HUNTERS_GUIDE.md)
- [Issue #79](https://github.com/paiml/ruchy/issues/79)
- [RUCHY-V3.147.6-TEST-RESULTS.md](./RUCHY-V3.147.6-TEST-RESULTS.md)

---

**Let's end the whack-a-mole cycle!** 🎯

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
