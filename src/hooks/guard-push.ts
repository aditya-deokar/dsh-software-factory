import { resolve } from 'node:path';
import { currentBranch } from '../lib/factory.js';

const PROTECTED = new Set(['main', 'master', 'release', 'production']);

/**
 * Splits a shell command line into separate commands and tokens
 */
export function commands(line: string): string[][] {
  return String(line)
    .split(/&&|\|\||[;|\n]/)
    .map((c) => (c.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, '')));
}

export interface CheckPushOptions {
  cwd?: string;
  branchOf?: (dir: string) => string | null;
}

/**
 * Validates whether a command contains a disallowed git push.
 * Returns a rejection reason if blocked, or null if allowed.
 */
export function checkPush(
  line: string,
  { cwd = process.cwd(), branchOf = currentBranch }: CheckPushOptions = {}
): string | null {
  for (const tokens of commands(line)) {
    // Find git token, skipping any VAR=value prefixes
    const g = tokens.findIndex((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t));
    if (g < 0 || tokens[g] !== 'git') continue;

    let i = g + 1;
    let dir = cwd;
    while (i < tokens.length && tokens[i].startsWith('-')) {
      if (tokens[i] === '-C') dir = resolve(cwd, tokens[++i] || '.');
      else if (tokens[i] === '-c') i++;
      i++;
    }

    if (tokens[i] !== 'push') continue;
    const args = tokens.slice(i + 1);

    const hasLease = args.some((a) => a.startsWith('--force-with-lease'));
    const plainForce = args.some((a) => a === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a));
    if (plainForce && !hasLease) {
      return 'Plain --force is strictly forbidden. Use --force-with-lease, and only on your isolated task branch.';
    }

    if (args.includes('--mirror') || args.includes('--all')) {
      return '--all and --mirror push the default branch too. Push your task branch by name.';
    }

    const positional = args.filter((a) => !a.startsWith('-'));
    const refspecs = positional.slice(1);
    for (const spec of refspecs) {
      if (spec.startsWith('+')) {
        return `"${spec}" force-pushes without safety. Use --force-with-lease on your own branch instead.`;
      }
      const dest = (spec.includes(':') ? spec.split(':').pop()! : spec).replace(/^refs\/heads\//, '');
      if (PROTECTED.has(dest)) {
        return `Direct push to protected branch "${dest}" is blocked by Software Factory guard. Work in a task branch and open a PR.`;
      }
    }

    if (!refspecs.length) {
      const branch = branchOf(dir);
      if (branch && PROTECTED.has(branch)) {
        return `You are currently on protected branch "${branch}"; a bare git push would update it. Switch to a task branch first.`;
      }
    }
  }
  return null;
}
