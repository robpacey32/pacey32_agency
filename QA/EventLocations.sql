-- ============================================================
-- EVENT LOCATIONS DATA QUALITY TESTS
-- ============================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();


-- ============================================================
-- EL001
-- Game reference grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT game_id
    FROM `pacey32-agency.EventLocations.01_Ref_GameInfo`
    GROUP BY game_id
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL001',
    'Game reference grain',
    'Grain',
    'EventLocations',
    '01_Ref_GameInfo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    '01_Ref_GameInfo must contain one row per game_id.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL002
-- Game reference required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.01_Ref_GameInfo`
    WHERE game_id IS NULL
       OR season IS NULL
       OR SeasonPart IS NULL
       OR home_team_id IS NULL
       OR away_team_id IS NULL
)
SELECT
    v_run_id, v_run_datetime,
    'EL002',
    'Game reference required fields',
    'Completeness',
    'EventLocations',
    '01_Ref_GameInfo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Games must contain season, season part and both teams.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL003
-- Player reference grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT playerID
    FROM `pacey32-agency.EventLocations.02_Ref_PlayerInfo`
    GROUP BY playerID
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL003',
    'Player reference grain',
    'Grain',
    'EventLocations',
    '02_Ref_PlayerInfo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    '02_Ref_PlayerInfo must contain one row per playerID.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL004
-- Player reference required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.02_Ref_PlayerInfo`
    WHERE playerID IS NULL
       OR NULLIF(TRIM(player_name), '') IS NULL
)
SELECT
    v_run_id, v_run_datetime,
    'EL004',
    'Player reference required fields',
    'Completeness',
    'EventLocations',
    '02_Ref_PlayerInfo',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Player reference records require player ID and name.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL005
-- Team reference grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT teamID
    FROM `pacey32-agency.EventLocations.03_Ref_TeamInfo`
    GROUP BY teamID
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL005',
    'Team reference grain',
    'Grain',
    'EventLocations',
    '03_Ref_TeamInfo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    '03_Ref_TeamInfo must contain one row per teamID.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL006
-- Canonical event grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.04_Ref_EventInfo`
    GROUP BY UnqEventID
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL006',
    'Canonical event grain',
    'Grain',
    'EventLocations',
    '04_Ref_EventInfo',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    '04_Ref_EventInfo must contain one row per unique event.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL007
-- Event required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.04_Ref_EventInfo`
    WHERE UnqEventID IS NULL
       OR gameID IS NULL
       OR eventId IS NULL
       OR eventType IS NULL
)
SELECT
    v_run_id, v_run_datetime,
    'EL007',
    'Event required fields',
    'Completeness',
    'EventLocations',
    '04_Ref_EventInfo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Canonical events require event ID, game ID and event type.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL008
-- Event game reference coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT e.UnqEventID
    FROM `pacey32-agency.EventLocations.04_Ref_EventInfo` e
    LEFT JOIN `pacey32-agency.EventLocations.01_Ref_GameInfo` g
        ON SAFE_CAST(e.gameID AS INT64) = g.game_id
    WHERE g.game_id IS NULL
)
SELECT
    v_run_id, v_run_datetime,
    'EL008',
    'Event game reference coverage',
    'Referential Integrity',
    'EventLocations',
    '04_Ref_EventInfo',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Events should normally resolve to the schedule game reference.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL009
-- Event score validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.04_Ref_EventInfo`
    WHERE awayScore < 0
       OR homeScore < 0
)
SELECT
    v_run_id, v_run_datetime,
    'EL009',
    'Event score validity',
    'Validity',
    'EventLocations',
    '04_Ref_EventInfo',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Event scores cannot be negative.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL010
-- Shot event grain and allowed event types
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.05_ShotEvents`
    GROUP BY UnqEventID
    HAVING COUNT(*) > 1

    UNION ALL

    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.05_ShotEvents`
    WHERE eventType NOT IN (
        'blocked-shot',
        'failed-shot-attempt',
        'shot-on-goal',
        'missed-shot',
        'goal'
    )
)
SELECT
    v_run_id, v_run_datetime,
    'EL010',
    'Shot event grain and type',
    'Validity',
    'EventLocations',
    '05_ShotEvents',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Shot events must be unique and contain only recognised shot event types.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL011
-- Shot event game enrichment
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.05_ShotEvents`
    WHERE season IS NULL
       OR SeasonPart IS NULL
       OR game_date IS NULL
)
SELECT
    v_run_id, v_run_datetime,
    'EL011',
    'Shot event game enrichment',
    'Completeness',
    'EventLocations',
    '05_ShotEvents',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Shot events should resolve to game metadata.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL012
-- Shot event team enrichment
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.05_ShotEvents`
    WHERE eventOwnerTeamId IS NOT NULL
      AND (
            eventOwnerTeamName IS NULL
         OR eventOwnerTeamCode IS NULL
         OR eventOwnerHomeAway NOT IN ('Home', 'Away')
      )
)
SELECT
    v_run_id, v_run_datetime,
    'EL012',
    'Shot event team enrichment',
    'Referential Integrity',
    'EventLocations',
    '05_ShotEvents',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Shot event owner teams should resolve to team and home/away metadata.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL013
-- Penalty event grain/type
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.06_PenaltyEvents`
    GROUP BY UnqEventID
    HAVING COUNT(*) > 1

    UNION ALL

    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.06_PenaltyEvents`
    WHERE eventType NOT IN ('penalty', 'delayed-penalty')
)
SELECT
    v_run_id, v_run_datetime,
    'EL013',
    'Penalty event grain and type',
    'Validity',
    'EventLocations',
    '06_PenaltyEvents',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Penalty events must be unique and contain only penalty event types.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL014
-- Faceoff event grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.07_FaceoffEvents`
    GROUP BY UnqEventID
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL014',
    'Faceoff event grain',
    'Grain',
    'EventLocations',
    '07_FaceoffEvents',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Faceoff events must contain one row per unique event.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL015
-- Faceoff player validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.07_FaceoffEvents`
    WHERE winningPlayerId IS NULL
       OR losingPlayerId IS NULL
       OR winningPlayerId = losingPlayerId
)
SELECT
    v_run_id, v_run_datetime,
    'EL015',
    'Faceoff player validity',
    'Validity',
    'EventLocations',
    '07_FaceoffEvents',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'WARN'),
    COUNT(*),
    'Faceoffs should identify two different participating players.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL016
-- Physical/possession event grain/type
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.08_PhysicalPossessionEvents`
    GROUP BY UnqEventID
    HAVING COUNT(*) > 1

    UNION ALL

    SELECT UnqEventID
    FROM `pacey32-agency.EventLocations.08_PhysicalPossessionEvents`
    WHERE eventType NOT IN ('hit', 'takeaway', 'giveaway')
)
SELECT
    v_run_id, v_run_datetime,
    'EL016',
    'Physical possession event grain and type',
    'Validity',
    'EventLocations',
    '08_PhysicalPossessionEvents',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Physical/possession events must be unique and contain recognised event types.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL017
-- Player performance grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT playerId, season, seasonPart
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    GROUP BY playerId, season, seasonPart
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL017',
    'Player performance grain',
    'Grain',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Player performance must contain one row per player, season and season part.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL018
-- Player performance required values
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE playerId IS NULL
       OR season IS NULL
       OR seasonPart IS NULL
       OR games_played <= 0
       OR toi_minutes <= 0
       OR seasonPart = 'PreSeason'
)
SELECT
    v_run_id, v_run_datetime,
    'EL018',
    'Player performance required values',
    'Validity',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Player performance requires positive games/TOI and excludes preseason.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL019
-- Player count metric validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE COALESCE(shots, 0) < 0
       OR COALESCE(goals, 0) < 0
       OR COALESCE(penalties, 0) < 0
       OR COALESCE(faceoffs, 0) < 0
       OR COALESCE(faceoff_wins, 0) < 0
       OR COALESCE(giveaways, 0) < 0
       OR COALESCE(takeaways, 0) < 0
       OR COALESCE(hits, 0) < 0
       OR COALESCE(goals, 0) > COALESCE(shots, 0)
       OR COALESCE(faceoff_wins, 0) > COALESCE(faceoffs, 0)
)
SELECT
    v_run_id, v_run_datetime,
    'EL019',
    'Player count metric validity',
    'Arithmetic',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Player event counts must be non-negative and obey basic arithmetic relationships.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL020
-- Shot distribution validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE shots > 0
      AND ABS(
            COALESCE(shot_pct_close_left, 0)
          + COALESCE(shot_pct_close_centre, 0)
          + COALESCE(shot_pct_close_right, 0)
          + COALESCE(shot_pct_medium_left, 0)
          + COALESCE(shot_pct_medium_centre, 0)
          + COALESCE(shot_pct_medium_right, 0)
          + COALESCE(shot_pct_far_left, 0)
          + COALESCE(shot_pct_far_centre, 0)
          + COALESCE(shot_pct_far_right, 0)
          - 1
      ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL020',
    'Player shot distribution',
    'Arithmetic',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Nine-zone shot shares should sum to one when shots exist.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL021
-- Goal distribution validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE goals > 0
      AND ABS(
            COALESCE(goal_pct_close_left, 0)
          + COALESCE(goal_pct_close_centre, 0)
          + COALESCE(goal_pct_close_right, 0)
          + COALESCE(goal_pct_medium_left, 0)
          + COALESCE(goal_pct_medium_centre, 0)
          + COALESCE(goal_pct_medium_right, 0)
          + COALESCE(goal_pct_far_left, 0)
          + COALESCE(goal_pct_far_centre, 0)
          + COALESCE(goal_pct_far_right, 0)
          - 1
      ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL021',
    'Player goal distribution',
    'Arithmetic',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Nine-zone goal shares should sum to one when goals exist.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL022
-- Shooting percentage range
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE EXISTS (
        SELECT 1
        FROM UNNEST([
            shooting_pct_close_left,
            shooting_pct_close_centre,
            shooting_pct_close_right,
            shooting_pct_medium_left,
            shooting_pct_medium_centre,
            shooting_pct_medium_right,
            shooting_pct_far_left,
            shooting_pct_far_centre,
            shooting_pct_far_right
        ]) x
        WHERE x < 0 OR x > 1
    )
)
SELECT
    v_run_id, v_run_datetime,
    'EL022',
    'Zone shooting percentage range',
    'Validity',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Zone shooting percentages must be between zero and one.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL023
-- Faceoff arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE faceoff_wins > faceoffs
       OR faceoff_pct < 0
       OR faceoff_pct > 1
       OR (
            faceoffs > 0
            AND ABS(faceoff_pct - SAFE_DIVIDE(faceoff_wins, faceoffs)) > 0.000001
       )
)
SELECT
    v_run_id, v_run_datetime,
    'EL023',
    'Faceoff arithmetic',
    'Arithmetic',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Faceoff wins and percentage must reconcile to faceoff attempts.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL024
-- Faceoff location distribution
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE faceoffs > 0
      AND ABS(
            COALESCE(faceoff_share_offensive_left, 0)
          + COALESCE(faceoff_share_offensive_right, 0)
          + COALESCE(faceoff_share_neutral_left, 0)
          + COALESCE(faceoff_share_neutral_right, 0)
          + COALESCE(faceoff_share_defensive_left, 0)
          + COALESCE(faceoff_share_defensive_right, 0)
          - 1
      ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL024',
    'Faceoff location distribution',
    'Arithmetic',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Faceoff location shares should sum to one when faceoffs exist.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL025
-- Player per-game rates
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE ABS(
            COALESCE(shots_per_game, 0)
            - SAFE_DIVIDE(COALESCE(shots, 0), games_played)
          ) > 0.000001
       OR ABS(
            COALESCE(penalties_per_game, 0)
            - SAFE_DIVIDE(COALESCE(penalties, 0), games_played)
          ) > 0.000001
       OR ABS(
            COALESCE(faceoffs_per_game, 0)
            - SAFE_DIVIDE(COALESCE(faceoffs, 0), games_played)
          ) > 0.000001
       OR ABS(
            COALESCE(faceoff_wins_per_game, 0)
            - SAFE_DIVIDE(COALESCE(faceoff_wins, 0), games_played)
          ) > 0.000001
       OR ABS(
            COALESCE(giveaways_per_game, 0)
            - SAFE_DIVIDE(COALESCE(giveaways, 0), games_played)
          ) > 0.000001
       OR ABS(
            COALESCE(takeaways_per_game, 0)
            - SAFE_DIVIDE(COALESCE(takeaways, 0), games_played)
          ) > 0.000001
       OR ABS(
            COALESCE(hits_per_game, 0)
            - SAFE_DIVIDE(COALESCE(hits, 0), games_played)
          ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL025',
    'Player per-game rates',
    'Arithmetic',
    'EventLocations',
    '09_PlayerPerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Player per-game rates must reconcile to event counts and games played.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL026
-- Latest player grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT playerId
    FROM `pacey32-agency.EventLocations.10_PlayerPerformanceLocationLatest`
    GROUP BY playerId
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL026',
    'Latest player performance grain',
    'Grain',
    'EventLocations',
    '10_PlayerPerformanceLocationLatest',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latest player performance must contain one row per player.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL027
-- Latest player season selection
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        playerId,
        MAX(season) AS expected_latest_season,
        LEAST(COUNT(DISTINCT season), 3) AS expected_seasons_used
    FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
    WHERE seasonPart = 'RegularSeason'
    GROUP BY playerId
),
failures AS (
    SELECT l.*
    FROM `pacey32-agency.EventLocations.10_PlayerPerformanceLocationLatest` l
    JOIN expected e USING (playerId)
    WHERE l.latest_season != e.expected_latest_season
       OR l.seasons_used != e.expected_seasons_used
)
SELECT
    v_run_id, v_run_datetime,
    'EL027',
    'Latest player season selection',
    'Transformation',
    'EventLocations',
    '10_PlayerPerformanceLocationLatest',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latest player output must use the latest regular season and at most three seasons.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL028
-- Latest player required metrics
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.10_PlayerPerformanceLocationLatest`
    WHERE latest_games_played <= 0
       OR latest_toi_minutes <= 0
       OR seasons_used NOT BETWEEN 1 AND 3
)
SELECT
    v_run_id, v_run_datetime,
    'EL028',
    'Latest player required metrics',
    'Validity',
    'EventLocations',
    '10_PlayerPerformanceLocationLatest',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latest player performance requires positive games/TOI and one to three seasons.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL029
-- Zone benchmark grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT season, seasonPart, benchmark_group, zone_key
    FROM `pacey32-agency.EventLocations.11_ZoneBenchmarks`
    GROUP BY season, seasonPart, benchmark_group, zone_key
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL029',
    'Zone benchmark grain',
    'Grain',
    'EventLocations',
    '11_ZoneBenchmarks',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Zone benchmarks must contain one row per season, season part, group and zone.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL030
-- Zone benchmark dimensions/ranges
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.11_ZoneBenchmarks`
    WHERE benchmark_group NOT IN (
            'Forward',
            'Defence',
            'Goalie'
          )
       OR zone_key NOT IN (
            'close_left',
            'close_centre',
            'close_right',
            'medium_left',
            'medium_centre',
            'medium_right',
            'far_left',
            'far_centre',
            'far_right'
          )
       OR shots < 0
       OR goals < 0
       OR saves < 0
       OR (
            benchmark_group IN ('Forward', 'Defence')
            AND (
                shooting_pct IS NULL
                OR shooting_pct < 0
                OR shooting_pct > 1
                OR save_pct IS NOT NULL
            )
       )
       OR (
            benchmark_group = 'Goalie'
            AND (
                save_pct IS NULL
                OR save_pct < 0
                OR save_pct > 1
                OR shooting_pct IS NOT NULL
            )
       )
)
SELECT
    v_run_id, v_run_datetime,
    'EL030',
    'Zone benchmark validity',
    'Validity',
    'EventLocations',
    '11_ZoneBenchmarks',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Benchmark groups, nine-zone keys, counts and group-specific percentages must be valid.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL031
-- Goalie performance grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT goalieId, season, seasonPart
    FROM `pacey32-agency.EventLocations.12_GoaliePerformanceLocation`
    GROUP BY goalieId, season, seasonPart
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL031',
    'Goalie performance grain',
    'Grain',
    'EventLocations',
    '12_GoaliePerformanceLocation',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Goalie performance must contain one row per goalie, season and season part.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL032
-- Goalie participation validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.12_GoaliePerformanceLocation`
    WHERE goalieId IS NULL
       OR games_played <= 0
       OR toi_minutes <= 0
       OR shots_faced < 0
       OR seasonPart NOT IN ('RegularSeason', 'Playoffs')
)
SELECT
    v_run_id, v_run_datetime,
    'EL032',
    'Goalie participation validity',
    'Validity',
    'EventLocations',
    '12_GoaliePerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Goalie performance requires actual playing time and valid shot counts.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL033
-- Goalie shot distribution
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.12_GoaliePerformanceLocation`
    WHERE shots_faced > 0
      AND ABS(
            COALESCE(shot_pct_close_left, 0)
          + COALESCE(shot_pct_close_centre, 0)
          + COALESCE(shot_pct_close_right, 0)
          + COALESCE(shot_pct_medium_left, 0)
          + COALESCE(shot_pct_medium_centre, 0)
          + COALESCE(shot_pct_medium_right, 0)
          + COALESCE(shot_pct_far_left, 0)
          + COALESCE(shot_pct_far_centre, 0)
          + COALESCE(shot_pct_far_right, 0)
          - 1
      ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL033',
    'Goalie shot distribution',
    'Arithmetic',
    'EventLocations',
    '12_GoaliePerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Goalie nine-zone shot shares should sum to one when shots were faced.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL034
-- Goalie per-game rate
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.12_GoaliePerformanceLocation`
    WHERE ABS(
        shots_faced_per_game
        - SAFE_DIVIDE(shots_faced, games_played)
    ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL034',
    'Goalie shots faced per game',
    'Arithmetic',
    'EventLocations',
    '12_GoaliePerformanceLocation',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Goalie shots faced per game must reconcile to shots faced and games played.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL035
-- Latest goalie performance grain/selection
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        goalieId,
        MAX(season) AS expected_latest_season,
        LEAST(COUNT(DISTINCT season), 3) AS expected_seasons_used
    FROM `pacey32-agency.EventLocations.12_GoaliePerformanceLocation`
    WHERE seasonPart = 'RegularSeason'
    GROUP BY goalieId
),
selection_failures AS (
    SELECT l.goalieId
    FROM `pacey32-agency.EventLocations.13_GoaliePerformanceLocationLatest` l
    LEFT JOIN expected e USING (goalieId)
    WHERE e.goalieId IS NULL
       OR l.latest_season != e.expected_latest_season
       OR l.seasons_used != e.expected_seasons_used
       OR l.latest_games_played <= 0
       OR l.latest_toi_minutes <= 0
),
duplicate_failures AS (
    SELECT goalieId
    FROM `pacey32-agency.EventLocations.13_GoaliePerformanceLocationLatest`
    GROUP BY goalieId
    HAVING COUNT(*) > 1
),
failure_counts AS (
    SELECT
        (SELECT COUNT(*) FROM selection_failures)
        + (SELECT COUNT(*) FROM duplicate_failures) AS failure_count
)
SELECT
    v_run_id, v_run_datetime,
    'EL035',
    'Latest goalie performance grain and season selection',
    'Transformation',
    'EventLocations',
    '13_GoaliePerformanceLocationLatest',
    CAST(NULL AS INT64),
    'HIGH',
    IF(failure_count = 0, 'PASS', 'FAIL'),
    failure_count,
    'Latest goalie performance must contain one row per goalie using the latest regular season.',
    CAST(NULL AS STRING)
FROM failure_counts;


-- ============================================================
-- EL036
-- Goalie effectiveness grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT goalieId, season, seasonPart
    FROM `pacey32-agency.EventLocations.14_GoalieEffectiveness`
    GROUP BY goalieId, season, seasonPart
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL036',
    'Goalie effectiveness grain',
    'Grain',
    'EventLocations',
    '14_GoalieEffectiveness',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Goalie effectiveness must contain one row per goalie, season and season part.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL037
-- Goalie shot arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.14_GoalieEffectiveness`
    WHERE shots_faced <= 0
       OR saves < 0
       OR goals_against < 0
       OR saves + goals_against != shots_faced
)
SELECT
    v_run_id, v_run_datetime,
    'EL037',
    'Goalie effectiveness shot arithmetic',
    'Arithmetic',
    'EventLocations',
    '14_GoalieEffectiveness',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'For location effectiveness, saves plus goals against must equal shots faced.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL038
-- Goalie save percentage arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.EventLocations.14_GoalieEffectiveness`
    WHERE actual_save_pct < 0
       OR actual_save_pct > 1
       OR expected_save_pct < 0
       OR expected_save_pct > 1
       OR ABS(
            actual_save_pct
            - SAFE_DIVIDE(saves, shots_faced)
       ) > 0.000001
       OR ABS(
            save_pct_above_expected
            - (actual_save_pct - expected_save_pct)
       ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL038',
    'Goalie effectiveness percentage arithmetic',
    'Arithmetic',
    'EventLocations',
    '14_GoalieEffectiveness',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Actual, expected and above-expected save percentages must be valid and reconcile.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL039
-- Latest goalie effectiveness grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT goalieId
    FROM `pacey32-agency.EventLocations.15_GoalieEffectivenessLatest`
    GROUP BY goalieId
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id, v_run_datetime,
    'EL039',
    'Latest goalie effectiveness grain',
    'Grain',
    'EventLocations',
    '15_GoalieEffectivenessLatest',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latest goalie effectiveness must contain one row per goalie.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- EL040
-- Latest goalie effectiveness selection/arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT
        goalieId,
        MAX(season) AS expected_latest_season,
        LEAST(COUNT(DISTINCT season), 3) AS expected_seasons_used
    FROM `pacey32-agency.EventLocations.14_GoalieEffectiveness`
    WHERE seasonPart = 'RegularSeason'
    GROUP BY goalieId
),
failures AS (
    SELECT l.*
    FROM `pacey32-agency.EventLocations.15_GoalieEffectivenessLatest` l
    JOIN expected e USING (goalieId)
    WHERE l.latest_season != e.expected_latest_season
       OR l.seasons_used != e.expected_seasons_used
       OR l.latest_shots_faced <= 0
       OR l.latest_saves < 0
       OR l.latest_goals_against < 0
       OR l.latest_saves + l.latest_goals_against != l.latest_shots_faced
       OR l.latest_actual_save_pct < 0
       OR l.latest_actual_save_pct > 1
       OR l.latest_expected_save_pct < 0
       OR l.latest_expected_save_pct > 1
       OR ABS(
            l.latest_save_pct_above_expected
            - (
                l.latest_actual_save_pct
                - l.latest_expected_save_pct
            )
       ) > 0.000001
)
SELECT
    v_run_id, v_run_datetime,
    'EL040',
    'Latest goalie effectiveness selection and arithmetic',
    'Transformation',
    'EventLocations',
    '15_GoalieEffectivenessLatest',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latest goalie effectiveness must use the latest regular season and valid arithmetic.',
    CAST(NULL AS STRING)
FROM failures;


-- ============================================================
-- FAILURE RECORDS
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object, season,
    record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'EL017',
    '09_PlayerPerformanceLocation',
    season,
    CONCAT(playerId, '|', CAST(season AS STRING), '|', seasonPart),
    'Duplicate player-season-seasonPart grain',
    TO_JSON(STRUCT(playerId, player, season, seasonPart))
FROM `pacey32-agency.EventLocations.09_PlayerPerformanceLocation`
QUALIFY COUNT(*) OVER (
    PARTITION BY playerId, season, seasonPart
) > 1;


INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object, season,
    record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'EL032',
    '12_GoaliePerformanceLocation',
    season,
    CONCAT(
        CAST(goalieId AS STRING),
        '|',
        CAST(season AS STRING),
        '|',
        seasonPart
    ),
    'Invalid goalie participation record',
    TO_JSON(STRUCT(
        goalieId,
        goalie,
        season,
        seasonPart,
        games_played,
        toi_minutes,
        shots_faced
    ))
FROM `pacey32-agency.EventLocations.12_GoaliePerformanceLocation`
WHERE goalieId IS NULL
   OR games_played <= 0
   OR toi_minutes <= 0
   OR shots_faced < 0
   OR seasonPart NOT IN ('RegularSeason', 'Playoffs');


INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object, season,
    record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'EL037',
    '14_GoalieEffectiveness',
    season,
    CONCAT(
        CAST(goalieId AS STRING),
        '|',
        CAST(season AS STRING),
        '|',
        seasonPart
    ),
    'Goalie shot arithmetic does not reconcile',
    TO_JSON(STRUCT(
        goalieId,
        goalie,
        season,
        seasonPart,
        shots_faced,
        saves,
        goals_against
    ))
FROM `pacey32-agency.EventLocations.14_GoalieEffectiveness`
WHERE shots_faced <= 0
   OR saves < 0
   OR goals_against < 0
   OR saves + goals_against != shots_faced;


-- ============================================================
-- RUN SUMMARY
-- ============================================================

SELECT
    v_run_id AS run_id,
    COUNT(*) AS test_count,
    COUNTIF(status = 'PASS') AS pass_count,
    COUNTIF(status = 'WARN') AS warn_count,
    COUNTIF(status = 'FAIL') AS fail_count
FROM `pacey32-agency.QA.TestResults`
WHERE run_id = v_run_id;