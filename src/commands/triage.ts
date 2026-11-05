import type { CommandDefinition } from './types.js';

export const triageCommand: CommandDefinition = {
  name: 'triage',
  description: 'Triage an issue into exactly one decision (implement, spec, duplicate, needs-info, decline)',
  argumentHint: '<issue number, URL, or pasted report>',
  action: async (ctx, ...args) => {
    const target = args.join(' ').trim();
    if (!target) {
      return 'Please specify an issue number, URL, or pasted report to triage.';
    }

    const prompt = `Use the issue-triage skill on: ${target}

Search memory (.factory/memory/INDEX.md) and existing issues (including closed ones) before deciding.
Make exactly ONE decision:
- implement
- spec
- duplicate
- needs-info
- decline

Apply its factory:* label and post one comment with the reason.
If the repo has .factory/, record the run with run-ledger. Do NOT start fixing anything during triage.`;

    if (ctx.session?.sendPrompt) {
      await ctx.session.sendPrompt({
        role: 'system',
        content: prompt,
      });
    }

    return `Initiated issue triage for: ${target}\n\nDecision framework dispatched to agent loop.`;
  },
};
