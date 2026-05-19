# ADF rich Jira comments with smart-link cards

Jira's v2 REST API takes plain text or wiki markup for comments. Jira's v3 REST API takes ADF (Atlassian Document Format) JSON. The two formats render differently in the Jira UI. The most useful difference: a `blockCard` node in ADF renders as a smart-link preview card (file thumbnail, name, hover preview, click-through). A plain URL in a v2 comment renders as a clickable hyperlink without the card.

If you're posting URLs as comments and you want them to render as cards (not as text-with-a-link), use v3 + ADF.

## When to use

- Any time you're posting a URL in a Jira comment and you want it to render as a smart-link preview (Drive, Google Docs, Loom, Sentry, GitHub, internal apps).
- Any time the comment needs structure beyond a single paragraph: bold headers, italic footers, multiple sections, code blocks.
- Any time you'd otherwise paste a raw URL and hope Jira's UI auto-converts it.

## The pattern

POST to `https://your-domain.atlassian.net/rest/api/3/issue/{key}/comment` with:

```json
{
  "body": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "✅ " },
          { "type": "text", "text": "Output Ready", "marks": [{ "type": "strong" }] }
        ]
      },
      { "type": "blockCard", "attrs": { "url": "https://drive.google.com/file/d/..." } },
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "(Automated message)", "marks": [{ "type": "em" }] }
        ]
      }
    ]
  }
}
```

The three top-level nodes render as:

1. A short title paragraph with a checkmark and a bold "Output Ready" label.
2. The smart-link card itself, pulling thumbnail and metadata from the linked URL.
3. A small italic footer that signals this came from automation rather than a human.

## Building the ADF body in JSONata

If the URL is dynamic per loop iteration (which it usually is), build the ADF body in a `json-transformer` step. Take the URL as input, return the full document structure.

```jsonata
(
  $fileUrl := "https://drive.google.com/file/d/" & file.id & "/view";

  {
    "body": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "✅ " },
            { "type": "text", "text": "Output Ready", "marks": [{ "type": "strong" }] }
          ]
        },
        { "type": "blockCard", "attrs": { "url": $fileUrl } },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "(Automated message)", "marks": [{ "type": "em" }] }
          ]
        }
      ]
    }
  }
)
```

Then the HTTP step references this transform's result as its body.

## Why this over the alternative

The two alternatives are:

1. **v2 plain text body with a URL.** Cheaper and simpler. Renders as a clickable hyperlink. No card. Acceptable if visual richness doesn't matter to you.
2. **v3 with a `text` node that has a `link` mark.** Renders the same as a plain-text URL with a hyperlink. Not a card. Don't bother going to ADF if you're just going to put a plain link in it.

`blockCard` (or `inlineCard` for cards embedded inside a paragraph) is the only node type that gives you the smart-link rendering. If you want the card, you must use one of those node types.

## A note on permissions

The card preview only renders fully when the user viewing the Jira ticket has access to the linked file. If they don't, the card falls back to a generic placeholder. That's fine for internal team links where everyone has access to the underlying Drive folder; less useful for external-facing tickets.

## Examples in this portfolio

- [Workflow 03. Multi-System State Verification](../workflows/03-multi-system-state-verification/): posts a comment with a `blockCard` linking to the downstream output file after a successful transition.
