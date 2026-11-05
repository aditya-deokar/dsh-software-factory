# Agent workflow

Work here runs as a factory: an inner loop takes each task from intake to a
monitored merge with evidence, and an outer loop improves the inner one
through reviewed PRs. Skills carry the how; this file holds the order and the
rules. Skills: `npx skills add aditya-deokar/software-factory`.

## Skills

| When | Skill |
|---|---|
| New issue or request | `issue-triage` |
| Before choosing what to build | `ambition-engine` |
| Ambiguous or cross-cutting work | `spec-writing` |
| Before the first edit | `worktree-isolation` |
| Writing the code | `service-layer` |
| Proving it works | `test-evidence`, then `visual-diff` for UI |
| Opening and reviewing the PR | `code-review-loop`, or `code-review-loop-large` past Greptile's file limit |
| After merge | `release-monitoring` |
| Every task, if `.factory/` exists | `run-ledger`, `agent-memory`, `model-routing` |
| Weekly, or when asked | `skill-feedback-loop` |
| Text a person will read | `prose-cleanup` |
| Setting up a repo, or after upgrading the skills | `factory-setup` |
| Writing skills, releasing them, Windows shells | `skill-authoring`, `package-release`, `cross-platform-shell` |

## Inner loop

0. **Triage.** One decision: implement, spec, duplicate, needs-info, decline.
1. **Aim.** Raise the target before building: the goal beyond the goal, the
   standard the field's best would hold, and an outside judge named up
   front. Take the highest rung the triaged size allows; file the rungs
   above as issues. Better, not bigger.
2. **Spec,** when triage or the aim says so. A human approves before code
   starts.
3. **Isolate.** A fresh worktree and branch from `origin/main`. Never build
   on `main`.
4. **Build.** Boundaries decide why and when; services do the how.
5. **Prove.** Capture the before state while reproducing, the after once it
   works, measured by the aim's judge. Scale proof to the change; report a
   missed target with its numbers.
6. **Ship.** PR with the aim and before/after proof in the body, then
   `code-review-loop` until Greptile reports 5/5 with zero unresolved
   comments.
7. **Monitor.** Check the merge commit; a regression becomes a new issue.

Beats switched off in `.factory/config.json` are skipped.

## Outer loop

- **Remember.** Read `.factory/memory/INDEX.md` at task start. Search memory
  before re-deriving a root cause. Save durable facts with a source.
- **Route.** Pick the model tier with `model-routing`; do the slice work on
  the cheapest tier that does it well.
- **Record.** One run in `.factory/runs/` per task: beats, evidence, review
  rounds, and every human correction.
- **Improve.** `skill-feedback-loop` turns repeated corrections into one
  reviewed PR per skill. It never merges its own work.

## Human gates

Spec approval, an aim that replaces what was asked, merge, and every
outer-loop PR (skill, memory graduation, routing change) wait for a person. Record each approval or correction as a
touch in the ledger.

## Rules

- Never commit to `main`. One worktree and branch per task and per agent;
  never touch another agent's worktree, branch, or uncommitted work.
- Scope check before starting: `gh pr list`, `gh pr diff <n> --name-only`,
  and uncommitted work in shared checkouts. On overlap, stop and ask.
- No plain `--force`. Only `--force-with-lease`, only on your own branch.
- Regenerate lockfiles and `memory/INDEX.md` on conflict; never hand-merge.
- Worktrees do not isolate ports or databases. Confirm a port answers your
  process; no schema experiments on a shared database.
- Keep changes to the task. Unrelated fixes become their own issue.
- Run `prose-cleanup` over commit messages, PR text, docs, and replies.
- End every report as **Done** with its artifact, or as
  `BLOCKED: <what> - unblock: <one action>`. Anything else is a stall.

## Completing a task

1. Run the repo's checks (listed below).
2. Assemble before/after evidence; note memories used and written.
3. Commit, rebase onto `origin/main`, rerun the checks, push.
4. Open the PR: what changed, the aim (rung, target, judge), evidence for
   every claim, risks, and the `Run:` line from the ledger.
5. `code-review-loop` to 5/5, zero unresolved. Finish the run record.
6. Present the PR URL. Do not merge unless told to. Keep the worktree until
   the PR is merged or closed.

## Repo-specific

Fill these in for the project. `factory-setup` writes everything above
this heading as a marked block and keeps it current on upgrade; this
section is the repo's and is never rewritten:

- **Commands:** install, dev, test, typecheck, lint, exactly as typed.
- **Invariants:** what must never happen, one line each.
- **Monitoring:** where failures show up after merge.
- **Not testable locally:** and what to do instead.
