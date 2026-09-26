-- =========================================================
-- GEO QA
-- =========================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();


-- =========================================================
-- TEMP FAILURE TABLE
-- =========================================================

CREATE TEMP TABLE qa_failures
(
    test_id STRING,
    source_object STRING,
    season INT64,
    record_key STRING,
    failure_reason STRING,
    record_json JSON
);


-- =========================================================
-- GE001
-- Arena unique team grain
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        id,
        COUNT(*) AS cnt
    FROM `pacey32-agency.Geo.Arena`
    GROUP BY id
    HAVING COUNT(*) > 1

)

SELECT
    'GE001',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Team has ',
        CAST(cnt AS STRING),
        ' Arena records.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE001',
    'Arena unique team grain',
    'Uniqueness',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Arena should contain at most one record per NHL team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE001';


-- =========================================================
-- GE002
-- Arena current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH expected AS (

    SELECT
        id,
        tricode,
        fullName
    FROM `pacey32-agency.Team.TeamList`

),

actual AS (

    SELECT DISTINCT
        id
    FROM `pacey32-agency.Geo.Arena`

),

failures AS (

    SELECT
        e.id,
        e.tricode,
        e.fullName,
        'Missing Arena record' AS issue
    FROM expected e
    LEFT JOIN actual a
        ON e.id = a.id
    WHERE a.id IS NULL

    UNION ALL

    SELECT
        a.id,
        CAST(NULL AS STRING) AS tricode,
        CAST(NULL AS STRING) AS fullName,
        'Arena team not present in current TeamList' AS issue
    FROM actual a
    LEFT JOIN expected e
        ON a.id = e.id
    WHERE e.id IS NULL

)

SELECT
    'GE002',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    issue,
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE002',
    'Arena current team coverage',
    'Coverage',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Arena team population should reconcile exactly to current TeamList.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE002';


-- =========================================================
-- GE003
-- Arena team identity reconciliation
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        a.id,
        a.tricode AS geo_tricode,
        t.tricode AS team_tricode,
        a.fullName AS geo_name,
        t.fullName AS team_name
    FROM `pacey32-agency.Geo.Arena` a
    INNER JOIN `pacey32-agency.Team.TeamList` t
        ON a.id = t.id
    WHERE a.tricode != t.tricode
       OR a.fullName != t.fullName

)

SELECT
    'GE003',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Arena team identity does not reconcile to TeamList.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE003',
    'Arena team identity reconciliation',
    'Reconciliation',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Arena team code and name should agree with current TeamList.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE003';


-- =========================================================
-- GE004
-- Arena required fields
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.Arena`
    WHERE id IS NULL
       OR tricode IS NULL
       OR TRIM(tricode) = ''
       OR fullName IS NULL
       OR TRIM(fullName) = ''
       OR arena_name IS NULL
       OR TRIM(arena_name) = ''

)

SELECT
    'GE004',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Arena has missing required identifiers or arena name.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE004',
    'Arena required fields',
    'Completeness',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Arena should contain complete team identifiers and arena name.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE004';


-- =========================================================
-- GE005
-- Arena coordinate completeness
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.Arena`
    WHERE latitude IS NULL
       OR longitude IS NULL
       OR geography_wkt IS NULL
       OR TRIM(geography_wkt) = ''

)

SELECT
    'GE005',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Arena has incomplete coordinates or geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE005',
    'Arena coordinate completeness',
    'Completeness',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every Arena record should contain coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE005';


-- =========================================================
-- GE006
-- Arena coordinate validity
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.Arena`
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180

)

SELECT
    'GE006',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Arena latitude or longitude is outside the valid geographic range.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE006',
    'Arena coordinate validity',
    'Validity',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Arena latitude and longitude should fall within valid geographic ranges.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE006';


-- =========================================================
-- GE007
-- Arena geography reconciliation
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.Arena`
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND geography_wkt IS NOT NULL
      AND SAFE.ST_GEOGFROMTEXT(geography_wkt) IS NULL

)

SELECT
    'GE007',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Arena geography_wkt is not a valid geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE007',
    'Arena geography validity',
    'Validity',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Arena geography_wkt should parse as a valid BigQuery geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE007';


-- =========================================================
-- GE008
-- Arena geocode success
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.Arena`
    WHERE geocode_status IS NULL
       OR UPPER(TRIM(geocode_status)) != 'FOUND'

)

SELECT
    'GE008',
    'Arena',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Arena geocode status is ',
        COALESCE(geocode_status, 'NULL'),
        '.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE008',
    'Arena geocode success',
    'Geocoding',
    'Geo',
    'Arena',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current NHL arenas should geocode successfully.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE008';


-- =========================================================
-- GE009
-- Practice facility unique team grain
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        id,
        COUNT(*) AS cnt
    FROM `pacey32-agency.Geo.PracticeFacility`
    GROUP BY id
    HAVING COUNT(*) > 1

)

SELECT
    'GE009',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Team has ',
        CAST(cnt AS STRING),
        ' PracticeFacility records.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE009',
    'Practice facility unique team grain',
    'Uniqueness',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PracticeFacility should contain one current facility record per NHL team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE009';


-- =========================================================
-- GE010
-- Practice facility current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH expected AS (

    SELECT
        id,
        tricode,
        fullName
    FROM `pacey32-agency.Team.TeamList`

),

actual AS (

    SELECT DISTINCT
        id
    FROM `pacey32-agency.Geo.PracticeFacility`

),

failures AS (

    SELECT
        e.id,
        e.tricode,
        e.fullName,
        'Missing PracticeFacility record' AS issue
    FROM expected e
    LEFT JOIN actual a
        ON e.id = a.id
    WHERE a.id IS NULL

    UNION ALL

    SELECT
        a.id,
        CAST(NULL AS STRING),
        CAST(NULL AS STRING),
        'PracticeFacility team not present in current TeamList'
    FROM actual a
    LEFT JOIN expected e
        ON a.id = e.id
    WHERE e.id IS NULL

)

SELECT
    'GE010',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    issue,
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE010',
    'Practice facility current team coverage',
    'Coverage',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PracticeFacility team population should reconcile exactly to current TeamList.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE010';


-- =========================================================
-- GE011
-- Practice facility team identity reconciliation
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        p.id,
        p.tricode AS geo_tricode,
        t.tricode AS team_tricode,
        p.fullName AS geo_name,
        t.fullName AS team_name
    FROM `pacey32-agency.Geo.PracticeFacility` p
    INNER JOIN `pacey32-agency.Team.TeamList` t
        ON p.id = t.id
    WHERE p.tricode != t.tricode
       OR p.fullName != t.fullName

)

SELECT
    'GE011',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'PracticeFacility team identity does not reconcile to TeamList.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE011',
    'Practice facility team identity reconciliation',
    'Reconciliation',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PracticeFacility team code and name should agree with current TeamList.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE011';


-- =========================================================
-- GE012
-- Practice facility required fields
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PracticeFacility`
    WHERE id IS NULL
       OR tricode IS NULL
       OR TRIM(tricode) = ''
       OR fullName IS NULL
       OR TRIM(fullName) = ''
       OR facility_name IS NULL
       OR TRIM(facility_name) = ''

)

SELECT
    'GE012',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'PracticeFacility has missing required identifiers or facility name.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE012',
    'Practice facility required fields',
    'Completeness',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PracticeFacility should contain complete team identifiers and facility name.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE012';


-- =========================================================
-- GE013
-- Practice facility coordinate completeness
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PracticeFacility`
    WHERE latitude IS NULL
       OR longitude IS NULL
       OR geography_wkt IS NULL
       OR TRIM(geography_wkt) = ''

)

SELECT
    'GE013',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'PracticeFacility has incomplete coordinates or geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE013',
    'Practice facility coordinate completeness',
    'Completeness',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every PracticeFacility record should contain coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE013';


-- =========================================================
-- GE014
-- Practice facility coordinate validity
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PracticeFacility`
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180

)

SELECT
    'GE014',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'PracticeFacility coordinates are outside valid geographic ranges.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE014',
    'Practice facility coordinate validity',
    'Validity',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PracticeFacility coordinates should fall within valid geographic ranges.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE014';


-- =========================================================
-- GE015
-- Practice facility geography validity
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PracticeFacility`
    WHERE geography_wkt IS NOT NULL
      AND SAFE.ST_GEOGFROMTEXT(geography_wkt) IS NULL

)

SELECT
    'GE015',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'PracticeFacility geography_wkt is not a valid geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE015',
    'Practice facility geography validity',
    'Validity',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PracticeFacility geography_wkt should parse as a valid BigQuery geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE015';


-- =========================================================
-- GE016
-- Practice facility geocode success
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PracticeFacility`
    WHERE geocode_status IS NULL
       OR UPPER(TRIM(geocode_status)) != 'FOUND'

)

SELECT
    'GE016',
    'PracticeFacility',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'PracticeFacility geocode status is ',
        COALESCE(geocode_status, 'NULL'),
        '.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE016',
    'Practice facility geocode success',
    'Geocoding',
    'Geo',
    'PracticeFacility',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current NHL practice facilities should geocode successfully.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE016';


-- =========================================================
-- GE017
-- Residential area unique team-rank grain
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        id,
        rank,
        COUNT(*) AS cnt
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    GROUP BY
        id,
        rank
    HAVING COUNT(*) > 1

)

SELECT
    'GE017',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        CAST(rank AS STRING)
    ),
    CONCAT(
        'Team/rank has ',
        CAST(cnt AS STRING),
        ' records.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE017',
    'Residential area unique team-rank grain',
    'Uniqueness',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PlayerResidentialArea should contain one record per team and rank.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE017';


-- =========================================================
-- GE018
-- Residential area current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH expected AS (

    SELECT id
    FROM `pacey32-agency.Team.TeamList`

),

actual AS (

    SELECT DISTINCT id
    FROM `pacey32-agency.Geo.PlayerResidentialArea`

),

failures AS (

    SELECT
        e.id,
        'Missing residential areas' AS issue
    FROM expected e
    LEFT JOIN actual a
        ON e.id = a.id
    WHERE a.id IS NULL

    UNION ALL

    SELECT
        a.id,
        'Residential area team not present in current TeamList'
    FROM actual a
    LEFT JOIN expected e
        ON a.id = e.id
    WHERE e.id IS NULL

)

SELECT
    'GE018',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    issue,
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE018',
    'Residential area current team coverage',
    'Coverage',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL team should have PlayerResidentialArea records and no obsolete teams should remain.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE018';


-- =========================================================
-- GE019
-- Residential area count per team
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        id,
        ANY_VALUE(tricode) AS tricode,
        COUNT(*) AS cnt
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    GROUP BY id
    HAVING COUNT(*) NOT BETWEEN 4 AND 5

)

SELECT
    'GE019',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Team ',
        tricode,
        ' has ',
        CAST(cnt AS STRING),
        ' residential areas; expected 4 or 5.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE019',
    'Residential area count per team',
    'Coverage',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each current team should have four or five ranked residential areas.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE019';


-- =========================================================
-- GE020
-- Residential area rank sequence
-- =========================================================

INSERT INTO qa_failures

WITH team_summary AS (

    SELECT
        id,
        COUNT(*) AS cnt,
        COUNT(DISTINCT rank) AS distinct_ranks,
        MIN(rank) AS min_rank,
        MAX(rank) AS max_rank
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    GROUP BY id

),

failures AS (

    SELECT *
    FROM team_summary
    WHERE min_rank != 1
       OR max_rank != cnt
       OR distinct_ranks != cnt
       OR cnt NOT BETWEEN 4 AND 5

)

SELECT
    'GE020',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Residential area ranks should be consecutive from 1 with no gaps.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE020',
    'Residential area rank sequence',
    'Sequence',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Residential area ranks should run consecutively from 1 for each team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE020';


-- =========================================================
-- GE021
-- Residential area required fields
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    WHERE id IS NULL
       OR tricode IS NULL
       OR TRIM(tricode) = ''
       OR fullName IS NULL
       OR TRIM(fullName) = ''
       OR area_name IS NULL
       OR TRIM(area_name) = ''
       OR location_type IS NULL
       OR TRIM(location_type) = ''
       OR rank IS NULL

)

SELECT
    'GE021',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        CAST(rank AS STRING)
    ),
    'Residential area has missing required fields.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE021',
    'Residential area required fields',
    'Completeness',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Residential areas should contain team identity, rank, area name and location type.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE021';


-- =========================================================
-- GE022
-- Residential area confidence validity
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    WHERE confidence IS NULL
       OR confidence < 0
       OR confidence > 1

)

SELECT
    'GE022',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        CAST(rank AS STRING)
    ),
    'Residential area confidence is NULL or outside 0 to 1.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE022',
    'Residential area confidence validity',
    'Validity',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Residential area confidence should be populated and between zero and one.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE022';


-- =========================================================
-- GE023
-- Residential area coordinate completeness
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    WHERE latitude IS NULL
       OR longitude IS NULL
       OR geography_wkt IS NULL
       OR TRIM(geography_wkt) = ''

)

SELECT
    'GE023',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        CAST(rank AS STRING)
    ),
    'Residential area has incomplete coordinates or geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE023',
    'Residential area coordinate completeness',
    'Completeness',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Residential areas should contain coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE023';


-- =========================================================
-- GE024
-- Residential area coordinate validity
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180
       OR SAFE.ST_GEOGFROMTEXT(geography_wkt) IS NULL

)

SELECT
    'GE024',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        CAST(rank AS STRING)
    ),
    'Residential area coordinates or geography are invalid.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE024',
    'Residential area geographic validity',
    'Validity',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Residential area coordinates and geography should be geographically valid.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE024';


-- =========================================================
-- GE025
-- Residential area geocode success
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerResidentialArea`
    WHERE geocode_status IS NULL
       OR UPPER(TRIM(geocode_status)) != 'FOUND'

)

SELECT
    'GE025',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        CAST(rank AS STRING)
    ),
    CONCAT(
        'Residential area geocode status is ',
        COALESCE(geocode_status, 'NULL'),
        '.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE025',
    'Residential area geocode success',
    'Geocoding',
    'Geo',
    'PlayerResidentialArea',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current residential areas should geocode successfully.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE025';


-- =========================================================
-- GE026
-- Player birthplace unique player grain
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        playerId,
        COUNT(*) AS cnt
    FROM `pacey32-agency.Geo.PlayerBirthplace`
    GROUP BY playerId
    HAVING COUNT(*) > 1

)

SELECT
    'GE026',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    CAST(playerId AS STRING),
    CONCAT(
        'Player has ',
        CAST(cnt AS STRING),
        ' PlayerBirthplace records.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE026',
    'Player birthplace unique player grain',
    'Uniqueness',
    'Geo',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PlayerBirthplace should contain at most one record per playerId.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE026';


-- =========================================================
-- GE027
-- Player birthplace required fields
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerBirthplace`
    WHERE playerId IS NULL
       OR player_name IS NULL
       OR TRIM(player_name) = ''
       OR birth_city IS NULL
       OR TRIM(birth_city) = ''
       OR birth_country IS NULL
       OR TRIM(birth_country) = ''

)

SELECT
    'GE027',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    CAST(playerId AS STRING),
    'PlayerBirthplace has missing player identity or required birthplace fields.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE027',
    'Player birthplace required fields',
    'Completeness',
    'Geo',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PlayerBirthplace should contain player identity, birth city and birth country.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE027';


-- =========================================================
-- GE028
-- Eligible player birthplace coverage
-- =========================================================

INSERT INTO qa_failures

WITH expected AS (

    SELECT
        playerId,
        CONCAT(
            firstName,
            ' ',
            lastName
        ) AS player_name,
        birthCity AS birth_city,
        birthCountry AS birth_country

    FROM `pacey32-agency.Player.PlayerLanding`

    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY playerId
        ORDER BY RunDate DESC
    ) = 1

),

eligible AS (

    SELECT
        playerId,
        player_name,
        birth_city,
        birth_country

    FROM expected

    WHERE birth_city IS NOT NULL
      AND birth_country IS NOT NULL

),

failures AS (

    SELECT
        e.playerId,
        e.player_name,
        e.birth_city,
        e.birth_country

    FROM eligible e

    LEFT JOIN `pacey32-agency.Geo.PlayerBirthplace` b
        ON e.playerId = b.playerId

    WHERE b.playerId IS NULL

)

SELECT
    'GE028',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    CAST(playerId AS STRING),
    'Eligible player is missing from PlayerBirthplace.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE028',
    'Eligible player birthplace coverage',
    'Coverage',
    'Geo',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every player in the latest PlayerLanding population with birth city and country should exist in PlayerBirthplace.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE028';


-- =========================================================
-- GE029
-- Player birthplace coordinate completeness
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerBirthplace`
    WHERE latitude IS NULL
       OR longitude IS NULL
       OR geography_wkt IS NULL
       OR TRIM(geography_wkt) = ''

)

SELECT
    'GE029',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    CAST(playerId AS STRING),
    'PlayerBirthplace has incomplete coordinates or geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE029',
    'Player birthplace coordinate completeness',
    'Completeness',
    'Geo',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Stored PlayerBirthplace records should contain coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE029';


-- =========================================================
-- GE030
-- Player birthplace geographic validity
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerBirthplace`
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180
       OR SAFE.ST_GEOGFROMTEXT(geography_wkt) IS NULL

)

SELECT
    'GE030',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    CAST(playerId AS STRING),
    'PlayerBirthplace coordinates or geography are invalid.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE030',
    'Player birthplace geographic validity',
    'Validity',
    'Geo',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'PlayerBirthplace coordinates and geography should be geographically valid.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE030';


-- =========================================================
-- GE031
-- Player birthplace geocode status
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT *
    FROM `pacey32-agency.Geo.PlayerBirthplace`
    WHERE geocode_status IS NULL
       OR UPPER(TRIM(geocode_status)) != 'FOUND'

)

SELECT
    'GE031',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    CAST(playerId AS STRING),
    CONCAT(
        'Player birthplace geocode status is ',
        COALESCE(geocode_status, 'NULL'),
        '.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE031',
    'Player birthplace geocode status',
    'Geocoding',
    'Geo',
    'PlayerBirthplace',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Player birthplace geocoding failures should be reviewed but do not invalidate the wider dataset.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE031';


-- =========================================================
-- GE032
-- POI unique team-place grain
-- =========================================================

INSERT INTO qa_failures

WITH poi AS (

    SELECT 'Airport' AS poi_type, id, tricode, place_id
    FROM `pacey32-agency.Geo.Airport`

    UNION ALL

    SELECT 'Beach', id, tricode, place_id
    FROM `pacey32-agency.Geo.Beach`

    UNION ALL

    SELECT 'CountryClub', id, tricode, place_id
    FROM `pacey32-agency.Geo.CountryClub`

    UNION ALL

    SELECT 'GolfClub', id, tricode, place_id
    FROM `pacey32-agency.Geo.GolfClub`

    UNION ALL

    SELECT 'Hospital', id, tricode, place_id
    FROM `pacey32-agency.Geo.Hospital`

    UNION ALL

    SELECT 'Marina', id, tricode, place_id
    FROM `pacey32-agency.Geo.Marina`

    UNION ALL

    SELECT 'Restaurant', id, tricode, place_id
    FROM `pacey32-agency.Geo.Restaurant`

    UNION ALL

    SELECT 'School', id, tricode, place_id
    FROM `pacey32-agency.Geo.School`

    UNION ALL

    SELECT 'ShoppingMall', id, tricode, place_id
    FROM `pacey32-agency.Geo.ShoppingMall`

    UNION ALL

    SELECT 'Ski', id, tricode, place_id
    FROM `pacey32-agency.Geo.Ski`

),

failures AS (

    SELECT
        poi_type,
        id,
        tricode,
        place_id,
        COUNT(*) AS cnt
    FROM poi
    GROUP BY
        poi_type,
        id,
        tricode,
        place_id
    HAVING COUNT(*) > 1

)

SELECT
    'GE032',
    poi_type,
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        COALESCE(place_id, 'NULL')
    ),
    CONCAT(
        'Duplicate team/place_id grain with ',
        CAST(cnt AS STRING),
        ' records.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE032',
    'POI unique team-place grain',
    'Uniqueness',
    'Geo',
    'POI',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each POI category should contain at most one row per team and place_id.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE032';


-- =========================================================
-- GE033
-- POI required identifiers
-- =========================================================

INSERT INTO qa_failures

WITH poi AS (

    SELECT 'Airport' AS poi_type, id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Airport`

    UNION ALL

    SELECT 'Beach', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Beach`

    UNION ALL

    SELECT 'CountryClub', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.CountryClub`

    UNION ALL

    SELECT 'GolfClub', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.GolfClub`

    UNION ALL

    SELECT 'Hospital', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Hospital`

    UNION ALL

    SELECT 'Marina', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Marina`

    UNION ALL

    SELECT 'Restaurant', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Restaurant`

    UNION ALL

    SELECT 'School', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.School`

    UNION ALL

    SELECT 'ShoppingMall', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.ShoppingMall`

    UNION ALL

    SELECT 'Ski', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Ski`

),

failures AS (

    SELECT *
    FROM poi
    WHERE id IS NULL
       OR tricode IS NULL
       OR TRIM(tricode) = ''
       OR fullName IS NULL
       OR TRIM(fullName) = ''
       OR place_id IS NULL
       OR TRIM(place_id) = ''

)

SELECT
    'GE033',
    poi_type,
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        COALESCE(place_id, 'NULL')
    ),
    'POI has missing team identity or place_id.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE033',
    'POI required identifiers',
    'Completeness',
    'Geo',
    'POI',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'POI records should contain team identity and source place_id.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE033';


-- =========================================================
-- GE034
-- POI team identity reconciliation
-- =========================================================

INSERT INTO qa_failures

WITH poi AS (

    SELECT 'Airport' AS poi_type, id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Airport`

    UNION ALL

    SELECT 'Beach', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Beach`

    UNION ALL

    SELECT 'CountryClub', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.CountryClub`

    UNION ALL

    SELECT 'GolfClub', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.GolfClub`

    UNION ALL

    SELECT 'Hospital', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Hospital`

    UNION ALL

    SELECT 'Marina', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Marina`

    UNION ALL

    SELECT 'Restaurant', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Restaurant`

    UNION ALL

    SELECT 'School', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.School`

    UNION ALL

    SELECT 'ShoppingMall', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.ShoppingMall`

    UNION ALL

    SELECT 'Ski', id, tricode, fullName, place_id
    FROM `pacey32-agency.Geo.Ski`

),

failures AS (

    SELECT
        p.poi_type,
        p.id,
        p.tricode AS poi_tricode,
        t.tricode AS team_tricode,
        p.fullName AS poi_name,
        t.fullName AS team_name,
        p.place_id
    FROM poi p
    LEFT JOIN `pacey32-agency.Team.TeamList` t
        ON p.id = t.id
    WHERE t.id IS NULL
       OR p.tricode != t.tricode
       OR p.fullName != t.fullName

)

SELECT
    'GE034',
    poi_type,
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        COALESCE(place_id, 'NULL')
    ),
    'POI team identity does not reconcile to current TeamList.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE034',
    'POI team identity reconciliation',
    'Reconciliation',
    'Geo',
    'POI',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'POI team IDs, tricodes and names should agree with current TeamList.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE034';


-- =========================================================
-- GE035
-- POI coordinate completeness
-- =========================================================

INSERT INTO qa_failures

WITH poi AS (

    SELECT 'Airport' AS poi_type, id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Airport`

    UNION ALL

    SELECT 'Beach', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Beach`

    UNION ALL

    SELECT 'CountryClub', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.CountryClub`

    UNION ALL

    SELECT 'GolfClub', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.GolfClub`

    UNION ALL

    SELECT 'Hospital', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Hospital`

    UNION ALL

    SELECT 'Marina', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Marina`

    UNION ALL

    SELECT 'Restaurant', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Restaurant`

    UNION ALL

    SELECT 'School', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.School`

    UNION ALL

    SELECT 'ShoppingMall', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.ShoppingMall`

    UNION ALL

    SELECT 'Ski', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Ski`

),

failures AS (

    SELECT *
    FROM poi
    WHERE latitude IS NULL
       OR longitude IS NULL
       OR geography_wkt IS NULL
       OR TRIM(geography_wkt) = ''

)

SELECT
    'GE035',
    poi_type,
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        COALESCE(place_id, 'NULL')
    ),
    'POI has incomplete coordinates or geography.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE035',
    'POI coordinate completeness',
    'Completeness',
    'Geo',
    'POI',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'POI records should contain coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE035';


-- =========================================================
-- GE036
-- POI geographic validity
-- =========================================================

INSERT INTO qa_failures

WITH poi AS (

    SELECT 'Airport' AS poi_type, id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Airport`

    UNION ALL

    SELECT 'Beach', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Beach`

    UNION ALL

    SELECT 'CountryClub', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.CountryClub`

    UNION ALL

    SELECT 'GolfClub', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.GolfClub`

    UNION ALL

    SELECT 'Hospital', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Hospital`

    UNION ALL

    SELECT 'Marina', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Marina`

    UNION ALL

    SELECT 'Restaurant', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Restaurant`

    UNION ALL

    SELECT 'School', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.School`

    UNION ALL

    SELECT 'ShoppingMall', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.ShoppingMall`

    UNION ALL

    SELECT 'Ski', id, place_id, latitude, longitude, geography_wkt
    FROM `pacey32-agency.Geo.Ski`

),

failures AS (

    SELECT *
    FROM poi
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180
       OR SAFE.ST_GEOGFROMTEXT(geography_wkt) IS NULL

)

SELECT
    'GE036',
    poi_type,
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        COALESCE(place_id, 'NULL')
    ),
    'POI coordinates or geography are invalid.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE036',
    'POI geographic validity',
    'Validity',
    'Geo',
    'POI',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'POI coordinates and geography should be geographically valid.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE036';


-- =========================================================
-- GE037
-- Airport current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        t.id,
        t.tricode,
        t.fullName
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT id
        FROM `pacey32-agency.Geo.Airport`
    ) p
        ON t.id = p.id
    WHERE p.id IS NULL

)

SELECT
    'GE037',
    'Airport',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Current NHL team has no Airport POIs.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE037',
    'Airport current team coverage',
    'Coverage',
    'Geo',
    'Airport',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL team should have at least one Airport POI.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE037';


-- =========================================================
-- GE038
-- Beach current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        t.id,
        t.tricode,
        t.fullName
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT id
        FROM `pacey32-agency.Geo.Beach`
    ) p
        ON t.id = p.id
    WHERE p.id IS NULL

)

SELECT
    'GE038',
    'Beach',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Current NHL team has no Beach POIs.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE038',
    'Beach current team coverage',
    'Coverage',
    'Geo',
    'Beach',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Current teams are expected to have Beach POIs where the source returns relevant results.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE038';


-- =========================================================
-- GE039
-- Country club current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        t.id,
        t.tricode,
        t.fullName
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT id
        FROM `pacey32-agency.Geo.CountryClub`
    ) p
        ON t.id = p.id
    WHERE p.id IS NULL

)

SELECT
    'GE039',
    'CountryClub',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Current NHL team has no CountryClub POIs.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE039',
    'Country club current team coverage',
    'Coverage',
    'Geo',
    'CountryClub',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Current teams are expected to have CountryClub POIs where the source returns relevant results.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE039';


-- =========================================================
-- GE040
-- Golf club current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        t.id,
        t.tricode,
        t.fullName
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT id
        FROM `pacey32-agency.Geo.GolfClub`
    ) p
        ON t.id = p.id
    WHERE p.id IS NULL

)

SELECT
    'GE040',
    'GolfClub',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Current NHL team has no GolfClub POIs.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE040',
    'Golf club current team coverage',
    'Coverage',
    'Geo',
    'GolfClub',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL team should have GolfClub POIs.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE040';


-- =========================================================
-- GE041
-- Hospital current team coverage
-- =========================================================

INSERT INTO qa_failures

WITH failures AS (

    SELECT
        t.id,
        t.tricode,
        t.fullName
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT id
        FROM `pacey32-agency.Geo.Hospital`
    ) p
        ON t.id = p.id
    WHERE p.id IS NULL

)

SELECT
    'GE041',
    'Hospital',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    'Current NHL team has no Hospital POIs.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE041',
    'Hospital current team coverage',
    'Coverage',
    'Geo',
    'Hospital',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL team should have Hospital POIs.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE041';


-- =========================================================
-- GE042
-- Restaurant expected count
-- =========================================================

INSERT INTO qa_failures

WITH counts AS (

    SELECT
        t.id,
        t.tricode,
        COUNT(r.place_id) AS cnt
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.Geo.Restaurant` r
        ON t.id = r.id
    GROUP BY
        t.id,
        t.tricode

),

failures AS (

    SELECT *
    FROM counts
    WHERE cnt != 100

)

SELECT
    'GE042',
    'Restaurant',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Team ',
        tricode,
        ' has ',
        CAST(cnt AS STRING),
        ' Restaurant records; expected 100.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE042',
    'Restaurant expected count',
    'Coverage',
    'Geo',
    'Restaurant',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Restaurant currently targets 100 POIs per current NHL team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE042';


-- =========================================================
-- GE043
-- School expected count
-- =========================================================

INSERT INTO qa_failures

WITH counts AS (

    SELECT
        t.id,
        t.tricode,
        COUNT(s.place_id) AS cnt
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.Geo.School` s
        ON t.id = s.id
    GROUP BY
        t.id,
        t.tricode

),

failures AS (

    SELECT *
    FROM counts
    WHERE cnt != 50

)

SELECT
    'GE043',
    'School',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Team ',
        tricode,
        ' has ',
        CAST(cnt AS STRING),
        ' School records; expected 50.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE043',
    'School expected count',
    'Coverage',
    'Geo',
    'School',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'School currently targets 50 POIs per current NHL team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE043';


-- =========================================================
-- GE044
-- Golf club expected count
-- =========================================================

INSERT INTO qa_failures

WITH counts AS (

    SELECT
        t.id,
        t.tricode,
        COUNT(g.place_id) AS cnt
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.Geo.GolfClub` g
        ON t.id = g.id
    GROUP BY
        t.id,
        t.tricode

),

failures AS (

    SELECT *
    FROM counts
    WHERE cnt != 20

)

SELECT
    'GE044',
    'GolfClub',
    CAST(NULL AS INT64),
    CAST(id AS STRING),
    CONCAT(
        'Team ',
        tricode,
        ' has ',
        CAST(cnt AS STRING),
        ' GolfClub records; expected 20.'
    ),
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE044',
    'Golf club expected count',
    'Coverage',
    'Geo',
    'GolfClub',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'GolfClub currently targets 20 POIs per current NHL team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE044';


-- =========================================================
-- GE045
-- POI freshness metadata
-- =========================================================

INSERT INTO qa_failures

WITH poi AS (

    SELECT 'Airport' AS poi_type, id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.Airport`

    UNION ALL

    SELECT 'Beach', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.Beach`

    UNION ALL

    SELECT 'CountryClub', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.CountryClub`

    UNION ALL

    SELECT 'GolfClub', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.GolfClub`

    UNION ALL

    SELECT 'Hospital', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.Hospital`

    UNION ALL

    SELECT 'Marina', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.Marina`

    UNION ALL

    SELECT 'Restaurant', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.Restaurant`

    UNION ALL

    SELECT 'School', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.School`

    UNION ALL

    SELECT 'ShoppingMall', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.ShoppingMall`

    UNION ALL

    SELECT 'Ski', id, place_id, source, last_updated
    FROM `pacey32-agency.Geo.Ski`

),

failures AS (

    SELECT *
    FROM poi
    WHERE source IS NULL
       OR TRIM(source) = ''
       OR last_updated IS NULL

)

SELECT
    'GE045',
    poi_type,
    CAST(NULL AS INT64),
    CONCAT(
        CAST(id AS STRING),
        '|',
        COALESCE(place_id, 'NULL')
    ),
    'POI has missing source or last_updated metadata.',
    TO_JSON(failures)
FROM failures;


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

SELECT
    v_run_id,
    v_run_datetime,
    'GE045',
    'POI freshness metadata',
    'Freshness',
    'Geo',
    'POI',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'POI records should retain source and last_updated metadata.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'GE045';


-- =========================================================
-- WRITE FAILURES
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
    test_id,
    source_object,
    season,
    record_key,
    failure_reason,
    record_json
FROM qa_failures;


-- =========================================================
-- RUN SUMMARY
-- =========================================================

SELECT
    v_run_id AS run_id,
    v_run_datetime AS run_datetime,
    COUNT(*) AS test_count,
    COUNTIF(status = 'PASS') AS pass_count,
    COUNTIF(status = 'WARN') AS warn_count,
    COUNTIF(status = 'FAIL') AS fail_count
FROM `pacey32-agency.QA.TestResults`
WHERE run_id = v_run_id;