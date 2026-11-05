import type { CommandDefinition } from './types.js';

export const factoryLoopCommand: CommandDefinition = {
  name: 'factory-loop',
  description: 'Run the outer loop once, collecting friction signals and opening at most one skill-improvement PR',
  argumentHint: '[--since 14d]',
  action: async (ctx, ...args) => {
    const windowArg = args.find((a) => !a.startsWith('-')) || '14d';

    const prompt = `Use the skill-feedback-loop skill with analysis window: ${windowArg}.

Autonomous Outer Loop Procedure:
1. Work in a fresh, isolated worktree (worktree-isolation).
2. Record the run with 'run-ledger --class loop'.
3. Run signals collection. If nothing qualifies under threshold, report the signals table and STOP.
4. If a skill qualifies:
   - Diagnose the owning skill from repeated corrections and friction entries.
   - Formulate minimal surgical proposal file.
   - Apply the fix to skills/<name>/SKILL.md.
   - Open exactly ONE pull request labeled 'factory:skill-loop'.
5. NEVER auto-merge the loop PR. A human must review all skill updates.`;

    if (ctx.session?.sendPrompt) {
      await ctx.session.sendPrompt({
        role: 'system',
        content: prompt,
      });
    }

    return `Initiated Software Factory outer feedback loop (window: ${windowArg}).`;
  },
};
