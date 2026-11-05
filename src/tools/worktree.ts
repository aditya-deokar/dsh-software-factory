import Schema from '@deepseek-ai/schemastery';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolDefinition } from './types.js';

export interface WorktreeInput {
  action: 'create' | 'list' | 'remove' | 'check-collision';
  taskName?: string;
  branchName?: string;
  force?: boolean;
}

export interface WorktreeOutput {
  status: 'success' | 'created' | 'exists' | 'removed' | 'ok' | 'error';
  output?: string;
  worktreePath?: string;
  branch?: string;
  instructions?: string;
  activeWorktrees?: string;
  error?: string;
}

export const worktreeTool: ToolDefinition<WorktreeInput, WorktreeOutput> = {
  name: 'factory_worktree',
  description: 'Manage isolated git worktrees for parallel agent tasks to prevent file and branch collisions.',
  parameters: Schema.object({
    action: Schema.union([
      Schema.const('create').description('Create a new isolated worktree and task branch'),
      Schema.const('list').description('List all active git worktrees'),
      Schema.const('remove').description('Remove an existing worktree directory'),
      Schema.const('check-collision').description('Inspect worktrees for branch and file conflicts'),
    ]).required(),
    taskName: Schema.string().description('Name or slug of the task/feature branch'),
    branchName: Schema.string().description('Custom branch name if different from taskName'),
    force: Schema.boolean().default(false).description('Force removal of worktree if unmerged or dirty'),
  }),
  execute: async ({ action, taskName, branchName, force }, env = {}) => {
    const root = env.cwd || process.cwd();

    switch (action) {
      case 'list': {
        try {
          const stdout = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
          return { status: 'success', output: stdout };
        } catch (err: any) {
          return { status: 'error', error: err.message };
        }
      }

      case 'create': {
        if (!taskName) {
          throw new Error('taskName is required when creating a worktree');
        }
        const safeName = taskName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const branch = branchName || `factory/${safeName}`;
        const worktreeDir = join(root, '..', `wt-${safeName}`);

        if (existsSync(worktreeDir)) {
          return {
            status: 'exists',
            worktreePath: worktreeDir,
            branch,
            instructions: `Worktree already exists at ${worktreeDir}. Switch commands to this directory.`,
          };
        }

        try {
          execFileSync('git', ['worktree', 'add', '-b', branch, worktreeDir, 'HEAD'], {
            cwd: root,
            encoding: 'utf8',
          });
          return {
            status: 'created',
            worktreePath: worktreeDir,
            branch,
            instructions: `Created isolated worktree at ${worktreeDir}. All subsequent task commands must run in this directory.`,
          };
        } catch (err: any) {
          return { status: 'error', error: err.message };
        }
      }

      case 'check-collision': {
        try {
          const stdout = execFileSync('git', ['worktree', 'list'], { cwd: root, encoding: 'utf8' });
          return { status: 'ok', activeWorktrees: stdout };
        } catch (err: any) {
          return { status: 'error', error: err.message };
        }
      }

      case 'remove': {
        if (!taskName) {
          throw new Error('taskName is required to remove a worktree');
        }
        const safeName = taskName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const worktreeDir = join(root, '..', `wt-${safeName}`);
        const args = ['worktree', 'remove', worktreeDir];
        if (force) args.push('--force');

        try {
          execFileSync('git', args, { cwd: root, encoding: 'utf8' });
          return { status: 'removed', worktreePath: worktreeDir };
        } catch (err: any) {
          return { status: 'error', error: err.message };
        }
      }
    }
  },
};
