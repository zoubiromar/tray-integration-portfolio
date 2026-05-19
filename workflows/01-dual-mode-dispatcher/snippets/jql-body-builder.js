// jql-body-builder.js
//
// What it does:
//   Builds the request body for Jira's POST /rest/api/3/search/jql endpoint.
//   Takes the array of business IDs attached to the current Snowflake row,
//   picks the first one, and constructs a JQL string that finds the matching
//   SSIO Jira ticket via a custom field equality plus a status filter.
//
// Where it sits:
//   Step "script-ssio-jql-body", first step inside the SSIO branch of
//   boolean-condition-2. Its `result` feeds the body of the next step,
//   http-client-jql.
//
// Design choice:
//   The JQL search pattern is what makes SSIO resolvable at all. SSIO rows
//   don't carry the Jira key directly in their BATCH_ID (unlike CATALOG_TEAM
//   rows). They carry a business ID. The Jira side stores that same business
//   ID in <CF_BUSINESS_ID>, so the custom field acts as a join key across
//   the two systems.
//
//   The early-return JQL ("1 = 2") is a defensive guard: if upstream
//   gives us an empty array (a malformed row, or a row mid-population),
//   we want Jira to return zero issues cleanly rather than have the
//   workflow crash on a malformed body. The downstream extractor handles
//   the empty-issues case.

exports.step = function (input) {
  var ids = input.businessIds;

  // The Snowflake connector sometimes returns array-typed columns as a
  // stringified JSON. Normalize before reading.
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch (e) {
      // fall through; the next check will short-circuit
    }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return JSON.stringify({
      jql: "project = INTAKE AND 1 = 2",
      fields: ["summary"],
      maxResults: 1,
    });
  }

  var bid = String(ids[0]);
  var jql =
    'cf[<CF_BUSINESS_ID>] = "' +
    bid +
    '" AND summary ~ "SSIO" AND status = "Pending Auto-Build" ORDER BY created DESC';

  return JSON.stringify({
    jql: jql,
    fields: ["summary", "status"],
    maxResults: 1,
  });
};
