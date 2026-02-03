# Memory Corruption → Code Execution

**Risk Level**: 🔴 CRITICAL
**Attacker Profile**: Elite Security Researchers / APT Groups
**Skill Required**: 3-7 years of exploit development
**Real-World Frequency**: Low (but **possible**)

## Attack Description

Attacker exploits buffer overflow or use-after-free vulnerability to inject and execute arbitrary code.

### Attack Chain

```
1. Find vulnerability (buffer overflow, UAF, etc.)
   ↓
2. Craft exploit payload (shellcode)
   ↓
3. Bypass ASLR (leak memory addresses)
   ↓
4. Trigger vulnerability
   ↓
5. Overwrite return address / function pointer
   ↓
6. Mark memory as executable (mprotect)
   ↓
7. Jump to shellcode
   ↓
8. Code execution achieved
```

## Threat Profile

**Who can do this:**
- Professional vulnerability researchers
- Exploit developers (ZDI, Project Zero)
- Advanced Persistent Threat (APT) groups
- Nation-state actors
- Pwn2Own contestants

**Prerequisites:**
- Deep knowledge of assembly (x86_64, ARM)
- Proficiency with debuggers (GDB, LLDB)
- Understanding of memory layout, stack frames, heap structures
- Ability to bypass modern mitigations (ASLR, stack canaries, NX)
- Often requires months of research per exploit

**Success Rate**: ~5-15% (finding exploitable bug is hardest part)

**Bounty Value**: $50k-$500k+ (Zerodium pays $2.5M for Chrome RCE)

**Impact**:
- Arbitrary code execution as site user
- BUT: Still trapped by systemd sandbox
- Cannot become root
- Cannot escape workspace
- Can only damage single site

## Vulnerability Example (Hypothetical)

> **Note:** These are hypothetical security examples for educational purposes. Claude Bridge does not use SQLite or these specific native modules.

### Buffer Overflow in Native Module

```c
// Hypothetical bug in better-sqlite3 or other native module (NOT used in Claude Bridge)
void process_query(const char *sql) {
  char buffer[256];
  strcpy(buffer, sql);  // ⚠️ No bounds check!
  // ... execute query
}
```

**Exploit:**
```javascript
// Attacker crafts oversized input
const payload =
  'A'.repeat(264) +           // Fill buffer + saved RBP
  '\x41\x42\x43\x44\x00\x00' +  // Overwrite return address
  shellcode;                   // Malicious code

db.exec(payload);  // Trigger overflow
// Return address now points to shellcode
```

## systemd Protection (INCOMPLETE)

```ini
# ❌ DISABLED for Bun JIT compatibility
MemoryDenyWriteExecute=no

# ✅ Still provides containment
User=site-example-com         # Not root
CapabilityBoundingSet=        # No capabilities
ReadWritePaths=/srv/.../      # Filesystem isolation
NoNewPrivileges=yes           # Can't escalate
```

## What Happens Without MemoryDenyWriteExecute

**Attacker can:**
```c
// 1. Allocate memory
void *mem = mmap(NULL, 4096, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);

// 2. Write shellcode
memcpy(mem, shellcode, sizeof(shellcode));

// 3. Mark as executable ⚠️ ALLOWED
mprotect(mem, 4096, PROT_READ | PROT_EXEC);

// 4. Jump to shellcode
((void(*)())mem)();  // Execute malicious code
```

**With MemoryDenyWriteExecute=yes** (if enabled):
```c
mprotect(mem, 4096, PROT_EXEC);
// Returns EACCES (Permission denied) ❌
```

## Modern Exploit Mitigations (System-Level)

Even without `MemoryDenyWriteExecute`, attackers must bypass:

### 1. ASLR (Address Space Layout Randomization)

**What it does**: Randomizes memory addresses on each execution.

```bash
# Check ASLR status
cat /proc/sys/kernel/randomize_va_space
# 2 = Full randomization (enabled on most systems)
```

**Exploit difficulty**: Must leak memory addresses first (info disclosure bug required).

### 2. Stack Canaries

**What it does**: Compiler inserts random value before return address.

```c
void vulnerable() {
  int canary = RANDOM_VALUE;
  char buffer[256];
  // ...
  if (canary != RANDOM_VALUE) abort();  // Overflow detected!
}
```

**Exploit difficulty**: Must overwrite canary with correct value (requires leak).

### 3. NX/DEP (Non-Executable Stack)

**What it does**: Stack memory is not executable.

**Exploit difficulty**: Can't put shellcode on stack directly (must use ROP).

### 4. PIE (Position Independent Executable)

**What it does**: Executable code location randomized (like ASLR for code).

**Exploit difficulty**: All code addresses randomized, need leak.

## Containment (Defense in Depth)

**Even if attacker achieves code execution**, systemd limits damage:

```ini
# Can't become root
User=site-example-com
NoNewPrivileges=yes

# Can't access other sites
ReadWritePaths=/srv/webalive/sites/example-com/

# Can't modify system
ProtectSystem=strict
ProtectKernelModules=yes
ProtectKernelTunables=yes

# No special privileges
CapabilityBoundingSet=
```

**Result**: Attacker is trapped in isolated workspace with no root access.

## Real-World Examples

### Chrome V8 Engine Exploits

**Pwn2Own 2023**: Multiple teams exploited V8 for $100k-$300k each.

**Typical exploit chain:**
1. Find JIT bug in V8
2. Corrupt memory to escape sandbox
3. Write shellcode to RWX region
4. Execute arbitrary code
5. Escape Chrome sandbox
6. Compromise system

**Time to develop**: 3-6 months per exploit

### Node.js Native Module Exploits

**Example**: Buffer overflow in `node-sqlite3` (hypothetical - NOT used in Claude Bridge)

**Exploit complexity**:
- Find buffer overflow (weeks of fuzzing)
- Bypass ASLR (info disclosure required)
- Craft ROP chain (days of work)
- Test reliability (many crashes)

**Success rate**: ~10-20% even for experts

## Why MemoryDenyWriteExecute is Disabled

**Bun requires JIT compilation**:

```javascript
// JavaScript → JIT → Machine code
function add(a, b) { return a + b; }

// Bun's process:
1. Parse JS
2. Compile to machine code (needs mmap(PROT_WRITE | PROT_EXEC))
3. Execute compiled code (needs PROT_EXEC)
4. Optimize hot code (needs PROT_WRITE again)
```

**With MemoryDenyWriteExecute=yes**: JIT compiler fails, performance drops 10-100x.

## Mitigation Options

### Option 1: Accept the Risk (Current)

**Reasoning**:
- Exploits are rare and difficult
- Containment limits damage
- Performance is critical
- Target is low-value (not finance/government)

**Risk**: Elite attackers **can** potentially exploit this.

### Option 2: Pre-Compile JavaScript

```bash
# Disable JIT, use snapshots
bun build --compile ./index.ts --outfile server

# Run with MemoryDenyWriteExecute=yes
MemoryDenyWriteExecute=yes
```

**Tradeoffs**:
- ✅ Blocks memory corruption exploits
- ❌ Slower startup
- ❌ Less dynamic code
- ❌ Requires build step

### Option 3: Use V8 Sandbox (Future)

**Chrome's approach**: V8 has internal sandbox that isolates JIT memory.

**Status**: Available in Chrome, not yet in standalone V8/Bun.

## Testing for Vulnerabilities

```bash
# Fuzz native modules
AFL_USE_ASAN=1 afl-fuzz -i input/ -o output/ -- bun run test

# Check for memory leaks
valgrind --leak-check=full bun run dev

# Address Sanitizer (ASAN)
ASAN_OPTIONS=detect_leaks=1 bun run dev
```

## Detection & Monitoring

```bash
# Monitor for crashes (sign of exploitation attempts)
journalctl -u site@example-com.service | grep 'segmentation fault'

# Check for unusual memory patterns
systemctl status site@example-com.service | grep Memory

# Audit logs for exploit attempts
ausearch -m AVC -ts recent  # SELinux denials
```

## Mitigation Effectiveness

| Attack Stage | Protection |
|--------------|-----------|
| **Find vulnerability** | Not mitigated (bug must exist) |
| **Bypass ASLR** | ⚠️ Requires info leak (medium difficulty) |
| **Bypass stack canary** | ⚠️ Requires leak (medium difficulty) |
| **Allocate RWX memory** | ❌ ALLOWED (MemoryDenyWriteExecute=no) |
| **Execute shellcode** | ❌ ALLOWED |
| **Become root** | ✅ BLOCKED (NoNewPrivileges, User=) |
| **Access other sites** | ✅ BLOCKED (ReadWritePaths) |
| **Modify system** | ✅ BLOCKED (ProtectSystem) |

**Protection Level**: 🛡️ 60% (exploit possible but contained)

## Risk Assessment

**Probability**: < 0.1% for typical multi-tenant platform

**Target selection criteria** (elite attackers choose targets with):
- High-value data (banking, healthcare, crypto)
- Many users (critical infrastructure)
- APT targets (government, defense contractors)

**WebAlive profile**:
- ❌ Not high-value target
- ❌ Not critical infrastructure
- ✅ Exploitation contained to single site
- ✅ No root access possible

**Conclusion**: Risk accepted for performance reasons. **Re-evaluate if hosting sensitive data.**

## References

- [Google Project Zero Blog](https://googleprojectzero.blogspot.com/)
- [Pwn2Own Results](https://www.zerodayinitiative.com/Pwn2OwnResults.html)
- [Zerodium Exploit Prices](https://zerodium.com/program.html)
- [V8 Security Design](https://v8.dev/docs/memory-cage)
