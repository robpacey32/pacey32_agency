-- =========================================================
-- TAX QA
-- pacey32-agency
--
-- Objects:
--   City.vw_city_tax_current
--   City.tax_brackets
--   City.tax_rules
--   City.tax_summary
--   City.NHLTaxSchedule
--   City.vw_nhl_tax_schedule_allocation
--   City.vw_tax_brackets
-- =========================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();

-- =========================================================
-- TX001
-- vw_city_tax_current: one row per venue
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        venueLocation,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.vw_city_tax_current`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX001',
    'city_tax unique venue',
    'Grain',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'vw_city_tax_current should contain exactly one current row per venueLocation.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX001',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    CAST(venueLocation AS STRING),
    'Duplicate venueLocation in vw_city_tax_current.',
    TO_JSON(t)
FROM (
    SELECT
        venueLocation,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.vw_city_tax_current`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
) t;


-- =========================================================
-- TX002
-- vw_city_tax_current: all current NHL venues covered
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        t.triCode,
        t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.City.vw_city_tax_current` c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX002',
    'Current NHL venue tax coverage',
    'Coverage',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL venue should have a current tax record.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX002',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    CAST(triCode AS STRING),
    'Current NHL venue missing from vw_city_tax_current.',
    TO_JSON(t)
FROM (
    SELECT
        x.triCode,
        x.venueLocation
    FROM `pacey32-agency.Team.TeamList` x
    LEFT JOIN `pacey32-agency.City.vw_city_tax_current` c
        ON x.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
) t;


-- =========================================================
-- TX003
-- vw_city_tax_current: required fields complete
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE venueLocation IS NULL
       OR TRIM(venueLocation) = ''
       OR country IS NULL
       OR country_code IS NULL
       OR combined_top_marginal_income_tax_rate IS NULL
       OR federal_income_tax_top_rate IS NULL
       OR state_income_tax_rate IS NULL
       OR combined_sales_tax_rate IS NULL
       OR sales_tax_basis IS NULL
       OR income_tax_rate_basis IS NULL
       OR tax_year IS NULL
       OR scrape_datetime IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX003',
    'city_tax required fields complete',
    'Completeness',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Required tax fields should be populated for every current NHL city tax record.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX004
-- vw_city_tax_current: supported countries
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE country_code NOT IN ('US', 'CA')
       OR country_code IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX004',
    'city_tax supported country',
    'Validity',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current NHL city tax records should be US or Canadian.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX005
-- vw_city_tax_current: valid rate ranges
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE combined_top_marginal_income_tax_rate < 0
       OR combined_top_marginal_income_tax_rate > 100
       OR federal_income_tax_top_rate < 0
       OR federal_income_tax_top_rate > 100
       OR state_income_tax_rate < 0
       OR state_income_tax_rate > 100
       OR combined_sales_tax_rate < 0
       OR combined_sales_tax_rate > 100
       OR sales_tax_state_rate < 0
       OR sales_tax_state_rate > 100
       OR sales_tax_average_local_rate < 0
       OR sales_tax_average_local_rate > 100
       OR gst_hst_rate < 0
       OR gst_hst_rate > 100
       OR pst_rate < 0
       OR pst_rate > 100
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX005',
    'city_tax valid rate ranges',
    'Validity',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax rates should be between 0 and 100 percent.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX006
-- vw_city_tax_current: combined income tax arithmetic
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        *,
        combined_top_marginal_income_tax_rate
          - (federal_income_tax_top_rate + state_income_tax_rate)
          AS difference
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE ABS(
        combined_top_marginal_income_tax_rate
        - (federal_income_tax_top_rate + state_income_tax_rate)
    ) > 0.001
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX006',
    'Combined income tax arithmetic',
    'Arithmetic',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Combined marginal income tax should equal federal plus state/provincial rate.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX007
-- vw_city_tax_current: US sales tax arithmetic
-- Allow small source rounding differences.
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        *,
        combined_sales_tax_rate
          - (sales_tax_state_rate + sales_tax_average_local_rate)
          AS difference
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE country_code = 'US'
      AND ABS(
          combined_sales_tax_rate
          - (sales_tax_state_rate + sales_tax_average_local_rate)
      ) > 0.05
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX007',
    'US sales tax arithmetic',
    'Arithmetic',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'US combined sales tax should reconcile to state plus average local tax within 0.05 percentage points to allow source rounding.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX008
-- vw_city_tax_current: Canadian sales tax arithmetic
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        *,
        combined_sales_tax_rate
          - (COALESCE(gst_hst_rate, 0) + COALESCE(pst_rate, 0))
          AS difference
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE country_code = 'CA'
      AND ABS(
          combined_sales_tax_rate
          - (COALESCE(gst_hst_rate, 0) + COALESCE(pst_rate, 0))
      ) > 0.001
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX008',
    'Canadian sales tax arithmetic',
    'Arithmetic',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Canadian combined sales tax should equal GST/HST plus PST.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX009
-- vw_city_tax_current: current tax year consistency
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH latest AS (
    SELECT MAX(tax_year) AS tax_year
    FROM `pacey32-agency.City.vw_city_tax_current`
),
failures AS (
    SELECT c.*
    FROM `pacey32-agency.City.vw_city_tax_current` c
    CROSS JOIN latest l
    WHERE c.tax_year != l.tax_year
       OR c.tax_year IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX009',
    'city_tax tax year consistency',
    'Freshness',
    'City',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'All city_tax records should use the same current tax year.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX010
-- tax_brackets: unique bracket grain
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        tax_year,
        country_code,
        jurisdiction,
        jurisdiction_type,
        filing_status,
        bracket_min,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.tax_brackets`
    GROUP BY
        tax_year,
        country_code,
        jurisdiction,
        jurisdiction_type,
        filing_status,
        bracket_min
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX010',
    'Tax bracket grain',
    'Grain',
    'City',
    'tax_brackets',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax brackets should be unique by year, country, jurisdiction, filing status and bracket minimum.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX011
-- tax_brackets: required fields
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.tax_brackets`
    WHERE tax_year IS NULL
       OR country_code IS NULL
       OR jurisdiction IS NULL
       OR jurisdiction_type IS NULL
       OR filing_status IS NULL
       OR bracket_min IS NULL
       OR tax_rate IS NULL
       OR source_url IS NULL
       OR scrape_datetime IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX011',
    'Tax bracket required fields',
    'Completeness',
    'City',
    'tax_brackets',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Required tax bracket fields should be populated.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX012
-- tax_brackets: valid bracket ranges and rates
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.tax_brackets`
    WHERE bracket_min < 0
       OR (bracket_max IS NOT NULL AND bracket_max < bracket_min)
       OR tax_rate < 0
       OR tax_rate > 100
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX012',
    'Tax bracket valid ranges',
    'Validity',
    'City',
    'tax_brackets',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax bracket boundaries and rates should be valid.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX013
-- tax_brackets: first bracket begins at zero
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH x AS (
    SELECT
        tax_year,
        country_code,
        jurisdiction,
        filing_status,
        MIN(bracket_min) AS first_bracket_min
    FROM `pacey32-agency.City.tax_brackets`
    GROUP BY
        tax_year,
        country_code,
        jurisdiction,
        filing_status
),
failures AS (
    SELECT *
    FROM x
    WHERE first_bracket_min != 0
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX013',
    'Tax brackets start at zero',
    'Validity',
    'City',
    'tax_brackets',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each jurisdiction filing schedule should begin with a zero lower boundary.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX014
-- tax_brackets: exactly one open-ended top bracket
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH x AS (
    SELECT
        tax_year,
        country_code,
        jurisdiction,
        filing_status,
        COUNTIF(bracket_max IS NULL) AS open_ended_brackets
    FROM `pacey32-agency.City.tax_brackets`
    GROUP BY
        tax_year,
        country_code,
        jurisdiction,
        filing_status
),
failures AS (
    SELECT *
    FROM x
    WHERE open_ended_brackets != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX014',
    'One open-ended top bracket',
    'Validity',
    'City',
    'tax_brackets',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each jurisdiction filing schedule should contain exactly one open-ended top bracket.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX015
-- tax_brackets: no overlapping brackets
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH ordered AS (
    SELECT
        *,
        LAG(bracket_max) OVER (
            PARTITION BY
                tax_year,
                country_code,
                jurisdiction,
                filing_status
            ORDER BY bracket_min
        ) AS previous_max
    FROM `pacey32-agency.City.tax_brackets`
),
failures AS (
    SELECT *
    FROM ordered
    WHERE previous_max IS NOT NULL
      AND bracket_min < previous_max
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX015',
    'No overlapping tax brackets',
    'Validity',
    'City',
    'tax_brackets',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax brackets within a jurisdiction should not overlap.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX016
-- vw_tax_brackets: row reconciliation
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH counts AS (
    SELECT
        (SELECT COUNT(*) FROM `pacey32-agency.City.tax_brackets`) AS source_cnt,
        (SELECT COUNT(*) FROM `pacey32-agency.City.vw_tax_brackets`) AS view_cnt
),
failures AS (
    SELECT *
    FROM counts
    WHERE source_cnt != view_cnt
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX016',
    'Tax bracket view row reconciliation',
    'Reconciliation',
    'City',
    'vw_tax_brackets',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'vw_tax_brackets should contain exactly one row for every source tax bracket.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX017
-- vw_tax_brackets: derived fields
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.vw_tax_brackets`
    WHERE currency_code IS NULL
       OR jurisdiction_id IS NULL
       OR ABS(rate_decimal - ROUND(tax_rate / 100.0, 6)) > 0.000001
       OR (bracket_max IS NULL AND bracket_max_calc != 999999999999.0)
       OR (bracket_max IS NOT NULL AND bracket_max_calc != bracket_max)
       OR is_top_bracket != (bracket_max IS NULL)
       OR is_zero_rate != (tax_rate = 0)
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX017',
    'Tax bracket derived fields',
    'Arithmetic',
    'City',
    'vw_tax_brackets',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Derived tax bracket fields should reconcile to the source bracket.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX018
-- vw_tax_brackets: bracket ordering
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH expected AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY
                tax_year,
                country_code,
                jurisdiction,
                filing_status
            ORDER BY bracket_min
        ) AS expected_order
    FROM `pacey32-agency.City.vw_tax_brackets`
),
failures AS (
    SELECT *
    FROM expected
    WHERE bracket_order != expected_order
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX018',
    'Tax bracket ordering',
    'Arithmetic',
    'City',
    'vw_tax_brackets',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'bracket_order should follow ascending bracket minimum within each tax schedule.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX019
-- tax_rules: unique rule grain
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        tax_year,
        country_code,
        jurisdiction_id,
        rule_key,
        rule_order,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.tax_rules`
    GROUP BY
        tax_year,
        country_code,
        jurisdiction_id,
        rule_key,
        rule_order
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX019',
    'Tax rule grain',
    'Grain',
    'City',
    'tax_rules',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax rules should be unique by tax year, jurisdiction, rule key and rule order.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX020
-- tax_rules: required fields
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.tax_rules`
    WHERE tax_year IS NULL
       OR country_code IS NULL
       OR country IS NULL
       OR jurisdiction IS NULL
       OR jurisdiction_id IS NULL
       OR currency_code IS NULL
       OR rule_key IS NULL
       OR rule_type IS NULL
       OR rule_name IS NULL
       OR applies_to IS NULL
       OR source_url IS NULL
       OR scrape_datetime IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX020',
    'Tax rule required fields',
    'Completeness',
    'City',
    'tax_rules',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Required tax rule fields should be populated.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX021
-- tax_rules: supported currencies
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.tax_rules`
    WHERE NOT (
        (country_code = 'US' AND currency_code = 'USD')
        OR (country_code = 'CA' AND currency_code = 'CAD')
        OR (
            country_code = 'SE'
            AND rule_key = 'athlete_nonresident_tax'
            AND applies_to = 'nonresident_athlete'
            AND currency_code = 'USD'
        )
    )
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX021',
    'Tax rule currency mapping',
    'Validity',
    'City',
    'tax_rules',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax rule currencies should match the calculation currency defined for each supported tax rule.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX022
-- tax_summary: one row per venue
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        venueLocation,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.tax_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX022',
    'tax_summary unique venue',
    'Grain',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'tax_summary should contain one row per venue.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX023
-- tax_summary: exact city_tax coverage
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        COALESCE(c.venueLocation, s.venueLocation) AS venueLocation
    FROM `pacey32-agency.City.vw_city_tax_current` c
    FULL OUTER JOIN `pacey32-agency.City.tax_summary` s
        ON c.venueLocation = s.venueLocation
    WHERE c.venueLocation IS NULL
       OR s.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX023',
    'tax_summary city coverage',
    'Reconciliation',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'tax_summary should contain exactly the city population present in city_tax.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX024
-- tax_summary: source tax values reconcile
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        c.venueLocation,
        c.combined_top_marginal_income_tax_rate AS source_income,
        s.combined_top_marginal_income_tax_rate AS summary_income,
        c.combined_sales_tax_rate AS source_sales,
        s.combined_sales_tax_rate AS summary_sales
    FROM `pacey32-agency.City.vw_city_tax_current` c
    JOIN `pacey32-agency.City.tax_summary` s
        USING (venueLocation)
    WHERE c.combined_top_marginal_income_tax_rate
              != s.combined_top_marginal_income_tax_rate
       OR c.combined_sales_tax_rate != s.combined_sales_tax_rate
       OR c.tax_year != s.tax_year
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX024',
    'tax_summary source reconciliation',
    'Reconciliation',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Core tax values in tax_summary should reconcile exactly to city_tax.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX025
-- tax_summary: NHL averages
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH expected AS (
    SELECT
        AVG(combined_top_marginal_income_tax_rate) AS avg_income,
        AVG(combined_sales_tax_rate) AS avg_sales
    FROM `pacey32-agency.City.vw_city_tax_current`
),
failures AS (
    SELECT s.*
    FROM `pacey32-agency.City.tax_summary` s
    CROSS JOIN expected e
    WHERE ABS(s.nhl_avg_income_tax_rate - e.avg_income) > 0.000001
       OR ABS(s.nhl_avg_sales_tax_rate - e.avg_sales) > 0.000001
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX025',
    'tax_summary NHL averages',
    'Arithmetic',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'NHL average tax rates should equal the averages across vw_city_tax_current.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX026
-- tax_summary: versus-average arithmetic
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.tax_summary`
    WHERE income_tax_vs_nhl_avg != ROUND(
              combined_top_marginal_income_tax_rate
              - nhl_avg_income_tax_rate,
              4
          )
       OR sales_tax_vs_nhl_avg != ROUND(
              combined_sales_tax_rate
              - nhl_avg_sales_tax_rate,
              4
          )
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX026',
    'tax_summary versus-average arithmetic',
    'Arithmetic',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax versus-NHL-average fields should match their defined arithmetic.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX027
-- tax_summary: rank arithmetic
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH expected AS (
    SELECT
        venueLocation,
        RANK() OVER (
            ORDER BY combined_top_marginal_income_tax_rate ASC
        ) AS expected_income_rank,
        RANK() OVER (
            ORDER BY combined_sales_tax_rate ASC
        ) AS expected_sales_rank
    FROM `pacey32-agency.City.tax_summary`
),
failures AS (
    SELECT
        s.*,
        e.expected_income_rank,
        e.expected_sales_rank
    FROM `pacey32-agency.City.tax_summary` s
    JOIN expected e
        USING (venueLocation)
    WHERE s.income_tax_rank != e.expected_income_rank
       OR s.sales_tax_rank != e.expected_sales_rank
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX027',
    'tax_summary ranks',
    'Arithmetic',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Income and sales tax ranks should match ascending NHL-city tax rates.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX028
-- tax_summary: NHL city count
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH expected AS (
    SELECT COUNT(*) AS expected_cnt
    FROM `pacey32-agency.City.vw_city_tax_current`
),
failures AS (
    SELECT s.*
    FROM `pacey32-agency.City.tax_summary` s
    CROSS JOIN expected e
    WHERE s.nhl_city_count != e.expected_cnt
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX028',
    'tax_summary NHL city count',
    'Arithmetic',
    'City',
    'tax_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'nhl_city_count should equal the number of current NHL city tax records.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX029
-- NHLTaxSchedule: unique team-game grain
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        season,
        game_id,
        team_code,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.NHLTaxSchedule`
    GROUP BY season, game_id, team_code
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX029',
    'NHLTaxSchedule unique team-game grain',
    'Grain',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'NHLTaxSchedule should contain one row per season, game and team.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX030
-- NHLTaxSchedule: required fields
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE season IS NULL
       OR game_id IS NULL
       OR game_date IS NULL
       OR game_type IS NULL
       OR team_code IS NULL
       OR opponent IS NULL
       OR home_away IS NULL
       OR venue_name IS NULL
       OR venue_city IS NULL
       OR country IS NULL
       OR country_code IS NULL
       OR jurisdiction_id IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX030',
    'NHLTaxSchedule required fields',
    'Completeness',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Required NHL tax schedule fields should be populated.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX031
-- NHLTaxSchedule: valid home/away values
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE LOWER(home_away) NOT IN ('home', 'away')
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX031',
    'NHLTaxSchedule home-away values',
    'Validity',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'home_away should contain only Home or Away.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX032
-- NHLTaxSchedule: team cannot play itself
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE team_code = opponent
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX032',
    'NHLTaxSchedule opponent validity',
    'Validity',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'A team cannot be its own opponent.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX033
-- NHLTaxSchedule: exactly two team perspectives per game
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        season,
        game_id,
        COUNT(*) AS cnt,
        COUNT(DISTINCT team_code) AS teams,
        COUNTIF(LOWER(home_away) = 'home') AS home_rows,
        COUNTIF(LOWER(home_away) = 'away') AS away_rows
    FROM `pacey32-agency.City.NHLTaxSchedule`
    GROUP BY season, game_id
    HAVING COUNT(*) != 2
        OR COUNT(DISTINCT team_code) != 2
        OR COUNTIF(LOWER(home_away) = 'home') != 1
        OR COUNTIF(LOWER(home_away) = 'away') != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX033',
    'NHLTaxSchedule game perspectives',
    'Integrity',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each game should have exactly one Home and one Away team perspective.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX034
-- NHLTaxSchedule: opponent symmetry
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH paired AS (
    SELECT
        a.season,
        a.game_id,
        a.team_code,
        a.opponent,
        b.team_code AS reciprocal_team,
        b.opponent AS reciprocal_opponent
    FROM `pacey32-agency.City.NHLTaxSchedule` a
    LEFT JOIN `pacey32-agency.City.NHLTaxSchedule` b
        ON a.season = b.season
       AND a.game_id = b.game_id
       AND a.team_code = b.opponent
       AND a.opponent = b.team_code
),
failures AS (
    SELECT *
    FROM paired
    WHERE reciprocal_team IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX034',
    'NHLTaxSchedule opponent symmetry',
    'Integrity',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each team-game row should have the reciprocal opponent row.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX035
-- NHLTaxSchedule: both team rows share jurisdiction
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        season,
        game_id,
        COUNT(DISTINCT jurisdiction_id) AS jurisdictions
    FROM `pacey32-agency.City.NHLTaxSchedule`
    GROUP BY season, game_id
    HAVING COUNT(DISTINCT jurisdiction_id) != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX035',
    'NHLTaxSchedule game jurisdiction consistency',
    'Integrity',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Both team perspectives for a game should map to the same tax jurisdiction.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX036
-- Regular-season tax schedule game totals
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH tax_schedule AS (
    SELECT
        season,
        team_code,
        COUNT(DISTINCT game_id) AS tax_games
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE game_type = 2
    GROUP BY
        season,
        team_code
),

source_team_games AS (
    SELECT
        season,
        game_id,
        home_team_abbrev AS team_code
    FROM `nhl-pacey32-github.NHL_Views.Schedule`
    WHERE game_type = 2

    UNION ALL

    SELECT
        season,
        game_id,
        away_team_abbrev AS team_code
    FROM `nhl-pacey32-github.NHL_Views.Schedule`
    WHERE game_type = 2
),

source_schedule AS (
    SELECT
        season,
        team_code,
        COUNT(DISTINCT game_id) AS expected_games
    FROM source_team_games
    GROUP BY
        season,
        team_code
),

failures AS (
    SELECT
        t.season,
        t.team_code,
        t.tax_games,
        s.expected_games
    FROM tax_schedule t
    LEFT JOIN source_schedule s
        ON t.season = s.season
       AND t.team_code = s.team_code
    WHERE s.team_code IS NULL
       OR t.tax_games != s.expected_games
)

SELECT
    v_run_id,
    v_run_datetime,
    'TX036',
    'Regular-season tax schedule game totals',
    'Coverage',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each tax schedule team-season should contain the same number of regular-season games as the canonical NHL Schedule.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX037
-- NHLTaxSchedule: neutral-site flag consistency
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        season,
        game_id,
        COUNT(DISTINCT CAST(neutral_site AS STRING)) AS flag_values
    FROM `pacey32-agency.City.NHLTaxSchedule`
    GROUP BY season, game_id
    HAVING COUNT(DISTINCT CAST(neutral_site AS STRING)) != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX037',
    'Neutral-site flag consistency',
    'Integrity',
    'City',
    'NHLTaxSchedule',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Both team perspectives should have the same neutral_site value.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX038
-- Allocation view: unique jurisdiction grain
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT
        season,
        team_code,
        jurisdiction_id,
        COUNT(*) AS cnt
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    GROUP BY season, team_code, jurisdiction_id
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX038',
    'Tax allocation unique jurisdiction grain',
    'Grain',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax allocation should contain one row per season, team and jurisdiction.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX039
-- Allocation view: valid counts and percentages
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    WHERE jurisdiction_id IS NULL
       OR games_in_jurisdiction <= 0
       OR total_games <= 0
       OR games_in_jurisdiction > total_games
       OR salary_allocation_pct <= 0
       OR salary_allocation_pct > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX039',
    'Tax allocation valid values',
    'Validity',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Tax schedule allocation counts and percentages should be valid.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX040
-- Allocation view: arithmetic
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    WHERE ABS(
        salary_allocation_pct
        - SAFE_DIVIDE(games_in_jurisdiction, total_games)
    ) > 0.000000001
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX040',
    'Tax allocation arithmetic',
    'Arithmetic',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'salary_allocation_pct should equal games_in_jurisdiction divided by total_games.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX041
-- Allocation view: team allocations sum to one
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH x AS (
    SELECT
        season,
        team_code,
        SUM(salary_allocation_pct) AS total_allocation
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    GROUP BY season, team_code
),
failures AS (
    SELECT *
    FROM x
    WHERE ABS(total_allocation - 1.0) > 0.000000001
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX041',
    'Team tax allocations sum to one',
    'Arithmetic',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Jurisdiction salary allocations should sum to 1.0 for each team-season.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX042
-- Allocation view: total games reconcile to schedule
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH schedule AS (
    SELECT
        season,
        team_code,
        COUNT(*) AS expected_games
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE game_type = 2
    GROUP BY season, team_code
),
allocation AS (
    SELECT
        season,
        team_code,
        MAX(total_games) AS total_games
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    GROUP BY season, team_code
),
failures AS (
    SELECT
        COALESCE(s.season, a.season) AS season,
        COALESCE(s.team_code, a.team_code) AS team_code,
        s.expected_games,
        a.total_games
    FROM schedule s
    FULL OUTER JOIN allocation a
        ON s.season = a.season
       AND s.team_code = a.team_code
    WHERE s.expected_games IS NULL
       OR a.total_games IS NULL
       OR s.expected_games != a.total_games
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX042',
    'Allocation total games reconciliation',
    'Reconciliation',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Allocation total_games should reconcile to regular-season NHLTaxSchedule games.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX043
-- Allocation view: jurisdiction counts reconcile
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH expected AS (
    SELECT
        season,
        team_code,
        jurisdiction_id,
        COUNT(*) AS expected_games
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE game_type = 2
    GROUP BY season, team_code, jurisdiction_id
),
actual AS (
    SELECT
        season,
        team_code,
        jurisdiction_id,
        games_in_jurisdiction
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
),
failures AS (
    SELECT
        COALESCE(e.season, a.season) AS season,
        COALESCE(e.team_code, a.team_code) AS team_code,
        COALESCE(e.jurisdiction_id, a.jurisdiction_id) AS jurisdiction_id,
        e.expected_games,
        a.games_in_jurisdiction
    FROM expected e
    FULL OUTER JOIN actual a
        ON e.season = a.season
       AND e.team_code = a.team_code
       AND e.jurisdiction_id = a.jurisdiction_id
    WHERE e.expected_games IS NULL
       OR a.games_in_jurisdiction IS NULL
       OR e.expected_games != a.games_in_jurisdiction
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX043',
    'Allocation jurisdiction reconciliation',
    'Reconciliation',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'games_in_jurisdiction should reconcile exactly to NHLTaxSchedule.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX044
-- Current NHL teams represented in allocation
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH latest_season AS (
    SELECT MAX(season) AS season
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
),
failures AS (
    SELECT
        t.triCode
    FROM `pacey32-agency.Team.TeamList` t
    CROSS JOIN latest_season l
    LEFT JOIN (
        SELECT DISTINCT
            season,
            team_code
        FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    ) a
        ON a.season = l.season
       AND a.team_code = t.triCode
    WHERE a.team_code IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX044',
    'Current NHL team allocation coverage',
    'Coverage',
    'City',
    'vw_nhl_tax_schedule_allocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL team should have tax jurisdiction allocation data for the latest included season.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX045
-- NHLTaxSchedule jurisdictions represented by tax model
--
-- US/CA game jurisdictions should be represented either by
-- tax brackets or tax rules. International neutral-site
-- jurisdictions may be represented by rules only.
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH schedule_jurisdictions AS (
    SELECT DISTINCT
        jurisdiction_id,
        country_code
    FROM `pacey32-agency.City.NHLTaxSchedule`
),
model_jurisdictions AS (
    SELECT DISTINCT jurisdiction_id
    FROM `pacey32-agency.City.vw_tax_brackets`

    UNION DISTINCT

    SELECT DISTINCT jurisdiction_id
    FROM `pacey32-agency.City.tax_rules`
),
failures AS (
    SELECT s.*
    FROM schedule_jurisdictions s
    LEFT JOIN model_jurisdictions m
        USING (jurisdiction_id)
    WHERE m.jurisdiction_id IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX045',
    'Schedule jurisdiction tax-model coverage',
    'Coverage',
    'City',
    'NHLTaxSchedule + Tax Model',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every game jurisdiction should be represented in the tax bracket or tax rule model.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX046
-- Current city tax jurisdictions represented in brackets
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH failures AS (
    SELECT c.*
    FROM `pacey32-agency.City.vw_city_tax_current` c
    WHERE NOT EXISTS (
        SELECT 1
        FROM `pacey32-agency.City.vw_tax_brackets` b
        WHERE b.tax_year = c.tax_year
          AND b.country_code = c.country_code
          AND (
                b.is_federal
                OR (
                    b.is_subnational
                    AND LOWER(b.jurisdiction) =
                        LOWER(c.state_province)
                )
          )
    )
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX046',
    'City tax bracket coverage',
    'Coverage',
    'City',
    'vw_city_tax_current + vw_tax_brackets',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each current city tax jurisdiction should have applicable bracket data for its tax year.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX047
-- Federal top rate reconciles to federal brackets
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH federal AS (
    SELECT
        tax_year,
        country_code,
        MAX(tax_rate) AS federal_top_rate
    FROM `pacey32-agency.City.vw_tax_brackets`
    WHERE is_federal
    GROUP BY tax_year, country_code
),
failures AS (
    SELECT
        c.venueLocation,
        c.tax_year,
        c.country_code,
        c.federal_income_tax_top_rate,
        f.federal_top_rate
    FROM `pacey32-agency.City.vw_city_tax_current` c
    LEFT JOIN federal f
        ON c.tax_year = f.tax_year
       AND c.country_code = f.country_code
    WHERE f.federal_top_rate IS NULL
       OR c.federal_income_tax_top_rate != f.federal_top_rate
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX047',
    'Federal top tax rate reconciliation',
    'Reconciliation',
    'City',
    'vw_city_tax_current + vw_tax_brackets',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current city federal top marginal rates should reconcile to the federal bracket schedules.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- TX048
-- State/provincial top rate reconciles to brackets
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestResults`
(
    run_id,
    run_datetime,
    test_id,
    test_name,
    category,
    source_dataset,
    source_object,
    season,
    severity,
    status,
    failure_count,
    description,
    details
)
WITH subnational AS (
    SELECT
        tax_year,
        country_code,
        LOWER(jurisdiction) AS jurisdiction,
        MAX(tax_rate) AS top_rate
    FROM `pacey32-agency.City.vw_tax_brackets`
    WHERE is_subnational
    GROUP BY
        tax_year,
        country_code,
        LOWER(jurisdiction)
),
failures AS (
    SELECT
        c.venueLocation,
        c.state_province,
        c.tax_year,
        c.country_code,
        c.state_income_tax_rate,
        s.top_rate
    FROM `pacey32-agency.City.vw_city_tax_current` c
    LEFT JOIN subnational s
        ON c.tax_year = s.tax_year
       AND c.country_code = s.country_code
       AND LOWER(c.state_province) = s.jurisdiction
    WHERE s.top_rate IS NULL
       OR ABS(c.state_income_tax_rate - s.top_rate) > 0.001
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX048',
    'State/provincial top tax rate reconciliation',
    'Reconciliation',
    'City',
    'vw_city_tax_current + vw_tax_brackets',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current city state/provincial top marginal rates should reconcile to the corresponding bracket schedules.',
    CAST(NULL AS STRING)
FROM failures;


-- =========================================================
-- Failure detail capture
-- Selected tests where row-level diagnostics are useful.
-- =========================================================

INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX006',
    'vw_city_tax_current',
    CAST(NULL AS INT64),
    venueLocation,
    'Combined income tax does not equal federal plus state/provincial tax.',
    TO_JSON(t)
FROM (
    SELECT
        venueLocation,
        country_code,
        combined_top_marginal_income_tax_rate,
        federal_income_tax_top_rate,
        state_income_tax_rate,
        combined_top_marginal_income_tax_rate
          - (federal_income_tax_top_rate + state_income_tax_rate)
          AS difference
    FROM `pacey32-agency.City.vw_city_tax_current`
    WHERE ABS(
        combined_top_marginal_income_tax_rate
        - (federal_income_tax_top_rate + state_income_tax_rate)
    ) > 0.001
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX015',
    'tax_brackets',
    CAST(tax_year AS INT64),
    CONCAT(
        country_code,
        '|',
        jurisdiction,
        '|',
        filing_status,
        '|',
        CAST(bracket_min AS STRING)
    ),
    'Tax bracket overlaps the previous bracket.',
    TO_JSON(t)
FROM (
    SELECT *
    FROM (
        SELECT
            tax_year,
            country_code,
            jurisdiction,
            filing_status,
            bracket_min,
            bracket_max,
            LAG(bracket_max) OVER (
                PARTITION BY
                    tax_year,
                    country_code,
                    jurisdiction,
                    filing_status
                ORDER BY bracket_min
            ) AS previous_max
        FROM `pacey32-agency.City.tax_brackets`
    )
    WHERE previous_max IS NOT NULL
      AND bracket_min < previous_max
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX033',
    'NHLTaxSchedule',
    CAST(season AS INT64),
    CAST(game_id AS STRING),
    'Game does not have exactly one Home and one Away team perspective.',
    TO_JSON(t)
FROM (
    SELECT
        season,
        game_id,
        COUNT(*) AS cnt,
        COUNT(DISTINCT team_code) AS teams,
        COUNTIF(LOWER(home_away) = 'home') AS home_rows,
        COUNTIF(LOWER(home_away) = 'away') AS away_rows
    FROM `pacey32-agency.City.NHLTaxSchedule`
    GROUP BY season, game_id
    HAVING COUNT(*) != 2
        OR COUNT(DISTINCT team_code) != 2
        OR COUNTIF(LOWER(home_away) = 'home') != 1
        OR COUNTIF(LOWER(home_away) = 'away') != 1
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX036',
    'NHLTaxSchedule',
    CAST(season AS INT64),
    CONCAT(CAST(season AS STRING), '|', team_code),
    'Regular-season team schedule does not contain 82 games.',
    TO_JSON(t)
FROM (
    SELECT
        season,
        team_code,
        COUNT(*) AS games
    FROM `pacey32-agency.City.NHLTaxSchedule`
    WHERE game_type = 2
    GROUP BY season, team_code
    HAVING COUNT(*) != 82
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX041',
    'vw_nhl_tax_schedule_allocation',
    CAST(season AS INT64),
    CONCAT(CAST(season AS STRING), '|', team_code),
    'Jurisdiction allocations do not sum to 1.0.',
    TO_JSON(t)
FROM (
    SELECT
        season,
        team_code,
        SUM(salary_allocation_pct) AS total_allocation
    FROM `pacey32-agency.City.vw_nhl_tax_schedule_allocation`
    GROUP BY season, team_code
    HAVING ABS(SUM(salary_allocation_pct) - 1.0) > 0.000000001
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX045',
    'NHLTaxSchedule + Tax Model',
    CAST(NULL AS INT64),
    jurisdiction_id,
    'Schedule jurisdiction is not represented in tax brackets or tax rules.',
    TO_JSON(t)
FROM (
    WITH schedule_jurisdictions AS (
        SELECT DISTINCT
            jurisdiction_id,
            country_code
        FROM `pacey32-agency.City.NHLTaxSchedule`
    ),
    model_jurisdictions AS (
        SELECT DISTINCT jurisdiction_id
        FROM `pacey32-agency.City.vw_tax_brackets`

        UNION DISTINCT

        SELECT DISTINCT jurisdiction_id
        FROM `pacey32-agency.City.tax_rules`
    )
    SELECT s.*
    FROM schedule_jurisdictions s
    LEFT JOIN model_jurisdictions m
        USING (jurisdiction_id)
    WHERE m.jurisdiction_id IS NULL
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX047',
    'vw_city_tax_current + vw_tax_brackets',
    CAST(tax_year AS INT64),
    venueLocation,
    'Federal top marginal rate does not reconcile to federal tax brackets.',
    TO_JSON(t)
FROM (
    WITH federal AS (
        SELECT
            tax_year,
            country_code,
            MAX(tax_rate) AS federal_top_rate
        FROM `pacey32-agency.City.vw_tax_brackets`
        WHERE is_federal
        GROUP BY tax_year, country_code
    )
    SELECT
        c.venueLocation,
        c.tax_year,
        c.country_code,
        c.federal_income_tax_top_rate,
        f.federal_top_rate
    FROM `pacey32-agency.City.vw_city_tax_current` c
    LEFT JOIN federal f
        ON c.tax_year = f.tax_year
       AND c.country_code = f.country_code
    WHERE f.federal_top_rate IS NULL
       OR c.federal_income_tax_top_rate != f.federal_top_rate
) t;


INSERT INTO `pacey32-agency.QA.TestFailures`
(
    run_id,
    run_datetime,
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TX048',
    'vw_city_tax_current + vw_tax_brackets',
    CAST(tax_year AS INT64),
    venueLocation,
    'State/provincial top marginal rate does not reconcile to tax brackets.',
    TO_JSON(t)
FROM (
    WITH subnational AS (
        SELECT
            tax_year,
            country_code,
            LOWER(jurisdiction) AS jurisdiction,
            MAX(tax_rate) AS top_rate
        FROM `pacey32-agency.City.vw_tax_brackets`
        WHERE is_subnational
        GROUP BY
            tax_year,
            country_code,
            LOWER(jurisdiction)
    )
    SELECT
        c.venueLocation,
        c.state_province,
        c.tax_year,
        c.country_code,
        c.state_income_tax_rate,
        s.top_rate
    FROM `pacey32-agency.City.vw_city_tax_current` c
    LEFT JOIN subnational s
        ON c.tax_year = s.tax_year
       AND c.country_code = s.country_code
       AND LOWER(c.state_province) = s.jurisdiction
    WHERE s.top_rate IS NULL
       OR ABS(c.state_income_tax_rate - s.top_rate) > 0.001
) t;


-- =========================================================
-- RUN SUMMARY
-- =========================================================

SELECT
    run_id,
    COUNT(*) AS test_count,
    COUNTIF(status = 'PASS') AS pass_count,
    COUNTIF(status = 'WARN') AS warn_count,
    COUNTIF(status = 'FAIL') AS fail_count
FROM `pacey32-agency.QA.TestResults`
WHERE run_id = v_run_id
GROUP BY run_id;