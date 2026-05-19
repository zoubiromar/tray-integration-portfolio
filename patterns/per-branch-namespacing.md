# Per-branch namespacing

When a workflow branches and both branches do similar work downstream (fetch the same kind of record, run the same kind of check, hit the same downstream API), the lazy choice is to "unify" the branches by writing conditional jsonpath that picks a different upstream step depending on which branch is active. Don't. Duplicate the downstream chain instead, and give each branch's steps a suffix that names the branch.

## The setup

In the Dual-Mode Dispatcher workflow, the branch fires on `BATCH_TYPE`. CATALOG_TEAM rows resolve their Jira key via regex extraction. SSIO rows resolve their Jira key via a JQL search. Both then need to do the same things: fetch the current Jira status, check it against the expected status, and POST a transition.

The lazy approach would be one shared `GET Jira issue` step that points to either `$.steps.text-helpers-2.result` (if catalog) or `$.steps.script-extract-ssio-key.result` (if SSIO). Implementations of "either-or" in Tray are fragile because:

1. The unselected step still exists in the run trace, but its output is undefined for the inactive branch.
2. Conditional jsonpath that switches paths based on a runtime value is hard to read and hard to debug when something goes wrong.

## The pattern

Suffix each branch's steps with a one-letter tag. In this case `-c` for CATALOG_TEAM, `-s` for SSIO.

```
CATALOG branch:
  text-helpers-1
  text-helpers-2
  boolean-condition-3-c   (has Jira key?)
  http-client-1-c         (GET Jira issue)
  boolean-condition-1-c   (COMPLETE + Pending Auto-Build?)
  json-transformer-1-c    (pick transition)
  http-client-2-c         (POST transition)

SSIO branch:
  script-ssio-jql-body
  http-client-jql
  script-extract-ssio-key
  boolean-condition-3-s   (has Jira key?)
  http-client-1-s         (GET Jira issue)
  boolean-condition-1-s   (COMPLETE + Pending Auto-Build?)
  json-transformer-1-s    (pick transition)
  http-client-2-s         (POST transition)
```

Each step's jsonpath references its branch-local predecessor. `http-client-1-c` points at `$.steps.text-helpers-2.result`. `http-client-1-s` points at `$.steps.script-extract-ssio-key.result`. Neither branch knows about the other.

## Why this over the alternative

- Each branch is independently readable. You can trace one path from top to bottom without keeping the other path in your head.
- Adding a new field to GET, or changing the transition payload, touches one branch at a time. Bugs in one branch don't bleed into the other.
- The cost is duplicate steps. For a workflow that fans out to two or three branches, that cost is small. For five or more branches, you start hitting copy-paste fatigue, and at that point the workflow is probably overdue for being split into separate workflows anyway.

## When NOT to use

- If the two branches are doing almost identical work and the only difference is a single input value, just use the unified step with a jsonpath that resolves through a small json-transformer "selector" step. The selector picks the right source based on the branch, then the unified downstream step reads from the selector's output. This is cleaner for trivial branches.

The namespacing pattern earns its weight when the per-branch downstream chains have multiple steps and any meaningful logic between them.

## Examples in this portfolio

- [Workflow 01. Dual-Mode Dispatcher](../workflows/01-dual-mode-dispatcher/): full `-c` / `-s` per-branch namespacing across seven downstream steps each.
