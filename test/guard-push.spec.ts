import { describe, it, expect } from 'vitest';
import { checkPush } from '../src/hooks/guard-push.js';

describe('Phase 2: guard-push safety check', () => {
  it('blocks bare git push when on protected branch main', () => {
    const violation = checkPush('git push', { branchOf: () => 'main' });
    expect(violation).toMatch(/protected branch "main"/);
  });

  it('blocks bare git push when on protected branch master', () => {
    const violation = checkPush('git push', { branchOf: () => 'master' });
    expect(violation).toMatch(/protected branch "master"/);
  });

  it('blocks explicit push targeting origin main', () => {
    const violation = checkPush('git push origin main', { branchOf: () => 'task/fix-auth' });
    expect(violation).toMatch(/Direct push to protected branch "main" is blocked/);
  });

  it('blocks plain --force flag', () => {
    const violation = checkPush('git push origin task/fix-auth --force', { branchOf: () => 'task/fix-auth' });
    expect(violation).toMatch(/Plain --force is strictly forbidden/);
  });

  it('blocks short -f flag', () => {
    const violation = checkPush('git push -f origin task/fix-auth', { branchOf: () => 'task/fix-auth' });
    expect(violation).toMatch(/Plain --force is strictly forbidden/);
  });

  it('blocks --mirror and --all pushes', () => {
    const violationAll = checkPush('git push origin --all', { branchOf: () => 'task/fix-auth' });
    expect(violationAll).toMatch(/--all and --mirror push the default branch too/);
  });

  it('allows --force-with-lease on feature branch', () => {
    const violation = checkPush('git push origin task/fix-auth --force-with-lease', {
      branchOf: () => 'task/fix-auth',
    });
    expect(violation).toBeNull();
  });

  it('allows normal push on a feature branch', () => {
    const violation = checkPush('git push origin task/fix-auth', {
      branchOf: () => 'task/fix-auth',
    });
    expect(violation).toBeNull();
  });

  it('ignores echo or harmless occurrences of git push', () => {
    expect(checkPush('echo "git push origin main"')).toBeNull();
    expect(checkPush('git commit -m "fix git push error"')).toBeNull();
  });
});
