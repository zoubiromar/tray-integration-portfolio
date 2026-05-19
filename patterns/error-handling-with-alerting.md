# Error handling with downstream alerting

A scheduled workflow that fails silently is worse than a workflow that fails loudly. The default "fail the run and stop" behavior in Tray will surface in the Tray UI, but nobody is watching that UI during off hours. Route step-level errors to a dedicated alerting workflow that posts to a Slack channel the team actually monitors.

## The pattern

Two layers, applied per step.

**Layer 1: per-step error strategy.**

On every step that can fail (HTTP requests, Snowflake queries, Salesforce updates), set an explicit error handling strategy in the step's configuration. The two strategies I reach for most:

- **`continueLoop` (target the parent loop):** "this row failed, log it somewhere and move on to the next row." Use on per-iteration calls where one failed row shouldn't stop the rest of the run. Common case: a Jira GET that 404s because the ticket key was wrong in the source row. Skip the row, keep going.
- **`manual` (a dedicated error branch):** "branch this step into a success path and an error path, and let me handle each differently." Use when you want to do something specific on failure (capture the error, format it, route it to alerting) before continuing or stopping.

**Layer 2: a dedicated alerting workflow.**

A separate, simple workflow whose only job is to receive an error payload, format it, and post to a Slack channel. The main workflow calls this alerting workflow from its `manual` error branches.

The alerting workflow is owned at the org level, not per-workflow. Every workflow in the project depends on the same alerting workflow ID. That gives you one Slack channel that aggregates all automation errors across all workflows.

## What the error branch looks like in the main workflow

```
http-client-X (POST something)
  error → json-transformer-error-logger
            (builds payload: { errorMessage, ticketID, workflowName })
        → call alerting workflow with that payload
  success → continue main flow
```

The `json-transformer-error-logger` step references `$.errors.http-client-X` to pull the captured error object, plus whatever context is available from the loop iteration (ticket key, business ID, row number) to make the alert actionable.

```jsonata
{
  "errorMessage": "{$.errors.http-client-X}",
  "ticketID": $.steps.loop-1.value.IssueKey,
  "workflowName": "Multi-System State Verification"
}
```

## What the alert looks like in Slack

Format the Slack message so the on-call person can act on it without opening Tray:

```
:warning: Automation error in *Multi-System State Verification*
Ticket: INTAKE-1091634
Error: <HTTP 400> Transition is not valid for this issue's status
[View run in Tray] (link)
```

Three things matter:

1. **Workflow name in the title.** When you have 10+ workflows and one is failing, you don't want to read the body to figure out which one.
2. **The specific entity that failed** (ticket key, business ID). So you can investigate the actual record without opening Tray.
3. **A link back to the Tray run.** So you can see the full step trace.

## Why this over the alternative

The two alternatives:

1. **Email alerts from Tray itself.** Tray can email on workflow failure, but the granularity is "the run failed" rather than "this specific row inside the run failed." For per-iteration errors, the email tells you "something failed" without telling you what.
2. **Stop the workflow on first error.** Loud, but throws out all the work the rest of the rows would have done. For workflows that process tens or hundreds of rows per run, that's wasteful and creates an outsized blast radius for any single broken row.

The per-step + alerting-workflow combination is the middle ground: loud, specific, doesn't halt the run unless the error is genuinely run-stopping.

## Examples in this portfolio

All three workflows in this portfolio use this pattern:

- [Workflow 01. Dual-Mode Dispatcher](../workflows/01-dual-mode-dispatcher/): `continueLoop` on the Jira GET steps so 404s on bad keys don't kill the run.
- [Workflow 02. Salesforce Milestone Auto-Graduation](../workflows/02-salesforce-milestone-graduation/): Salesforce update steps with manual error branches that capture the failure for alerting.
- [Workflow 03. Multi-System State Verification](../workflows/03-multi-system-state-verification/): manual error branches on both the transition POST and the comment POST, each with their own error logger.
