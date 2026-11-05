# 01 - Architecture and Cordis Mapping

## 1. DeepSeek Harness (`dsh`) & Cordis Microkernel Primer

**DeepSeek Harness (`dsh`)** is an open-source, extensible agent runtime engineered specifically for reasoning and coding models (DeepSeek-V3, DeepSeek-R1, and hybrid variants). Unlike monolithic CLI runners, DSH is architected around the **Cordis** microkernel, where every subsystem—LLM providers, tool pipelines, session runners, sandbox environments, and Web UI components—is a composable plugin.

### 1.1 The Cordis Core Concepts

1. **Context (`ctx: Context`)**:
   - The fundamental hierarchical scope. Every plugin runs in a subcontext with its own lifecycle, dependencies, and configuration.
   - Subcontexts allow scoped resource management: when a plugin is reloaded or unmounted, all event listeners, timers, tools, and commands registered in its context are automatically torn down without memory leaks.

2. **The Plugin Signature (`apply(ctx: Context, config: Config)`)**:
   - Plugins can be structured either as functional modules or as subclassed `Service` instances:
     ```typescript
     import { Context, Schema } from '@deepseek-ai/cordis';

     export interface Config {
       autoSyncAgentsMd?: boolean;
       defaultRoutingTier?: 'fast' | 'balanced' | 'frontier';
     }

     export const Config: Schema<Config> = Schema.object({
       autoSyncAgentsMd: Schema.boolean().default(true),
       defaultRoutingTier: Schema.union(['fast', 'balanced', 'frontier']).default('balanced'),
     });

     export const name = 'software-factory';
     export const inject = ['tools', 'commands', 'session', 'git'];

     export function apply(ctx: Context, config: Config) {
       // Plugin activation
       ctx.on('session/start', async (session) => { ... });
     }
     ```

3. **Spatiotemporal Composability**:
   - Plugins can be loaded, configured, swapped, and unloaded at runtime without restarting the DSH process.
   - Hot-reloading enables dynamic modification of factory rules, memory indexes, and model routing policies.

4. **The Three-Role "Seams" Pattern**:
   - **Service Definition**: Defines TypeScript interfaces and service keys (e.g., `declare module '@deepseek-ai/cordis' { interface Context { factory: SoftwareFactoryService } }`).
   - **Service Provider**: Implements and provides the service instance to Cordis via `ctx.provide('factory')`.
   - **Service Consumer**: Other plugins, tools, slash commands, or the LLM agent loop consume the service through `ctx.factory`.

---

## 2. Mapping Software Factory Components to Cordis & DSH

The Software Factory ecosystem consists of three major layers:
1. **The Inner & Outer Loop Workflow** (documented in `AGENTS.md` and executed via 19 skills).
2. **Governance Hooks** (SessionStart context loader, PreToolUse push safety guard, Stop ledger checker).
3. **Slash Commands** (`/triage`, `/aim`, `/spec`, `/factory-loop`, `/factory-report`, `/sidecar`).

Here is how each Software Factory primitive maps to DSH and Cordis:

| Software Factory Primitive | Claude/Codex Plugin Mechanism | DeepSeek Harness / Cordis Mechanism |
|---|---|---|
| **SessionStart Hook** | `hooks.json` ➔ `node hooks/session-start.mjs` | `ctx.on('session/start', async (session) => { ... })` injecting memory index and active run context into system prompt. |
| **PreToolUse Hook (`guard-push`)** | `hooks.json` ➔ `node hooks/guard-push.mjs` | `ctx.on('tool/before-call', async (call) => { ... })` or Cordis Tool Middleware intercepting Bash/Terminal commands. |
| **Stop Hook (`stop-ledger`)** | `hooks.json` ➔ `node hooks/stop-ledger.mjs` | `ctx.on('session/before-stop', async (session) => { ... })` validating unfinished runs in `.factory/runs/`. |
| **Slash Commands** (`/triage`, `/aim`, etc.) | Markdown command files (`commands/*.md`) | `ctx.command('factory/triage', ...)`, `ctx.command('factory/aim', ...)` registered into DSH command registry. |
| **Subagent Spawning (`/sidecar`)** | Spawns child agent with read-only contract | `ctx.agent.spawn({ role: 'sidecar', readOnly: true, tier: 'balanced' })` using DSH Agent System. |
| **Native Skills (19 skills)** | `skills/*/SKILL.md` + scripts | Registered as DSH Cordis Tools (`ctx.tools.register`) and Prompt Skill definitions in DSH Skill Catalog. |
| **Worktree Isolation** | `skills/worktree-isolation/` | Integrated with DSH workspace/worktree service or Git service seam. |
| **Run Ledger & Memory** | `.factory/runs/`, `.factory/memory/` | Managed by `SoftwareFactoryService` with automatic SQLite/JSON-LD cache. |
| **Programmatic Tool Calling (PTC)** | Custom Node/Python invocation | Native DSH PTC engine: DeepSeek-V3/R1 generates executable JS/Python blocks orchestrating factory steps. |

---

## 3. High-Level Component Interaction Diagram

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      DeepSeek Harness Runtime                          │
 │                                                                        │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │                         Cordis Kernel                            │  │
 │  │                                                                  │  │
 │  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐  │  │
 │  │  │   Git Seam    │  │ Tool Pipeline │  │ Agent Session Seam   │  │  │
 │  │  └───────▲───────┘  └───────▲───────┘  └──────────▲───────────┘  │  │
 │  │          │                  │                     │              │  │
 │  │  ┌───────┴──────────────────┴─────────────────────┴───────────┐  │  │
 │  │  │         SoftwareFactoryService (dsh-software-factory)      │  │  │
 │  │  │                                                            │  │  │
 │  │  │  [Hooks & Governance]                                      │  │  │
 │  │  │   ├── session/start      -> Injects Memory & Active Run    │  │  │
 │  │  │   ├── tool/before-call   -> guard-push blocks main/force   │  │  │
 │  │  │   └── session/before-stop-> Verifies run ledger completion │  │  │
 │  │  │                                                            │  │  │
 │  │  │  [Slash Commands & Prompts]                                │  │  │
 │  │  │   ├── /triage, /aim, /spec, /factory-loop                  │  │  │
 │  │  │   └── /sidecar (spawns isolated read-only child agent)     │  │  │
 │  │  │                                                            │  │  │
 │  │  │  [Tools & PTC Bindings]                                    │  │  │
 │  │  │   ├── factory_worktree_create / isolate                    │  │  │
 │  │  │   ├── factory_test_evidence (record & verify)              │  │  │
 │  │  │   ├── factory_review_loop (Greptile 5/5 confidence)        │  │  │
 │  │  │   └── factory_ledger_record                                │  │  │
 │  │  │                                                            │  │  │
 │  │  │  [Autonomous Engine]                                       │  │  │
 │  │  │   ├── Memory Graduation (used 3x -> skill candidate)       │  │  │
 │  │  │   ├── Dynamic Model Routing (tier mapping & eval)          │  │  │
 │  │  │   └── Outer Loop Feedback (skill patch PR proposal)        │  │  │
 │  │  └───────────────────────────────┬────────────────────────────┘  │  │
 │  └──────────────────────────────────┼───────────────────────────────┘  │
 │                                     ▼                                  │
 │         Workspace Root: .factory/ (runs, memory, routing, config)      │
 │                         AGENTS.md (idempotent synchronized contract)   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Differences & Enhancements for DeepSeek Harness

When adapting Software Factory from standard CLI agents (Claude Code, Cursor, Copilot) to DeepSeek Harness:

1. **First-Class Subagents**: DeepSeek Harness supports native multi-agent topologies. The `/sidecar` command can be executed as a true, sandboxed, parallel sub-session with distinct memory limits and zero-write guarantees, rather than relying solely on prompt persuasion.
2. **Programmatic Tool Calling (PTC)**: DeepSeek models natively leverage PTC to chain multiple tools (e.g., create worktree -> run build -> run tests -> capture evidence -> write ledger entry) in a single reasoning step, drastically reducing round-trip latency and token overhead.
3. **Structured Web UI Integration**: DeepSeek Harness has both a CLI and a Web UI. The plugin can contribute trajectory viewer panes, run ledger status dashboards, and memory graph inspectors directly into the DSH Web UI.
4. **Hot-Reloadable Profiles**: In DSH, plugins can be organized into profiles (e.g., `web`, `headless`, `production-eval`). Teams can enable Software Factory globally or per-repository with `dsh plugin --profile default add dsh-software-factory`.
