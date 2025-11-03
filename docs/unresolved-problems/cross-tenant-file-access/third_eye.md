Third eye report: A lean, durable isolation plan for Claude Bridge on a single Hetzner server

TL;DR

Don’t rebuild the world. Fix the invariants.
Make /srv/webalive/sites non-listable to others (711) and normalize all tenant dirs to 750 with umask 007. This removes cross-tenant reads even when someone misconfigures a file.
Constrain each site process with systemd’s mount namespace: bind its workspace to /app and make /srv/webalive/sites invisible. This is a small change with a big effect.
Optionally add a simple AppArmor profile that only allows /app and system libs. It’s light, fast, and catches mistakes.
Keep developer speed: nothing new to learn, same stack, same server. “Deploy” becomes an atomic symlink switch + systemd restart. Zero downtime, one command.
Total cost: near-zero. Total change: a few lines in a systemd template and a permissions sweep. Security: materially better, durable.
Two interpretations

My reading of the incident

The actual boundary your platform intends is “site workspace,” but the effective OS boundary was “parent of all sites,” so app code could roam.
A permissive parent directory (755) enabled tenant enumeration; two sites were world-readable (755), enabling cross-tenant file reads.
App-level guardrails only covered Claude SDK tools. Application code was not confined at runtime.
This is fundamentally an alignment problem: runtime authority exceeded the logical workspace boundary.
What I think you want

Keep everything on a single Hetzner box; keep costs down.
Developers should move fast with Vite/Bun/Node, no new platform to learn.
When users click Deploy, it updates production immediately and atomically, with rollbacks easy.
Minimal operational and conceptual change. Durable security that doesn’t depend on everyone always getting permissions exactly right.
Design principles

Make the boundary real: the thing you say is the boundary must be the boundary the kernel enforces.
Fewer knobs. Prefer one uniform template over many per-site exceptions.
Fail safe. Mistakes shouldn’t lead to cross-tenant reads.
Be observable. Denials should be visible in journald and easy to debug.
Atomic deploys; instant rollback.
Proposed architecture delta (small, high–leverage changes)

Filesystem invariants (15 minutes)
Parent directory: chmod 711 /srv/webalive/sites
Prevents listing while preserving traversal. Tenants can reach their own dir; they can’t enumerate siblings.
All site roots: chmod 750 /srv/webalive/sites/<site>
Owner: site-<site>; Group: site-<site>; Others: none.
Service umask: UMask=007 in the systemd unit
New files default 660 and dirs 770; no accidental world-readable files.
One-time audit:
find /srv/webalive/sites -type d -perm -o=r -print
find /srv/webalive/sites -type f -perm -o=r -print
Fix any stragglers to 640/750.
Result: enumeration eliminated, 755 mistakes no longer leak everything, defaults are safe.

2. Runtime confinement with systemd mount namespaces (no containers, no chroot)
Goal: process only sees its own workspace at /app; /srv/webalive/sites is invisible.

Update the site@.service template:

Run as the site user with a private mount namespace:
PrivateTmp=yes
PrivateDevices=yes
NoNewPrivileges=yes
ProtectSystem=strict (system dirs read-only)
ReadWritePaths=/app (only /app is writable)
BindPaths=/srv/webalive/sites/%i/current:/app
InaccessiblePaths=/srv/webalive/sites
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
LockPersonality=yes
RestrictRealtime=yes
UMask=007
WorkingDirectory=/app
Effect:

App code’s __dirname resolves under /app. path.resolve(__dirname, '../../') can’t escape to /srv because /srv/webalive/sites is simply not there.
Even if a developer writes code that references /srv/webalive/sites, InaccessiblePaths blocks it. You get a clean “Permission denied” at the syscall level.
Startup time, memory, and CPU overhead are negligible. No Docker. No new dev flow.
3. Optional but recommended: AppArmor allowlist (lightweight defense-in-depth)

One simple profile per site user or a parameterized generator:
Allow /app/** rw
Deny /srv/webalive/sites/** (explicit)
Allow typical system libs and /dev/null, /dev/urandom, proc/sys read
Allow network inet/inet6
Exec via aa-exec in the systemd unit or attach by profile name.
Start in complain mode for a day; flip to enforce when clean.
Effect:

Even if permissions drift or a mount slips, syscalls still respect the profile. It catches surprises and logs denials.
4. Claude Bridge alignment (small change)

Set workspace root to /app/user for the running process; your canUseTool checks already work with this.
Add a minimal code scan on Write/Edit for obviously dangerous patterns (path.resolve with .. out of workspace, fs.* on absolute paths outside /app). This catches accidental risks and educates users without trying to be perfect.
Keep this guardrail low-friction and overrideable by a manager if there’s a legit case.
5. Click-to-deploy as an atomic symlink switch (simple, fast, safe)

Directory structure per site:
/srv/webalive/sites/<site>/releases/<timestamp>/user
/srv/webalive/sites/<site>/current -> releases/<timestamp>
/srv/webalive/sites/<site>/shared (optional for persistent bits)
The service binds /srv/webalive/sites/%i/current to /app.
Deploy button workflow:
Build in a temp dir under releases/<new_ts>.
If build passes, ln -sfn releases/<new_ts> current.
systemctl restart site@<site>.
Keep last N releases for instant rollback; rollback = update symlink + restart.
Impact:
Near-zero downtime deploys. No data copies beyond release; reuses same mount strategy.
Rollbacks become 5 seconds.
Why this is durable and lean

Minimal change: you’re not switching runtimes, not adopting containers, not adding a second server.
Security is enforced at the kernel level. If someone writes code that tries to escape the workspace, it simply can’t see anything to escape to.
Defaults are safe; you’re no longer relying on every directory always being 750.
It’s reversible and incremental. You can roll this out site-by-site with a template unit and one script.
Implementation steps (order of operations)

Day 0–1: Close the breach quickly

Fix perms:
chmod 711 /srv/webalive/sites
chmod 750 /srv/webalive/sites/* (verify ownership too)
UMask=007 in current systemd units and restart each service
Audit and fix any lingering world-readable files/dirs with the find commands.
Remove/disable the known-vulnerable code path in kranazilie.nl (or confirm blockers in place).
Day 1–2: Systemd sandbox rollout

Create a hardened site@.service template with:
BindPaths=/srv/webalive/sites/%i/current:/app
WorkingDirectory=/app
InaccessiblePaths=/srv/webalive/sites
ProtectSystem=strict, ReadWritePaths=/app, PrivateTmp, NoNewPrivileges, etc.
For each site:
Create releases/<timestamp> and set current to it.
systemctl daemon-reload; systemctl restart site@<site>.
Validate:
From inside the site service, ls /srv/webalive/sites → should fail.
fs.readdirSync('/srv/webalive/sites') from app code → should fail.
Normal app behavior unchanged.
Week 1: Optional AppArmor + Bridge scan

Add a small AppArmor profile per site; start in complain mode; review logs; switch to enforce.
Add the minimal code scan to Claude Bridge on Write/Edit; ship with a warning + deny-by-default policy for obvious workspace escapes, with manager override.
Week 2: Deploy workflow polish

Adopt releases/current symlink per site if not already.
Implement “Deploy” button to:
Build into releases/<ts>
Update current symlink atomically
Restart service
Keep 5–10 releases; add a “Rollback” button
Add a quick deploy log viewer and health check.
Operational template (systemd unit essentials)

User=site-%i
WorkingDirectory=/app
ExecStart=/usr/bin/env bash -lc 'NODE_ENV=production bun start' (or your command)
UMask=007
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ReadWritePaths=/app
BindPaths=/srv/webalive/sites/%i/current:/app
InaccessiblePaths=/srv/webalive/sites
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
LockPersonality=yes
RestrictRealtime=yes
Restart=on-failure
Note: If you enable AppArmor, wrap ExecStart with aa-exec -p site-%i or attach a profile that matches the binary path.

Testing checklist (fast, reliable)

As site user:
ls /srv/webalive/sites → Permission denied
cat /srv/webalive/sites/other-site/user/package.json → Permission denied
Node code: fs.readdirSync('/srv/webalive/sites') → throws
Normal ops:
Vite dev server runs, hot reload works
Bun/Node can read node_modules and write under /app
Deploy button does an atomic switch; rollback works
Monitoring:
journald shows clear denials if code attempts to read forbidden paths
If AppArmor: aa-status shows profiles loaded; denials visible in syslog
Risks and mitigations

Some code may reference absolute paths under /srv/webalive/sites. With the new namespace, those calls will fail. Migration: use /app as the root and pass that to utilities, or keep relative paths.
Overly strict systemd filters can break inotify/file watchers. If so, relax only the specific restriction; keep the rest.
AppArmor availability: enabled by default on Ubuntu; otherwise skip and rely on systemd sandboxing.
Cost and performance

No new infrastructure. No Docker. No second machine.
Startup overhead: negligible. Memory/CPU unchanged.
Admin overhead: a single service template, a one-time permissions sweep, and two short scripts (deploy and rollback).
What changes for developers

Nothing material. Their code lives under /app (which is their site workspace). Path assumptions become cleaner.
Deploy is faster and safer: one click, atomic switch, instant rollback.
What changes for users

The “Deploy” button pushes to live immediately, safely, and atomically.
Isolation is stronger by default. Mistakes in one site can’t leak another.
Appendix: small checklists

Immediate commands

chmod 711 /srv/webalive/sites
find /srv/webalive/sites -maxdepth 1 -type d -exec chmod 750 {} ;
systemctl daemon-reload; systemctl restart site@<site> (after updating UMask)
Audit:
find /srv/webalive/sites -type d -perm -o=r -print
find /srv/webalive/sites -type f -perm -o=r -print
Deploy script outline

TS=$(date +%Y%m%d-%H%M%S)
DEST=/srv/webalive/sites/<site>/releases/$TS
mkdir -p "$DEST"
rsync -a --delete /srv/webalive/sites/<site>/user/ "$DEST/user/"
ln -sfn "$DEST" /srv/webalive/sites/<site>/current
systemctl restart site@<site>
Closing thought
Small, uniform, kernel-enforced boundaries are the highest ROI change here. Binding each site to /app and making the rest of /srv/webalive/sites invisible turns your intended isolation into actual isolation—without new tech, cost, or operational load. It’s the kind of constraint that makes everything else simpler: fewer footguns, fewer exceptions, and a platform that stays fast while being safely multi-tenant.