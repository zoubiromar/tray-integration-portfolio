# Eligibility Query (Pseudocode)

The Snowflake query identifies merchants in a regulated product category whose catalogs have reached the data-quality bar that lets onboarding move past the manual graduation gate. It joins implementation-request records, store metadata, raw SKU rows, the canonical SKU mapping table, and the open Salesforce cases for each business, then filters to the cohort that should advance.

Output is fed straight into a Tray loop; each row drives one Salesforce case update downstream.

## CTE walkthrough

### onshore_businesses
Selects the base population. Filters: implementation-request stage = `Closed Won`, sales-org excludes a self-delivery sub-segment, country = United States, primary merchant category = the regulated category in scope, and close date within the recent window. The result is a list of business IDs eligible to be evaluated.

### store_per_business
Reduces each business to one representative store row from `DIMENSION_STORE`. Uses `ROW_NUMBER()` partitioned by business, ordered by store ID, and keeps `rn = 1`. Carries forward `pos_provider` and `is_active` so the downstream filter can require a still-pending activation (`is_active = 0`).

### esku_rows
Pulls the merchant's raw enriched-SKU records from `ENRICHED_SKU`, joined to `DIMENSION_BUSINESS` for a category-specific filter. Scopes to the last 30 days of created SKUs and to the auto-build workflow type. Extracts the `merchant_supplied_id` from the SKU's JSON payload using `TRY_PARSE_JSON` with a regex fallback, since the column has mixed JSON-valid and JSON-broken rows.

### ump_coverage
Computes the coverage ratio. Left-joins `esku_rows` against `CATALOG_UMP` on `(business_id, merchant_supplied_id)`, then aggregates per business into `total_eskus`, `eskus_in_ump`, and `pct_esku_with_ump`. UMP is the canonical SKU mapping table; a SKU is "covered" if it has a matching entry there. NULL-safe trimming on the join keys handles whitespace and missing-ID rows.

### sf_cases
Picks the one open Salesforce case per business that the workflow will update. Joins `FACT_SALESFORCE_ACCOUNT` to `FACT_SALESFORCE_CASE` with a fixed record-type filter to scope to onboarding cases. Excludes deleted and closed cases. `ROW_NUMBER()` partitioned by business breaks ties when a merchant has more than one open case.

## Final select shape

Returns one row per business with:

- `business_id`
- `business_name`
- `pos_provider`
- `total_eskus`
- `eskus_in_ump`
- `pct_esku_in_ump`
- `salesforce_case_id`
- `salesforce_case_number`

## Eligibility thresholds

Three filters applied on the final select:

- `pct_esku_with_ump >= 0.70`: at least 70% of the merchant's recent SKUs are mapped in the canonical SKU table. The bar the analyst team had been checking by hand.
- `total_eskus > 100`: minimum catalog size, so the percentage is meaningful and not driven by a handful of SKUs.
- `is_active = 0`: the store has not yet been activated. Already-active merchants are out of scope; the workflow only graduates pending ones.

Rows that clear all three thresholds are the merchants the workflow auto-graduates on the next 30-minute tick.
