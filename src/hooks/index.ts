import { Context } from '@deepseek-ai/cordis';
import { checkPush } from './guard-push.js';
import { buildSessionStartContext } from './session-start.js';
import { auditSessionStop } from './stop-ledger.js';
import type { SoftwareFactoryConfig } from '../types.js';

export * from './guard-push.js';
export * from './session-start.js';
export * from './stop-ledger.js';

/**
 * Registers all Phase 2 lifecycle hooks and governance guards onto the Cordis context
 */
export function registerLifecycleHooks(ctx: Context, config: SoftwareFactoryConfig = {}): void {
  // 1. Session start listener
  ctx.on('session/start', (session: any) => {
    const root = session?.workspaceRoot || ctx.softwareFactory?.rootDir || process.cwd();
    const sessionData = buildSessionStartContext(root, config);

    if (sessionData.systemPromptAdditions.length > 0 && typeof session?.addSystemPromptSection === 'function') {
      session.addSystemPromptSection('software-factory', sessionData.systemPromptAdditions.join('\n'));
    }
  });

  // 2. PreToolUse guard for shell & git commands
  if (config.guardGitPush !== false) {
    ctx.on('tool/before-call', (event: any) => {
      const toolName = event?.toolName || event?.name;
      if (['bash', 'terminal', 'shell', 'exec', 'execute'].includes(toolName)) {
        const cmd = event?.args?.command || event?.args?.code || event?.command;
        if (typeof cmd === 'string' && /\bgit\b[\s\S]*\bpush\b/.test(cmd)) {
          const root = event?.cwd || ctx.softwareFactory?.rootDir || process.cwd();
          const violation = checkPush(cmd, { cwd: root });
          if (violation) {
            throw new Error(`[Software Factory Guard] Blocked git push: ${violation}`);
          }
        }
      }
    });
  }

  // 3. Session before-stop audit
  ctx.on('session/before-stop', (session: any) => {
    const root = session?.workspaceRoot || ctx.softwareFactory?.rootDir || process.cwd();
    const audit = auditSessionStop(root);
    if (audit.hasUnfinishedRuns && audit.warningMessage && typeof session?.sendWarning === 'function') {
      session.sendWarning(audit.warningMessage);
    }
  });
}
