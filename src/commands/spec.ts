import type { CommandDefinition } from './types.js';

export const specCommand: CommandDefinition = {
  name: 'spec',
  description: 'Write a product spec and a tech spec for an issue, open them for review, and stop',
  argumentHint: '<issue number or description>',
  action: async (ctx, ...args) => {
    const target = args.join(' ').trim();
    if (!target) {
      return 'Please specify an issue number or task description for the spec.';
    }

    const prompt = `Use the spec-writing skill for: ${target}

Structure:
1. Open Questions at the top, each with a recommended answer.
2. Product Spec: Invariants, user behavior, testable acceptance checks that test-evidence can prove.
3. Tech Spec: Boundary vs service split (service-layer), files touched, risk analysis.

Workflow Gate:
- Open the spec as a pull request labeled 'factory:spec'.
- Link it from the issue.
- STOP: Implementation code strictly waits for a human to approve the spec PR.`;

    if (ctx.session?.sendPrompt) {
      await ctx.session.sendPrompt({
        role: 'system',
        content: prompt,
      });
    }

    return `Drafting formal product & tech spec for: ${target}\n\nCode changes will remain blocked until approval.`;
  },
};
