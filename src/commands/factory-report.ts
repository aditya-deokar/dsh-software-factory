import { join } from 'node:path';
import type { CommandDefinition } from './types.js';
import { loadRunsFromDir, generateReport, formatReportMarkdown } from '../lib/report.js';

export const factoryReportCommand: CommandDefinition = {
  name: 'factory-report',
  description: 'Show how the factory is doing from the run ledger and friction metrics',
  argumentHint: '[14d | 30d | all]',
  action: async (ctx, ...args) => {
    const window = args[0] || '14d';
    const root = ctx.session?.workspaceRoot || process.cwd();
    const runsDir = join(root, '.factory', 'runs');

    const runs = loadRunsFromDir(runsDir);
    if (!runs.length) {
      return `### Software Factory Report (${window})\n\n_No runs found in ${runsDir}._`;
    }

    const report = generateReport(runs, window);
    return formatReportMarkdown(report, window);
  },
};
