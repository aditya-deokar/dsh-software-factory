# dsh-software-factory

**DeepSeek Harness (`dsh`) plugin for Software Factory** ([`aditya-deokar/software-factory`](https://github.com/aditya-deokar/software-factory)).

Self-improving software factory for DeepSeek coding agents: triage, spec, isolate, build, prove, ship, and monitor, backed by an outer loop that records metrics, remembers invariants, routes work across model tiers, and proposes skill fixes as reviewed PRs.

---

## Architecture & Quick Start

Built on the **Cordis** microkernel framework.

### Mounting in DeepSeek Harness

Add to `cordis.yml`:

```yaml
plugins:
  dsh-software-factory:
    enabled: true
    autoSyncAgentsMd: auto
    defaultRoutingTier: balanced
    enforceWorktreeIsolation: true
    guardGitPush: true
    memoryBudgetTokens: 4096
```

Or install via CLI:

```bash
dsh plugin add dsh-software-factory
```

---

## Development

```bash
npm install
npm run build
npm test
```
