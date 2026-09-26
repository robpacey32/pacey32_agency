-- ============================================================
-- ORGANISATION QA
-- pacey32-agency
-- ============================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();


-- ============================================================
-- ORG001 - OrganizationDetail grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT tricode
    FROM `pacey32-agency.Team.OrganizationDetail`
    GROUP BY tricode
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG001',
    'Organisation detail grain',
    'Grain',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'OrganizationDetail must contain one row per NHL team.',
    CAST(NULL AS STRING)
FROM counts;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id,
    v_run_datetime,
    'ORG001',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    COALESCE(tricode, 'NULL'),
    'Duplicate organisation record for team',
    TO_JSON(f)
FROM (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    QUALIFY COUNT(*) OVER (PARTITION BY tricode) > 1
) f;


-- ============================================================
-- ORG002 - OrganizationDetail current NHL coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH stats AS (
    SELECT
        COUNT(*) AS cnt,
        COUNT(DISTINCT tricode) AS distinct_teams
    FROM `pacey32-agency.Team.OrganizationDetail`
),
failures AS (
    SELECT
        ABS(cnt - 32) +
        ABS(distinct_teams - 32) AS failure_count,
        cnt,
        distinct_teams
    FROM stats
)
SELECT
    v_run_id, v_run_datetime,
    'ORG002',
    'Organisation NHL team coverage',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'OrganizationDetail must contain the 32 current NHL teams.',
    FORMAT('cnt=%d, distinct_teams=%d', cnt, distinct_teams)
FROM failures;


-- ============================================================
-- ORG003 - OrganizationDetail TeamList reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT
        COALESCE(o.tricode, t.triCode) AS tricode
    FROM `pacey32-agency.Team.OrganizationDetail` o
    FULL OUTER JOIN `pacey32-agency.Team.TeamList` t
        ON o.tricode = t.triCode
    WHERE o.tricode IS NULL
       OR t.triCode IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG003',
    'Organisation team reconciliation',
    'Referential Integrity',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'OrganizationDetail and TeamList must contain the same current NHL team codes.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG004 - Team identity reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT o.*
    FROM `pacey32-agency.Team.OrganizationDetail` o
    INNER JOIN `pacey32-agency.Team.TeamList` t
        ON o.tricode = t.triCode
    WHERE o.id IS DISTINCT FROM t.id
       OR o.fullName IS DISTINCT FROM t.fullName
       OR o.venue IS DISTINCT FROM t.venue
       OR o.venueLocation IS DISTINCT FROM t.venueLocation
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG004',
    'Organisation team identity reconciliation',
    'Reconciliation',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Organisation team identity and venue fields must reconcile to TeamList.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG005 - Required organisation identity fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE id IS NULL
       OR NULLIF(TRIM(fullName), '') IS NULL
       OR NULLIF(TRIM(tricode), '') IS NULL
       OR NULLIF(TRIM(venue), '') IS NULL
       OR NULLIF(TRIM(venueLocation), '') IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG005',
    'Organisation required identity fields',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Current organisation records require team and venue identity fields.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG006 - Arena completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(arena_name), '') IS NULL
       OR arena_capacity IS NULL
       OR NULLIF(TRIM(arena_opened), '') IS NULL
       OR NULLIF(TRIM(arena_source_url), '') IS NULL
       OR arena_last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG006',
    'Arena information completeness',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL organisation should contain core arena information and provenance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG007 - Arena capacity validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE arena_capacity <= 0
       OR arena_capacity > 30000
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG007',
    'Arena capacity validity',
    'Validity',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Arena capacity must be positive and within a plausible NHL arena range.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG008 - Head coach completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(head_coach), '') IS NULL
       OR NULLIF(TRIM(coach_source_url), '') IS NULL
       OR coach_last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG008',
    'Head coach completeness',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL organisation requires a head coach and provenance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG009 - General manager completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(general_manager), '') IS NULL
       OR NULLIF(TRIM(gm_source_url), '') IS NULL
       OR gm_last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG009',
    'General manager completeness',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL organisation requires a general manager and provenance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG010 - Ownership completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(principal_owner), '') IS NULL
       OR NULLIF(TRIM(owner_source_url), '') IS NULL
       OR owner_last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG010',
    'Ownership completeness',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL organisation requires principal ownership information and provenance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG011 - AHL affiliate completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(ahl_team), '') IS NULL
       OR NULLIF(TRIM(ahl_city), '') IS NULL
       OR NULLIF(TRIM(ahl_arena), '') IS NULL
       OR NULLIF(TRIM(ahl_capacity), '') IS NULL
       OR NULLIF(TRIM(ahl_source_url), '') IS NULL
       OR ahl_last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG011',
    'AHL affiliate completeness',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL organisation requires core AHL affiliate information and provenance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG012 - AHL capacity validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE SAFE_CAST(ahl_capacity AS INT64) IS NULL
       OR SAFE_CAST(ahl_capacity AS INT64) <= 0
       OR SAFE_CAST(ahl_capacity AS INT64) > 30000
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG012',
    'AHL arena capacity validity',
    'Validity',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'AHL arena capacity should be numeric, positive and within a plausible arena range.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG013 - Captain completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(captain), '') IS NULL
       OR NULLIF(TRIM(captain_source_url), '') IS NULL
       OR captain_last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG013',
    'Captain information completeness',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL organisation requires captain status and provenance; Vacant is a valid status.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG014 - Alternate captain validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE NULLIF(TRIM(alternate_captain_1), '') IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG014',
    'Alternate captain coverage',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'Current NHL teams should have at least one recorded alternate captain.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG015 - Stanley Cup count validity
-- NULL represents zero/no Cup history in this dataset
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE stanley_cups < 0
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG015',
    'Stanley Cup count validity',
    'Validity',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Stanley Cup counts must be non-negative; NULL represents a franchise with no Stanley Cup wins.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG016 - Stanley Cup provenance
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail`
    WHERE stanley_cups IS NOT NULL
      AND (
          NULLIF(TRIM(stanley_cup_source_url), '') IS NULL
          OR stanley_cup_last_updated IS NULL
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG016',
    'Stanley Cup provenance',
    'Completeness',
    'Team',
    'OrganizationDetail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Populated Stanley Cup counts require source and update metadata.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG017 - LLM grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT tricode
    FROM `pacey32-agency.Team.OrganizationDetail_LLM`
    GROUP BY tricode
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG017',
    'Organisation LLM grain',
    'Grain',
    'Team',
    'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'OrganizationDetail_LLM must contain one row per current NHL team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG018 - LLM team coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT
        COALESCE(t.triCode, l.tricode) AS tricode
    FROM `pacey32-agency.Team.TeamList` t
    FULL OUTER JOIN `pacey32-agency.Team.OrganizationDetail_LLM` l
        ON t.triCode = l.tricode
    WHERE t.triCode IS NULL
       OR l.tricode IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG018',
    'Organisation LLM team coverage',
    'Referential Integrity',
    'Team',
    'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'OrganizationDetail_LLM must contain exactly the current NHL team population.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG019 - LLM team identity reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT l.*
    FROM `pacey32-agency.Team.OrganizationDetail_LLM` l
    INNER JOIN `pacey32-agency.Team.TeamList` t
        ON l.tricode = t.triCode
    WHERE l.id IS DISTINCT FROM t.id
       OR l.fullName IS DISTINCT FROM t.fullName
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG019',
    'Organisation LLM team identity',
    'Reconciliation',
    'Team',
    'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'LLM organisation team identifiers must reconcile to TeamList.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG020 - LLM content completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail_LLM`
    WHERE NULLIF(TRIM(player_neighbourhoods), '') IS NULL
       OR NULLIF(TRIM(organization_summary), '') IS NULL
       OR NULLIF(TRIM(fanbase_media_pressure), '') IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG020',
    'Organisation LLM content completeness',
    'Completeness',
    'Team',
    'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Generated organisation content must contain neighbourhood, organisation and fan/media sections.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG021 - LLM metadata completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail_LLM`
    WHERE NULLIF(TRIM(model), '') IS NULL
       OR NULLIF(TRIM(prompt_version), '') IS NULL
       OR generated_datetime IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG021',
    'Organisation LLM generation metadata',
    'Completeness',
    'Team',
    'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Generated organisation records require model, prompt version and generation timestamp.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG022 - LLM content length sanity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.OrganizationDetail_LLM`
    WHERE LENGTH(TRIM(player_neighbourhoods)) < 50
       OR LENGTH(TRIM(organization_summary)) < 100
       OR LENGTH(TRIM(fanbase_media_pressure)) < 50
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG022',
    'Organisation LLM content length',
    'Validity',
    'Team',
    'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'Generated organisation content should exceed minimum lengths to detect truncated or malformed responses.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG023 - AHLLogo grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT ahl_team
    FROM `pacey32-agency.Team.AHLLogo`
    GROUP BY ahl_team
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG023',
    'AHL logo grain',
    'Grain',
    'Team',
    'AHLLogo',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'AHLLogo must contain one row per AHL affiliate.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG024 - AHL logo organisation coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT COALESCE(o.ahl_team, l.ahl_team) AS ahl_team
    FROM (
        SELECT DISTINCT ahl_team
        FROM `pacey32-agency.Team.OrganizationDetail`
    ) o
    FULL OUTER JOIN `pacey32-agency.Team.AHLLogo` l
        ON o.ahl_team = l.ahl_team
    WHERE o.ahl_team IS NULL
       OR l.ahl_team IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG024',
    'AHL logo affiliate coverage',
    'Referential Integrity',
    'Team',
    'AHLLogo',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'AHLLogo and OrganizationDetail must contain the same current AHL affiliate population.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG025 - AHL logo required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.AHLLogo`
    WHERE NULLIF(TRIM(ahl_team), '') IS NULL
       OR NULLIF(TRIM(sportslogos_team_url), '') IS NULL
       OR NULLIF(TRIM(source_logo_url), '') IS NULL
       OR NULLIF(TRIM(logo_url), '') IS NULL
       OR last_updated IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG025',
    'AHL logo required fields',
    'Completeness',
    'Team',
    'AHLLogo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'AHL logo records require team, source, logo and update metadata.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG026 - AHL logo URL validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.AHLLogo`
    WHERE NOT STARTS_WITH(LOWER(sportslogos_team_url), 'http')
       OR NOT STARTS_WITH(LOWER(source_logo_url), 'http')
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG026',
    'AHL source URL validity',
    'Validity',
    'Team',
    'AHLLogo',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'AHL source page and source logo values should contain HTTP URLs.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG027 - Retired number grain
-- Includes league_retired because a team may contain both its
-- own retirement and the NHL-wide retirement of the same number.
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT
        id,
        player_name,
        jersey_number,
        league_retired,
        retirement_date
    FROM `pacey32-agency.Team.RetiredNumbers`
    GROUP BY
        id,
        player_name,
        jersey_number,
        league_retired,
        retirement_date
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG027',
    'Retired number grain',
    'Grain',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'RetiredNumbers must contain one row per team, player, number and retirement event.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG028 - Retired number team reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT r.*
    FROM `pacey32-agency.Team.RetiredNumbers` r
    LEFT JOIN `pacey32-agency.Team.TeamList` t
        ON r.tricode = t.triCode
    WHERE t.triCode IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG028',
    'Retired number team reconciliation',
    'Referential Integrity',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every RetiredNumbers record must resolve to a current TeamList team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG029 - Retired number team identity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT r.*
    FROM `pacey32-agency.Team.RetiredNumbers` r
    INNER JOIN `pacey32-agency.Team.TeamList` t
        ON r.tricode = t.triCode
    WHERE r.id IS DISTINCT FROM t.id
       OR r.fullName IS DISTINCT FROM t.fullName
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG029',
    'Retired number team identity',
    'Reconciliation',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Retired number team identifiers must reconcile to TeamList.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG030 - Retired number required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE id IS NULL
       OR NULLIF(TRIM(tricode), '') IS NULL
       OR NULLIF(TRIM(fullName), '') IS NULL
       OR NULLIF(TRIM(player_name), '') IS NULL
       OR jersey_number IS NULL
       OR retirement_date IS NULL
       OR league_retired IS NULL
       OR NULLIF(TRIM(source_url), '') IS NULL
       OR scrape_datetime IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG030',
    'Retired number required fields',
    'Completeness',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Retired number records require team, player, number, retirement type, date and provenance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG031 - Jersey number validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE jersey_number < 0
       OR jersey_number > 99
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG031',
    'Retired jersey number validity',
    'Validity',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Retired jersey numbers must be between 0 and 99.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG032 - Retirement date validity
-- Future announced retirement ceremonies are legitimate.
-- Flag only dates more than 2 years into the future.
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE retirement_date > DATE_ADD(CURRENT_DATE(), INTERVAL 2 YEAR)
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG032',
    'Retirement date validity',
    'Validity',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'Retirement dates may include announced future ceremonies; dates more than two years ahead are flagged for review.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG033 - League-wide retired number validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE league_retired = TRUE
      AND (
          jersey_number != 99
          OR player_name != 'Wayne Gretzky'
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG033',
    'League-wide retired number validity',
    'Validity',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'League-wide retirement records must represent Wayne Gretzky number 99.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG034 - League-wide #99 team coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH current_teams AS (
    SELECT triCode
    FROM `pacey32-agency.Team.TeamList`
),
gretzky AS (
    SELECT DISTINCT tricode
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE league_retired = TRUE
      AND jersey_number = 99
      AND player_name = 'Wayne Gretzky'
),
failures AS (
    SELECT t.triCode
    FROM current_teams t
    LEFT JOIN gretzky g
        ON t.triCode = g.tricode
    WHERE g.tricode IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG034',
    'League-wide number 99 coverage',
    'Completeness',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every current NHL team must contain the NHL-wide retirement of Wayne Gretzky number 99.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- ORG035 - League-wide #99 consistency
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE league_retired = TRUE
      AND (
          jersey_number != 99
          OR player_name != 'Wayne Gretzky'
          OR retirement_date != DATE '2000-02-06'
          OR source_team_name != 'All NHL teams'
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'ORG035',
    'League-wide number 99 consistency',
    'Reconciliation',
    'Team',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'League-wide number 99 records should contain consistent retirement metadata.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- FAILURE RECORDS FOR ORG003-ORG035
-- Store actionable failing records for current run.
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG003', 'OrganizationDetail',
    CAST(NULL AS INT64),
    COALESCE(o.tricode, t.triCode, 'NULL'),
    'OrganizationDetail and TeamList population mismatch',
    TO_JSON(STRUCT(
        o.tricode AS organisation_tricode,
        t.triCode AS teamlist_tricode
    ))
FROM `pacey32-agency.Team.OrganizationDetail` o
FULL OUTER JOIN `pacey32-agency.Team.TeamList` t
    ON o.tricode = t.triCode
WHERE o.tricode IS NULL OR t.triCode IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG006', 'OrganizationDetail',
    CAST(NULL AS INT64), tricode,
    'Incomplete arena information',
    TO_JSON(o)
FROM `pacey32-agency.Team.OrganizationDetail` o
WHERE NULLIF(TRIM(arena_name), '') IS NULL
   OR arena_capacity IS NULL
   OR NULLIF(TRIM(arena_opened), '') IS NULL
   OR NULLIF(TRIM(arena_source_url), '') IS NULL
   OR arena_last_updated IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG008', 'OrganizationDetail',
    CAST(NULL AS INT64), tricode,
    'Incomplete head coach information',
    TO_JSON(o)
FROM `pacey32-agency.Team.OrganizationDetail` o
WHERE NULLIF(TRIM(head_coach), '') IS NULL
   OR NULLIF(TRIM(coach_source_url), '') IS NULL
   OR coach_last_updated IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG009', 'OrganizationDetail',
    CAST(NULL AS INT64), tricode,
    'Incomplete general manager information',
    TO_JSON(o)
FROM `pacey32-agency.Team.OrganizationDetail` o
WHERE NULLIF(TRIM(general_manager), '') IS NULL
   OR NULLIF(TRIM(gm_source_url), '') IS NULL
   OR gm_last_updated IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG010', 'OrganizationDetail',
    CAST(NULL AS INT64), tricode,
    'Incomplete ownership information',
    TO_JSON(o)
FROM `pacey32-agency.Team.OrganizationDetail` o
WHERE NULLIF(TRIM(principal_owner), '') IS NULL
   OR NULLIF(TRIM(owner_source_url), '') IS NULL
   OR owner_last_updated IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG011', 'OrganizationDetail',
    CAST(NULL AS INT64), tricode,
    'Incomplete AHL affiliate information',
    TO_JSON(o)
FROM `pacey32-agency.Team.OrganizationDetail` o
WHERE NULLIF(TRIM(ahl_team), '') IS NULL
   OR NULLIF(TRIM(ahl_city), '') IS NULL
   OR NULLIF(TRIM(ahl_arena), '') IS NULL
   OR NULLIF(TRIM(ahl_capacity), '') IS NULL
   OR NULLIF(TRIM(ahl_source_url), '') IS NULL
   OR ahl_last_updated IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG018', 'OrganizationDetail_LLM',
    CAST(NULL AS INT64),
    COALESCE(t.triCode, l.tricode, 'NULL'),
    'LLM organisation team population mismatch',
    TO_JSON(STRUCT(
        t.triCode AS teamlist_tricode,
        l.tricode AS llm_tricode
    ))
FROM `pacey32-agency.Team.TeamList` t
FULL OUTER JOIN `pacey32-agency.Team.OrganizationDetail_LLM` l
    ON t.triCode = l.tricode
WHERE t.triCode IS NULL OR l.tricode IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG020', 'OrganizationDetail_LLM',
    CAST(NULL AS INT64), tricode,
    'Missing generated organisation content',
    TO_JSON(l)
FROM `pacey32-agency.Team.OrganizationDetail_LLM` l
WHERE NULLIF(TRIM(player_neighbourhoods), '') IS NULL
   OR NULLIF(TRIM(organization_summary), '') IS NULL
   OR NULLIF(TRIM(fanbase_media_pressure), '') IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG024', 'AHLLogo',
    CAST(NULL AS INT64),
    COALESCE(o.ahl_team, l.ahl_team, 'NULL'),
    'AHL affiliate population mismatch',
    TO_JSON(STRUCT(
        o.ahl_team AS organisation_ahl_team,
        l.ahl_team AS logo_ahl_team
    ))
FROM (
    SELECT DISTINCT ahl_team
    FROM `pacey32-agency.Team.OrganizationDetail`
) o
FULL OUTER JOIN `pacey32-agency.Team.AHLLogo` l
    ON o.ahl_team = l.ahl_team
WHERE o.ahl_team IS NULL OR l.ahl_team IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG027', 'RetiredNumbers',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING), '|',
        player_name, '|',
        CAST(jersey_number AS STRING), '|',
        CAST(league_retired AS STRING), '|',
        CAST(retirement_date AS STRING)
    ),
    'Duplicate retired-number event',
    TO_JSON(r)
FROM `pacey32-agency.Team.RetiredNumbers` r
QUALIFY COUNT(*) OVER (
    PARTITION BY
        id,
        player_name,
        jersey_number,
        league_retired,
        retirement_date
) > 1;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG028', 'RetiredNumbers',
    CAST(NULL AS INT64),
    CONCAT(CAST(r.id AS STRING), '|', r.player_name, '|', CAST(r.jersey_number AS STRING)),
    'Retired number does not resolve to current TeamList',
    TO_JSON(r)
FROM `pacey32-agency.Team.RetiredNumbers` r
LEFT JOIN `pacey32-agency.Team.TeamList` t
    ON r.tricode = t.triCode
WHERE t.triCode IS NULL;


INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG030', 'RetiredNumbers',
    CAST(NULL AS INT64),
    CONCAT(
        COALESCE(tricode, 'NULL'), '|',
        COALESCE(player_name, 'NULL'), '|',
        COALESCE(CAST(jersey_number AS STRING), 'NULL')
    ),
    'Retired number has missing required fields',
    TO_JSON(r)
FROM `pacey32-agency.Team.RetiredNumbers` r
WHERE id IS NULL
   OR NULLIF(TRIM(tricode), '') IS NULL
   OR NULLIF(TRIM(fullName), '') IS NULL
   OR NULLIF(TRIM(player_name), '') IS NULL
   OR jersey_number IS NULL
   OR retirement_date IS NULL
   OR league_retired IS NULL
   OR NULLIF(TRIM(source_url), '') IS NULL
   OR scrape_datetime IS NULL;

INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id,
    v_run_datetime,
    'ORG032',
    'RetiredNumbers',
    CAST(NULL AS INT64),
    CONCAT(
        tricode, '|',
        player_name, '|',
        CAST(jersey_number AS STRING)
    ),
    'Retirement date is more than two years in the future',
    TO_JSON(r)
FROM `pacey32-agency.Team.RetiredNumbers` r
WHERE retirement_date > DATE_ADD(CURRENT_DATE(), INTERVAL 2 YEAR);

INSERT INTO `pacey32-agency.QA.TestFailures`
SELECT
    v_run_id, v_run_datetime, 'ORG034', 'RetiredNumbers',
    CAST(NULL AS INT64),
    t.triCode,
    'Current NHL team is missing league-wide Wayne Gretzky number 99 retirement',
    TO_JSON(STRUCT(t.triCode AS tricode))
FROM `pacey32-agency.Team.TeamList` t
LEFT JOIN (
    SELECT DISTINCT tricode
    FROM `pacey32-agency.Team.RetiredNumbers`
    WHERE league_retired = TRUE
      AND jersey_number = 99
      AND player_name = 'Wayne Gretzky'
) r
    ON t.triCode = r.tricode
WHERE r.tricode IS NULL;


-- ============================================================
-- RUN SUMMARY
-- ============================================================

SELECT
    run_id,
    run_datetime,
    COUNT(*) AS test_count,
    COUNTIF(status = 'PASS') AS pass_count,
    COUNTIF(status = 'WARN') AS warn_count,
    COUNTIF(status = 'FAIL') AS fail_count
FROM `pacey32-agency.QA.TestResults`
WHERE run_id = v_run_id
GROUP BY run_id, run_datetime;