# Idempotent skip gates

A workflow that runs every N minutes against an append-mostly data source will re-encounter the same rows on every cycle. Without a skip gate, every cycle re-attempts the work and re-fires the side effects (transitions, notifications, comments). The fix is a small check at the top of each loop iteration that asks: has this row already been processed? If yes, skip; if no, proceed.

## When to use

- Any scheduled workflow whose input is a database table, sheet, or query whose rows persist across runs.
- Any workflow that fires user-facing side effects (Jira comments, Slack alerts, Salesforce updates) where a duplicate fire would be visible.

## The pattern

There are two shapes the gate takes, depending on what "processed" means in your system.

**Shape 1: gate against the destination state.**

Check the downstream system. If the action you're about to take has already happened, skip. Example from the Salesforce milestone graduation workflow: after reading the Case and its milestones, ask whether the `Setup Catalog` milestone is already `Complete`. If yes, this case has already been graduated, so the workflow returns without touching anything.

```jsonata
$setupCatalogStatus :=
  $filter(milestones, function($m) { $m.Name = 'Setup Catalog' })[0].Status__c
```

A downstream boolean condition then short-circuits when `$setupCatalogStatus = 'Complete'`.

**Shape 2: gate against an exclusion list.**

Maintain a list of statuses or states that should never be touched, and skip when the current state matches. Example from the multi-system state verification workflow: a 12-entry list of "do not transition into" statuses. Before transitioning, fetch the ticket's current status; if it's in the list (or already equals the target transition title), skip.

```jsonata
$skip := [
  'Auto-Build Complete', 'Pending Size Inference', 'Catalog QA',
  'Upload', 'Collections', 'Blocked', 'Resolved', 'Done',
  'Reopened', 'In Final Review', 'Pending Verification', "Won't Do"
];
$shouldSkip := ($status in $skip) or ($status = updateStatus.jiraTransitionTitle)
```

## Why this over the alternative

The alternative is to track "already processed" state inside Tray itself (a workflow variable, a sticky cache, a side database). Don't. The destination system already has the state. Read it. The fewer pieces of mutable state your workflow owns, the fewer ways it can get out of sync with reality after a restart, a re-import, or a partial failure.

The shape-1 gate is preferable when you can. Shape 2 (the skip list) is the fallback when "processed" isn't a single field but a set of acceptable terminal states.

## Examples in this portfolio

- [Workflow 01. Dual-Mode Dispatcher](../workflows/01-dual-mode-dispatcher/): boolean condition that requires both the Snowflake row's status equal `COMPLETE` AND the Jira status equal `Pending Auto-Build`.
- [Workflow 02. Salesforce Milestone Auto-Graduation](../workflows/02-salesforce-milestone-graduation/): the `Setup Catalog === 'Complete'` check at the top of each loop iteration.
- [Workflow 03. Multi-System State Verification](../workflows/03-multi-system-state-verification/): the 12-status skip list.
