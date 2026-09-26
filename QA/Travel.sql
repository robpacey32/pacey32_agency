-- =========================================================
-- Agency QA: Travel
-- =========================================================
-- Objects:
--   Team.Travel_1_ScheduleExpanded
--   Team.Travel_1_ScheduleExpanded_5yr
--   Team.Travel_2_Legs
--   Team.Travel_2_Legs_5yr
--   Team.Travel_3_LastSeasonSummary
--   Team.Travel_4_FiveYearSummary
--
-- Test ranges:
--   TR001-TR011  Current schedule
--   TR012-TR021  Five-year schedule
--   TR022-TR041  Travel legs
--   TR042-TR048  Summary views
-- =========================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();


-- =========================================================
-- Temporary failure store
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
-- TR001
-- Current schedule unique team-game grain
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        game_id,
        team_id,
        COUNT(*) AS duplicate_count
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded`
    GROUP BY
        season,
        game_id,
        team_id
    HAVING COUNT(*) > 1
)

SELECT
    'TR001',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Duplicate season/game/team rows.',
    TO_JSON(
        STRUCT(
            season,
            game_id,
            team_id,
            duplicate_count
        )
    )
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
    'TR001',
    'Current schedule unique team-game grain',
    'Uniqueness',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current expanded schedule should contain one row per season, game and team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR001';


-- =========================================================
-- TR002
-- Current schedule regular season only
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR002',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    CONCAT(
        'Unexpected game_type: ',
        COALESCE(CAST(game_type AS STRING), 'NULL')
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE game_type IS NULL
   OR game_type != 2;


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
    'TR002',
    'Current schedule regular season only',
    'Validity',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Travel schedule should contain regular-season games only.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR002';


-- =========================================================
-- TR003
-- Current schedule home-away exclusivity
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR003',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Home/away flags are not mutually exclusive.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE COALESCE(CAST(is_home AS INT64), 0)
    + COALESCE(CAST(is_away AS INT64), 0) != 1;


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
    'TR003',
    'Current schedule home-away exclusivity',
    'Validity',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Exactly one of is_home and is_away should be true.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR003';


-- =========================================================
-- TR004
-- Current schedule two team perspectives
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        game_id,
        COUNT(*) AS team_rows
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded`
    GROUP BY
        season,
        game_id
    HAVING COUNT(*) != 2
)

SELECT
    'TR004',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING)
    ),
    CONCAT(
        'Expected 2 rows; found ',
        CAST(team_rows AS STRING)
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
    'TR004',
    'Current schedule two team perspectives',
    'Coverage',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each NHL game should appear once for each participating team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR004';


-- =========================================================
-- TR005
-- Current schedule opponent integrity
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR005',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'team_id equals opponent_team_id.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE team_id = opponent_team_id;


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
    'TR005',
    'Current schedule opponent integrity',
    'Validity',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'A team cannot be its own opponent.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR005';


-- =========================================================
-- TR006
-- Current schedule required identifiers
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR006',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        COALESCE(CAST(season AS STRING), 'NULL'), '|',
        COALESCE(CAST(game_id AS STRING), 'NULL'), '|',
        COALESCE(CAST(team_id AS STRING), 'NULL')
    ),
    'One or more required identifiers are null or blank.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE season IS NULL
   OR game_id IS NULL
   OR game_date IS NULL
   OR game_datetime IS NULL
   OR team_id IS NULL
   OR NULLIF(TRIM(team_abbrev), '') IS NULL
   OR opponent_team_id IS NULL
   OR NULLIF(TRIM(opponent_team_abbrev), '') IS NULL
   OR team_game_number IS NULL;


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
    'TR006',
    'Current schedule required identifiers',
    'Completeness',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Core game, team and opponent identifiers should be populated.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR006';


-- =========================================================
-- TR007
-- Current schedule game location completeness
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR007',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Game location is incomplete.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE NULLIF(TRIM(game_city), '') IS NULL
   OR game_latitude IS NULL
   OR game_longitude IS NULL
   OR game_geography IS NULL;


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
    'TR007',
    'Current schedule game location completeness',
    'Completeness',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every game should have usable city coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR007';


-- =========================================================
-- TR008
-- Current schedule team home location completeness
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR008',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Team home location is incomplete.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE NULLIF(TRIM(team_home_city), '') IS NULL
   OR team_home_latitude IS NULL
   OR team_home_longitude IS NULL
   OR team_home_geography IS NULL;


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
    'TR008',
    'Current schedule team home location completeness',
    'Completeness',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every team perspective should have usable home coordinates and geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR008';


-- =========================================================
-- TR009
-- Current schedule coordinate ranges
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR009',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'One or more coordinates are outside valid ranges.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
WHERE game_latitude NOT BETWEEN -90 AND 90
   OR game_longitude NOT BETWEEN -180 AND 180
   OR team_home_latitude NOT BETWEEN -90 AND 90
   OR team_home_longitude NOT BETWEEN -180 AND 180;


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
    'TR009',
    'Current schedule coordinate ranges',
    'Validity',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latitude and longitude values should be geographically valid.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR009';


-- =========================================================
-- TR010
-- Current schedule sequential team game numbers
-- =========================================================

INSERT INTO qa_failures
WITH team_seasons AS (
    SELECT
        season,
        team_id,
        team_abbrev,
        COUNT(*) AS game_count,
        MIN(team_game_number) AS min_game_number,
        MAX(team_game_number) AS max_game_number,
        COUNT(DISTINCT team_game_number) AS distinct_game_numbers
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded`
    GROUP BY
        season,
        team_id,
        team_abbrev
),

failures AS (
    SELECT *
    FROM team_seasons
    WHERE min_game_number != 1
       OR max_game_number != game_count
       OR distinct_game_numbers != game_count
)

SELECT
    'TR010',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Team game numbering is not consecutive.',
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
    'TR010',
    'Current schedule sequential team game numbers',
    'Sequence',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Team game numbers should run consecutively from 1 to the team schedule count.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR010';


-- =========================================================
-- TR011
-- Current travel season freshness
-- =========================================================

INSERT INTO qa_failures

WITH travel_season AS (
    SELECT
        MAX(season) AS season
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded`
),

canonical_season AS (
    SELECT
        MAX(season) AS season
    FROM `nhl-pacey32-github.NHL_Views.Schedule`
    WHERE game_type = 2
),

failures AS (
    SELECT
        t.season AS travel_season,
        s.season AS canonical_season
    FROM travel_season t
    CROSS JOIN canonical_season s
    WHERE t.season != s.season
       OR t.season IS NULL
       OR s.season IS NULL
)

SELECT
    'TR011',
    'Travel_1_ScheduleExpanded',
    travel_season,
    'CURRENT_SEASON',
    CONCAT(
        'Travel season is ',
        COALESCE(CAST(travel_season AS STRING), 'NULL'),
        '; canonical Schedule season is ',
        COALESCE(CAST(canonical_season AS STRING), 'NULL'),
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
    'TR011',
    'Current travel season freshness',
    'Freshness',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current Travel schedule should represent the latest regular season available in canonical Schedule.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR011';


-- =========================================================
-- TR012
-- Five-year schedule unique team-game grain
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        game_id,
        team_id,
        COUNT(*) AS duplicate_count
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr`
    GROUP BY
        season,
        game_id,
        team_id
    HAVING COUNT(*) > 1
)

SELECT
    'TR012',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Duplicate season/game/team rows.',
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
    'TR012',
    'Five-year schedule unique team-game grain',
    'Uniqueness',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Five-year expanded schedule should contain one row per season, game and team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR012';


-- =========================================================
-- TR013
-- Five-year schedule season coverage
-- =========================================================

INSERT INTO qa_failures
WITH coverage AS (
    SELECT
        COUNT(DISTINCT season) AS season_count,
        MIN(season) AS min_season,
        MAX(season) AS max_season
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr`
),

failures AS (
    SELECT *
    FROM coverage
    WHERE season_count != 5
)

SELECT
    'TR013',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'ALL',
    CONCAT(
        'Expected 5 seasons; found ',
        CAST(season_count AS STRING)
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
    'TR013',
    'Five-year schedule season coverage',
    'Coverage',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Five-year travel schedule should contain exactly five regular seasons.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR013';


-- =========================================================
-- TR014
-- Five-year schedule regular season only
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR014',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    CONCAT(
        'Unexpected game_type: ',
        COALESCE(CAST(game_type AS STRING), 'NULL')
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` t
WHERE game_type IS NULL
   OR game_type != 2;


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
    'TR014',
    'Five-year schedule regular season only',
    'Validity',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Five-year travel schedule should contain regular-season games only.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR014';


-- =========================================================
-- TR015
-- Five-year schedule home-away exclusivity
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR015',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Home/away flags are not mutually exclusive.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` t
WHERE COALESCE(CAST(is_home AS INT64), 0)
    + COALESCE(CAST(is_away AS INT64), 0) != 1;


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
    'TR015',
    'Five-year schedule home-away exclusivity',
    'Validity',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Exactly one of is_home and is_away should be true.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR015';


-- =========================================================
-- TR016
-- Five-year schedule two team perspectives
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        game_id,
        COUNT(*) AS team_rows
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr`
    GROUP BY
        season,
        game_id
    HAVING COUNT(*) != 2
)

SELECT
    'TR016',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING)
    ),
    CONCAT(
        'Expected 2 rows; found ',
        CAST(team_rows AS STRING)
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
    'TR016',
    'Five-year schedule two team perspectives',
    'Coverage',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each NHL game should appear once for each participating team.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR016';


-- =========================================================
-- TR017
-- Five-year schedule required identifiers
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR017',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        COALESCE(CAST(season AS STRING), 'NULL'), '|',
        COALESCE(CAST(game_id AS STRING), 'NULL'), '|',
        COALESCE(CAST(team_id AS STRING), 'NULL')
    ),
    'One or more required identifiers are null or blank.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` t
WHERE season IS NULL
   OR game_id IS NULL
   OR game_date IS NULL
   OR game_datetime IS NULL
   OR team_id IS NULL
   OR NULLIF(TRIM(team_abbrev), '') IS NULL
   OR opponent_team_id IS NULL
   OR NULLIF(TRIM(opponent_team_abbrev), '') IS NULL
   OR team_game_number IS NULL;


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
    'TR017',
    'Five-year schedule required identifiers',
    'Completeness',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Core game, team and opponent identifiers should be populated.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR017';


-- =========================================================
-- TR018
-- Five-year schedule location completeness
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR018',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Game or team-home location is incomplete.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` t
WHERE NULLIF(TRIM(game_city), '') IS NULL
   OR game_latitude IS NULL
   OR game_longitude IS NULL
   OR game_geography IS NULL
   OR NULLIF(TRIM(team_home_city), '') IS NULL
   OR team_home_latitude IS NULL
   OR team_home_longitude IS NULL
   OR team_home_geography IS NULL;


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
    'TR018',
    'Five-year schedule location completeness',
    'Completeness',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Game and team-home locations should be populated.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR018';


-- =========================================================
-- TR019
-- Five-year schedule sequential team game numbers
-- =========================================================

INSERT INTO qa_failures
WITH team_seasons AS (
    SELECT
        season,
        team_id,
        team_abbrev,
        COUNT(*) AS game_count,
        MIN(team_game_number) AS min_game_number,
        MAX(team_game_number) AS max_game_number,
        COUNT(DISTINCT team_game_number) AS distinct_game_numbers
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr`
    GROUP BY
        season,
        team_id,
        team_abbrev
),

failures AS (
    SELECT *
    FROM team_seasons
    WHERE min_game_number != 1
       OR max_game_number != game_count
       OR distinct_game_numbers != game_count
)

SELECT
    'TR019',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Team game numbering is not consecutive.',
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
    'TR019',
    'Five-year schedule sequential team game numbers',
    'Sequence',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Team game numbers should run consecutively from 1 to the team schedule count.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR019';


-- =========================================================
-- TR020
-- Five-year schedule source reconciliation
-- =========================================================

INSERT INTO qa_failures
WITH seasons AS (
    SELECT DISTINCT season
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr`
),

source_schedule AS (
    SELECT
        s.season,
        s.game_id,
        s.home_team_id AS team_id,
        s.away_team_id AS opponent_team_id,
        TRUE AS is_home,
        FALSE AS is_away
    FROM `nhl-pacey32-github.NHL_Views.Schedule` s
    INNER JOIN seasons
        USING (season)
    WHERE s.game_type = 2

    UNION ALL

    SELECT
        s.season,
        s.game_id,
        s.away_team_id AS team_id,
        s.home_team_id AS opponent_team_id,
        FALSE AS is_home,
        TRUE AS is_away
    FROM `nhl-pacey32-github.NHL_Views.Schedule` s
    INNER JOIN seasons
        USING (season)
    WHERE s.game_type = 2
),

failures AS (
    SELECT
        s.*,
        'Missing from Travel_1_ScheduleExpanded_5yr' AS issue
    FROM source_schedule s
    LEFT JOIN `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` t
        USING (
            season,
            game_id,
            team_id,
            opponent_team_id,
            is_home,
            is_away
        )
    WHERE t.game_id IS NULL

    UNION ALL

    SELECT
        t.season,
        t.game_id,
        t.team_id,
        t.opponent_team_id,
        t.is_home,
        t.is_away,
        'Missing from canonical Schedule' AS issue
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` t
    LEFT JOIN source_schedule s
        USING (
            season,
            game_id,
            team_id,
            opponent_team_id,
            is_home,
            is_away
        )
    WHERE s.game_id IS NULL
)

SELECT
    'TR020',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
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
    'TR020',
    'Five-year schedule source reconciliation',
    'Reconciliation',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Five-year expanded schedule should reconcile exactly to canonical regular-season Schedule.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR020';


-- =========================================================
-- TR021
-- Current season schedule cross-pipeline coverage
-- =========================================================

INSERT INTO qa_failures
WITH current_schedule AS (
    SELECT
        season,
        game_id,
        team_id
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded`
),

five_year_schedule AS (
    SELECT
        season,
        game_id,
        team_id
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr`
    WHERE season = (
        SELECT MAX(season)
        FROM current_schedule
    )
),

failures AS (
    SELECT
        c.*,
        'Missing from five-year schedule' AS issue
    FROM current_schedule c
    LEFT JOIN five_year_schedule f
        USING (season, game_id, team_id)
    WHERE f.game_id IS NULL

    UNION ALL

    SELECT
        f.*,
        'Missing from current schedule' AS issue
    FROM five_year_schedule f
    LEFT JOIN current_schedule c
        USING (season, game_id, team_id)
    WHERE c.game_id IS NULL
)

SELECT
    'TR021',
    'Travel_1_ScheduleExpanded_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
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
    'TR021',
    'Current season schedule cross-pipeline coverage',
    'Reconciliation',
    'Team',
    'Travel_1_ScheduleExpanded_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'The current season should contain the same team-game keys in current and five-year schedule pipelines.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR021';


-- =========================================================
-- TR022
-- Current travel leg unique sequence
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        team_id,
        leg_sequence,
        COUNT(*) AS duplicate_count
    FROM `pacey32-agency.Team.Travel_2_Legs`
    GROUP BY
        season,
        team_id,
        leg_sequence
    HAVING COUNT(*) > 1
)

SELECT
    'TR022',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Duplicate leg sequence.',
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
    'TR022',
    'Current travel leg unique sequence',
    'Uniqueness',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each team-season leg_sequence should be unique.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR022';


-- =========================================================
-- TR023
-- Five-year travel leg unique sequence
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        team_id,
        leg_sequence,
        COUNT(*) AS duplicate_count
    FROM `pacey32-agency.Team.Travel_2_Legs_5yr`
    GROUP BY
        season,
        team_id,
        leg_sequence
    HAVING COUNT(*) > 1
)

SELECT
    'TR023',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Duplicate leg sequence.',
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
    'TR023',
    'Five-year travel leg unique sequence',
    'Uniqueness',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each team-season leg_sequence should be unique.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR023';


-- =========================================================
-- TR024
-- Current legs one arrival per game
-- =========================================================

INSERT INTO qa_failures
WITH arrivals AS (
    SELECT
        s.season,
        s.team_id,
        s.game_id,
        COUNTIF(l.leg_type = 'GAME_ARRIVAL') AS arrival_count
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` s
    LEFT JOIN `pacey32-agency.Team.Travel_2_Legs` l
        USING (season, team_id, game_id)
    GROUP BY
        s.season,
        s.team_id,
        s.game_id
),

failures AS (
    SELECT *
    FROM arrivals
    WHERE arrival_count != 1
)

SELECT
    'TR024',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(game_id AS STRING)
    ),
    CONCAT(
        'GAME_ARRIVAL count: ',
        CAST(arrival_count AS STRING)
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
    'TR024',
    'Current legs one arrival per game',
    'Coverage',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every expanded team-game should have exactly one GAME_ARRIVAL leg.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR024';


-- =========================================================
-- TR025
-- Five-year legs one arrival per game
-- =========================================================

INSERT INTO qa_failures
WITH arrivals AS (
    SELECT
        s.season,
        s.team_id,
        s.game_id,
        COUNTIF(l.leg_type = 'GAME_ARRIVAL') AS arrival_count
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded_5yr` s
    LEFT JOIN `pacey32-agency.Team.Travel_2_Legs_5yr` l
        USING (season, team_id, game_id)
    GROUP BY
        s.season,
        s.team_id,
        s.game_id
),

failures AS (
    SELECT *
    FROM arrivals
    WHERE arrival_count != 1
)

SELECT
    'TR025',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(game_id AS STRING)
    ),
    CONCAT(
        'GAME_ARRIVAL count: ',
        CAST(arrival_count AS STRING)
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
    'TR025',
    'Five-year legs one arrival per game',
    'Coverage',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every expanded team-game should have exactly one GAME_ARRIVAL leg.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR025';


-- =========================================================
-- TR026
-- Current valid leg types
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR026',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    CONCAT(
        'Unexpected leg_type: ',
        COALESCE(leg_type, 'NULL')
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs` t
WHERE leg_type IS NULL
   OR leg_type NOT IN (
       'GAME_ARRIVAL',
       'RETURN_HOME'
   );


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
    'TR026',
    'Current valid leg types',
    'Validity',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Leg type should be GAME_ARRIVAL or RETURN_HOME.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR026';


-- =========================================================
-- TR027
-- Five-year valid leg types
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR027',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    CONCAT(
        'Unexpected leg_type: ',
        COALESCE(leg_type, 'NULL')
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE leg_type IS NULL
   OR leg_type NOT IN (
       'GAME_ARRIVAL',
       'RETURN_HOME'
   );


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
    'TR027',
    'Five-year valid leg types',
    'Validity',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Leg type should be GAME_ARRIVAL or RETURN_HOME.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR027';


-- =========================================================
-- TR028
-- Current valid travel reasons
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR028',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    CONCAT(
        'Unexpected travel_reason: ',
        COALESCE(travel_reason, 'NULL')
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs` t
WHERE travel_reason IS NULL
   OR travel_reason NOT IN (
       'SEASON_START_TO_AWAY_GAME',
       'SEASON_START_HOME',
       'RETURN_HOME_FOR_HOME_GAME',
       'REMAINED_HOME',
       'HOME_TO_AWAY_GAME',
       'AWAY_TO_AWAY_STAYED_ON_ROAD',
       'RETURN_HOME_BETWEEN_AWAY_GAMES',
       'HOME_TO_AWAY_AFTER_RETURN_HOME',
       'FINAL_AWAY_GAME_RETURN_HOME'
   );


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
    'TR028',
    'Current valid travel reasons',
    'Validity',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Travel reasons should use only values produced by the travel-leg model.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR028';


-- =========================================================
-- TR029
-- Five-year valid travel reasons
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR029',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    CONCAT(
        'Unexpected travel_reason: ',
        COALESCE(travel_reason, 'NULL')
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE travel_reason IS NULL
   OR travel_reason NOT IN (
       'SEASON_START_TO_AWAY_GAME',
       'SEASON_START_HOME',
       'RETURN_HOME_FOR_HOME_GAME',
       'REMAINED_HOME',
       'HOME_TO_AWAY_GAME',
       'AWAY_TO_AWAY_STAYED_ON_ROAD',
       'RETURN_HOME_BETWEEN_AWAY_GAMES',
       'HOME_TO_AWAY_AFTER_RETURN_HOME',
       'FINAL_AWAY_GAME_RETURN_HOME'
   );


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
    'TR029',
    'Five-year valid travel reasons',
    'Validity',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Travel reasons should use only values produced by the travel-leg model.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR029';


-- =========================================================
-- TR030
-- Current travel location completeness
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR030',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Travel origin or destination is incomplete.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs` t
WHERE NULLIF(TRIM(travel_from_city), '') IS NULL
   OR travel_from_latitude IS NULL
   OR travel_from_longitude IS NULL
   OR travel_from_geography IS NULL
   OR NULLIF(TRIM(travel_to_city), '') IS NULL
   OR travel_to_latitude IS NULL
   OR travel_to_longitude IS NULL
   OR travel_to_geography IS NULL;


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
    'TR030',
    'Current travel location completeness',
    'Completeness',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every leg should have complete origin and destination coordinates and geographies.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR030';


-- =========================================================
-- TR031
-- Five-year travel location completeness
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR031',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Travel origin or destination is incomplete.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE NULLIF(TRIM(travel_from_city), '') IS NULL
   OR travel_from_latitude IS NULL
   OR travel_from_longitude IS NULL
   OR travel_from_geography IS NULL
   OR NULLIF(TRIM(travel_to_city), '') IS NULL
   OR travel_to_latitude IS NULL
   OR travel_to_longitude IS NULL
   OR travel_to_geography IS NULL;


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
    'TR031',
    'Five-year travel location completeness',
    'Completeness',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every leg should have complete origin and destination coordinates and geographies.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR031';


-- =========================================================
-- TR032
-- Current travel distance validity
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR032',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Invalid distance or kilometre/mile mismatch.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs` t
WHERE travel_km IS NULL
   OR travel_miles IS NULL
   OR travel_km < 0
   OR travel_miles < 0
   OR ABS(
       travel_miles
       - (travel_km * 0.621371192237334)
   ) > 0.01;


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
    'TR032',
    'Current travel distance validity',
    'Reconciliation',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Distances should be non-negative and miles should reconcile to kilometres.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR032';


-- =========================================================
-- TR033
-- Five-year travel distance validity
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR033',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Invalid distance or kilometre/mile mismatch.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE travel_km IS NULL
   OR travel_miles IS NULL
   OR travel_km < 0
   OR travel_miles < 0
   OR ABS(
       travel_miles
       - (travel_km * 0.621371192237334)
   ) > 0.01;


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
    'TR033',
    'Five-year travel distance validity',
    'Reconciliation',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Distances should be non-negative and miles should reconcile to kilometres.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR033';


-- =========================================================
-- TR034
-- Current involves-travel consistency
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR034',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'involves_travel disagrees with travel_km.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs` t
WHERE involves_travel IS NULL
   OR involves_travel != (travel_km > 0);


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
    'TR034',
    'Current involves-travel consistency',
    'Validity',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'involves_travel should indicate whether calculated travel distance is greater than zero.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR034';


-- =========================================================
-- TR035
-- Five-year involves-travel consistency
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR035',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'involves_travel disagrees with travel_km.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE involves_travel IS NULL
   OR involves_travel != (travel_km > 0);


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
    'TR035',
    'Five-year involves-travel consistency',
    'Validity',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'involves_travel should indicate whether calculated travel distance is greater than zero.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR035';


-- =========================================================
-- TR036
-- Current return-home destination
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR036',
    'Travel_2_Legs',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Return-home destination differs from team home location.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs` t
WHERE leg_type = 'RETURN_HOME'
  AND ST_DISTANCE(
      travel_to_geography,
      team_home_geography
  ) > 100;


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
    'TR036',
    'Current return-home destination',
    'Logic',
    'Team',
    'Travel_2_Legs',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'RETURN_HOME legs should end at the team home geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR036';


-- =========================================================
-- TR037
-- Five-year return-home destination
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR037',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'Return-home destination differs from team home location.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE leg_type = 'RETURN_HOME'
  AND ST_DISTANCE(
      travel_to_geography,
      team_home_geography
  ) > 100;


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
    'TR037',
    'Five-year return-home destination',
    'Logic',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'RETURN_HOME legs should end at the team home geography.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR037';


-- =========================================================
-- TR038
-- Away-to-away road-trip gap rule
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR038',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    CONCAT(
        'days_since_previous_game=',
        COALESCE(
            CAST(days_since_previous_game AS STRING),
            'NULL'
        )
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE travel_reason = 'AWAY_TO_AWAY_STAYED_ON_ROAD'
  AND (
      days_since_previous_game IS NULL
      OR days_since_previous_game > 2
  );


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
    'TR038',
    'Away-to-away road-trip gap rule',
    'Logic',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'AWAY_TO_AWAY_STAYED_ON_ROAD should only occur when consecutive away games are no more than two calendar days apart.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR038';


-- =========================================================
-- TR039
-- Return-home long-gap rule
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR039',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    CONCAT(
        'days_until_next_game=',
        COALESCE(
            CAST(days_until_next_game AS STRING),
            'NULL'
        )
    ),
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE travel_reason = 'RETURN_HOME_BETWEEN_AWAY_GAMES'
  AND (
      days_until_next_game IS NULL
      OR days_until_next_game <= 2
  );


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
    'TR039',
    'Return-home long-gap rule',
    'Logic',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'RETURN_HOME_BETWEEN_AWAY_GAMES should only be generated before an away game more than two calendar days later.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR039';


-- =========================================================
-- TR040
-- Road-trip ID consistency
-- =========================================================

INSERT INTO qa_failures
SELECT
    'TR040',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
    'road_trip_id presence is inconsistent with travel reason.',
    TO_JSON(t)
FROM `pacey32-agency.Team.Travel_2_Legs_5yr` t
WHERE (
    travel_reason IN (
        'SEASON_START_TO_AWAY_GAME',
        'RETURN_HOME_FOR_HOME_GAME',
        'HOME_TO_AWAY_GAME',
        'AWAY_TO_AWAY_STAYED_ON_ROAD',
        'RETURN_HOME_BETWEEN_AWAY_GAMES',
        'HOME_TO_AWAY_AFTER_RETURN_HOME',
        'FINAL_AWAY_GAME_RETURN_HOME'
    )
    AND road_trip_id IS NULL
)
OR (
    travel_reason IN (
        'SEASON_START_HOME',
        'REMAINED_HOME'
    )
    AND road_trip_id IS NOT NULL
);


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
    'TR040',
    'Road-trip ID consistency',
    'Logic',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Away-trip and associated return-home legs should have road_trip_id; home-only legs should not.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR040';


-- =========================================================
-- TR041
-- Current season leg cross-pipeline reconciliation
-- =========================================================

INSERT INTO qa_failures
WITH current_legs AS (
    SELECT
        season,
        team_id,
        leg_sequence,
        leg_type,
        game_id,
        travel_reason
    FROM `pacey32-agency.Team.Travel_2_Legs`
),

five_year_legs AS (
    SELECT
        season,
        team_id,
        leg_sequence,
        leg_type,
        game_id,
        travel_reason
    FROM `pacey32-agency.Team.Travel_2_Legs_5yr`
    WHERE season = (
        SELECT MAX(season)
        FROM current_legs
    )
),

failures AS (
    SELECT
        c.*,
        'Missing/different in five-year legs' AS issue
    FROM current_legs c
    LEFT JOIN five_year_legs f
        USING (
            season,
            team_id,
            leg_sequence,
            leg_type,
            game_id,
            travel_reason
        )
    WHERE f.leg_sequence IS NULL

    UNION ALL

    SELECT
        f.*,
        'Missing/different in current legs' AS issue
    FROM five_year_legs f
    LEFT JOIN current_legs c
        USING (
            season,
            team_id,
            leg_sequence,
            leg_type,
            game_id,
            travel_reason
        )
    WHERE c.leg_sequence IS NULL
)

SELECT
    'TR041',
    'Travel_2_Legs_5yr',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING), '|',
        CAST(leg_sequence AS STRING)
    ),
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
    'TR041',
    'Current season leg cross-pipeline reconciliation',
    'Reconciliation',
    'Team',
    'Travel_2_Legs_5yr',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Current-season travel-leg structure should agree between current and five-year pipelines.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR041';


-- =========================================================
-- TR042
-- Last-season summary unique team-season grain
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        team_id,
        COUNT(*) AS duplicate_count
    FROM `pacey32-agency.Team.Travel_3_LastSeasonSummary`
    GROUP BY
        season,
        team_id
    HAVING COUNT(*) > 1
)

SELECT
    'TR042',
    'Travel_3_LastSeasonSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Duplicate team-season summary rows.',
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
    'TR042',
    'Last-season summary unique team-season grain',
    'Uniqueness',
    'Team',
    'Travel_3_LastSeasonSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Last-season summary should contain one row per team-season.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR042';


-- =========================================================
-- TR043
-- Five-year summary unique team-season grain
-- =========================================================

INSERT INTO qa_failures
WITH failures AS (
    SELECT
        season,
        team_id,
        COUNT(*) AS duplicate_count
    FROM `pacey32-agency.Team.Travel_4_FiveYearSummary`
    GROUP BY
        season,
        team_id
    HAVING COUNT(*) > 1
)

SELECT
    'TR043',
    'Travel_4_FiveYearSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'Duplicate team-season summary rows.',
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
    'TR043',
    'Five-year summary unique team-season grain',
    'Uniqueness',
    'Team',
    'Travel_4_FiveYearSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Five-year summary should contain one row per team-season.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR043';


-- =========================================================
-- TR044
-- Last-season summary coverage
-- =========================================================

INSERT INTO qa_failures
WITH leg_team_seasons AS (
    SELECT DISTINCT
        season,
        team_id
    FROM `pacey32-agency.Team.Travel_2_Legs`
),

summary_team_seasons AS (
    SELECT
        season,
        team_id
    FROM `pacey32-agency.Team.Travel_3_LastSeasonSummary`
),

failures AS (
    SELECT
        l.season,
        l.team_id,
        'Missing summary' AS issue
    FROM leg_team_seasons l
    LEFT JOIN summary_team_seasons s
        USING (season, team_id)
    WHERE s.team_id IS NULL

    UNION ALL

    SELECT
        s.season,
        s.team_id,
        'Summary without legs' AS issue
    FROM summary_team_seasons s
    LEFT JOIN leg_team_seasons l
        USING (season, team_id)
    WHERE l.team_id IS NULL
)

SELECT
    'TR044',
    'Travel_3_LastSeasonSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
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
    'TR044',
    'Last-season summary coverage',
    'Coverage',
    'Team',
    'Travel_3_LastSeasonSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Summary team-seasons should exactly match current travel-leg team-seasons.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR044';


-- =========================================================
-- TR045
-- Five-year summary coverage
-- =========================================================

INSERT INTO qa_failures
WITH leg_team_seasons AS (
    SELECT DISTINCT
        season,
        team_id
    FROM `pacey32-agency.Team.Travel_2_Legs_5yr`
),

summary_team_seasons AS (
    SELECT
        season,
        team_id
    FROM `pacey32-agency.Team.Travel_4_FiveYearSummary`
),

failures AS (
    SELECT
        l.season,
        l.team_id,
        'Missing summary' AS issue
    FROM leg_team_seasons l
    LEFT JOIN summary_team_seasons s
        USING (season, team_id)
    WHERE s.team_id IS NULL

    UNION ALL

    SELECT
        s.season,
        s.team_id,
        'Summary without legs' AS issue
    FROM summary_team_seasons s
    LEFT JOIN leg_team_seasons l
        USING (season, team_id)
    WHERE l.team_id IS NULL
)

SELECT
    'TR045',
    'Travel_4_FiveYearSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
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
    'TR045',
    'Five-year summary coverage',
    'Coverage',
    'Team',
    'Travel_4_FiveYearSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Summary team-seasons should exactly match five-year travel-leg team-seasons.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR045';


-- =========================================================
-- TR046
-- Last-season summary aggregate reconciliation
-- =========================================================

INSERT INTO qa_failures
WITH expected AS (
    SELECT
        season,
        team_id,

        COUNTIF(leg_type = 'GAME_ARRIVAL') AS total_games,
        COUNTIF(is_home) AS home_games,
        COUNTIF(is_away) AS away_games,
        COUNTIF(travel_km > 0) AS travel_legs,
        COUNTIF(leg_type = 'RETURN_HOME') AS return_home_legs,
        COUNT(DISTINCT road_trip_id) AS road_trip_count,

        ROUND(
            SUM(COALESCE(travel_km, 0)),
            1
        ) AS total_distance_km,

        ROUND(
            SUM(COALESCE(travel_km, 0)) * 0.621371,
            1
        ) AS total_distance_miles,

        ROUND(
            AVG(NULLIF(travel_km, 0)),
            1
        ) AS average_leg_km,

        ROUND(
            APPROX_QUANTILES(
                NULLIF(travel_km, 0),
                100
            )[OFFSET(50)],
            1
        ) AS median_leg_km,

        ROUND(MAX(travel_km), 1) AS longest_leg_km,

        ROUND(
            MIN(NULLIF(travel_km, 0)),
            1
        ) AS shortest_nonzero_leg_km,

        COUNTIF(travel_km >= 500) AS legs_over_500km,
        COUNTIF(travel_km >= 1000) AS legs_over_1000km,
        COUNTIF(travel_km >= 2000) AS legs_over_2000km,
        COUNTIF(travel_km >= 3000) AS legs_over_3000km,

        COUNTIF(
            travel_reason = 'SEASON_START_TO_AWAY_GAME'
        ) AS season_start_trips,

        COUNTIF(
            travel_reason IN (
                'HOME_TO_AWAY_GAME',
                'HOME_TO_AWAY_AFTER_RETURN_HOME'
            )
        ) AS home_to_away_trips,

        COUNTIF(
            travel_reason = 'AWAY_TO_AWAY_STAYED_ON_ROAD'
        ) AS away_to_away_trips,

        COUNTIF(
            travel_reason = 'RETURN_HOME_BETWEEN_AWAY_GAMES'
        ) AS return_home_between_trips,

        COUNTIF(
            travel_reason = 'RETURN_HOME_FOR_HOME_GAME'
        ) AS return_home_for_home_games

    FROM `pacey32-agency.Team.Travel_2_Legs`
    GROUP BY
        season,
        team_id
),

failures AS (
    SELECT
        s.*
    FROM `pacey32-agency.Team.Travel_3_LastSeasonSummary` s
    INNER JOIN expected e
        USING (season, team_id)
    WHERE s.total_games != e.total_games
       OR s.home_games != e.home_games
       OR s.away_games != e.away_games
       OR s.travel_legs != e.travel_legs
       OR s.return_home_legs != e.return_home_legs
       OR s.road_trip_count != e.road_trip_count
       OR ABS(s.total_distance_km - e.total_distance_km) > 0.01
       OR ABS(s.total_distance_miles - e.total_distance_miles) > 0.01
       OR ABS(s.average_leg_km - e.average_leg_km) > 0.01
       OR ABS(s.median_leg_km - e.median_leg_km) > 0.01
       OR ABS(s.longest_leg_km - e.longest_leg_km) > 0.01
       OR ABS(
           s.shortest_nonzero_leg_km
           - e.shortest_nonzero_leg_km
       ) > 0.01
       OR s.legs_over_500km != e.legs_over_500km
       OR s.legs_over_1000km != e.legs_over_1000km
       OR s.legs_over_2000km != e.legs_over_2000km
       OR s.legs_over_3000km != e.legs_over_3000km
       OR s.season_start_trips != e.season_start_trips
       OR s.home_to_away_trips != e.home_to_away_trips
       OR s.away_to_away_trips != e.away_to_away_trips
       OR s.return_home_between_trips != e.return_home_between_trips
       OR s.return_home_for_home_games != e.return_home_for_home_games
)

SELECT
    'TR046',
    'Travel_3_LastSeasonSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'One or more summary metrics do not reconcile to travel legs.',
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
    'TR046',
    'Last-season summary aggregate reconciliation',
    'Reconciliation',
    'Team',
    'Travel_3_LastSeasonSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'All exposed last-season summary aggregates should reconcile to Travel_2_Legs.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR046';


-- =========================================================
-- TR047
-- Five-year summary aggregate reconciliation
-- =========================================================

INSERT INTO qa_failures
WITH expected AS (
    SELECT
        season,
        team_id,

        COUNTIF(leg_type = 'GAME_ARRIVAL') AS total_games,
        COUNTIF(is_home) AS home_games,
        COUNTIF(is_away) AS away_games,
        COUNTIF(travel_km > 0) AS travel_legs,
        COUNTIF(leg_type = 'RETURN_HOME') AS return_home_legs,
        COUNT(DISTINCT road_trip_id) AS road_trip_count,

        ROUND(
            SUM(COALESCE(travel_km, 0)),
            1
        ) AS total_distance_km,

        ROUND(
            SUM(COALESCE(travel_km, 0)) * 0.621371,
            1
        ) AS total_distance_miles,

        ROUND(
            AVG(NULLIF(travel_km, 0)),
            1
        ) AS average_leg_km,

        ROUND(
            APPROX_QUANTILES(
                NULLIF(travel_km, 0),
                100
            )[OFFSET(50)],
            1
        ) AS median_leg_km,

        ROUND(MAX(travel_km), 1) AS longest_leg_km,

        ROUND(
            MIN(NULLIF(travel_km, 0)),
            1
        ) AS shortest_nonzero_leg_km,

        COUNTIF(travel_km >= 500) AS legs_over_500km,
        COUNTIF(travel_km >= 1000) AS legs_over_1000km,
        COUNTIF(travel_km >= 2000) AS legs_over_2000km,
        COUNTIF(travel_km >= 3000) AS legs_over_3000km,

        COUNTIF(
            travel_reason = 'SEASON_START_TO_AWAY_GAME'
        ) AS season_start_trips,

        COUNTIF(
            travel_reason IN (
                'HOME_TO_AWAY_GAME',
                'HOME_TO_AWAY_AFTER_RETURN_HOME'
            )
        ) AS home_to_away_trips,

        COUNTIF(
            travel_reason = 'AWAY_TO_AWAY_STAYED_ON_ROAD'
        ) AS away_to_away_trips,

        COUNTIF(
            travel_reason = 'RETURN_HOME_BETWEEN_AWAY_GAMES'
        ) AS return_home_between_trips,

        COUNTIF(
            travel_reason = 'RETURN_HOME_FOR_HOME_GAME'
        ) AS return_home_for_home_games

    FROM `pacey32-agency.Team.Travel_2_Legs_5yr`
    GROUP BY
        season,
        team_id
),

failures AS (
    SELECT
        s.*
    FROM `pacey32-agency.Team.Travel_4_FiveYearSummary` s
    INNER JOIN expected e
        USING (season, team_id)
    WHERE s.total_games != e.total_games
       OR s.home_games != e.home_games
       OR s.away_games != e.away_games
       OR s.travel_legs != e.travel_legs
       OR s.return_home_legs != e.return_home_legs
       OR s.road_trip_count != e.road_trip_count
       OR ABS(s.total_distance_km - e.total_distance_km) > 0.01
       OR ABS(s.total_distance_miles - e.total_distance_miles) > 0.01
       OR ABS(s.average_leg_km - e.average_leg_km) > 0.01
       OR ABS(s.median_leg_km - e.median_leg_km) > 0.01
       OR ABS(s.longest_leg_km - e.longest_leg_km) > 0.01
       OR ABS(
           s.shortest_nonzero_leg_km
           - e.shortest_nonzero_leg_km
       ) > 0.01
       OR s.legs_over_500km != e.legs_over_500km
       OR s.legs_over_1000km != e.legs_over_1000km
       OR s.legs_over_2000km != e.legs_over_2000km
       OR s.legs_over_3000km != e.legs_over_3000km
       OR s.season_start_trips != e.season_start_trips
       OR s.home_to_away_trips != e.home_to_away_trips
       OR s.away_to_away_trips != e.away_to_away_trips
       OR s.return_home_between_trips != e.return_home_between_trips
       OR s.return_home_for_home_games != e.return_home_for_home_games
)

SELECT
    'TR047',
    'Travel_4_FiveYearSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'One or more summary metrics do not reconcile to travel legs.',
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
    'TR047',
    'Five-year summary aggregate reconciliation',
    'Reconciliation',
    'Team',
    'Travel_4_FiveYearSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'All exposed five-year summary aggregates should reconcile to Travel_2_Legs_5yr.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR047';


-- =========================================================
-- TR048
-- Five-year summary ranking reconciliation
-- =========================================================

INSERT INTO qa_failures
WITH expected AS (
    SELECT
        season,
        team_id,

        DENSE_RANK() OVER (
            PARTITION BY season
            ORDER BY total_distance_km DESC
        ) AS expected_distance_rank,

        DENSE_RANK() OVER (
            PARTITION BY season
            ORDER BY road_trip_count DESC
        ) AS expected_road_trip_rank,

        DENSE_RANK() OVER (
            PARTITION BY season
            ORDER BY longest_leg_km DESC
        ) AS expected_longest_leg_rank

    FROM `pacey32-agency.Team.Travel_4_FiveYearSummary`
),

failures AS (
    SELECT
        s.season,
        s.team_id,
        s.team_abbrev,

        s.distance_rank,
        e.expected_distance_rank,

        s.road_trip_rank,
        e.expected_road_trip_rank,

        s.longest_leg_rank,
        e.expected_longest_leg_rank

    FROM `pacey32-agency.Team.Travel_4_FiveYearSummary` s
    INNER JOIN expected e
        USING (season, team_id)

    WHERE s.distance_rank != e.expected_distance_rank
       OR s.road_trip_rank != e.expected_road_trip_rank
       OR s.longest_leg_rank != e.expected_longest_leg_rank
)

SELECT
    'TR048',
    'Travel_4_FiveYearSummary',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(team_id AS STRING)
    ),
    'One or more ranking fields do not reconcile.',
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
    'TR048',
    'Five-year summary ranking reconciliation',
    'Reconciliation',
    'Team',
    'Travel_4_FiveYearSummary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Summary ranks should equal dense ranks of their underlying metrics within season.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR048';

-- =========================================================
-- TR049
-- Current schedule source reconciliation
-- =========================================================

INSERT INTO qa_failures

WITH travel_seasons AS (
    SELECT DISTINCT
        season
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded`
),

source_schedule AS (
    SELECT
        s.season,
        s.game_id,
        s.home_team_id AS team_id,
        s.away_team_id AS opponent_team_id,
        TRUE AS is_home,
        FALSE AS is_away
    FROM `nhl-pacey32-github.NHL_Views.Schedule` s
    INNER JOIN travel_seasons t
        ON s.season = t.season
    WHERE s.game_type = 2

    UNION ALL

    SELECT
        s.season,
        s.game_id,
        s.away_team_id AS team_id,
        s.home_team_id AS opponent_team_id,
        FALSE AS is_home,
        TRUE AS is_away
    FROM `nhl-pacey32-github.NHL_Views.Schedule` s
    INNER JOIN travel_seasons t
        ON s.season = t.season
    WHERE s.game_type = 2
),

failures AS (
    SELECT
        s.season,
        s.game_id,
        s.team_id,
        s.opponent_team_id,
        s.is_home,
        s.is_away,
        'Missing from Travel_1_ScheduleExpanded' AS issue
    FROM source_schedule s
    LEFT JOIN `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
        USING (
            season,
            game_id,
            team_id,
            opponent_team_id,
            is_home,
            is_away
        )
    WHERE t.game_id IS NULL

    UNION ALL

    SELECT
        t.season,
        t.game_id,
        t.team_id,
        t.opponent_team_id,
        t.is_home,
        t.is_away,
        'Missing from canonical Schedule' AS issue
    FROM `pacey32-agency.Team.Travel_1_ScheduleExpanded` t
    LEFT JOIN source_schedule s
        USING (
            season,
            game_id,
            team_id,
            opponent_team_id,
            is_home,
            is_away
        )
    WHERE s.game_id IS NULL
)

SELECT
    'TR049',
    'Travel_1_ScheduleExpanded',
    season,
    CONCAT(
        CAST(season AS STRING), '|',
        CAST(game_id AS STRING), '|',
        CAST(team_id AS STRING)
    ),
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
    'TR049',
    'Current schedule source reconciliation',
    'Reconciliation',
    'Team',
    'Travel_1_ScheduleExpanded',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Travel schedule should reconcile exactly to canonical regular-season Schedule for the season represented in Travel.',
    CAST(NULL AS STRING)
FROM qa_failures
WHERE test_id = 'TR049';


-- =========================================================
-- Write failure records
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
-- Return this run for immediate inspection
-- =========================================================

SELECT
    test_id,
    test_name,
    category,
    severity,
    status,
    failure_count,
    source_object
FROM `pacey32-agency.QA.TestResults`
WHERE run_id = v_run_id
ORDER BY test_id;