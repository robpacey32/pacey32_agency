-- ============================================================
-- PACEY32 AGENCY - COMPARISON DATA QUALITY
-- ============================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();

-- ============================================================
-- FAILURE COLLECTION
-- ============================================================

CREATE TEMP TABLE failures (
    test_id STRING,
    source_object STRING,
    season INT64,
    record_key STRING,
    failure_reason STRING,
    record_json JSON
);


-- ============================================================
-- LATEST V3 COMPARABLE RUN
--
-- Comparable results are versioned/historical.
-- Use the latest calculated run for each target player.
-- ============================================================

CREATE TEMP TABLE latest_comparable_run AS

SELECT c.*
FROM `pacey32-agency.Comparison.11_ComparablePlayers_v3` c

INNER JOIN (
    SELECT
        target_playerId,
        MAX(calculated_at) AS calculated_at
    FROM `pacey32-agency.Comparison.11_ComparablePlayers_v3`
    GROUP BY target_playerId
) latest
    ON c.target_playerId = latest.target_playerId
   AND c.calculated_at = latest.calculated_at;


-- ============================================================
-- CQ001
-- PlayerProfile unique player
-- ============================================================

INSERT INTO failures

SELECT
    'CQ001',
    '01_PlayerProfile',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate playerId in PlayerProfile',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.01_PlayerProfile`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ002
-- PlayerProfile required identity
-- ============================================================

INSERT INTO failures

SELECT
    'CQ002',
    '01_PlayerProfile',
    NULL,
    COALESCE(CAST(playerId AS STRING), 'NULL'),
    'Required active-player identity field is missing',
    TO_JSON(STRUCT(
        playerId,
        player_name,
        position,
        CurrentTeamTriCode,
        activeFlag
    ))

FROM `pacey32-agency.Comparison.01_PlayerProfile`

WHERE playerId IS NULL
   OR player_name IS NULL
   OR TRIM(player_name) = ''
   OR position IS NULL
   OR TRIM(position) = ''
   OR CurrentTeamTriCode IS NULL
   OR TRIM(CurrentTeamTriCode) = ''
   OR activeFlag != 1;


-- ============================================================
-- CQ003
-- CareerStats coverage
-- ============================================================

INSERT INTO failures

SELECT
    'CQ003',
    '02_PlayerCareerStats',
    NULL,
    CAST(p.playerId AS STRING),
    'PlayerProfile player is missing from PlayerCareerStats',
    TO_JSON(STRUCT(
        p.playerId,
        p.player_name
    ))

FROM `pacey32-agency.Comparison.01_PlayerProfile` p

LEFT JOIN `pacey32-agency.Comparison.02_PlayerCareerStats` c
    ON p.playerId = c.playerId

WHERE c.playerId IS NULL;


-- ============================================================
-- CQ004
-- CareerStats unique player
-- ============================================================

INSERT INTO failures

SELECT
    'CQ004',
    '02_PlayerCareerStats',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate playerId in PlayerCareerStats',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.02_PlayerCareerStats`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ005
-- PlayerSeasonStats unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CQ005',
    '03_PlayerSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart, '|',
        team_code
    ),
    'Duplicate player-season-team record',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        team_code,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`

GROUP BY
    playerId,
    season,
    seasonPart,
    team_code

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ006
-- PlayerSeasonStats arithmetic
-- ============================================================

INSERT INTO failures

SELECT
    'CQ006',
    '03_PlayerSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart, '|',
        team_code
    ),
    'Points do not equal goals plus assists',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        team_code,
        goals,
        assists,
        points
    ))

FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`

WHERE points != goals + assists;


-- ============================================================
-- CQ007
-- PlayerSeasonStats valid values
-- ============================================================

INSERT INTO failures

SELECT
    'CQ007',
    '03_PlayerSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        COALESCE(seasonPart, 'NULL'), '|',
        COALESCE(team_code, 'NULL')
    ),
    'Player season contains invalid required or counting values',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        team_code,
        games_played,
        goals,
        assists,
        points,
        toi_minutes
    ))

FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`

WHERE playerId IS NULL
   OR season IS NULL
   OR seasonPart IS NULL
   OR seasonPart NOT IN (
       'PreSeason',
       'RegularSeason',
       'Playoffs'
   )
   OR team_code IS NULL
   OR TRIM(team_code) = ''
   OR games_played < 0
   OR goals < 0
   OR assists < 0
   OR points < 0
   OR toi_minutes < 0;


-- ============================================================
-- CQ008
-- Per-game calculations
-- ============================================================

INSERT INTO failures

SELECT
    'CQ008',
    '03_PlayerSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart, '|',
        team_code
    ),
    'Per-game production calculation is incorrect',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        team_code,
        games_played,
        goals_per_game,
        assists_per_game,
        points_per_game,
        ROUND(SAFE_DIVIDE(goals, games_played), 3)
            AS expected_goals_per_game,
        ROUND(SAFE_DIVIDE(assists, games_played), 3)
            AS expected_assists_per_game,
        ROUND(SAFE_DIVIDE(points, games_played), 3)
            AS expected_points_per_game
    ))

FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`

WHERE
    COALESCE(goals_per_game, -999999)
        != COALESCE(
            ROUND(SAFE_DIVIDE(goals, games_played), 3),
            -999999
        )

    OR COALESCE(assists_per_game, -999999)
        != COALESCE(
            ROUND(SAFE_DIVIDE(assists, games_played), 3),
            -999999
        )

    OR COALESCE(points_per_game, -999999)
        != COALESCE(
            ROUND(SAFE_DIVIDE(points, games_played), 3),
            -999999
        );

-- ============================================================
-- CQ009
-- Per-60 calculations
--
-- toi_minutes is stored rounded to 1 decimal place, while the
-- per-60 metrics are calculated from the underlying precise TOI.
-- Validate that the stored rate is consistent with a true TOI
-- within the rounding interval represented by toi_minutes.
-- ============================================================

INSERT INTO failures

WITH expected_ranges AS (

    SELECT
        *,

        -- Lowest possible rate occurs at the highest possible TOI.
        SAFE_DIVIDE(
            goals * 60,
            toi_minutes + 0.05
        ) AS goals_per_60_min,

        SAFE_DIVIDE(
            goals * 60,
            GREATEST(toi_minutes - 0.05, 0)
        ) AS goals_per_60_max,

        SAFE_DIVIDE(
            assists * 60,
            toi_minutes + 0.05
        ) AS assists_per_60_min,

        SAFE_DIVIDE(
            assists * 60,
            GREATEST(toi_minutes - 0.05, 0)
        ) AS assists_per_60_max,

        SAFE_DIVIDE(
            points * 60,
            toi_minutes + 0.05
        ) AS points_per_60_min,

        SAFE_DIVIDE(
            points * 60,
            GREATEST(toi_minutes - 0.05, 0)
        ) AS points_per_60_max

    FROM `pacey32-agency.Comparison.03_PlayerSeasonStats`
)

SELECT
    'CQ009',
    '03_PlayerSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart, '|',
        team_code
    ),
    'Per-60 production is inconsistent with the stored rounded time on ice',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        team_code,
        toi_minutes,

        goals_per_60,
        goals_per_60_min,
        goals_per_60_max,

        assists_per_60,
        assists_per_60_min,
        assists_per_60_max,

        points_per_60,
        points_per_60_min,
        points_per_60_max
    ))

FROM expected_ranges

WHERE
    (
        goals_per_60 IS NOT NULL
        AND (
            goals_per_60 < ROUND(goals_per_60_min, 2)
            OR goals_per_60 > ROUND(goals_per_60_max, 2)
        )
    )

    OR (
        assists_per_60 IS NOT NULL
        AND (
            assists_per_60 < ROUND(assists_per_60_min, 2)
            OR assists_per_60 > ROUND(assists_per_60_max, 2)
        )
    )

    OR (
        points_per_60 IS NOT NULL
        AND (
            points_per_60 < ROUND(points_per_60_min, 2)
            OR points_per_60 > ROUND(points_per_60_max, 2)
        )
    );


-- ============================================================
-- CQ010
-- PeakStats unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CQ010',
    '04_PlayerPeakStats',
    NULL,
    CONCAT(
        CAST(playerId AS STRING), '|',
        seasonPart
    ),
    'Duplicate player / seasonPart in PlayerPeakStats',
    TO_JSON(STRUCT(
        playerId,
        seasonPart,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.04_PlayerPeakStats`

GROUP BY
    playerId,
    seasonPart

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ011
-- PeakStats excludes preseason
-- ============================================================

INSERT INTO failures

SELECT
    'CQ011',
    '04_PlayerPeakStats',
    NULL,
    CONCAT(
        CAST(playerId AS STRING), '|',
        seasonPart
    ),
    'PreSeason unexpectedly present in PlayerPeakStats',
    TO_JSON(STRUCT(
        playerId,
        seasonPart
    ))

FROM `pacey32-agency.Comparison.04_PlayerPeakStats`

WHERE seasonPart = 'PreSeason';


-- ============================================================
-- CQ012
-- Trajectory season grain / ranking
-- ============================================================

INSERT INTO failures

WITH trajectory AS (

    SELECT
        playerId,
        seasonPart,
        season,
        season_rank,

        COUNT(*) OVER (
            PARTITION BY
                playerId,
                seasonPart,
                season
        ) AS season_row_count,

        ROW_NUMBER() OVER (
            PARTITION BY
                playerId,
                seasonPart
            ORDER BY season DESC
        ) AS expected_rank

    FROM `pacey32-agency.Comparison.05_PlayerTrajectory`
)

SELECT
    'CQ012',
    '05_PlayerTrajectory',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        seasonPart, '|',
        CAST(season AS STRING)
    ),
    'Trajectory must contain one row per actual season with sequential descending season_rank',
    TO_JSON(STRUCT(
        playerId,
        seasonPart,
        season,
        season_rank,
        expected_rank,
        season_row_count
    ))

FROM trajectory

WHERE season_row_count != 1
   OR season_rank != expected_rank;


-- ============================================================
-- CQ013
-- Latest trajectory unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CQ013',
    '06_PlayerTrajectoryLatest',
    NULL,
    CONCAT(
        CAST(playerId AS STRING), '|',
        seasonPart
    ),
    'Duplicate player / seasonPart in latest trajectory',
    TO_JSON(STRUCT(
        playerId,
        seasonPart,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.06_PlayerTrajectoryLatest`

GROUP BY
    playerId,
    seasonPart

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ014
-- Latest trajectory season ordering
-- ============================================================

INSERT INTO failures

SELECT
    'CQ014',
    '06_PlayerTrajectoryLatest',
    NULL,
    CONCAT(
        CAST(playerId AS STRING), '|',
        seasonPart
    ),
    'Latest trajectory seasons are not in descending order',
    TO_JSON(STRUCT(
        playerId,
        seasonPart,
        last1_season,
        last2_season,
        last3_season
    ))

FROM `pacey32-agency.Comparison.06_PlayerTrajectoryLatest`

WHERE
    (
        last2_season IS NOT NULL
        AND last1_season <= last2_season
    )
    OR
    (
        last3_season IS NOT NULL
        AND last2_season <= last3_season
    );


-- ============================================================
-- CQ015
-- Current snapshot unique player
-- ============================================================

INSERT INTO failures

SELECT
    'CQ015',
    '09_PlayerCurrentSnapshot',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate playerId in current snapshot',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.09_PlayerCurrentSnapshot`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ016
-- Current snapshot required fields
-- ============================================================

INSERT INTO failures

SELECT
    'CQ016',
    '09_PlayerCurrentSnapshot',
    NULL,
    COALESCE(CAST(playerId AS STRING), 'NULL'),
    'Required current snapshot field is missing',
    TO_JSON(STRUCT(
        playerId,
        position,
        SnapshotDate
    ))

FROM `pacey32-agency.Comparison.09_PlayerCurrentSnapshot`

WHERE playerId IS NULL
   OR position IS NULL
   OR TRIM(position) = ''
   OR SnapshotDate IS NULL;


-- ============================================================
-- CQ017
-- ModelFeatures unique player
-- ============================================================

INSERT INTO failures

SELECT
    'CQ017',
    '11_ComparisonModelFeatures',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate playerId in model features',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.11_ComparisonModelFeatures`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ018
-- Snapshot / ModelFeatures coverage
-- ============================================================

INSERT INTO failures

SELECT
    'CQ018',
    '11_ComparisonModelFeatures',
    NULL,
    CAST(COALESCE(s.playerId, f.playerId) AS STRING),
    'Snapshot and model-feature player populations do not reconcile',
    TO_JSON(STRUCT(
        s.playerId AS snapshot_playerId,
        f.playerId AS feature_playerId
    ))

FROM `pacey32-agency.Comparison.09_PlayerCurrentSnapshot` s

FULL OUTER JOIN
    `pacey32-agency.Comparison.11_ComparisonModelFeatures` f
    ON s.playerId = f.playerId

WHERE s.playerId IS NULL
   OR f.playerId IS NULL;


-- ============================================================
-- CQ019
-- ModelFeatures required identity
-- ============================================================

INSERT INTO failures

SELECT
    'CQ019',
    '11_ComparisonModelFeatures',
    NULL,
    COALESCE(CAST(playerId AS STRING), 'NULL'),
    'Required model-feature identity field is missing',
    TO_JSON(STRUCT(
        playerId,
        player,
        position,
        SnapshotDate
    ))

FROM `pacey32-agency.Comparison.11_ComparisonModelFeatures`

WHERE playerId IS NULL
   OR player IS NULL
   OR TRIM(player) = ''
   OR position IS NULL
   OR TRIM(position) = ''
   OR SnapshotDate IS NULL;


-- ============================================================
-- CQ020
-- Latest v3 comparable rank uniqueness
-- ============================================================

INSERT INTO failures

SELECT
    'CQ020',
    '11_ComparablePlayers_v3',
    NULL,
    CONCAT(
        CAST(target_playerId AS STRING), '|',
        CAST(comparable_rank AS STRING)
    ),
    'Duplicate comparable rank in latest target run',
    TO_JSON(STRUCT(
        target_playerId,
        target_player,
        comparable_rank,
        COUNT(*) AS cnt
    ))

FROM latest_comparable_run

GROUP BY
    target_playerId,
    target_player,
    comparable_rank

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ021
-- Latest v3 comparable count / ranks
-- ============================================================

INSERT INTO failures

SELECT
    'CQ021',
    '11_ComparablePlayers_v3',
    NULL,
    CAST(target_playerId AS STRING),
    'Latest comparable run does not contain ranks 1 through 20 exactly once',
    TO_JSON(STRUCT(
        target_playerId,
        ANY_VALUE(target_player) AS target_player,
        COUNT(*) AS cnt,
        COUNT(DISTINCT comparable_playerId)
            AS distinct_comparables,
        MIN(comparable_rank) AS min_rank,
        MAX(comparable_rank) AS max_rank,
        COUNT(DISTINCT comparable_rank)
            AS distinct_ranks
    ))

FROM latest_comparable_run

GROUP BY target_playerId

HAVING COUNT(*) != 20
    OR COUNT(DISTINCT comparable_playerId) != 20
    OR COUNT(DISTINCT comparable_rank) != 20
    OR MIN(comparable_rank) != 1
    OR MAX(comparable_rank) != 20;


-- ============================================================
-- CQ022
-- No self comparison
-- ============================================================

INSERT INTO failures

SELECT
    'CQ022',
    '11_ComparablePlayers_v3',
    NULL,
    CONCAT(
        CAST(target_playerId AS STRING), '|',
        CAST(comparable_playerId AS STRING)
    ),
    'Target player appears as their own comparable',
    TO_JSON(STRUCT(
        target_playerId,
        target_player,
        comparable_playerId,
        comparable_player,
        comparable_rank
    ))

FROM latest_comparable_run

WHERE target_playerId = comparable_playerId;


-- ============================================================
-- CQ023
-- Comparable similarity validity
-- ============================================================

INSERT INTO failures

SELECT
    'CQ023',
    '11_ComparablePlayers_v3',
    NULL,
    CONCAT(
        CAST(target_playerId AS STRING), '|',
        CAST(comparable_playerId AS STRING)
    ),
    'Comparable similarity or model count is invalid',
    TO_JSON(STRUCT(
        target_playerId,
        comparable_playerId,
        comparable_rank,
        overall_similarity,
        playing_style_similarity,
        production_similarity,
        effectiveness_similarity,
        usage_similarity,
        trajectory_similarity,
        models_available
    ))

FROM latest_comparable_run

WHERE overall_similarity IS NULL
   OR overall_similarity < 0
   OR overall_similarity > 100
   OR models_available < 1
   OR models_available > 5

   OR (
       playing_style_similarity IS NOT NULL
       AND (
           playing_style_similarity < 0
           OR playing_style_similarity > 100
       )
   )

   OR (
       production_similarity IS NOT NULL
       AND (
           production_similarity < 0
           OR production_similarity > 100
       )
   )

   OR (
       effectiveness_similarity IS NOT NULL
       AND (
           effectiveness_similarity < 0
           OR effectiveness_similarity > 100
       )
   )

   OR (
       usage_similarity IS NOT NULL
       AND (
           usage_similarity < 0
           OR usage_similarity > 100
       )
   )

   OR (
       trajectory_similarity IS NOT NULL
       AND (
           trajectory_similarity < 0
           OR trajectory_similarity > 100
       )
   );


-- ============================================================
-- CQ024
-- Comparable rank ordering
-- Higher-ranked comparable should not have lower overall
-- similarity than a lower-ranked comparable.
-- ============================================================

INSERT INTO failures

SELECT
    'CQ024',
    '11_ComparablePlayers_v3',
    NULL,
    CAST(target_playerId AS STRING),
    'Comparable rank ordering does not follow overall similarity',
    TO_JSON(STRUCT(
        target_playerId,
        target_player,
        comparable_rank,
        overall_similarity,
        previous_similarity
    ))

FROM (

    SELECT
        *,
        LAG(overall_similarity) OVER (
            PARTITION BY target_playerId
            ORDER BY comparable_rank
        ) AS previous_similarity

    FROM latest_comparable_run

)

WHERE previous_similarity IS NOT NULL
  AND overall_similarity > previous_similarity + 0.000001;


-- ============================================================
-- CQ025
-- ContractHistory unique contract
-- ============================================================

INSERT INTO failures

SELECT
    'CQ025',
    '12_ContractHistory',
    NULL,
    CONCAT(
        COALESCE(player_url, player), '|',
        CAST(contract_id AS STRING)
    ),
    'Duplicate historical contract',
    TO_JSON(STRUCT(
        player,
        player_url,
        contract_id,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.12_ContractHistory`

GROUP BY
    player,
    player_url,
    contract_id

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ026
-- ContractHistory modelling validity
-- ============================================================

INSERT INTO failures

SELECT
    'CQ026',
    '12_ContractHistory',
    NULL,
    CONCAT(
        COALESCE(player_url, player), '|',
        CAST(contract_id AS STRING)
    ),
    'Historical modelling contract violates inclusion rules',
    TO_JSON(STRUCT(
        player,
        contract_id,
        contract_type,
        signed_date,
        birth_date,
        signing_age,
        term,
        cap_hit,
        cap_pct_at_signing,
        signing_status
    ))

FROM `pacey32-agency.Comparison.12_ContractHistory`

WHERE contract_id IS NULL
   OR signed_date IS NULL
   OR birth_date IS NULL
   OR signing_age IS NULL
   OR term IS NULL
   OR term < 1
   OR term > 8
   OR cap_hit <= 0
   OR cap_pct_at_signing <= 0
   OR contract_type = 'Entry Level Contract'
   OR signing_status NOT IN (
       'RFA',
       'UFA',
       'UFA-GROUP6',
       'UFAGROUP6',
       'UFANOQO'
   );


-- ============================================================
-- CQ027
-- Contract mapping unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CQ027',
    '13_ContractPlayerMapping',
    NULL,
    CONCAT(
        contract_player, '|',
        CAST(birth_date AS STRING)
    ),
    'Duplicate contract-player mapping',
    TO_JSON(STRUCT(
        contract_player,
        birth_date,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.13_ContractPlayerMapping`

GROUP BY
    contract_player,
    birth_date

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ028
-- Contract mapping validity
-- ============================================================

INSERT INTO failures

SELECT
    'CQ028',
    '13_ContractPlayerMapping',
    NULL,
    CONCAT(
        contract_player, '|',
        CAST(birth_date AS STRING)
    ),
    'Contract mapping has an invalid match classification',
    TO_JSON(STRUCT(
        contract_player,
        birth_date,
        playerID,
        nhl_player,
        match_type
    ))

FROM `pacey32-agency.Comparison.13_ContractPlayerMapping`

WHERE match_type NOT IN (
    'exact',
    'normalised',
    'dob_surname',
    'unmatched'
)
OR (
    match_type != 'unmatched'
    AND (
        playerID IS NULL
        OR nhl_player IS NULL
        OR TRIM(nhl_player) = ''
    )
)
OR (
    match_type = 'unmatched'
    AND playerID IS NOT NULL
);


-- ============================================================
-- CQ029
-- Contract mapping coverage
-- WARN - some PuckPedia players may not exist in NHL source.
-- ============================================================

INSERT INTO failures

SELECT
    'CQ029',
    '13_ContractPlayerMapping',
    NULL,
    CONCAT(
        contract_player, '|',
        CAST(birth_date AS STRING)
    ),
    'Historical contract player is not mapped to NHL playerId',
    TO_JSON(STRUCT(
        contract_player,
        birth_date,
        match_type
    ))

FROM `pacey32-agency.Comparison.13_ContractPlayerMapping`

WHERE playerID IS NULL
   OR match_type = 'unmatched';


-- ============================================================
-- CQ030
-- ContractPerformance row preservation
-- ============================================================

INSERT INTO failures

SELECT
    'CQ030',
    '14_ContractPerformance',
    NULL,
    CAST(COALESCE(h.contract_id, p.contract_id) AS STRING),
    'ContractPerformance does not preserve ContractHistory contract',
    TO_JSON(STRUCT(
        h.contract_id AS history_contract_id,
        p.contract_id AS performance_contract_id,
        h.player AS history_player,
        p.player AS performance_player
    ))

FROM `pacey32-agency.Comparison.12_ContractHistory` h

FULL OUTER JOIN
    `pacey32-agency.Comparison.14_ContractPerformance` p
    ON h.contract_id = p.contract_id
   AND h.player = p.player

WHERE h.contract_id IS NULL
   OR p.contract_id IS NULL;


-- ============================================================
-- CQ031
-- ContractPerformance season logic
-- ============================================================

INSERT INTO failures

SELECT
    'CQ031',
    '14_ContractPerformance',
    latest_completed_season,
    CAST(contract_id AS STRING),
    'latest_completed_season is inconsistent with signed_date',
    TO_JSON(STRUCT(
        player,
        contract_id,
        signed_date,
        latest_completed_season,

        CASE
            WHEN EXTRACT(MONTH FROM signed_date) >= 7
            THEN
                (EXTRACT(YEAR FROM signed_date) - 1) * 10000
                + EXTRACT(YEAR FROM signed_date)
            ELSE
                (EXTRACT(YEAR FROM signed_date) - 2) * 10000
                + (EXTRACT(YEAR FROM signed_date) - 1)
        END AS expected_latest_completed_season
    ))

FROM `pacey32-agency.Comparison.14_ContractPerformance`

WHERE latest_completed_season !=
    CASE
        WHEN EXTRACT(MONTH FROM signed_date) >= 7
        THEN
            (EXTRACT(YEAR FROM signed_date) - 1) * 10000
            + EXTRACT(YEAR FROM signed_date)
        ELSE
            (EXTRACT(YEAR FROM signed_date) - 2) * 10000
            + (EXTRACT(YEAR FROM signed_date) - 1)
    END;


-- ============================================================
-- CQ032
-- ContractPerformance availability flags
-- ============================================================

INSERT INTO failures

SELECT
    'CQ032',
    '14_ContractPerformance',
    latest_completed_season,
    CAST(contract_id AS STRING),
    'Contract performance availability flag is inconsistent',
    TO_JSON(STRUCT(
        player,
        contract_id,
        playerID,
        player_mapped,
        last1_season,
        has_last1,
        last2_season,
        has_last2,
        last3_season,
        has_last3
    ))

FROM `pacey32-agency.Comparison.14_ContractPerformance`

WHERE player_mapped != (playerID IS NOT NULL)
   OR has_last1 != (last1_season IS NOT NULL)
   OR has_last2 != (last2_season IS NOT NULL)
   OR has_last3 != (last3_season IS NOT NULL);


-- ============================================================
-- CQ033
-- ContractModelFeatures inclusion rules
-- ============================================================

INSERT INTO failures

SELECT
    'CQ033',
    '15_ContractModelFeatures',
    latest_completed_season,
    CAST(contract_id AS STRING),
    'Contract model feature row does not satisfy modelling inclusion rules',
    TO_JSON(STRUCT(
        player,
        playerID,
        contract_id,
        has_last1,
        last1_season,
        cap_pct_at_signing
    ))

FROM `pacey32-agency.Comparison.15_ContractModelFeatures`

WHERE playerID IS NULL
   OR has_last1 != TRUE
   OR last1_season IS NULL
   OR cap_pct_at_signing IS NULL
   OR cap_pct_at_signing <= 0;


-- ============================================================
-- CQ034
-- ContractModelFeatures reconciliation
-- ============================================================

INSERT INTO failures

SELECT
    'CQ034',
    '15_ContractModelFeatures',
    p.latest_completed_season,
    CAST(p.contract_id AS STRING),
    'Eligible ContractPerformance row missing from model features',
    TO_JSON(STRUCT(
        p.player,
        p.playerID,
        p.contract_id,
        p.has_last1
    ))

FROM `pacey32-agency.Comparison.14_ContractPerformance` p

LEFT JOIN `pacey32-agency.Comparison.15_ContractModelFeatures` f
    ON p.contract_id = f.contract_id
   AND p.playerID = f.playerID

WHERE p.player_mapped = TRUE
  AND p.has_last1 = TRUE
  AND f.contract_id IS NULL;


-- ============================================================
-- CQ035
-- GoalieSeasonStats unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CQ035',
    '16_GoalieSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart
    ),
    'Duplicate goalie-season record',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.16_GoalieSeasonStats`

GROUP BY
    playerId,
    season,
    seasonPart

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ036
-- Goalie production arithmetic
-- ============================================================

INSERT INTO failures

SELECT
    'CQ036',
    '16_GoalieSeasonStats',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart
    ),
    'Goalie production calculation is incorrect',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        shots_against,
        saves,
        goals_against,
        toi_minutes,
        save_pct,
        gaa,
        SAFE_DIVIDE(saves, shots_against)
            AS expected_save_pct,
        SAFE_DIVIDE(goals_against * 60, toi_minutes)
            AS expected_gaa
    ))

FROM `pacey32-agency.Comparison.16_GoalieSeasonStats`

WHERE
    ABS(
        COALESCE(save_pct, -999999)
        -
        COALESCE(SAFE_DIVIDE(saves, shots_against), -999999)
    ) > 0.000001

    OR ABS(
        COALESCE(gaa, -999999)
        -
        COALESCE(
            SAFE_DIVIDE(goals_against * 60, toi_minutes),
            -999999
        )
    ) > 0.000001;


-- ============================================================
-- CQ037
-- Goalie production latest uniqueness
-- ============================================================

INSERT INTO failures

SELECT
    'CQ037',
    '17_GoalieProductionLatest',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate goalie in production-latest view',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.17_GoalieProductionLatest`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ038
-- Goalie usage validity
-- ============================================================

INSERT INTO failures

SELECT
    'CQ038',
    '18_GoalieUsageSeason',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING), '|',
        seasonPart, '|',
        team_code
    ),
    'Goalie usage values are invalid',
    TO_JSON(STRUCT(
        playerId,
        season,
        seasonPart,
        team_code,
        games_played,
        starts,
        team_games,
        team_start_pct,
        toi_minutes,
        shots_faced
    ))

FROM `pacey32-agency.Comparison.18_GoalieUsageSeason`

WHERE games_played < 0
   OR starts < 0
   OR team_games < 0
   OR starts > games_played
   OR games_played > team_games
   OR team_start_pct < 0
   OR team_start_pct > 1
   OR toi_minutes < 0
   OR shots_faced < 0;


-- ============================================================
-- CQ039
-- Goalie usage latest uniqueness
-- ============================================================

INSERT INTO failures

SELECT
    'CQ039',
    '19_GoalieUsageLatest',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate goalie in usage-latest view',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.19_GoalieUsageLatest`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ040
-- Goalie trajectory unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CQ040',
    '20_GoalieTrajectorySeason',
    season,
    CONCAT(
        CAST(playerId AS STRING), '|',
        CAST(season AS STRING)
    ),
    'Duplicate goalie-season trajectory row',
    TO_JSON(STRUCT(
        playerId,
        season,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.20_GoalieTrajectorySeason`

GROUP BY
    playerId,
    season

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ041
-- Goalie trajectory latest uniqueness
-- ============================================================

INSERT INTO failures

SELECT
    'CQ041',
    '21_GoalieTrajectoryLatest',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate goalie in trajectory-latest view',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Comparison.21_GoalieTrajectoryLatest`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CQ042
-- Goalie latest-model coverage
-- ============================================================

INSERT INTO failures

SELECT
    'CQ042',
    'GoalieLatestModels',
    NULL,
    CAST(g.playerId AS STRING),
    'Goalie is missing from one or more latest model views',
    TO_JSON(STRUCT(
        g.playerId,
        p.playerId IS NOT NULL AS has_production,
        u.playerId IS NOT NULL AS has_usage,
        t.playerId IS NOT NULL AS has_trajectory
    ))

FROM (
    SELECT DISTINCT playerId
    FROM `pacey32-agency.Comparison.16_GoalieSeasonStats`
) g

LEFT JOIN `pacey32-agency.Comparison.17_GoalieProductionLatest` p
    ON g.playerId = p.playerId

LEFT JOIN `pacey32-agency.Comparison.19_GoalieUsageLatest` u
    ON g.playerId = u.playerId

LEFT JOIN `pacey32-agency.Comparison.21_GoalieTrajectoryLatest` t
    ON g.playerId = t.playerId

WHERE p.playerId IS NULL
   OR u.playerId IS NULL
   OR t.playerId IS NULL;


-- ============================================================
-- CQ043
-- Goalie latest season agreement
-- ============================================================

INSERT INTO failures

SELECT
    'CQ043',
    'GoalieLatestModels',
    p.latest_season,
    CAST(p.playerId AS STRING),
    'Goalie latest-season model views disagree',
    TO_JSON(STRUCT(
        p.playerId,
        p.latest_season AS production_latest_season,
        u.latest_season AS usage_latest_season,
        t.latest_season AS trajectory_latest_season
    ))

FROM `pacey32-agency.Comparison.17_GoalieProductionLatest` p

JOIN `pacey32-agency.Comparison.19_GoalieUsageLatest` u
    ON p.playerId = u.playerId

JOIN `pacey32-agency.Comparison.21_GoalieTrajectoryLatest` t
    ON p.playerId = t.playerId

WHERE p.latest_season != u.latest_season
   OR p.latest_season != t.latest_season;


-- ============================================================
-- WRITE FAILURE RECORDS
-- ============================================================

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

FROM failures;


-- ============================================================
-- TEST METADATA
-- ============================================================

CREATE TEMP TABLE test_metadata AS

SELECT
    'CQ001' AS test_id,
    'PlayerProfile unique player' AS test_name,
    'UNIQUENESS' AS category,
    '01_PlayerProfile' AS source_object,
    'HIGH' AS severity,
    'PlayerProfile must contain one row per playerId.' AS description

UNION ALL SELECT
    'CQ002', 'PlayerProfile required identity',
    'COMPLETENESS', '01_PlayerProfile', 'HIGH',
    'Active comparison players require core identity, position and current team.'

UNION ALL SELECT
    'CQ003', 'CareerStats player coverage',
    'COMPLETENESS', '02_PlayerCareerStats', 'HIGH',
    'Every PlayerProfile player must appear in PlayerCareerStats.'

UNION ALL SELECT
    'CQ004', 'CareerStats unique player',
    'UNIQUENESS', '02_PlayerCareerStats', 'HIGH',
    'PlayerCareerStats must contain one row per playerId.'

UNION ALL SELECT
    'CQ005', 'PlayerSeasonStats unique grain',
    'UNIQUENESS', '03_PlayerSeasonStats', 'HIGH',
    'PlayerSeasonStats must be unique by season, seasonPart, player and team.'

UNION ALL SELECT
    'CQ006', 'PlayerSeasonStats points arithmetic',
    'CALCULATION', '03_PlayerSeasonStats', 'HIGH',
    'Points must equal goals plus assists.'

UNION ALL SELECT
    'CQ007', 'PlayerSeasonStats validity',
    'VALIDITY', '03_PlayerSeasonStats', 'HIGH',
    'Player-season keys and counting measures must be valid.'

UNION ALL SELECT
    'CQ008', 'PlayerSeasonStats per-game calculations',
    'CALCULATION', '03_PlayerSeasonStats', 'HIGH',
    'Per-game production must reconcile to totals and games played.'

UNION ALL SELECT
    'CQ009', 'PlayerSeasonStats per-60 calculations',
    'CALCULATION', '03_PlayerSeasonStats', 'HIGH',
    'Per-60 production must reconcile to totals and time on ice.'

UNION ALL SELECT
    'CQ010', 'PlayerPeakStats unique grain',
    'UNIQUENESS', '04_PlayerPeakStats', 'HIGH',
    'Peak stats must contain one row per player and seasonPart.'

UNION ALL SELECT
    'CQ011', 'PlayerPeakStats season validity',
    'VALIDITY', '04_PlayerPeakStats', 'MEDIUM',
    'Preseason must be excluded from peak statistics.'

UNION ALL SELECT
    'CQ012', 'Trajectory season grain and ranking',
    'CALCULATION', '05_PlayerTrajectory', 'HIGH',
    'Trajectory must contain one row per player season and rank distinct seasons most-recent first.'

UNION ALL SELECT
    'CQ013', 'Latest trajectory unique grain',
    'UNIQUENESS', '06_PlayerTrajectoryLatest', 'HIGH',
    'Latest trajectory must contain one row per player and seasonPart.'

UNION ALL SELECT
    'CQ014', 'Latest trajectory season ordering',
    'CONSISTENCY', '06_PlayerTrajectoryLatest', 'HIGH',
    'Trajectory last1, last2 and last3 seasons must be ordered newest to oldest.'

UNION ALL SELECT
    'CQ015', 'Current snapshot unique player',
    'UNIQUENESS', '09_PlayerCurrentSnapshot', 'CRITICAL',
    'Current snapshot must contain one row per playerId.'

UNION ALL SELECT
    'CQ016', 'Current snapshot required fields',
    'COMPLETENESS', '09_PlayerCurrentSnapshot', 'HIGH',
    'Current model snapshot requires player identity, position and snapshot timestamp.'

UNION ALL SELECT
    'CQ017', 'ModelFeatures unique player',
    'UNIQUENESS', '11_ComparisonModelFeatures', 'CRITICAL',
    'Comparison model features must contain one row per playerId.'

UNION ALL SELECT
    'CQ018', 'Snapshot feature coverage',
    'RECONCILIATION', '11_ComparisonModelFeatures', 'CRITICAL',
    'Current snapshot and model-feature player populations must reconcile.'

UNION ALL SELECT
    'CQ019', 'ModelFeatures required identity',
    'COMPLETENESS', '11_ComparisonModelFeatures', 'HIGH',
    'Model features require player identity, position and snapshot timestamp.'

UNION ALL SELECT
    'CQ020', 'Comparable rank uniqueness',
    'UNIQUENESS', '11_ComparablePlayers_v3', 'CRITICAL',
    'Latest comparable run must contain one row per target and comparable rank.'

UNION ALL SELECT
    'CQ021', 'Comparable top-20 completeness',
    'COMPLETENESS', '11_ComparablePlayers_v3', 'CRITICAL',
    'Latest comparable run must contain 20 distinct comparables ranked 1 through 20.'

UNION ALL SELECT
    'CQ022', 'Comparable self comparison',
    'VALIDITY', '11_ComparablePlayers_v3', 'CRITICAL',
    'A target player must never be returned as their own comparable.'

UNION ALL SELECT
    'CQ023', 'Comparable similarity validity',
    'VALIDITY', '11_ComparablePlayers_v3', 'HIGH',
    'Similarity measures must be within 0 to 100 and models_available within 1 to 5.'

UNION ALL SELECT
    'CQ024', 'Comparable rank ordering',
    'CONSISTENCY', '11_ComparablePlayers_v3', 'HIGH',
    'Comparable rank must descend with overall similarity.'

UNION ALL SELECT
    'CQ025', 'ContractHistory unique contract',
    'UNIQUENESS', '12_ContractHistory', 'HIGH',
    'Historical modelling contracts must be unique.'

UNION ALL SELECT
    'CQ026', 'ContractHistory modelling validity',
    'VALIDITY', '12_ContractHistory', 'HIGH',
    'Historical contracts must satisfy the configured market-value modelling inclusion rules.'

UNION ALL SELECT
    'CQ027', 'Contract mapping unique grain',
    'UNIQUENESS', '13_ContractPlayerMapping', 'HIGH',
    'Each contract player and birth date must have one mapping record.'

UNION ALL SELECT
    'CQ028', 'Contract mapping validity',
    'VALIDITY', '13_ContractPlayerMapping', 'HIGH',
    'Contract-player match classification and mapped NHL identity must be internally consistent.'

UNION ALL SELECT
    'CQ029', 'Contract player mapping coverage',
    'COMPLETENESS', '13_ContractPlayerMapping', 'MEDIUM',
    'Monitor historical contract players that cannot currently be mapped to an NHL playerId.'

UNION ALL SELECT
    'CQ030', 'ContractPerformance row preservation',
    'RECONCILIATION', '14_ContractPerformance', 'HIGH',
    'ContractPerformance must preserve every ContractHistory contract.'

UNION ALL SELECT
    'CQ031', 'ContractPerformance season logic',
    'CALCULATION', '14_ContractPerformance', 'HIGH',
    'Latest completed season must be determined correctly from the contract signing date.'

UNION ALL SELECT
    'CQ032', 'ContractPerformance availability flags',
    'CONSISTENCY', '14_ContractPerformance', 'HIGH',
    'Player mapping and historical-season availability flags must agree with populated data.'

UNION ALL SELECT
    'CQ033', 'ContractModelFeatures inclusion',
    'VALIDITY', '15_ContractModelFeatures', 'HIGH',
    'Contract model features require a mapped player and most recent completed NHL season.'

UNION ALL SELECT
    'CQ034', 'ContractModelFeatures reconciliation',
    'RECONCILIATION', '15_ContractModelFeatures', 'HIGH',
    'Every eligible ContractPerformance row must appear in ContractModelFeatures.'

UNION ALL SELECT
    'CQ035', 'GoalieSeasonStats unique grain',
    'UNIQUENESS', '16_GoalieSeasonStats', 'HIGH',
    'Goalie production must contain one row per player, season and seasonPart.'

UNION ALL SELECT
    'CQ036', 'Goalie production arithmetic',
    'CALCULATION', '16_GoalieSeasonStats', 'HIGH',
    'Goalie save percentage and GAA must reconcile to underlying totals.'

UNION ALL SELECT
    'CQ037', 'Goalie production latest uniqueness',
    'UNIQUENESS', '17_GoalieProductionLatest', 'HIGH',
    'Goalie production latest must contain one row per goalie.'

UNION ALL SELECT
    'CQ038', 'Goalie usage validity',
    'VALIDITY', '18_GoalieUsageSeason', 'HIGH',
    'Goalie appearances, starts, team games, workload and start share must be valid.'

UNION ALL SELECT
    'CQ039', 'Goalie usage latest uniqueness',
    'UNIQUENESS', '19_GoalieUsageLatest', 'HIGH',
    'Goalie usage latest must contain one row per goalie.'

UNION ALL SELECT
    'CQ040', 'Goalie trajectory unique grain',
    'UNIQUENESS', '20_GoalieTrajectorySeason', 'HIGH',
    'Goalie trajectory must contain one row per goalie and regular season.'

UNION ALL SELECT
    'CQ041', 'Goalie trajectory latest uniqueness',
    'UNIQUENESS', '21_GoalieTrajectoryLatest', 'HIGH',
    'Goalie trajectory latest must contain one row per goalie.'

UNION ALL SELECT
    'CQ042', 'Goalie latest-model coverage',
    'RECONCILIATION', 'GoalieLatestModels', 'CRITICAL',
    'Every goalie in season production must appear in all three latest model views.'

UNION ALL SELECT
    'CQ043', 'Goalie latest-season agreement',
    'CONSISTENCY', 'GoalieLatestModels', 'HIGH',
    'Goalie production, usage and trajectory models must agree on the latest regular season.';


-- ============================================================
-- WRITE TEST RESULTS
-- ============================================================

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

    m.test_id,
    m.test_name,
    m.category,

    'Comparison',

    m.source_object,

    NULL,

    m.severity,

    CASE
        WHEN COUNT(f.test_id) = 0
            THEN 'PASS'

        WHEN m.test_id = 'CQ029'
            THEN 'WARN'

        ELSE 'FAIL'
    END AS status,

    COUNT(f.test_id) AS failure_count,

    m.description,

    CASE
        WHEN COUNT(f.test_id) = 0
            THEN 'Test passed.'

        WHEN m.test_id = 'CQ029'
            THEN CONCAT(
                CAST(COUNT(f.test_id) AS STRING),
                ' historical contract players are currently unmatched.'
            )

        ELSE CONCAT(
            CAST(COUNT(f.test_id) AS STRING),
            ' failing records.'
        )
    END AS details

FROM test_metadata m

LEFT JOIN failures f
    ON m.test_id = f.test_id

GROUP BY
    m.test_id,
    m.test_name,
    m.category,
    m.source_object,
    m.severity,
    m.description;


-- ============================================================
-- RUN SUMMARY
-- ============================================================

SELECT
    test_id,
    test_name,
    severity,
    status,
    failure_count,
    description,
    details

FROM `pacey32-agency.QA.TestResults`

WHERE run_id = v_run_id

ORDER BY test_id;