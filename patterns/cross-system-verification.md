# Cross-system state verification

Don't trust your primary source. Whenever a workflow is acting on the assumption that something has happened in another system, validate that assumption against the other system before acting. This sounds obvious; it's also frequently skipped because the primary source already has a "status" field that looks authoritative.

## The setup

Two systems can have different views of the same state. In the multi-system state verification workflow, the primary source is a vendor-progress sheet where vendors mark their rows as `Completed` when they think they're done. The secondary source is a Drive folder where a downstream service consumes input files and removes them after processing.

If both systems agree, the workflow can act. If they disagree, the workflow should wait.

The sheet alone is not enough. Vendors can mark a row `Completed` before the downstream service has actually consumed their file. If the workflow transitioned the ticket based only on the sheet, the ticket would move forward while the work was still in flight, and the team picking up the ticket downstream would find no completed output to work with.

## The pattern

After your primary-source state check passes, do a secondary check against the adjacent system before firing the side effect.

```jsonata
(
  $fileFound := $count($filter(files, function($f) {
    $exists(issueKey."Issue Key") ? $contains($f.name, issueKey."Issue Key") : false
  })) > 0;

  { "fileFound": $fileFound }
)
```

Inputs:
- `files`: the result of a `drive.list_files` step listing the upstream input folder.
- `issueKey`: the loop iteration value, which carries the ticket key.

Output: a boolean. If `true`, the input file is still in the upstream folder, which means the downstream service hasn't consumed it yet. Skip the transition. If `false`, the downstream service has consumed it, and the work is genuinely done.

A boolean condition downstream gates on `fileFound === false` and only proceeds when the second check confirms.

## Why this over the alternative

The three alternatives:

1. **Trust the sheet.** The cheap path. Works when the sheet is the system of record. Doesn't work here, because the sheet is updated by humans (the vendor team) and the downstream consumption is done by a different system. The two can disagree and the sheet is the less authoritative of the two.
2. **Run the workflow less often and assume sync over time.** Doesn't solve the problem. It just shifts it from "we transition too early" to "we transition early some of the time but you can't tell which times." Worse, because the bug is now non-deterministic.
3. **Poll the downstream system asynchronously.** Right shape, wrong tool. iPaaS workflows are not the place to maintain long-running polling state across hours. If the cross-check needs to happen on a 2-hour scheduled cycle, fold it into the scheduled cycle's main work. The "list folder, check for file" call is cheap.

## When to use

- Any time the action you're about to take depends on something being done in a second system, and the primary source's signal can be ahead of (or behind) the second system's actual state.
- Particularly important when the systems are owned by different teams or different services with their own update cadences.

## When NOT to use

- When the primary source IS the system of record (e.g., your only signal is the database row, and there's no downstream consumer that holds independent state).
- When the second check is expensive (a multi-second API call per iteration) and the cost per iteration matters. Look for a cheaper signal first.

## Examples in this portfolio

- [Workflow 03. Multi-System State Verification](../workflows/03-multi-system-state-verification/): sheet says `Completed`, workflow lists the upstream Drive folder, only proceeds if the input file is no longer there.
