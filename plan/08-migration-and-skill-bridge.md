# 08 - Migration and Skill Bridge

## 1. Goal & Objectives
Software Factory is already published as a popular universal skill package ([`@software-factory/skills`](https://www.npmjs.com/package/@software-factory/skills)) that users install via:
```bash
npx skills add aditya-deokar/software-factory
```

The DeepSeek Harness plugin (`dsh-software-factory`) must provide seamless backwards and bidirectional compatibility:
1. **Dynamic Skill Loader Bridge**: Allow `dsh-software-factory` to dynamically resolve, expose, and run the 19 skills from `@software-factory/skills` or `.agents/skills/`.
2. **Dual-Environment Support**: Ensure that a repository configured for Claude Code, Cursor, Copilot, or OpenCode works identically and without conflict when opened in DeepSeek Harness.
3. **Idempotent AGENTS.md Coexistence**: Guarantee that both the `npx skills` installer and the `dsh` Cordis plugin share the exact same two-marker section in `AGENTS.md`.

---

## 2. Bridging `npx skills` and Cordis Tools

When `npx skills add aditya-deokar/software-factory` is executed in a repository, skills are unpacked into `.agents/skills/*` or `~/.agents/skills/*`.

The DSH plugin implements a bridge (`src/lib/skill-bridge.ts`) that automatically discovers these skill directories and exposes them to the DeepSeek Harness skill catalog:

```typescript
import { Context } from '@deepseek-ai/cordis';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function registerSkillBridge(ctx: Context) {
  const root = ctx.softwareFactory.rootDir;
  const candidateDirs = [
    join(root, '.agents', 'skills'),
    join(root, '.claude', 'skills'),
    join(root, 'node_modules', '@software-factory', 'skills', 'skills'),
  ];

  for (const dir of candidateDirs) {
    if (!existsSync(dir)) continue;

    const skillFolders = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const skillName of skillFolders) {
      const skillMdPath = join(dir, skillName, 'SKILL.md');
      if (existsSync(skillMdPath)) {
        const content = readFileSync(skillMdPath, 'utf8');
        // Register dynamically into DSH Skill registry
        ctx.emit('skill/register', {
          name: skillName,
          source: 'software-factory-bridge',
          instructions: content,
        });
        ctx.logger.debug(`Bridged skill into DSH: ${skillName}`);
      }
    }
    break; // Use highest priority discovered directory
  }
}
```

---

## 3. Unified Setup Command

To make setup frictionless for DeepSeek Harness developers, the plugin registers a setup command:
```bash
/factory-setup
```
or via DSH CLI:
```bash
dsh factory setup
```

This runs the idempotent `setup.mjs` script from `factory-setup`, creating:
- `.factory/` directory structure (`runs/`, `memory/`, `evidence/`)
- `.factory/routing.json` initialized with DeepSeek model tiers (V3, R1)
- `.factory/config.json`
- Synchronizes the Software Factory contract block in `AGENTS.md`.

---

## 4. Cross-Agent Compatibility Matrix

| Feature | Claude Code | Cursor | OpenCode | DeepSeek Harness (`dsh`) |
|---|---|---|---|---|
| **Skills Execution** | Via Agent Skills CLI | Via `.cursorrules` / `.agents` | Native OpenCode Skills | Native Cordis Tool & Skill Bridge |
| **SessionStart Hook** | `hooks.json` | Not supported | Session Start Event | `ctx.on('session/start')` |
| **Push Safety Guard** | `hooks.json` (PreToolUse) | Manual | Middleware | `ctx.on('tool/before-call')` |
| **Slash Commands** | Supported (`commands/`) | Prompt only | OpenCode Commands | `ctx.command(...)` in DSH TUI & Web |
| **PTC Scripting** | Bash script | Bash script | JavaScript Code Mode | Native DeepSeek PTC (TypeScript/Python) |
| **Subagents** | Sequential | No | Subagent Tool | Sandboxed `session.spawnSubagent` |

---

## 5. Next Steps & Execution Roadmap

With the master architecture and phase specifications documented:
1. Initialize the `dsh-software-factory` package repository.
2. Implement Phase 1 & Phase 2 (Scaffolding, Cordis Service, Lifecycle Hooks).
3. Implement Phase 3 & Phase 4 (Slash Commands, Native Tools, PTC).
4. Implement Phase 5 & Phase 6 (Outer Loop, Web UI panels, Marketplace metadata).
5. Verify end-to-end execution against DeepSeek-V3 and DeepSeek-R1 test models.
