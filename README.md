# Tray.io Integration Portfolio

Real iPaaS workflows I designed and shipped, anonymized for public viewing. Each one solves an actual production problem at a marketplace company: catalog onboarding, vendor coordination, ticket lifecycle automation. The original workflows run in Tray.io. The code samples here are the JSONata expressions, JavaScript snippets, and architectural choices I wrote to make them work.

## Who this is for

- Hiring managers looking at iPaaS / integration roles (Tray, Workato, Zapier, n8n, Make, MuleSoft)
- Engineers evaluating "can this person actually design and ship production integrations"
- Recruiters comparing my profile to other automation candidates

## What's inside

Three workflows, each in its own folder with a README, an architecture diagram, anonymized snippets, and a section on the patterns I'd want a peer to learn from it.

### [01. Dual-Mode Dispatcher](./workflows/01-dual-mode-dispatcher/)

One Snowflake-driven workflow that handles two completely different ticket-submission origins. Branches at the top of the loop based on a `BATCH_TYPE` column, then uses two different Jira-key resolution strategies (regex extraction vs. JQL search by custom field) before converging on the same transition logic. Avoids cross-branch JSONata coupling by giving each lane its own step namespace.

**Highlight:** the heavy SQL runs as a Snowflake task on its own warehouse and writes to a materialized table. The Tray workflow only reads that table. That separation kills the connector-timeout class of bugs you hit when iPaaS tools try to run expensive queries inline.

**Stack:** Snowflake, Jira REST API v3, JavaScript script steps, JSONata.

### [02. Salesforce Milestone Auto-Graduation](./workflows/02-salesforce-milestone-graduation/)

Reads Snowflake to identify merchants who cleared a coverage threshold, then auto-graduates their onboarding case in Salesforce. Updates custom milestone records (not standard `CaseMilestone`), appends dated notes, and routes the case to one of two queues based on integration status. Skip-if-already-processed gate prevents re-processing on every 30-minute cycle.

**Highlight:** the owner-preservation safety pattern. Even when the workflow only intends to update milestones and notes, it reads the Case `OwnerId` at the start of each iteration and writes it back at the end. Salesforce assignment rules can silently override updates, so this is belt-and-suspenders defense against ownership drift.

**Stack:** Snowflake, Salesforce REST API (custom objects), JSONata.

### [03. Multi-System State Verification](./workflows/03-multi-system-state-verification/)

The most architecturally interesting of the three. Reads a vendor-progress Google Sheet, but doesn't blindly trust it. When a row says "completed," the workflow lists a Google Drive folder to confirm the corresponding file has actually been consumed downstream. Only then does it transition the Jira ticket. Closes the loop by querying Snowflake for the downstream output file location and writing that link back into the source sheet plus posting it as a smart-link card comment on the Jira ticket.

**Highlight:** cross-system state reconciliation. Most iPaaS workflows treat their primary source as truth. This one validates the source against an adjacent system before acting, which is the right instinct for any pipeline where two systems can disagree.

**Stack:** Google Sheets, Google Drive, Snowflake, Jira REST API v3 (including ADF `blockCard` for rich comments), JSONata.

## Patterns folder

The `patterns/` directory pulls out the reusable building blocks I lean on across most of my workflows. Idempotent skip gates. Error handling with downstream alerting. Two different ID-resolution strategies and when to use each. The note-append read-then-write pattern. ADF-formatted Jira comments with smart-link previews. Each pattern has a short writeup with a concrete example and the situations where it applies.

[Browse patterns →](./patterns/)

## What you won't find here

- Tray.io workflow JSON exports themselves. The interesting parts of those files are the expression nodes and the architectural decisions; the rest is connector boilerplate. I've extracted what matters into readable snippets instead.
- Anything that identifies the company. Real ticket prefixes, custom field IDs, queue IDs, internal table names, and product code names are replaced with descriptive placeholders. A mapping I keep locally drives the substitutions.
- Inflated impact claims. Where I can attest to a measurable outcome (tickets transitioned per day, hours saved per week), I say so. Where I can't, I don't pad.

## A short note on Tray.io for non-iPaaS readers

Tray.io is a visual workflow builder for integrations. Think of it as the same problem space as Zapier or n8n, but built for higher-volume production use. You compose workflows out of pre-built connector nodes (Salesforce, Snowflake, Slack, Drive, HTTP, etc.) plus expression nodes that transform data between them. The expression language is [JSONata](https://jsonata.org/), with the option to drop into JavaScript when you need it. Workflows are stored as JSON and can be exported, versioned, and reviewed. That JSON is what I've drawn the snippets here from.

If you've worked with Workato, Make, or n8n: same category, slightly different idioms.

## About me

I'm a Data Automation Specialist at DoorDash on the SPOT Projects team, based in Montreal. Bilingual French and English.

Concrete proof points from the role:

- Six production Tray.io workflows on the catalog onboarding pipeline. Over 370,000 tickets have been routed through them since August 2025.
- Authored the team's Tray.IO Automation Guide on Confluence: seven standardized workflow pages with embedded Mermaid diagrams, used by Catalog and SPOT stakeholders.
- Built the org's first Salesforce API integration via Tray.io (the workflow documented at [02-salesforce-milestone-graduation](./workflows/02-salesforce-milestone-graduation/)).

Background before automation engineering: data science research (TensorFlow, ML for material-behavior prediction) and software development (production-floor data visualization in C#). Master of Engineering in Information Technology from ETS Montreal.

Looking for integration engineer / iPaaS roles with Canadian employers.

Reach me on [LinkedIn](https://www.linkedin.com/in/omarzoubir/) or by email at omarzoubir97@gmail.com.
