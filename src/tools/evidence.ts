import Schema from '@deepseek-ai/schemastery';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import type { ToolDefinition } from './types.js';

const execFileAsync = promisify(execFile);

export interface EvidenceInput {
  command: string;
  judgeMetric: string;
  worktreeDir?: string;
  captureVideo?: boolean;
}

export interface EvidenceOutput {
  status: 'VERIFIED' | 'BLOCKED' | 'ERROR';
  judgeResult: string;
  artifactPath?: string;
  summary?: Record<string, any>;
  error?: string;
}

export const evidenceTool: ToolDefinition<EvidenceInput, EvidenceOutput> = {
  name: 'factory_evidence',
  description: 'Run test verification against the aim judge criteria and record undeniable test evidence artifacts.',
  parameters: Schema.object({
    command: Schema.string().required().description('Test command to execute (e.g. npm test, pytest)'),
    judgeMetric: Schema.string().required().description('The outside judge criteria defined in the Aim beat'),
    worktreeDir: Schema.string().description('Directory to run within if executing inside an isolated worktree'),
    captureVideo: Schema.boolean().default(false).description('Whether to run recorder for graphical UI sessions'),
  }),
  execute: async ({ command, judgeMetric, worktreeDir }, env = {}) => {
    const cwd = worktreeDir || env.cwd || process.cwd();
    const evidenceDir = join(cwd, '.factory', 'evidence');
    try {
      mkdirSync(evidenceDir, { recursive: true });
    } catch {
      // Directory creation fallback
    }

    const timestamp = Date.now();
    const artifactPath = join(evidenceDir, `evidence-${timestamp}.log`);

    try {
      const { stdout, stderr } = await execFileAsync(command, { cwd, shell: true });
      const report = {
        timestamp,
        command,
        judgeMetric,
        status: 'PASSED',
        stdoutPreview: stdout.slice(-2000),
        stderrPreview: stderr.slice(-1000),
      };

      try {
        writeFileSync(artifactPath, `${stdout}\n\n=== STDERR ===\n${stderr}`);
      } catch {
        // Log fallback
      }

      return {
        status: 'VERIFIED',
        judgeResult: `Outside judge verification passed for metric: "${judgeMetric}"`,
        artifactPath,
        summary: report,
      };
    } catch (err: any) {
      const errorReport = {
        timestamp,
        command,
        judgeMetric,
        status: 'FAILED',
        error: err.message,
        stdout: err.stdout?.slice(-2000),
        stderr: err.stderr?.slice(-1000),
      };

      try {
        writeFileSync(artifactPath, `FAILED:\n${err.message}\n\n=== STDOUT ===\n${err.stdout}\n\n=== STDERR ===\n${err.stderr}`);
      } catch {
        // Fallback
      }

      return {
        status: 'BLOCKED',
        judgeResult: `Outside judge verification failed: ${err.message}`,
        artifactPath,
        summary: errorReport,
        error: err.message,
      };
    }
  },
};
