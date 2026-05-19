# ID resolution strategies: regex vs JQL search

Sometimes you have the Jira ticket key embedded in a string you already know (a filename, a URL, a custom-build batch ID). Sometimes you don't, but you have a value that maps to a ticket via a custom field. These two situations call for different resolution strategies.

## When to use

- **Regex extraction:** the ticket key is somewhere inside a string field you already have. Fast, no API call.
- **JQL search:** you only have a value that lives in a custom field on the target ticket. Requires a Jira API call but works when there's no embedded key.

## Pattern A: regex extraction

The cheapest path. Pull the key out of a field that already contains it.

```jsonata
$m   := $match($.name, /INTAKE-\d{6,7}/);
$key := $m[0].match
```

If your input string is something like `[SP] NRS WS Expansion (Part 3/5) - [INTAKE-1095092] - Auto-Build Input.xlsx`, this gives you `INTAKE-1095092`. Plug it into the Jira URL: `https://your-domain.atlassian.net/rest/api/3/issue/{key}`.

If you're working with a more varied input shape, use a regex replace to pull out just the key:

```
pattern:     .*(INTAKE-\d+).*
replacement: $1
```

This is what Tray's `text-helpers Replace` step does. Output is the captured key.

## Pattern B: JQL search

When the ticket key isn't in your input, hit Jira's search endpoint to find it by a custom field value.

```js
exports.step = function(input) {
  var businessId = String(input.businessIds[0]);
  var jql = 'cf[<CF_BUSINESS_ID>] = "' + businessId + '"' +
            ' AND summary ~ "SSIO"' +
            ' AND status = "Pending Auto-Build"' +
            ' ORDER BY created DESC';
  return JSON.stringify({
    jql: jql,
    fields: ['summary', 'status'],
    maxResults: 1
  });
};
```

POST that body to `https://your-domain.atlassian.net/rest/api/3/search/jql`. The response is `{ issues: [{ key, fields, ... }] }`. Extract the first issue's key:

```js
exports.step = function(input) {
  var resp = typeof input.response === 'string' ? JSON.parse(input.response) : input.response;
  var body = resp && (resp.body || resp);
  var issues = body && body.issues;
  if (Array.isArray(issues) && issues.length > 0 && issues[0].key) return issues[0].key;
  return '';
};
```

Return an empty string when nothing matched, and have the downstream boolean condition skip the row if the key is empty. Don't throw, don't halt the loop; one missing match shouldn't kill the run.

## Why both paths in the same workflow

A workflow that receives input from two different submission origins can hit both situations. One origin embeds the ticket key in a build batch ID string (regex extraction is fine). The other origin produces rows tagged only by business ID (JQL search is the only option). Branching at the top of the loop based on a `BATCH_TYPE` column and running the right resolution per branch handles both without writing two whole workflows.

## Tradeoffs

| Aspect | Regex | JQL search |
|---|---|---|
| Speed | Instant, no API call | One Jira API call per row |
| Cost | Free | Counts against Jira API rate limits |
| Fragility | Breaks if the input format drifts | Breaks if the custom field's value drifts |
| Multiple matches | First match wins | You control ordering in the JQL (`ORDER BY ...`) |

Prefer regex when you can. Use JQL when you have to.

## Examples in this portfolio

- [Workflow 01. Dual-Mode Dispatcher](../workflows/01-dual-mode-dispatcher/): uses both in one workflow, picked per branch.
- [Workflow 03. Multi-System State Verification](../workflows/03-multi-system-state-verification/): regex extraction from a sheet column.
