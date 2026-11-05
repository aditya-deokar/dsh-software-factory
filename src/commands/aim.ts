import type { CommandDefinition } from './types.js';

export const aimCommand: CommandDefinition = {
  name: 'aim',
  description: "Raise a task's target before building it - goal beyond the goal, the rung to take, a hard target, and an outside judge",
  argumentHint: '<issue number, task, or prompt to improve>',
  action: async (ctx, ...args) => {
    const target = args.join(' ').trim() || 'the most recent request';

    const prompt = `Use the ambition-engine skill for: ${target}

Apply Felix Rieseberg's types of ambition:
1. Altitude: Goal beyond the goal as a 3-rung ladder.
2. Depth: The professional standard the field's best would hold, based on raw data.
3. Range: Methods from adjacent fields applied concretely.

Strict Rules:
- Name an OUTSIDE JUDGE before writing any code.
- Take only ONE rung that fits the task's size for the current PR.
- File the rungs above it as separate issues instead of building them now.
- End with the rewritten prompt and STOP.`;

    if (ctx.session?.sendPrompt) {
      await ctx.session.sendPrompt({
        role: 'system',
        content: prompt,
      });
    }

    return `Configured ambition engine for: ${target}\n\nCalculating ambition ladder and establishing outside judge criteria.`;
  },
};
