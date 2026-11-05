import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunRecord } from './report.js';

export interface SkillFrictionSignal {
  skillName: string;
  correctionCount: number;
  failureCount: number;
  totalOccurrences: number;
  recentNotes: string[];
  trend: 'rising' | 'stable' | 'isolated';
}

export interface FeedbackProposal {
  qualifyingSkill: string;
  signalDiagnosis: string;
  suggestedAction: string;
  targetMetricGoal: string;
  proposalDraft: string;
}

/**
 * Analyzes run ledger entries in .factory/runs/ to extract friction,
 * failed beats, and human corrections attributed to skills.
 */
export function analyzeFrictionSignals(runsDir: string): SkillFrictionSignal[] {
  if (!existsSync(runsDir)) return [];

  const files = readdirSync(runsDir).filter((f) => f.endsWith('.json'));
  const skillMap: Record<string, { corrections: number; failures: number; notes: string[] }> = {
    'issue-triage': { corrections: 0, failures: 0, notes: [] },
    'ambition-engine': { corrections: 0, failures: 0, notes: [] },
    'spec-writing': { corrections: 0, failures: 0, notes: [] },
    'worktree-isolation': { corrections: 0, failures: 0, notes: [] },
    'service-layer': { corrections: 0, failures: 0, notes: [] },
    'test-evidence': { corrections: 0, failures: 0, notes: [] },
    'code-review-loop': { corrections: 0, failures: 0, notes: [] },
    'release-monitoring': { corrections: 0, failures: 0, notes: [] },
  };

  const beatToSkill: Record<string, string> = {
    triage: 'issue-triage',
    aim: 'ambition-engine',
    spec: 'spec-writing',
    isolate: 'worktree-isolation',
    build: 'service-layer',
    prove: 'test-evidence',
    ship: 'code-review-loop',
    monitor: 'release-monitoring',
  };

  for (const f of files) {
    try {
      const run: RunRecord = JSON.parse(readFileSync(join(runsDir, f), 'utf8'));

      // Check human touches
      if (run.human_touches) {
        for (const touch of run.human_touches) {
          const skill = beatToSkill[touch.beat] || 'service-layer';
          if (!skillMap[skill]) skillMap[skill] = { corrections: 0, failures: 0, notes: [] };
          if (touch.kind === 'correction') {
            skillMap[skill].corrections++;
            if (touch.note) skillMap[skill].notes.push(touch.note);
          }
        }
      }

      // Check failed beats
      if (run.beats) {
        for (const [beat, data] of Object.entries(run.beats)) {
          if (data && (data.status === 'blocked' || data.status === 'failed')) {
            const skill = beatToSkill[beat] || 'test-evidence';
            if (!skillMap[skill]) skillMap[skill] = { corrections: 0, failures: 0, notes: [] };
            skillMap[skill].failures++;
            if (data.note || data.error) skillMap[skill].notes.push(data.note || data.error);
          }
        }
      }
    } catch {
      // Ignore malformed files
    }
  }

  const results: SkillFrictionSignal[] = Object.entries(skillMap).map(([skillName, stat]) => {
    const total = stat.corrections + stat.failures;
    return {
      skillName,
      correctionCount: stat.corrections,
      failureCount: stat.failures,
      totalOccurrences: total,
      recentNotes: stat.notes.slice(-5),
      trend: total >= 3 ? 'rising' : total > 0 ? 'stable' : 'isolated',
    };
  });

  return results.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
}

/**
 * Formulates a skill-loop repair proposal for the highest friction skill
 */
export function formulateFeedbackProposal(
  signals: SkillFrictionSignal[],
  threshold: number = 2
): FeedbackProposal | null {
  const candidate = signals.find((s) => s.totalOccurrences >= threshold);
  if (!candidate) return null;

  const diagnosis = `Skill "${candidate.skillName}" accumulated ${candidate.correctionCount} corrections and ${candidate.failureCount} beat failures. Notes: ${candidate.recentNotes.join('; ') || 'No specific notes recorded'}.`;
  const draft = [
    `# Skill Feedback Proposal: ${candidate.skillName}`,
    '',
    `**Diagnosis**: ${diagnosis}`,
    '',
    '**Recommended Surgical Changes**:',
    `- Add explicit negative anti-pattern examples to \`skills/${candidate.skillName}/SKILL.md\`.`,
    `- Tighten prompt instructions for edge-case handling.`,
    `- Add automatic validation check before finishing beat.`,
    '',
    `**Target Goal**: Reduce ${candidate.skillName} friction events from ${candidate.totalOccurrences} to 0 across the next 10 runs.`,
  ].join('\n');

  return {
    qualifyingSkill: candidate.skillName,
    signalDiagnosis: diagnosis,
    suggestedAction: `Refactor skills/${candidate.skillName}/SKILL.md with negative examples`,
    targetMetricGoal: `Target: 0 friction events across next 10 runs (down from ${candidate.totalOccurrences})`,
    proposalDraft: draft,
  };
}
