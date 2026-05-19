# Owner preservation (read-then-write-back)

Salesforce assignment rules can silently override updates. Even when your "update record" call doesn't touch the `OwnerId` field, an assignment rule on the object can re-evaluate and reassign ownership in the same transaction. The safest defense: read the current `OwnerId` at the top of your loop iteration, and write it back at the end of the iteration, regardless of whether you needed to change it.

## When to use

- Any Salesforce automation that updates a record on which assignment rules are configured.
- Any case where silent ownership drift would be a problem (i.e., almost always, because nothing fails loudly when an assignment rule re-routes a case behind your back).
- Specifically: the path in your workflow where you don't *intend* to change ownership but you're touching the record. The ownership-changing path doesn't need this, because you're already setting `OwnerId` to your target value.

## The setup

In the Salesforce milestone graduation workflow, integrated merchants have their case ownership re-routed to a different queue. That path is straightforward: set `OwnerId` to the new queue ID.

The non-integrated path is the dangerous one. The intent is to update milestone records and append a note to the case, then leave the case where it is. But the case object has assignment rules. Even with `toggle_active_assignment_rules` set to `Disable active assignment rules`, Salesforce has been observed re-evaluating ownership when other fields on the case are updated. The note-update touches the case. That's enough to trip a re-evaluation.

## The pattern

**Step 1 (top of loop iteration): read the current owner.**

In the same `find_records` call where you read the notes field, also request `OwnerId`.

```
Salesforce → Find records → Case
  fields: [Menu_Team_Notes__c, OwnerId]
  conditions: [Id = <SF_CASE_ID>]
```

**Step 2 (the work): do your updates as planned.**

Update milestones, append notes, whatever your workflow does.

**Step 3 (end of loop iteration, non-integrated path only): write the same owner back.**

In the case-update step that handles notes, also write `OwnerId` to the value you captured in step 1.

```
Salesforce → Update record → Case
  object_id: <SF_CASE_ID>
  fields:
    - Menu_Team_Notes__c = <appended notes>
    - OwnerId = $.steps.salesforce-1.records[0].OwnerId    // ← this is the safety
  toggle_active_assignment_rules: Disable
```

If an assignment rule fired and tried to reassign between step 1 and step 3, the explicit `OwnerId` write in step 3 restores the original owner. The cost is one extra field on the update, which is free.

## Why this over the alternative

The two alternatives both fail:

1. **Trust `toggle_active_assignment_rules: Disable`.** Doesn't always work in practice. Salesforce has internal automation (process builders, flows, triggers, validation rules) that can run regardless of how the API call was made. The disable flag controls one specific class of override, not all of them.
2. **Audit ownership after the fact and re-route if wrong.** Too late. The case has already shown up in the wrong queue, the wrong team has already seen it, and you're now chasing your own automation around.

The read-then-write-back pattern costs one extra field read and one extra field write per iteration. That's worth it for a class of bug that would otherwise be invisible until someone complains about cases showing up in the wrong queue.

## Examples in this portfolio

- [Workflow 02. Salesforce Milestone Auto-Graduation](../workflows/02-salesforce-milestone-graduation/): non-integrated path captures `OwnerId` in the initial Find Case call and writes it back in the case Update step.
