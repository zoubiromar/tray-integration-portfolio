# Note appending (read, concat, write)

Most CRM and ticketing systems' text fields don't support append as a native operation. You can write a value, you can clear a value, but you can't add to the existing value in one call. So appending is a three-step dance: read the current value, build the new value in a transform, write the new value.

## When to use

- Salesforce Case notes, custom long-text fields on any object, anything where the field is stored as a single blob.
- Jira issue descriptions (technically supported by the v3 API as ADF, but ADF append is its own headache; if you just want plain-text append, this pattern still applies).
- Any time the field's history matters and you don't want to lose what's already there.

## The pattern

**Step 1: read.**

The same Find Records call that reads the rest of the fields you need. Always check whether the field is currently null or empty before deciding how to format the append.

**Step 2: build.**

A small JSONata transform that concatenates the existing value with the new entry, separated by a delimiter (two newlines is a good default).

```jsonata
(
  $date := $now('[M01].[D01].[Y0001]');
  $newNote := $date & ' - Merchant Qualified for Early Activation';
  $existing := notes;
  $appendedNotes := $existing != null and $trim($existing) != ''
    ? $existing & '\n\n' & $newNote
    : $newNote;

  { "appendedNotes": $appendedNotes }
)
```

A few details worth noting:

- The new note goes at the END of the existing text, so the field reads chronologically top-to-bottom. (If you flip this, you have to flip it everywhere or you'll end up with a confusing reverse-chronological mess that mixes with manually-written notes that go in order.)
- `$now('[M01].[D01].[Y0001]')` is the JSONata format-time spec. `[M01]` is two-digit month, `[D01]` is two-digit day, `[Y0001]` is four-digit year. Output is `MM.DD.YYYY`.
- The null-and-trimmed-empty check matters. If the field is null, you get `null & '\n\n' & 'new note'`, which can render as the string `"null\n\nnew note"`. Check first.

**Step 3: write.**

The Update Record call writes `$.steps.json-transformer-X.result.appendedNotes` back to the same field you read in step 1.

## Why this over the alternative

The two alternatives both have issues:

1. **Overwrite the field with just the new value.** Loses all history. Anyone who reads the field after the next run only sees the latest entry. If your workflow runs daily, the field is useless as an audit trail.
2. **Store history outside the field in a separate object.** Cleaner long-term but adds a related-record query every time someone wants to see the history. Many teams operate by glancing at the field directly, not by clicking into a related list. Keep the history in the field they actually look at.

The three-step append is uglier than a hypothetical native "append" operation would be, but it's the right shape for the actual capabilities of CRM APIs.

## A note on Jira (ADF)

For Jira, the v3 API expects ADF (Atlassian Document Format) JSON for rich content. Appending to an ADF document means parsing the existing document, adding a new top-level node, and writing the whole document back. That's a much bigger transform than the JSONata above. If you only need a separate annotation rather than appending to an existing field, consider posting a comment instead (see [ADF rich comments](./adf-rich-comments.md)).

## Examples in this portfolio

- [Workflow 02. Salesforce Milestone Auto-Graduation](../workflows/02-salesforce-milestone-graduation/): appends a dated qualification note to the Case `Menu_Team_Notes__c` field.
