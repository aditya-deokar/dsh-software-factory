# Software Factory Plugin Architecture & Creator Mode Guide

This document instructs **DeepSeek Harness (`dsh`)** when inspecting or editing this plugin in **Creator Mode**.

---

## 1. Core Architecture Invariants

- **Kernel**: Built exclusively on the **Cordis** microkernel (`@deepseek-ai/cordis`).
- **Everything is a Plugin**:
  - The plugin exports `name = 'software-factory'`, `Config`, and an `apply(ctx: Context, config: SoftwareFactoryConfig)` entrypoint.
  - Registers `SoftwareFactoryService` on `ctx.softwareFactory`.
- **Inner Loop Integrity**:
  - The 8 beats (`triage` -> `aim` -> `spec` -> `isolate` -> `build` -> `prove` -> `ship` -> `monitor`) are inviolate.
  - Changes to `AGENTS.md` are synchronized idempotently between `<!-- software-factory:begin -->` and `<!-- software-factory:end -->`.
- **Governance & Safety**:
  - `guard-push` MUST always block direct pushes to `main`/`master` and unleased force pushes (`--force` without `--force-with-lease`).
  - `session-start` injects memory from `.factory/memory/INDEX.md` and routing defaults into the session context.
  - `stop-ledger` audits active task branches for unfinished run records.

---

## 2. Programmatic Tool Calling (PTC) Protocol

DeepSeek models operating in PTC Mode can script multiple tool calls in sequence using TypeScript/JavaScript:

```typescript
// PTC snippet executing an isolated task run
const wt = await tools.factory_worktree({ action: 'create', taskName: 'fix-login' });
await tools.factory_ledger({ action: 'start', taskClass: 'bugfix', modelTier: 'balanced' });

// ... file edits ...

const proof = await tools.factory_evidence({
  command: 'npm test',
  judgeMetric: 'All tests green with 0 unhandled promise rejections',
  worktreeDir: wt.worktreePath
});

if (proof.status === 'VERIFIED') {
  await tools.factory_ledger({ action: 'finish', outcome: 'shipped', evidenceArtifact: proof.artifactPath });
}
```

---

## 3. Extending the Plugin in Creator Mode

When asked to add new skills, tools, or commands in Creator Mode:
1. Declare schemas in `src/config.ts` using `@deepseek-ai/schemastery`.
2. Register tools in `src/tools/index.ts` conforming to `ToolDefinition`.
3. Add slash commands in `src/commands/index.ts` conforming to `CommandDefinition`.
4. Run `npm test` and `npm run build` to verify that all Vitest test suites pass.
