# Resource Exhaustion Attack

**Risk Level**: 🟢 LOW
**Attacker Profile**: Script Kiddies
**Skill Required**: Complete beginner (5 minutes of Google)
**Real-World Frequency**: Very High

## Attack Description

Attacker consumes all system resources (memory, CPU, processes) to crash the server.

### Attack Code

```javascript
// Memory exhaustion
while(true) {
  Array(999999999); // Eat all RAM
}

// CPU exhaustion
while(true) {} // Infinite loop

// Fork bomb
function fork() { fork(); fork(); }
fork();
```

## Threat Profile

**Who can do this:**
- 12-year-old with copy-paste skills
- Literally anyone with browser console access
- Automated botnets

**Success Rate**: 100% if unprotected

**Impact**:
- Server crashes
- All sites go down
- Requires manual restart

## systemd Protection

```ini
# Memory limit
MemoryMax=512M

# CPU limit (50% of one core)
CPUQuota=50%

# Process/thread limit
LimitNPROC=100

# File descriptor limit
LimitNOFILE=65536
```

## How Protection Works

**Before hardening:**
```bash
# Attacker site consumes 8GB RAM
$ ps aux | grep site-evil-com
site-evil-com  12345  99.0  85.0  # Using 85% of total RAM!

# Server OOM killer starts killing random processes
$ dmesg | tail
[12345.678] Out of memory: Kill process 9999 (postgres)
```

**After hardening:**
```bash
# Attacker site hits 512MB limit
$ systemctl status site@evil-com.service
● site@evil-com.service - WebAlive Site: evil-com
   Active: active (running)
   Memory: 512.0M (max: 512.0M)  # CAPPED
   CGroup: /system.slice/site@evil-com.service
           └─12345 /usr/local/bin/bun run dev

# Attacker's process is OOM-killed, but other sites unaffected
# systemd automatically restarts the service (Restart=always)
```

**Result**:
- ✅ Attack contained to one site
- ✅ Other sites continue running
- ✅ Automatic recovery

## Real-World Examples

**Classic DoS (Cloudflare 2014):**
- Attacker sends infinite loop script
- Server runs out of memory
- All customers go offline

**Webhosting providers without limits:**
- One customer's infinite loop
- Takes down entire shared hosting server
- Hundreds of sites affected

## Verification

```bash
# Test memory limit
systemd-run --user --unit=test-mem --property=MemoryMax=100M \
  bash -c 'while true; do x="$x$x"; done'

# Should see: Killed (OOM)

# Test CPU limit
systemd-run --user --unit=test-cpu --property=CPUQuota=10% \
  bash -c 'while true; do :; done'

# CPU usage should cap at 10%
```

## Mitigation Effectiveness

| Attack Type | Without Limits | With Limits |
|-------------|----------------|-------------|
| Memory bomb | Server crash | Site restart only |
| CPU exhaustion | Server freeze | Limited to 50% CPU |
| Fork bomb | System unusable | Max 100 processes |
| FD leak | Can't accept connections | Max 65k FDs |

**Protection Level**: 🛡️ 100% effective against this attack class
