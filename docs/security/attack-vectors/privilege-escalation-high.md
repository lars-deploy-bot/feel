# Privilege Escalation via Setuid

**Risk Level**: 🟠 HIGH
**Attacker Profile**: Professional Hackers / Senior Pentesters
**Skill Required**: 1-2 years of security experience
**Real-World Frequency**: Medium

## Attack Description

Attacker exploits setuid binaries or gains new privileges via process execution to become root.

### Attack Scenarios

#### Scenario 1: Creating Setuid Binary

```bash
# Attacker compiles malicious program
cat > exploit.c << 'EOF'
#include <unistd.h>
int main() {
  setuid(0);  // Become root
  system("/bin/bash");
}
EOF

gcc -o exploit exploit.c
chmod u+s exploit  # Set setuid bit (BLOCKED by RestrictSUIDSGID)
./exploit          # Would give root shell (BLOCKED by NoNewPrivileges)
```

#### Scenario 2: Exploiting Existing Setuid Binary

```bash
# Find setuid binaries
find /usr -perm -4000 2>/dev/null

# Example: exploiting sudo vulnerability
# CVE-2021-4034 (PwnKit)
./pwnkit  # Exploit gives root shell (BLOCKED by NoNewPrivileges)
```

#### Scenario 3: Capability Escalation

```bash
# Check capabilities
getcap /usr/bin/*

# Exploit binary with capabilities
# Example: CAP_DAC_OVERRIDE allows bypassing file permissions
/usr/bin/tool-with-caps  # Would gain privileges (BLOCKED)
```

## Threat Profile

**Who can do this:**
- Professional penetration testers
- Security researchers
- Exploit developers
- Advanced red team operators

**Prerequisites:**
- Deep understanding of Unix permissions
- Knowledge of syscalls (setuid, execve, capabilities)
- Ability to compile exploits
- Often requires finding/chaining vulnerabilities

**Success Rate**: ~50% without hardening (requires exploitable setuid binary)

**Impact**:
- Full root access
- Complete system compromise
- Access to all sites
- Can install backdoors

## systemd Protection

```ini
# Prevent gaining new privileges
NoNewPrivileges=yes

# Block creating setuid/setgid files
RestrictSUIDSGID=yes

# Remove ALL Linux capabilities
CapabilityBoundingSet=
AmbientCapabilities=

# Run as unprivileged user
User=site-example-com
Group=site-example-com
```

## How Protection Works

### NoNewPrivileges=yes

**Effect**: Process and all children **cannot** gain more privileges than parent.

**What it blocks:**
```bash
# Setuid binary
-rwsr-xr-x 1 root root  /usr/bin/sudo
# Normally: execve() would run as root
# With NoNewPrivileges: execve() stays as site-example-com ❌

# File capabilities
getcap /usr/bin/ping
/usr/bin/ping = cap_net_raw+ep
# Normally: Would gain CAP_NET_RAW
# With NoNewPrivileges: Stays without capabilities ❌

# Setuid() syscall
setuid(0)  # Try to become root
# Returns EPERM (Operation not permitted) ❌
```

**Kernel enforcement**: Once set, even root cannot unset this flag.

### RestrictSUIDSGID=yes

**Effect**: Cannot create files with setuid/setgid bits.

```bash
# Try to create setuid backdoor
chmod u+s backdoor.sh
# Still executes as site-example-com, NOT root ❌

# Or via code
chmod("/backdoor", 04755)  # 04755 = setuid
# Setuid bit is silently ignored ❌
```

### CapabilityBoundingSet=

**Effect**: Process has **ZERO** Linux capabilities.

**Capabilities that would be useful for attacks:**
- `CAP_DAC_OVERRIDE` - Bypass file read/write/execute checks
- `CAP_CHOWN` - Change file ownership
- `CAP_SETUID` - Change UID
- `CAP_SYS_ADMIN` - Mount filesystems, create namespaces
- `CAP_NET_BIND_SERVICE` - Bind ports < 1024
- `CAP_NET_RAW` - Create raw sockets, packet injection

**All removed** ✅

## Real-World Exploits (Mitigated)

### Dirty Cow (CVE-2016-5195)

**Original exploit:**
```c
// Race condition in Linux kernel allows writing to read-only memory
// Could modify /etc/passwd to add root user
madvise(map, 100, MADV_DONTNEED);  // Race condition
write(f, "hacker::0:0:::/bin/bash\n", 24);  // Add root user
```

**With systemd hardening:**
- ✅ `ProtectSystem=strict` makes /etc read-only at mount level
- ✅ `NoNewPrivileges` prevents privilege escalation even if exploit works
- ✅ Contained to one site's files only

### PwnKit (CVE-2021-4034)

**Original exploit:**
```bash
# Buffer overflow in pkexec (setuid binary)
./pwnkit  # Gives instant root shell
```

**With systemd hardening:**
- ✅ `NoNewPrivileges=yes` prevents execve() from gaining setuid privileges
- ✅ Even if pkexec is called, it runs as site-example-com
- ✅ Exploit returns to unprivileged shell

### Sudo Baron Samedit (CVE-2021-3156)

**Original exploit:**
```bash
# Heap overflow in sudo
sudoedit -s /  # Buffer overflow → root
```

**With systemd hardening:**
- ✅ `NoNewPrivileges` prevents sudo from running as root
- ✅ CapabilityBoundingSet prevents capability grants
- ✅ Exploit fails to escalate

## Defense in Depth

**Even if attacker bypasses NoNewPrivileges** (kernel exploit):

```ini
# Still limited by:
ProtectSystem=strict         # Can't modify system files
ReadWritePaths=/srv/.../     # Can only write to own workspace
ProtectKernelModules=yes     # Can't load kernel modules
MemoryMax=512M               # Resource constrained
```

**Result**: Attacker is still trapped in isolated environment.

## Testing

### Manual Testing

```bash
# Become site user
sudo -u site-example-com bash

# Try to create setuid binary
echo '#!/bin/bash' > test.sh
chmod u+s test.sh
ls -l test.sh
# Should show: -rwxr-xr-x (no 's' bit)

# Try to run sudo
sudo ls
# Should fail: sudo requires privileges

# Check capabilities
grep Cap /proc/$$/status
# Should show all zeros
```

### Verification Commands

```bash
# Check NoNewPrivileges flag
systemctl show site@example-com.service | grep NoNewPrivileges
# Output: NoNewPrivileges=yes

# Check capabilities
systemctl show site@example-com.service | grep Capability
# Output: CapabilityBoundingSet= (empty)
```

## Mitigation Effectiveness

| Attack Vector | Without Hardening | With Hardening |
|---------------|------------------|----------------|
| Setuid binary exploit | ✅ Root shell | ❌ Stays unprivileged |
| Sudo vulnerability | ✅ Root access | ❌ Sudo doesn't escalate |
| File capabilities | ✅ Gains capabilities | ❌ Capabilities ignored |
| Manual setuid() call | ✅ Can become root | ❌ EPERM error |
| Create setuid backdoor | ✅ Persistent backdoor | ❌ Setuid bit ignored |

**Protection Level**: 🛡️ 95% effective

**Remaining 5%**: Kernel 0-day that bypasses seccomp/LSM - requires elite attacker.

## References

- [PwnKit Exploit Analysis](https://blog.qualys.com/vulnerabilities-threat-research/2022/01/25/pwnkit-local-privilege-escalation-vulnerability-discovered-in-polkits-pkexec-cve-2021-4034)
- [NoNewPrivileges Documentation](https://www.kernel.org/doc/Documentation/prctl/no_new_privs.txt)
- [Linux Capabilities](https://man7.org/linux/man-pages/man7/capabilities.7.html)
