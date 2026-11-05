import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Ascend directory tree looking for .factory directory or .git root
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, '.factory')) || existsSync(join(current, '.git'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root, return original directory
      return resolve(startDir);
    }
    current = parent;
  }
}

/**
 * Returns current active git branch or null if not a repo or detached
 */
export function currentBranch(cwd: string = process.cwd()): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON file, returning empty object on failure
 */
export function readJson<T = Record<string, unknown>>(filePath: string): T {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

/**
 * List files matching a specific extension inside a folder
 */
export function listFiles(dirPath: string, ext: string = '.json'): string[] {
  if (!existsSync(dirPath)) return [];
  try {
    return readdirSync(dirPath)
      .filter((file: string) => file.endsWith(ext))
      .map((file: string) => join(dirPath, file));
  } catch {
    return [];
  }
}
