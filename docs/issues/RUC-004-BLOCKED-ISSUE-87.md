# RUC-004 Blocked by Issue #87 - Pattern-Specific Compiler Bug

**Date**: 2025-10-30
**Status**: 🔴 **BLOCKED**
**Severity**: HIGH - Blocks CLI development
**Issue**: [Ruchy #87](https://github.com/paiml/ruchy/issues/87)

---

## Problem Summary

RUC-004 (Microphone CLI) cannot be implemented using the proven inline-library pattern from RUC-002 due to Issue #87. The RUC-003 library code triggers the compiler bug even in smaller files than RUC-002.

---

## Evidence

### Working: RUC-002 (Speaker CLI)
```
File: ubuntu-audio.ruchy
Size: 464 LOC
Pattern: RUC-001 library (335 LOC) + CLI handlers (129 LOC)
Status: ✅ Compiles and runs perfectly
```

### Blocked: RUC-004 (Microphone CLI)
```
File: ubuntu-mic.ruchy
Size: 579 LOC → Fails
Size: 545 LOC → Fails (simplified main)
Size: 408 LOC → Fails (minimal commands only)
Pattern: RUC-003 library (450 LOC) + CLI handlers
Status: ❌ "Syntax error: Expected RightBrace, found Identifier"
```

### Key Finding

**Even with only 408 LOC, the RUC-003-based CLI fails, while RUC-002 at 464 LOC works!**

This proves the bug is **pattern-specific**, not just file size.

---

## Pattern Analysis

### RUC-001 Library (Works when inlined)
```ruchy
struct AudioDevice {
    id: String,
    name: String,
    description: String,
    is_default: bool,  // 4 fields
}

// Simple parsing
let name = extract_field(block, "Name:");
```

### RUC-003 Library (Triggers bug when inlined)
```ruchy
struct MicDevice {
    id: String,
    name: String,
    description: String,
    card: String,       // 6 fields (+2 more)
    device: String,
    is_default: bool,
}

// Monitor filtering
if name.contains(".monitor") || name.contains("Monitor of") {
    continue;  // Additional logic
}

// More format! calls
let name = if name.len() == 0 {
    format!("source-{}", id)  // Dynamic formatting
} else {
    name
};
```

### Differences That May Trigger Bug

1. **Struct Complexity**: 6 fields vs 4 fields
2. **String Operations**: Multiple `.contains()` calls
3. **Conditional Logic**: Monitor filtering adds complexity
4. **Format Calls**: More dynamic string building

---

## Attempted Workarounds

### ❌ Attempt 1: Reduce File Size
- Removed demo main() function
- Result: Still fails at 545 LOC

### ❌ Attempt 2: Minimal Commands
- Only list + help commands
- Result: Still fails at 408 LOC

### ❌ Attempt 3: Simplify Main
- Just call cmd_help()
- Result: Still fails

### Conclusion
**Cannot workaround by reducing file size or simplifying. The RUC-003 library patterns themselves trigger the bug.**

---

## Impact on Development

### Blocked Work
- ❌ RUC-004: Microphone CLI (this ticket)
- ❌ RUC-005: Combined audio CLI (would need both libraries)
- ❌ Any CLI tool using RUC-003 library

### Pattern Broken
The "inline library for single binary" pattern works for:
- ✅ RUC-001 library (simple patterns)
- ❌ RUC-003 library (complex patterns)

### Development Velocity
- RUC-002 took 45 minutes (fast with pattern)
- RUC-004 blocked indefinitely (pattern doesn't work)

---

## Possible Solutions

### Option 1: Wait for Ruchy Fix ⏰
**Pros**: Proper solution, maintains single-binary pattern
**Cons**: Unknown timeline, blocks progress
**Status**: Issue filed, waiting for maintainer response
**Recommendation**: ✅ **RECOMMENDED** - Only viable option

### Option 2: Module System 🔧 ❌ **NOT VIABLE** (Issue #88)
**Approach**: Keep library in separate file, import it
**Pros**: Would avoid inlining, smaller files
**Cons**: Module system not integrated with interpreter
**Status**: ❌ **TESTED AND REJECTED** - [Issue #88 filed](https://github.com/paiml/ruchy/issues/88)
**Details**: See `docs/issues/RUCHY-MODULE-SYSTEM-STATUS.md`

Ruchy has a sophisticated module loader in the backend, but it's **not wired into the interpreter** that `ruchydbg run` uses. The `use` statement is parsed but modules are not actually loaded at runtime.

**Filed Issue #88** with comprehensive debugging data including AST parse output showing Import is parsed correctly but not executed at runtime.

### Option 3: Simplify RUC-003 Library 📉
**Approach**: Remove monitor filtering, reduce struct fields
**Pros**: Might work with inline pattern
**Cons**: Loses functionality, band-aid solution
**Status**: ❌ **Not recommended** (compromises quality)

### Option 4: External Binary 🔗
**Approach**: Separate microphone binary, call via Command
**Pros**: Works around compiler issue
**Cons**: Multiple binaries, deployment complexity
**Status**: Last resort if Issue #87 not fixed

---

## Recommendation

**Wait for Issue #87 Resolution** (Option 1).

### Next Steps
1. ✅ ~~Test if Ruchy v3.149.0 supports importing from separate files~~ - **TESTED**: Module system not in interpreter
2. ⏸️ Wait for Issue #87 fix from upstream
3. 📋 Monitor Ruchy releases for Issue #87 resolution
4. 🔄 Test each new Ruchy version with RUC-004 CLI

### Trade-offs
- **Pausing saves time**: Don't waste effort on workarounds
- **Issue documented**: Upstream knows about the problem
- **Quality maintained**: No compromises to work around bug

---

## Toyota Way Applied ✅

**Stop the Line**: Immediately halted when pattern failed
**Go and See**: Created multiple test cases (408, 545, 579 LOC)
**Root Cause**: Identified pattern-specific trigger, not just file size
**Kaizen**: Updated Issue #87 with detailed findings
**Respect**: Provided actionable data for Ruchy maintainers

---

## Files Affected

### Blocked
- `ruchy/bin/ubuntu-mic.ruchy` - Cannot compile (multiple attempts)

### Working
- `ruchy/lib/microphone.ruchy` - Library works standalone ✅
- `ruchy/bin/ubuntu-audio.ruchy` - Different pattern works ✅

### Documentation
- `docs/tickets/RUC-004-MICROPHONE-CLI.md` - Ticket created
- `docs/issues/RUC-004-BLOCKED-ISSUE-87.md` - This document

---

## Timeline

**2025-10-30**:
- Created RUC-004 ticket
- Attempted implementation
- Discovered pattern-specific trigger
- Filed detailed Issue #87 updates
- Documented blocker
- **Decision**: Pause until module system tested or compiler fixed

---

## Next Actions

1. **Test Ruchy Module System**
   - Can we `use` from separate files?
   - Does it avoid the inline pattern bug?

2. **If Modules Work**
   - Restructure RUC-003 as proper module
   - Create RUC-004 CLI that imports module
   - Update patterns for future tickets

3. **If Modules Don't Work**
   - Wait for Issue #87 resolution
   - Monitor Ruchy releases
   - Test each new version

---

**Status**: 🔴 BLOCKED - Awaiting module system test or compiler fix
**Priority**: HIGH - Blocks audio module completion
**Workaround**: None found that maintains quality standards

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
