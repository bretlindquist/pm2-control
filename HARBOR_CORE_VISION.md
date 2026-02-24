# Captain’s Fabric / Harbor Core (Tabled for Later)

Status: **Idea parked intentionally** for reflection before implementation.
Date: 2026-02-24

## Big Direction

Evolve Command Harbor from a service dashboard into a local-first orchestration substrate:

- apps
- agents
- automations
- routes/devices
- policies/safety

all coordinated through one intent + state model.

## Working Concept

**Command Harbor** is the bridge UI.
**Harbor Core** is the orchestration engine under it.

## Proposed Architecture (v1 concept)

1. **State Graph (truth layer)**
   - Entities: services, routes, accounts, devices, workflows, policies
   - Canonical live state map

2. **Intent Engine (control layer)**
   - User/agent intents translated into executable actions
   - Examples: `ensure_online`, `open_context`, `prep_mode`, `switch_account`

3. **Policy + Safety Kernel**
   - Risk tiers, confirmation boundaries, blast-radius limits
   - Rollback rules and safe defaults

4. **Execution Mesh**
   - Adapters for PM2, Tailscale, CLI tools, agent tasks, browser flows
   - Unified event stream + audit trail

5. **Experience Layer**
   - Command Harbor UI
   - Chat interface
   - CLI surface
   - Future mobile/glance surfaces

## Why this matters

This shifts from "dashboard" to **Personal Mission OS**:
- local-first
- sovereign control
- composable automation
- human-in-the-loop safety

## Do Later (when resumed)

- Draft `harbor-core` bounded contexts and entity schema
- Define first 5 intents + adapters
- Define event model and persistence
- Build smallest end-to-end intent pipeline (`ensure_online`)
- Integrate Command Harbor as first client

## Table It

This is intentionally paused for deeper thinking and scope shaping before code.
