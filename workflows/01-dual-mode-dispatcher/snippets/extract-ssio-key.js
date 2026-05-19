// extract-ssio-key.js
//
// What it does:
//   Parses the JQL search response from Jira and returns the first issue
//   key found, or an empty string if no match. Empty string is the sentinel
//   the downstream boolean condition checks against to skip the loop iteration.
//
// Where it sits:
//   Step "script-extract-ssio-key", immediately after http-client-jql in the
//   SSIO branch. Its `result` is what http-client-1-s (GET issue) and
//   http-client-2-s (POST transition) interpolate into their URL paths.
//
// Design choice:
//   Pulling the key into its own script step (rather than inlining a
//   jsonpath like $.steps.http-client-jql.response.body.issues[0].key)
//   gives two things:
//     1. A single normalized value to gate on. The next step is a
//        boolean condition that checks "is this string non-empty?". One
//        check, not a chain of null-safe traversals.
//     2. Defensive parsing. The Tray HTTP client sometimes returns the
//        response body as a string (when parse_response misbehaves on
//        certain content types). This step accepts both shapes.
//
// Returning '' instead of throwing means a missed match is a soft skip,
// not a workflow failure. The boolean-condition-3-s step downstream
// short-circuits the rest of the chain when the key is empty.

exports.step = function (input) {
  var resp =
    typeof input.response === "string"
      ? JSON.parse(input.response)
      : input.response;

  var body = resp && (resp.body || resp);
  var issues = body && body.issues;

  if (Array.isArray(issues) && issues.length > 0 && issues[0].key) {
    return issues[0].key;
  }

  return "";
};
