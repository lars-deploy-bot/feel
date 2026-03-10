# E2B Live Capacity Report

Date: 2026-03-09
Host: `webs`

## Scope

This report combines:

- live queries against the running E2B deployment on this host
- direct host inspection of Firecracker, cgroups, NBD devices, and sandbox cache state
- upstream E2B and Firecracker source/docs

Secrets were used to query local services but are intentionally omitted here.

## Executive Summary

- The live E2B deployment on this host is not configured for `8` concurrent sandboxes. The live tier limit is `50` concurrent sandboxes and `20` concurrent template builds.
- This host is also not capped at `8` by NBD device count or hugepage pool size. `nbds_max=4096`, and the hugepage pool is `29618` x `2 MiB` pages (`~57.8 GiB` total, `~55.7 GiB` free at query time).
- The more important live problem is control-plane drift:
  - `GET /sandboxes` for the seeded local-dev team returns `[]`
  - `public.snapshots` is empty
  - but the host still has `5` live Firecracker processes, `8` Firecracker socket files, `8` sandbox rootfs link files, and `9` sandbox cgroups under `/sys/fs/cgroup/e2b/`
- Current sandbox cgroups are not enforcing hard host limits. For all inspected cgroups, `memory.max=max` and `cpu.max=max`.
- The current local E2B build profiles are mostly `2 vCPU / 1024 MiB / ~3.5-4.1 GiB disk`, plus one older `512 MiB` variant.
- The practical scaling risk on this host is not a neat entitlement ceiling. It is:
  - stale/orphaned sandbox state
  - missing hard host limits
  - high existing host pressure from other services
  - Alive's current sticky long-lived sandbox model

## What Was Queried

### Live services

Active systemd units:

- `e2b-api.service`
- `e2b-client-proxy.service`
- `e2b-dashboard-api.service`
- `e2b-infra.service`
- `e2b-orchestrator.service`
- `e2b-terminal.service`

Observed listeners:

- `3000` - E2B API
- `5008` - Orchestrator
- `5010` - Orchestrator
- `5075` - E2B terminal bridge
- local Postgres and Redis for the E2B stack

Relevant unit wiring:

- API unit uses [packages/api/.env.local](/root/e2b/infra/packages/api/.env.local)
- Orchestrator unit uses [packages/orchestrator/.env.local](/root/e2b/infra/packages/orchestrator/.env.local)
- Client proxy unit uses [packages/client-proxy/.env.local](/root/e2b/infra/packages/client-proxy/.env.local)

### Live API

- `curl http://127.0.0.1:3000/health` returned success.
- `GET /sandboxes` with the seeded local-dev team API key returned `[]`.
- `GET /v2/sandboxes?limit=100` with the same key also returned `[]`.

This means the local-dev team is not currently seeing active sandboxes through the public API.

### Live database

The live E2B Postgres is configured at `localhost:5434`.

Queried rows:

- `public.tiers`
- `public.team_limits`
- `public.teams`
- `public.env_builds`
- `public.envs`
- `public.snapshots`

Results:

- `public.tiers`:
  - `base_v1`
  - `concurrent_instances=50`
  - `concurrent_template_builds=20`
  - `max_vcpu=8`
  - `max_ram_mb=8192`
  - `disk_mb=512`
- `public.team_limits` for the live teams all reflect `50` concurrent sandboxes and `20` concurrent template builds.
- `public.snapshots` currently has no rows.
- `public.env_builds` shows recent uploaded builds with:
  - mostly `2 vCPU / 1024 MiB / ~3.5-4.1 GiB disk`
  - one older `2 vCPU / 512 MiB / 2.9 GiB disk`
- `public.envs` shows recent `spawn_count` activity for the local-dev team.

## Live Host State

### Host capacity

At query time:

- CPUs: `12`
- RAM: `125 GiB`
- `MemAvailable`: `~23 GiB`
- Swap: `4 GiB`, effectively exhausted
- Root disk free: `647 GiB`

Hugepages:

- `HugePages_Total=29618`
- `HugePages_Free=28527`
- `Hugepagesize=2048 kB`

NBD:

- `/sys/module/nbd/parameters/nbds_max=4096`

### Firecracker and sandbox artifacts

Observed:

- `5` live Firecracker processes
- `8` Firecracker socket files in `/tmp/fc-*.sock`
- `8` sandbox-cache rootfs link files in [sandbox-cache-dir](/root/e2b/infra/packages/orchestrator/tmp/sandbox-cache-dir)
- `9` cgroup directories under `/sys/fs/cgroup/e2b/`

The running Firecracker processes map to cgroups like:

- `/e2b/sbx-ioskhzvydezrv092fep9j`
- `/e2b/sbx-ihxk3qfwiz4ln67yizz7g`
- `/e2b/sbx-iwsysis1m035cca7eqvep`
- `/e2b/sbx-i4kosm4yme7b3jex9pnyy`
- `/e2b/sbx-iwqi1r2sowo8vyeu8t57p`

There are also cgroups with no attached process:

- `sbx-i0c1pds6dagyb4ie45yhb`
- `sbx-ibtmz7kvb6kwlwl1h3q4w`
- `sbx-ilay1vvs1z9h2c5382v2n`
- `sbx-iui3rrvhy55orn19zqvpc`

This is strong evidence of stale sandbox artifacts remaining on the host after the API stopped reporting them.

### Current cgroup enforcement

For every inspected sandbox cgroup:

- `memory.max=max`
- `cpu.max=max 100000`

Meaning:

- there is no hard memory ceiling enforced at the host cgroup layer
- there is no hard CPU quota enforced at the host cgroup layer

Important nuance:

- `memory.current` was small for these cgroups, but that does not mean the guest is tiny
- Firecracker can keep guest memory lazily mapped, so the important signal here is not current RSS
- the important signal is the absence of hard limits

## Upstream Verification

### Tier and concurrency limits are real

Upstream E2B enforces team sandbox concurrency in the API create path and returns `429` when exceeded. Template build concurrency is enforced separately.

### NBD pool is real, but not the current ceiling here

Upstream E2B:

- explicitly uses an NBD device pool
- reads `/sys/module/nbd/parameters/nbds_max`
- recommends raising `nbds_max`
- sets `nbds_max=4096` in its client bootstrap

So NBD is a real scaling dimension, but on this host it is not the reason for a hard cap at `8`.

### Network pool is not naturally `8`

In the main orchestrator:

- network pool buffers are `32` new slots and `100` reused slots
- slot capacity is derived from the sandbox CIDR
- the default virtual network CIDR is `/16`

So the mainline network design does not imply a hard cap of `8`.

### Hugepages are real, but the failure mode is different

Firecracker documents:

- 2 MiB hugepage backing
- need for a preallocated host pool
- undersized pools can cause erratic behavior or `SIGBUS`
- hugepage-backed snapshots must restore with hugepages
- ballooning cannot reclaim hugepage backing to reduce RSS

That does not match a neat entitlement ceiling at `8`, especially not on this host's current hugepage pool size.

## Diagnosis of the "8 Sandboxes" Theory

### What is false on this host

The live `8` cap is not explained by:

- team concurrency limit
- template build concurrency limit
- `nbds_max`
- hugepage pool size

Those values are currently:

- `50` concurrent sandboxes
- `20` concurrent template builds
- `4096` NBD devices
- `~57.8 GiB` hugepage pool

### What is more plausible

The more plausible explanation is control-plane drift and leaked runtime artifacts:

- the public API for the seeded team sees `0` sandboxes
- the database snapshot inventory sees `0` rows
- the host still holds live Firecracker processes, stale sockets, stale cgroups, and stale sandbox cache links

Inference:

- the neat `8` pattern likely came from leaked sandbox artifacts on the host, not from an intended product limit
- that needs to be treated as an inventory/reconciliation bug before any serious scaling discussion

## Alive-Specific Implication

Alive's current E2B manager in [manager.ts](/root/alive/packages/sandbox/src/manager.ts) still assumes sticky long-lived sandboxes:

- default timeout is `30 days`
- sandboxes are cached per domain
- reconnect/create logic is oriented around persistence, not active-set scheduling

That is the wrong default if the goal is:

- secure untrusted execution
- high density on one host
- predictable rollback and release management

## Huurmatcher Implication

Huurmatcher's current host runtime process is already around `1.3 GiB` RSS.

So for Huurmatcher-class apps:

- a `1 GiB` runtime VM is already too optimistic
- a `2 GiB` runtime class is the safer starting point
- build sandboxes should be treated separately from runtime sandboxes

## Recommended Operating Model

On this shared host, the first sane model is:

1. Build/dev sandboxes:
   - `4 vCPU / 6 GiB / 25 GiB`
   - concurrency `1`

2. Huurmatcher-class runtime sandboxes:
   - `2 vCPU / 2 GiB / 10 GiB`
   - small hot set only

3. Lightweight runtime sandboxes:
   - `1 vCPU / 768 MiB-1 GiB / 6 GiB`

4. Static/exportable sites:
   - no VM at all

5. Cold path:
   - pause/snapshot for dev sandboxes and dormant previews
   - not for public sites that must answer instantly

Given the host's current `MemAvailable` and exhausted swap, I would not plan for more than about:

- `1` active Huurmatcher-class build sandbox
- `4` hot Huurmatcher-class runtime sandboxes

until the existing host services are reduced or moved.

## Immediate Problems To Fix

Before broadening E2B use on Alive:

1. Add reconciliation between API inventory and host reality.
2. Add sandbox reaping for dead sockets, dead cgroups, and stale sandbox-cache links.
3. Enforce hard `memory.max` and `cpu.max` for sandbox cgroups.
4. Expose a single trustworthy inventory endpoint for "what is actually running now".
5. Move Alive off the sticky 30-day sandbox default toward `hot set + cold set`.

## Sources

External primary sources:

- <https://github.com/e2b-dev/infra/blob/main/packages/api/internal/orchestrator/create_instance.go>
- <https://github.com/e2b-dev/infra/blob/main/packages/api/internal/template/register_build.go>
- <https://github.com/e2b-dev/infra/blob/main/packages/db/migrations/20231124185944_create_schemas_and_tables.sql>
- <https://github.com/e2b-dev/infra/blob/main/packages/orchestrator/internal/sandbox/nbd/pool.go>
- <https://github.com/e2b-dev/infra/blob/main/iac/provider-gcp/nomad-cluster/scripts/start-client.sh>
- <https://github.com/e2b-dev/infra/blob/main/packages/orchestrator/internal/sandbox/network/pool.go>
- <https://github.com/e2b-dev/infra/blob/main/packages/orchestrator/internal/sandbox/network/slot.go>
- <https://e2b.dev/docs/sandbox/persistence>
- <https://e2b.dev/docs/sandbox/snapshots>
- <https://github.com/firecracker-microvm/firecracker/blob/main/README.md>
- <https://github.com/firecracker-microvm/firecracker/blob/main/docs/hugepages.md>
- <https://github.com/firecracker-microvm/firecracker/blob/main/docs/ballooning.md>
- <https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md>
- <https://docs.kernel.org/admin-guide/blockdev/nbd.html>

Local Alive references:

- [packages/sandbox/src/manager.ts](/root/alive/packages/sandbox/src/manager.ts)
