import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const END = '<!-- software-factory:end -->';
export const LEGACY_MARKER = '<!-- factory-setup: software factory section -->';
const BEGIN_RE = /<!-- software-factory:begin kind=(full|section) version=(\S+) sha=([0-9a-f]{12})[^\n]*-->\n/;
const SPLIT_RE = /^#{2,3} Repo-specific\b/m;

const PRISTINE_LEGACY = new Set(['782f076543ce', '8ffe4cac8e75']);

const lf = (s: string) => s.replace(/\r\n/g, '\n');
export const digest = (s: string) => createHash('sha256').update(lf(s).trim()).digest('hex').slice(0, 12);

export interface TemplateParts {
  owned: string;
  stub: string;
}

export function splitTemplate(text: string): TemplateParts {
  const t = lf(text);
  const m = t.match(SPLIT_RE);
  return m ? { owned: t.slice(0, m.index).trim(), stub: t.slice(m.index).trim() } : { owned: t.trim(), stub: '' };
}

export function managedBlock(kind: 'full' | 'section', owned: string, version: string): string {
  return (
    `<!-- software-factory:begin kind=${kind} version=${version} sha=${digest(owned)} ` +
    `(factory-setup replaces this block on upgrade; keep repo rules outside it) -->\n${owned.trim()}\n${END}`
  );
}

export interface Templates {
  full: string;
  section: string;
  version: string;
}

export function loadTemplates(assetsDir?: string): Templates {
  const assets = assetsDir || join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
  const versionFile = join(assets, 'VERSION');
  const version = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : '3.1.0';
  return {
    full: existsSync(join(assets, 'AGENTS.md')) ? readFileSync(join(assets, 'AGENTS.md'), 'utf8') : '',
    section: existsSync(join(assets, 'agents-section.md')) ? readFileSync(join(assets, 'agents-section.md'), 'utf8') : '',
    version,
  };
}

export interface PlanResult {
  action: 'create' | 'update' | 'migrate' | 'append' | 'current' | 'edited' | 'legacy-edited' | 'broken';
  from?: string;
  to: string;
  text?: string;
}

export function planAgentsMd(
  current: string | null,
  { full, section, version, replaceEdited = false }: Templates & { replaceEdited?: boolean }
): PlanResult {
  const tpl = { full: splitTemplate(full), section: splitTemplate(section) };
  const to = version;
  if (current === null || !current.trim()) {
    return { action: 'create', to, text: `${managedBlock('full', tpl.full.owned, version)}\n\n${tpl.full.stub}\n` };
  }

  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const out = (t: string) => (eol === '\n' ? t : t.replace(/\n/g, eol));
  const text = lf(current);

  const m = text.match(BEGIN_RE);
  if (m) {
    const [, kindRaw, from, sha] = m;
    const kind = kindRaw as 'full' | 'section';
    const start = m.index! + m[0].length;
    const end = text.indexOf(END, start);
    if (end < 0) return { action: 'broken', from, to };
    const inner = text.slice(start, end).trim();
    const owned = tpl[kind].owned;
    if (from === version && inner === owned) return { action: 'current', from, to };
    if (digest(inner) !== sha && !replaceEdited) return { action: 'edited', from, to };
    const next = text.slice(0, m.index) + managedBlock(kind, owned, version) + text.slice(end + END.length);
    return { action: 'update', from, to, text: out(next) };
  }

  const at = text.indexOf(LEGACY_MARKER);
  if (at >= 0) {
    const after = text.slice(at + LEGACY_MARKER.length);
    const appended = /^\s*## Software factory/.test(after);
    const kind = appended ? 'section' : 'full';
    const old = appended ? after : text.slice(0, at);
    const cut = old.match(SPLIT_RE);
    const owned = cut ? old.slice(0, cut.index) : old;
    if (!PRISTINE_LEGACY.has(digest(owned)) && !replaceEdited) return { action: 'legacy-edited', from: '3.0.0', to };
    const stub = cut ? old.slice(cut.index).trim() : tpl[kind].stub;
    const head = appended ? `${text.slice(0, at).trimEnd()}\n\n` : '';
    const tail = appended ? '' : after.trim() ? `\n${after.trim()}\n` : '';
    const next = `${head}${managedBlock(kind, tpl[kind].owned, version)}\n\n${stub}\n${tail}`;
    return { action: 'migrate', from: '3.0.0', to, text: out(next) };
  }

  const stub = SPLIT_RE.test(text) ? '' : `\n\n${tpl.section.stub}`;
  const next = `${text.trimEnd()}\n\n${managedBlock('section', tpl.section.owned, version)}${stub}\n`;
  return { action: 'append', to, text: out(next) };
}
