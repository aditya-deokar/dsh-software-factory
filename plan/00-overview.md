# DeepSeek Harness Plugin: Software Factory (`dsh-software-factory`)
## Master Implementation Plan & Architecture Roadmap

This document serves as the master blueprint and navigation index for building the official **DeepSeek Harness (`dsh`)** plugin based on **Software Factory** ([`aditya-deokar/software-factory`](https://github.com/aditya-deokar/software-factory), `@software-factory/skills`).

---

### Executive Summary

**DeepSeek Harness (`dsh`)** is an agentic harness built entirely on the **Cordis** microkernel architecture (*"everything is a plugin"*). Software Factory is a self-improving software development factory for AI coding agents, providing an 8-beat inner loop (Triage → Aim → Spec → Isolate → Build → Prove → Ship → Monitor), an outer loop for continuous learning and skill self-repair (Record → Remember → Route → Improve), 19 specialized skills, 6 slash commands, and strict governance hooks.

This project packages Software Factory as a native DeepSeek Harness plugin (`@software-factory/dsh-plugin` or `dsh-software-factory`), enabling DeepSeek models (such as DeepSeek-V3, DeepSeek-R1, and hybrid variants) to execute disciplined, self-improving software development with verifiable evidence, isolated worktrees, and safety guardrails.

---

### Implementation Plan Index

The implementation plan is structured into eight detailed, phase-wise specification documents:

| File | Phase / Topic | Focus & Deliverables |
|---|---|---|
| [**`01-architecture-and-cordis-mapping.md`**](./01-architecture-and-cordis-mapping.md) | **Architecture & Concept Mapping** | Cordis microkernel deep-dive, Seams pattern (Definition, Provider, Consumer), event streams, mapping 19 skills, 6 slash commands, and 3 hooks to DSH primitives. |
| [**`02-phase-1-project-scaffolding-and-core-service.md`**](./02-phase-1-project-scaffolding-and-core-service.md) | **Phase 1: Scaffolding & Core Service** | Monorepo/project structure, TypeScript config, `@deepseek-ai/cordis` setup, `SoftwareFactoryService` declaration, config schema, and `cordis.yml`. |
| [**`03-phase-2-lifecycle-hooks-and-governance.md`**](./03-phase-2-lifecycle-hooks-and-governance.md) | **Phase 2: Lifecycle & Safety Hooks** | SessionStart context injection (memory + open runs), PreToolUse safety guard (`guard-push` against main/unleased force-push), Stop ledger check, and `AGENTS.md` auto-sync. |
| [**`04-phase-3-slash-commands-and-agent-modes.md`**](./04-phase-3-slash-commands-and-agent-modes.md) | **Phase 3: Slash Commands & Workflows** | Implementation of `/triage`, `/aim`, `/spec`, `/factory-loop`, `/factory-report`, and `/sidecar` using Cordis `ctx.command()` and DSH subagent protocols. |
| [**`05-phase-4-native-tools-and-ptc-integration.md`**](./05-phase-4-native-tools-and-ptc-integration.md) | **Phase 4: Native Tools & PTC Engine** | Registering native tools (`ctx.tools.register`), Programmatic Tool Calling (PTC) orchestration, worktree isolation, test evidence recording, and review scoring. |
| [**`06-phase-5-outer-loop-memory-and-telemetry.md`**](./06-phase-5-outer-loop-memory-and-telemetry.md) | **Phase 5: Outer Loop & Telemetry** | Run Ledger (`.factory/runs`), Agent Memory (`.factory/memory`), Dynamic Model Routing (`.factory/routing.json`), and autonomous skill self-improvement loop. |
| [**`07-phase-6-web-ui-testing-and-distribution.md`**](./07-phase-6-web-ui-testing-and-distribution.md) | **Phase 6: Web UI, Testing & Release** | DSH Web UI panels (trajectory viewer, run dashboard), unit/integration test suites, Cordis bundle packaging, DSH Market indexing (`dsh-plugin`), and Creator Mode compatibility. |
| [**`08-migration-and-skill-bridge.md`**](./08-migration-and-skill-bridge.md) | **Skill Bridge & Ecosystem Sync** | Dynamic bridge for `npx skills add aditya-deokar/software-factory`, cross-agent synchronization, and dual CLI/Harness compatibility. |

---

### Core Architecture Bridge: Software Factory ➔ Cordis / DSH

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   DEEPSEEK HARNESS (DSH) RUNTIME                       │
│                                                                        │
│   ┌────────────────────────── CORDIS KERNEL ───────────────────────┐   │
│   │                                                                │   │
│   │   [Event Bus]  [Dependency Injection]  [Service Lifecycle]     │   │
│   │                                                                │   │
│   │   ┌────────────────────────────────────────────────────────┐   │   │
│   │   │    SOFTWARE FACTORY PLUGIN (SoftwareFactoryService)    │   │   │
│   │   │                                                        │   │   │
│   │   │  * Session Interceptors: Memory Inject, Push Guard     │   │   │
│   │   │  * Slash Commands: /triage, /aim, /spec, /sidecar...   │   │   │
│   │   │  * Native Tools: Worktree, Evidence, Ledger, Review    │   │   │
│   │   │  * PTC Integration: JS/Py Multi-step Workflows         │   │   │
│   │   │  * Outer Loop: Telemetry, Memory Prune, Self-Heal      │   │   │
│   │   │  * UI Widgets: Trajectory Viewer, Run Dashboard        │   │   │
│   │   └────────────────────────────────────────────────────────┘   │   │
│   │                                                                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   Storage: Workspace Root / .factory/ (runs, memory, routing, config)  │
│   Workflow Spec: AGENTS.md (idempotent 2-marker self-sync)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Key Milestones & Phased Timeline

- **Milestone 1 (Foundations & Safety):** Phases 1 & 2 complete. The plugin installs cleanly into `cordis.yml`, intercepts DSH sessions, injects memory and routing context, and prevents dangerous git operations.
- **Milestone 2 (Workflow Automation):** Phases 3 & 4 complete. Full suite of slash commands and native factory tools available to DeepSeek models in both CLI and Web UI.
- **Milestone 3 (Self-Improving Engine):** Phase 5 complete. Autonomous feedback loop, run ledger reporting, memory graduation, and automated skill patch PR generation.
- **Milestone 4 (Production Polish & Ecosystem):** Phases 6 & 7 complete. Web UI dashboard panels active, high-coverage test suite passing, packaged to npm and listed on DSH Plugin Hub.
