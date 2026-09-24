-- ============================================================
-- TEAM DOMAIN DATA QUALITY
-- pacey32-agency
--
-- Objects:
--   TeamList
--   TeamList_History
--   Standings
--   TeamSummary
--   TeamPerformance
--   TeamDepthChart
--   Playoffs
--   PlayoffResult
-- ============================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();

-- ============================================================
-- TM001 - TeamList grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT triCode
    FROM `pacey32-agency.Team.TeamList`
    GROUP BY triCode
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id,
    v_run_datetime,
    'TM001',
    'Current team grain',
    'Grain',
    'Team',
    'TeamList',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamList must contain one row per current team code.',
    CAST(NULL AS STRING)
FROM counts;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TM001',
    'TeamList',
    CAST(NULL AS INT64),
    triCode,
    'Duplicate current team code',
    TO_JSON(STRUCT(triCode))
FROM (
    SELECT triCode
    FROM `pacey32-agency.Team.TeamList`
    GROUP BY triCode
    HAVING COUNT(*) > 1
);


-- ============================================================
-- TM002 - Current NHL team count
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH profile AS (
    SELECT
        COUNT(*) AS cnt,
        COUNT(DISTINCT triCode) AS team_cnt
    FROM `pacey32-agency.Team.TeamList`
),
counts AS (
    SELECT
        IF(cnt = 32 AND team_cnt = 32, 0, 1) AS failure_count,
        cnt,
        team_cnt
    FROM profile
)
SELECT
    v_run_id,
    v_run_datetime,
    'TM002',
    'Current NHL team coverage',
    'Completeness',
    'Team',
    'TeamList',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamList should contain the 32 current NHL teams.',
    FORMAT('rows=%d, distinct_teams=%d', cnt, team_cnt)
FROM counts;


-- ============================================================
-- TM003 - TeamList required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamList`
    WHERE id IS NULL
       OR franchiseId IS NULL
       OR NULLIF(TRIM(fullName), '') IS NULL
       OR NULLIF(TRIM(triCode), '') IS NULL
       OR NULLIF(TRIM(venue), '') IS NULL
       OR NULLIF(TRIM(venueLocation), '') IS NULL
       OR NULLIF(TRIM(home_name), '') IS NULL
       OR NULLIF(TRIM(HomeTeamPlaceName), '') IS NULL
       OR NULLIF(TRIM(home_logo), '') IS NULL
       OR NULLIF(TRIM(conferenceName), '') IS NULL
       OR NULLIF(TRIM(conferenceAbbrev), '') IS NULL
       OR NULLIF(TRIM(divisionName), '') IS NULL
       OR NULLIF(TRIM(divisionAbbrev), '') IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM003',
    'Current team required fields',
    'Completeness',
    'Team',
    'TeamList',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Current teams require identifiers, venue and standings metadata.',
    CAST(NULL AS STRING)
FROM counts;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id, v_run_datetime,
    'TM003',
    'TeamList',
    CAST(NULL AS INT64),
    COALESCE(triCode, CAST(id AS STRING)),
    'Missing required current team metadata',
    TO_JSON(t)
FROM `pacey32-agency.Team.TeamList` t
WHERE id IS NULL
   OR franchiseId IS NULL
   OR NULLIF(TRIM(fullName), '') IS NULL
   OR NULLIF(TRIM(triCode), '') IS NULL
   OR NULLIF(TRIM(venue), '') IS NULL
   OR NULLIF(TRIM(venueLocation), '') IS NULL
   OR NULLIF(TRIM(home_name), '') IS NULL
   OR NULLIF(TRIM(HomeTeamPlaceName), '') IS NULL
   OR NULLIF(TRIM(home_logo), '') IS NULL
   OR NULLIF(TRIM(conferenceName), '') IS NULL
   OR NULLIF(TRIM(conferenceAbbrev), '') IS NULL
   OR NULLIF(TRIM(divisionName), '') IS NULL
   OR NULLIF(TRIM(divisionAbbrev), '') IS NULL;


-- ============================================================
-- TM004 - TeamList valid conference/division
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamList`
    WHERE conferenceName NOT IN ('Eastern', 'Western')
       OR divisionName NOT IN ('Atlantic', 'Metropolitan', 'Central', 'Pacific')
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM004',
    'Conference and division validity',
    'Validity',
    'Team',
    'TeamList',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Current teams must belong to recognised NHL conferences and divisions.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM005 - TeamList_History grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT season, team_id
    FROM `pacey32-agency.Team.TeamList_History`
    GROUP BY season, team_id
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM005',
    'Historical team grain',
    'Grain',
    'Team',
    'TeamList_History',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamList_History must contain one row per season and team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM006 - TeamList_History season coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT DISTINCT season
    FROM `nhl-pacey32-github.NHL_Views.Schedule`
    ORDER BY season DESC
    LIMIT 5
),
actual AS (
    SELECT DISTINCT season
    FROM `pacey32-agency.Team.TeamList_History`
),
failures AS (
    SELECT season FROM expected
    EXCEPT DISTINCT
    SELECT season FROM actual
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM006',
    'Historical team season coverage',
    'Coverage',
    'Team',
    'TeamList_History',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamList_History must contain each of the latest five schedule seasons.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM007 - TeamList_History required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH regular_seasons AS (
    SELECT DISTINCT
        SAFE_CAST(season AS INT64) AS season
    FROM `nhl-pacey32-github.NHL_Views.GameAction_BasicInfo`
    WHERE gameType = '2'
      AND neutralSite = 'n/a'
),
failures AS (
    SELECT h.*
    FROM `pacey32-agency.Team.TeamList_History` h
    LEFT JOIN regular_seasons r
        ON SAFE_CAST(h.season AS INT64) = r.season
    WHERE h.season IS NULL
       OR h.team_id IS NULL
       OR NULLIF(TRIM(h.fullName), '') IS NULL
       OR NULLIF(TRIM(h.tricode), '') IS NULL
       OR (
           r.season IS NOT NULL
           AND (
               NULLIF(TRIM(h.venue), '') IS NULL
               OR NULLIF(TRIM(h.venueLocation), '') IS NULL
           )
       )
),
counts AS (
    SELECT COUNT(*) AS failure_count
    FROM failures
)
SELECT
    v_run_id,
    v_run_datetime,
    'TM007',
    'Historical team required fields',
    'Completeness',
    'Team',
    'TeamList_History',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'WARN'),
    failure_count,
    'Historical team-season records require team identity; venue metadata is required once regular-season GameAction data exists.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM008 - Standings source reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH counts AS (
    SELECT ABS(
        (SELECT COUNT(*) FROM `pacey32-agency.Team.Standings`) -
        (SELECT COUNT(*) FROM `nhl-pacey32-github.NHL_Views.Standings`)
    ) AS failure_count
)
SELECT
    v_run_id, v_run_datetime,
    'TM008',
    'Standings source reconciliation',
    'Reconciliation',
    'Team',
    'Standings',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Agency Standings is a direct pass-through and must match source row count.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM009 - Standings grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT seasonId, date, teamAbbrev_default
    FROM `pacey32-agency.Team.Standings`
    GROUP BY seasonId, date, teamAbbrev_default
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM009',
    'Standings grain',
    'Grain',
    'Team',
    'Standings',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Standings must contain one row per season, date and team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM010 - Standings arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.Standings`
    WHERE gameTypeId = 2
      AND (
          gamesPlayed < 0
          OR wins < 0
          OR losses < 0
          OR otLosses < 0
          OR points < 0
          OR wins + losses + otLosses != gamesPlayed
          OR goalFor < 0
          OR goalAgainst < 0
          OR goalDifferential != goalFor - goalAgainst
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM010',
    'Standings arithmetic',
    'Arithmetic',
    'Team',
    'Standings',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Regular-season standings counts and goal differential must reconcile.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM011 - Standings home/road arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.Standings`
    WHERE gameTypeId = 2
      AND (
          homeGamesPlayed + roadGamesPlayed != gamesPlayed
          OR homeWins + homeLosses + homeOtLosses != homeGamesPlayed
          OR roadWins + roadLosses + roadOtLosses != roadGamesPlayed
          OR homeGoalDifferential != homeGoalsFor - homeGoalsAgainst
          OR roadGoalDifferential != roadGoalsFor - roadGoalsAgainst
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM011',
    'Standings home and road arithmetic',
    'Arithmetic',
    'Team',
    'Standings',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Home and road standings must reconcile to overall games and goal differential.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM012 - Standings percentage validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.Standings`
    WHERE gameTypeId = 2
      AND (
          pointPctg < 0 OR pointPctg > 1
          OR winPctg < 0 OR winPctg > 1
          OR regulationWinPctg < 0 OR regulationWinPctg > 1
          OR regulationPlusOtWinPctg < 0 OR regulationPlusOtWinPctg > 1
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM012',
    'Standings percentage validity',
    'Validity',
    'Team',
    'Standings',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Standings percentage fields must remain between zero and one.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM013 - TeamSummary source reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH counts AS (
    SELECT ABS(
        (SELECT COUNT(*) FROM `pacey32-agency.Team.TeamSummary`) -
        (SELECT COUNT(*) FROM `nhl-pacey32-github.NHL_Views.TeamSummary`)
    ) AS failure_count
)
SELECT
    v_run_id, v_run_datetime,
    'TM013',
    'Team summary source reconciliation',
    'Reconciliation',
    'Team',
    'TeamSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Agency TeamSummary is a direct pass-through and must match source row count.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM014 - TeamSummary grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT seasonId, teamId
    FROM `pacey32-agency.Team.TeamSummary`
    GROUP BY seasonId, teamId
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM014',
    'Team summary grain',
    'Grain',
    'Team',
    'TeamSummary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamSummary must contain one row per season and team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM015 - TeamSummary arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamSummary`
    WHERE gamesPlayed < 0
       OR wins < 0
       OR losses < 0
       OR otLosses < 0
       OR points < 0
       OR goalsFor < 0
       OR goalsAgainst < 0
       OR wins + losses + otLosses != gamesPlayed
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM015',
    'Team summary arithmetic',
    'Arithmetic',
    'Team',
    'TeamSummary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamSummary win/loss/OT counts must reconcile to games played.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM016 - TeamSummary percentage validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamSummary`
    WHERE pointPct < 0 OR pointPct > 1
       OR powerPlayPct < 0 OR powerPlayPct > 1
       OR powerPlayNetPct < 0 OR powerPlayNetPct > 1
       OR penaltyKillPct < 0 OR penaltyKillPct > 1
       OR penaltyKillNetPct < 0 OR penaltyKillNetPct > 1
       OR faceoffWinPct < 0 OR faceoffWinPct > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM016',
    'Team summary percentage validity',
    'Validity',
    'Team',
    'TeamSummary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamSummary percentage metrics must remain between zero and one.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM017 - Playoffs source reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH counts AS (
    SELECT ABS(
        (SELECT COUNT(*) FROM `pacey32-agency.Team.Playoffs`) -
        (SELECT COUNT(*) FROM `nhl-pacey32-github.NHL_Views.Playoffs`)
    ) AS failure_count
)
SELECT
    v_run_id, v_run_datetime,
    'TM017',
    'Playoffs source reconciliation',
    'Reconciliation',
    'Team',
    'Playoffs',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Agency Playoffs is a direct pass-through and must match source row count.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM018 - Playoffs grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT seasonId, seriesLetter
    FROM `pacey32-agency.Team.Playoffs`
    GROUP BY seasonId, seriesLetter
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM018',
    'Playoff series grain',
    'Grain',
    'Team',
    'Playoffs',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Playoffs must contain one row per season and series letter.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM019 - PlayoffResult grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT season, team
    FROM `pacey32-agency.Team.PlayoffResult`
    GROUP BY season, team
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM019',
    'Playoff result grain',
    'Grain',
    'Team',
    'PlayoffResult',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'PlayoffResult must contain one row per playoff season and team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM020 - PlayoffResult allowed values
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.PlayoffResult`
    WHERE result NOT IN (
        'Stanley Cup Winner',
        'Stanley Cup Final',
        'Conference Final',
        'Second Round',
        'First Round',
        'Missed Playoffs'
    )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM020',
    'Playoff result validity',
    'Validity',
    'Team',
    'PlayoffResult',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'PlayoffResult must use recognised result categories.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM021 - Stanley Cup winner count
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH completed AS (
    SELECT SAFE_CAST(seasonId AS INT64) AS season
    FROM `pacey32-agency.Team.Playoffs`
    WHERE seriesAbbrev = 'SCF'
    GROUP BY seasonId
),
actual AS (
    SELECT
        season,
        COUNTIF(result = 'Stanley Cup Winner') AS winner_count
    FROM `pacey32-agency.Team.PlayoffResult`
    GROUP BY season
),
failures AS (
    SELECT
        c.season,
        COALESCE(a.winner_count, 0) AS winner_count
    FROM completed c
    LEFT JOIN actual a
        ON c.season = a.season
    WHERE COALESCE(a.winner_count, 0) !=
        CASE
            WHEN c.season = 19181919 THEN 0
            ELSE 1
        END
),
counts AS (
    SELECT COUNT(*) AS failure_count
    FROM failures
)
SELECT
    v_run_id,
    v_run_datetime,
    'TM021',
    'Stanley Cup winner count',
    'Arithmetic',
    'Team',
    'PlayoffResult',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Each Stanley Cup Final season must identify exactly one winner, except 1918-19 when the Final was abandoned and no Cup was awarded.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM022 - Cup final metadata
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.PlayoffResult`
    WHERE result IN ('Stanley Cup Winner', 'Stanley Cup Final')
      AND (
          NULLIF(TRIM(final_opponent), '') IS NULL
          OR NULLIF(TRIM(final_score), '') IS NULL
      )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM022',
    'Stanley Cup Final metadata',
    'Completeness',
    'Team',
    'PlayoffResult',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Stanley Cup finalists require final opponent and series score.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM023 - Non-finalist final metadata
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.PlayoffResult`
    WHERE result NOT IN ('Stanley Cup Winner', 'Stanley Cup Final')
      AND (final_opponent IS NOT NULL OR final_score IS NOT NULL)
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM023',
    'Non-finalist final metadata',
    'Validity',
    'Team',
    'PlayoffResult',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Only Stanley Cup finalists should contain final opponent and final score.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM024 - TeamPerformance grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT seasonId, team_code
    FROM `pacey32-agency.Team.TeamPerformance`
    GROUP BY seasonId, team_code
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM024',
    'Team performance grain',
    'Grain',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamPerformance must contain one row per season and team.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM025 - TeamPerformance latest standings selection
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        seasonId,
        teamAbbrev_default AS team_code,
        date,
        gamesPlayed,
        points
    FROM `pacey32-agency.Team.Standings`
    WHERE gameTypeId = 2
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY seasonId, teamAbbrev_default
        ORDER BY date DESC, RunDate DESC
    ) = 1
),
failures AS (
    SELECT
        e.seasonId,
        e.team_code
    FROM expected e
    LEFT JOIN `pacey32-agency.Team.TeamPerformance` p
        ON e.seasonId = p.seasonId
       AND e.team_code = p.team_code
    WHERE p.team_code IS NULL
       OR p.date != e.date
       OR p.games_played != e.gamesPlayed
       OR p.points != e.points
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM025',
    'Latest standings selection',
    'Transformation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamPerformance must use the latest regular-season standings row for each team-season.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM026 - TeamPerformance overall arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamPerformance`
    WHERE games_played < 0
       OR wins + losses + ot_losses != games_played
       OR goal_differential != goals_for - goals_against
       OR points < 0
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM026',
    'Team performance arithmetic',
    'Arithmetic',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Team performance win/loss and goal metrics must reconcile.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM027 - TeamPerformance home/road arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamPerformance`
    WHERE home_games_played + road_games_played != games_played
       OR home_wins + home_losses + home_ot_losses != home_games_played
       OR road_wins + road_losses + road_ot_losses != road_games_played
       OR home_goal_differential != home_goals_for - home_goals_against
       OR road_goal_differential != road_goals_for - road_goals_against
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM027',
    'Team performance home and road arithmetic',
    'Arithmetic',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamPerformance home and road metrics must reconcile to overall performance.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM028 - TeamPerformance calculated rates
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamPerformance`
    WHERE ABS(
        COALESCE(home_point_pctg, 0) -
        COALESCE(SAFE_DIVIDE(home_points, home_games_played * 2), 0)
    ) > 0.000001
       OR ABS(
        COALESCE(road_point_pctg, 0) -
        COALESCE(SAFE_DIVIDE(road_points, road_games_played * 2), 0)
    ) > 0.000001
       OR ABS(
        COALESCE(l10_point_pctg, 0) -
        COALESCE(SAFE_DIVIDE(l10_points, l10_games_played * 2), 0)
    ) > 0.000001
       OR ABS(
        COALESCE(goals_for_per_game, 0) -
        COALESCE(SAFE_DIVIDE(goals_for, games_played), 0)
    ) > 0.000001
       OR ABS(
        COALESCE(goals_against_per_game, 0) -
        COALESCE(SAFE_DIVIDE(goals_against, games_played), 0)
    ) > 0.000001
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM028',
    'Team performance calculated rates',
    'Arithmetic',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Calculated home, road, recent and scoring rates must reconcile to their components.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM029 - TeamSummary enrichment
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT p.*
    FROM `pacey32-agency.Team.TeamPerformance` p
    LEFT JOIN `pacey32-agency.Team.TeamSummary` s
        ON p.seasonId = s.seasonId
       AND p.team_name = s.teamFullName
    WHERE s.teamId IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM029',
    'Team summary enrichment coverage',
    'Referential Integrity',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every TeamPerformance record should resolve to TeamSummary.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM030 - TeamSummary enrichment values
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT p.*
    FROM `pacey32-agency.Team.TeamPerformance` p
    JOIN `pacey32-agency.Team.TeamSummary` s
        ON p.seasonId = s.seasonId
       AND p.team_name = s.teamFullName
    WHERE p.power_play_pct IS DISTINCT FROM s.powerPlayPct
       OR p.power_play_net_pct IS DISTINCT FROM s.powerPlayNetPct
       OR p.penalty_kill_pct IS DISTINCT FROM s.penaltyKillPct
       OR p.penalty_kill_net_pct IS DISTINCT FROM s.penaltyKillNetPct
       OR p.faceoff_win_pct IS DISTINCT FROM s.faceoffWinPct
       OR p.shots_for_per_game IS DISTINCT FROM s.shotsForPerGame
       OR p.shots_against_per_game IS DISTINCT FROM s.shotsAgainstPerGame
       OR p.team_shutouts IS DISTINCT FROM s.teamShutouts
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM030',
    'Team summary enrichment values',
    'Reconciliation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamPerformance summary metrics must match TeamSummary.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM031 - PlayoffResult enrichment
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT p.*
    FROM `pacey32-agency.Team.TeamPerformance` p
    LEFT JOIN `pacey32-agency.Team.PlayoffResult` r
        ON p.seasonId = r.season
       AND p.team_code = r.team
    WHERE r.team IS NOT NULL
      AND p.playoff_result IS DISTINCT FROM r.result
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM031',
    'Playoff result enrichment',
    'Reconciliation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamPerformance playoff result must match PlayoffResult where a mapping exists.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM032 - Season label
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamPerformance`
    WHERE season_label != CONCAT(
        CAST(DIV(seasonId, 10000) AS STRING),
        '-',
        RIGHT(CAST(MOD(seasonId, 10000) AS STRING), 2)
    )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM032',
    'Season label transformation',
    'Transformation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamPerformance season labels must reconcile to seasonId.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM033 - Season-over-season point percentage change
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        seasonId,
        team_code,
        point_pctg -
            LAG(point_pctg) OVER (
                PARTITION BY team_code
                ORDER BY seasonId
            ) AS expected_change
    FROM `pacey32-agency.Team.TeamPerformance`
),
failures AS (
    SELECT p.*
    FROM `pacey32-agency.Team.TeamPerformance` p
    JOIN expected e
        USING (seasonId, team_code)
    WHERE p.point_pctg_change IS DISTINCT FROM e.expected_change
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM033',
    'Point percentage season change',
    'Transformation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Point percentage change must reconcile to the preceding team season.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM034 - Season-over-season league rank change
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        seasonId,
        team_code,
        LAG(league_rank) OVER (
            PARTITION BY team_code
            ORDER BY seasonId
        ) - league_rank AS expected_change
    FROM `pacey32-agency.Team.TeamPerformance`
),
failures AS (
    SELECT p.*
    FROM `pacey32-agency.Team.TeamPerformance` p
    JOIN expected e
        USING (seasonId, team_code)
    WHERE p.league_rank_change IS DISTINCT FROM e.expected_change
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM034',
    'League rank season change',
    'Transformation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'League rank change must reconcile to the preceding team season.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM035 - Season-over-season goal differential change
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        seasonId,
        team_code,
        goal_differential -
            LAG(goal_differential) OVER (
                PARTITION BY team_code
                ORDER BY seasonId
            ) AS expected_change
    FROM `pacey32-agency.Team.TeamPerformance`
),
failures AS (
    SELECT p.*
    FROM `pacey32-agency.Team.TeamPerformance` p
    JOIN expected e
        USING (seasonId, team_code)
    WHERE p.goal_differential_change IS DISTINCT FROM e.expected_change
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM035',
    'Goal differential season change',
    'Transformation',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Goal differential change must reconcile to the preceding team season.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM036 - TeamDepthChart grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT team_code, player
    FROM `pacey32-agency.Team.TeamDepthChart`
    GROUP BY team_code, player
    HAVING COUNT(*) > 1
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM036',
    'Team depth chart grain',
    'Grain',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'TeamDepthChart must contain one row per team and player.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM037 - TeamDepthChart team coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT d.team_code
    FROM `pacey32-agency.Team.TeamDepthChart` d
    LEFT JOIN `pacey32-agency.Team.TeamList` t
        ON d.team_code = t.triCode
    WHERE t.triCode IS NULL
    GROUP BY d.team_code
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM037',
    'Depth chart team reference',
    'Referential Integrity',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every depth chart team must resolve to TeamList.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM038 - TeamDepthChart required values
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamDepthChart`
    WHERE NULLIF(TRIM(team_code), '') IS NULL
       OR NULLIF(TRIM(team_name), '') IS NULL
       OR NULLIF(TRIM(player), '') IS NULL
       OR NULLIF(TRIM(position), '') IS NULL
       OR cap_hit < 0
       OR term < 0
       OR total_value < 0
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM038',
    'Depth chart required values',
    'Validity',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Depth chart rows require team/player identity and non-negative contract values.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM039 - Depth chart flag consistency
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamDepthChart`
    WHERE is_depth_chart IS DISTINCT FROM (
        depth_chart_position IS NOT NULL
        AND depth_chart_line IS NOT NULL
    )
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM039',
    'Depth chart flag consistency',
    'Transformation',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'is_depth_chart must reflect the presence of both depth position and line.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM040 - Depth chart grouping
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        *,
        CASE
            WHEN depth_chart_position IN ('LW', 'C', 'RW') THEN 'Forwards'
            WHEN depth_chart_position IN ('LD', 'RD') THEN 'Defence'
            WHEN depth_chart_position = 'G' THEN 'Goalies'
            ELSE 'Organisational Depth'
        END AS expected_group
    FROM `pacey32-agency.Team.TeamDepthChart`
),
failures AS (
    SELECT *
    FROM expected
    WHERE depth_group != expected_group
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM040',
    'Depth chart grouping',
    'Transformation',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Depth chart display groups must reconcile to depth chart position.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM041 - Depth chart sort mappings
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        *,
        CASE depth_chart_position
            WHEN 'LW' THEN 1
            WHEN 'C'  THEN 2
            WHEN 'RW' THEN 3
            WHEN 'LD' THEN 4
            WHEN 'RD' THEN 5
            WHEN 'G'  THEN 6
            ELSE 7
        END AS expected_position_sort,
        CASE
            WHEN depth_chart_position IN ('LW', 'C', 'RW') THEN 1
            WHEN depth_chart_position IN ('LD', 'RD') THEN 2
            WHEN depth_chart_position = 'G' THEN 3
            ELSE 4
        END AS expected_group_sort
    FROM `pacey32-agency.Team.TeamDepthChart`
),
failures AS (
    SELECT *
    FROM expected
    WHERE position_sort != expected_position_sort
       OR group_sort != expected_group_sort
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM041',
    'Depth chart sort mappings',
    'Transformation',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Depth chart position and group sort values must match display mappings.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM042 - Depth chart line validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamDepthChart`
    WHERE depth_chart_line IS NOT NULL
      AND depth_chart_line <= 0
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM042',
    'Depth chart line validity',
    'Validity',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Published depth chart line numbers must be positive.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM043 - Published depth chart player mapping coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamDepthChart`
    WHERE is_depth_chart = TRUE
      AND playerId IS NULL
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM043',
    'Published depth chart player mapping coverage',
    'Referential Integrity',
    'Team',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Every player on a published depth chart must resolve through Cap.PlayerReference to an NHL playerId.',
    CAST(NULL AS STRING)
FROM counts;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'TM043',
    'TeamDepthChart',
    CAST(NULL AS INT64),
    CONCAT(team_code, '|', player),
    'Published depth chart player does not resolve to NHL playerId',
    TO_JSON(t)
FROM `pacey32-agency.Team.TeamDepthChart` t
WHERE is_depth_chart = TRUE
  AND playerId IS NULL;


-- ============================================================
-- TM044 - TeamPerformance rank validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamPerformance`
    WHERE league_rank IS NULL
       OR league_rank < 1
       OR league_rank > 32
       OR conference_rank IS NULL
       OR conference_rank < 0
       OR conference_rank > 16
       OR division_rank IS NULL
       OR division_rank < 1
       OR division_rank > 8
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM044',
    'Team performance rank validity',
    'Validity',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'League and division ranks must be positive and within NHL ranges; conference rank may be zero where the source does not provide a conference ranking.',
    CAST(NULL AS STRING)
FROM counts;


-- ============================================================
-- TM045 - TeamPerformance L10 validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.Team.TeamPerformance`
    WHERE l10_games_played < 0
       OR l10_games_played > 10
       OR l10_wins + l10_losses + l10_ot_losses != l10_games_played
       OR l10_goal_differential != l10_goals_for - l10_goals_against
),
counts AS (
    SELECT COUNT(*) AS failure_count FROM failures
)
SELECT
    v_run_id, v_run_datetime,
    'TM045',
    'Last ten performance validity',
    'Arithmetic',
    'Team',
    'TeamPerformance',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Last-ten games, record and goal differential must reconcile.',
    CAST(NULL AS STRING)
FROM counts;