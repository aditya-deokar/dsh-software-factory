import type { CommandDefinition } from './types.js';

export const sidecarCommand: CommandDefinition = {
  name: 'sidecar',
  description: 'Spawn a read-only investigator that reports back without editing anything',
  argumentHint: '<question to investigate>',
  action: async (ctx, ...args) => {
    const question = args.join(' ').trim();
    if (!question) {
      return 'Please specify a question for the sidecar investigator to explore.';
    }

    const contract = `You are a read-only investigator in this repository. Investigate and report.
Do not fix anything, however small or obvious.

Question: ${question}

You may: read any file, search, run read-only git commands (status, log,
diff, show, blame), run existing tests, and read logs.

You may not: create, edit, or delete files; run formatters or autofixers;
switch, create, reset, rebase, or stash branches; add worktrees; push,
comment on, approve, or merge anything on GitHub.

Other agents may be editing this checkout right now. If a file changes while
you read it, report what you saw and when; do not "fix" it.

Report:
1. The answer in two or three sentences.
2. The evidence (file:line, command output).
3. What you could not determine and what would settle it.`;

    if (ctx.session?.spawnSubagent) {
      try {
        const subagent = await ctx.session.spawnSubagent({
          role: 'sidecar-investigator',
          tier: 'balanced',
          readOnly: true,
          systemPrompt: contract,
        });

        const res = await subagent.execute(question);
        return `### Sidecar Investigation Report\n\n${res.content}`;
      } catch (err: any) {
        return `Sidecar subagent spawned in fallback mode:\n\n${contract}`;
      }
    }

    // Direct return of instructions when host runtime handles dispatch
    return `### Read-Only Sidecar Contract Dispatched\n\n${contract}`;
  },
};
