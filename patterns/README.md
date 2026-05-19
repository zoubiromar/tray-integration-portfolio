# Patterns

Reusable building blocks I lean on across most of my Tray.io workflows. Each pattern has a short writeup with a concrete example pulled from one of the workflows in this portfolio.

If you're trying to reach a specific design problem, jump to:

| If you need to... | Use |
|---|---|
| Stop a workflow from re-processing rows on every scheduled run | [Idempotent skip gates](./idempotent-skip-gates.md) |
| Find a ticket by something other than its key (e.g., a custom field value) | [ID resolution strategies](./id-resolution-strategies.md) |
| Handle two distinct input shapes in one workflow without coupling them | [Per-branch namespacing](./per-branch-namespacing.md) |
| Update a record without losing ownership state | [Owner preservation](./owner-preservation.md) |
| Append to a text field that has no native append operation | [Note appending](./note-appending.md) |
| Post a Jira comment with a smart-link preview card | [ADF rich comments](./adf-rich-comments.md) |
| Validate primary-source state against an adjacent system before acting | [Cross-system verification](./cross-system-verification.md) |
| Route step errors to a dedicated alerting workflow | [Error handling with downstream alerting](./error-handling-with-alerting.md) |
