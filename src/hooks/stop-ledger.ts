import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { currentBranch, listFiles, readJson } from '../lib/factory.js';

export interface StopAuditResult {
  hasUnfinishedRuns: boolean;
  branch: string | null;
  unfinishedRunIds: string[];
  warningMessage?: string;
}

/**
 * Checks for unrecorded/unfinished runs before a session stops
 */
export function auditSessionStop(workspaceRoot: string): StopAuditResult {
  const dir = join(workspaceRoot, '.factory');
  const result: StopAuditResult = {
    hasUnfinishedRuns: false,
    branch: null,
    unfinishedRunIds: [],
  };

  if (!existsSync(dir)) return result;

  const branch = currentBranch(workspaceRoot);
  result.branch = branch;
  if (!branch) return result;

  const runsDir = join(dir, 'runs');
  const unfinished = listFiles(runsDir, '.json')
    .map((f) => readJson<{ id: string; branch?: string; finished_at?: string }>(f))
    .filter((run) => !run.finished_at && run.branch === branch);

  if (unfinished.length > 0) {
    result.hasUnfinishedRuns = true;
    result.unfinishedRunIds = unfinished.map((u) => u.id);
    result.warningMessage = `[Software Factory] Task branch "${branch}" has ${unfinished.length} unfinished run ledger entry (${result.unfinishedRunIds.join(
      ', '
    )}). Remember to record final test evidence and finish the run.`;
  }

  return result;
}
