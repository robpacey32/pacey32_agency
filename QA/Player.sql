-- ============================================================
-- PLAYER QA
-- Project: pacey32-agency
--
-- PL001 - PlayerSeasonOffence unique grain
-- PL002 - PlayerSeasonOffenceRate unique grain
-- PL003 - PlayerProfile unique player
-- PL004 - Points arithmetic
-- PL005 - Offence -> rate coverage
-- PL006 - Valid season context
-- PL007 - Required offence keys
-- PL008 - Latest PlayerLanding -> PlayerProfile coverage
-- PL009 - Agency Boxscore -> source Boxscore reconciliation
-- PL010 - Latest PlayerLanding unique player
-- PL011 - Games played reconciliation
-- PL012 - TOI reconciliation
-- PL013 - Shifts reconciliation
-- PL014 - Per-game rate calculations
-- PL015 - Per-60 rate calculations
-- PL016 - Non-negative measures
-- PL017 - PlayerProfile required identity
-- PL018 - PlayerProfile -> latest PlayerLanding reconciliation
-- PL019 - Valid PlayerProfile position
-- PL020 - Regular-season career points arithmetic
-- PL021 - Playoff career points arithmetic
-- PL022 - Active-player current-team completeness
-- PL023 - Goals / assists reconcile to 1_OffenceStats
-- PL024 - Average TOI calculation
-- PL025 - Seconds-per-shift calculation
-- ============================================================


DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();


-- ============================================================
-- FAILURE STAGING
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
-- REUSABLE BOXSCORE AGGREGATION
-- ============================================================

CREATE TEMP TABLE expected_boxscore AS

SELECT
    season,

    CASE
        WHEN gameType = 1 THEN 'PreSeason'
        WHEN gameType = 2 THEN 'RegularSeason'
        WHEN gameType = 3 THEN 'Playoffs'
    END AS SeasonPart,

    playerId,
    playerTeamAbbrev AS team_code,

    COUNT(DISTINCT id) AS games_played,

    SUM(
        CASE
            WHEN toi IS NULL OR toi = '' THEN 0
            ELSE
                SAFE_CAST(SPLIT(toi, ':')[SAFE_OFFSET(0)] AS INT64) * 60
                +
                SAFE_CAST(SPLIT(toi, ':')[SAFE_OFFSET(1)] AS INT64)
        END
    ) AS toi_seconds,

    SUM(
        COALESCE(
            SAFE_CAST(shifts AS INT64),
            0
        )
    ) AS shifts

FROM `pacey32-agency.Player.Boxscore`

WHERE gameType IN (1,2,3)

GROUP BY
    season,
    SeasonPart,
    playerId,
    team_code;


-- ============================================================
-- LATEST PLAYER LANDING
-- ============================================================

CREATE TEMP TABLE latest_landing AS

SELECT *

FROM `pacey32-agency.Player.PlayerLanding`

QUALIFY ROW_NUMBER() OVER (
    PARTITION BY playerId
    ORDER BY RunDate DESC
) = 1;


-- ============================================================
-- PL001 - PlayerSeasonOffence unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'PL001',
    '2_PlayerSeasonOffence',
    season,

    CONCAT(
        CAST(season AS STRING), '|',
        SeasonPart, '|',
        CAST(playerId AS STRING), '|',
        team_code
    ),

    'Duplicate season / SeasonPart / playerId / team_code grain',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            team_code,
            COUNT(*) AS duplicate_count
        )
    )

FROM `pacey32-agency.Player.2_PlayerSeasonOffence`

GROUP BY
    season,
    SeasonPart,
    playerId,
    team_code

HAVING COUNT(*) > 1;


-- ============================================================
-- PL002 - PlayerSeasonOffenceRate unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'PL002',
    '3_PlayerSeasonOffenceRate',
    season,

    CONCAT(
        CAST(season AS STRING), '|',
        SeasonPart, '|',
        playerId, '|',
        team_code
    ),

    'Duplicate season / SeasonPart / playerId / team_code grain',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            team_code,
            COUNT(*) AS duplicate_count
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate`

GROUP BY
    season,
    SeasonPart,
    playerId,
    team_code

HAVING COUNT(*) > 1;


-- ============================================================
-- PL003 - PlayerProfile unique player
-- ============================================================

INSERT INTO failures

SELECT
    'PL003',
    'PlayerProfile',
    NULL,

    CAST(playerId AS STRING),

    'Duplicate playerId in PlayerProfile',

    TO_JSON(
        STRUCT(
            playerId,
            COUNT(*) AS duplicate_count
        )
    )

FROM `pacey32-agency.Player.PlayerProfile`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- PL004 - Points arithmetic
-- ============================================================

INSERT INTO failures

SELECT
    'PL004',
    '2_PlayerSeasonOffence',
    season,

    CONCAT(
        CAST(season AS STRING), '|',
        SeasonPart, '|',
        CAST(playerId AS STRING), '|',
        team_code
    ),

    'points does not equal goals + assists',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            player,
            team_code,
            goals,
            assists,
            points
        )
    )

FROM `pacey32-agency.Player.2_PlayerSeasonOffence`

WHERE points != goals + assists;


-- ============================================================
-- PL005 - Offence -> rate coverage
-- ============================================================

INSERT INTO failures

SELECT
    'PL005',
    '3_PlayerSeasonOffenceRate',
    o.season,

    CONCAT(
        CAST(o.season AS STRING), '|',
        o.SeasonPart, '|',
        CAST(o.playerId AS STRING), '|',
        o.team_code
    ),

    'PlayerSeasonOffence record missing from PlayerSeasonOffenceRate',

    TO_JSON(
        STRUCT(
            o.season,
            o.SeasonPart,
            o.playerId,
            o.player,
            o.team_code
        )
    )

FROM `pacey32-agency.Player.2_PlayerSeasonOffence` o

LEFT JOIN `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r
    ON o.season = r.season
    AND o.SeasonPart = r.SeasonPart
    AND CAST(o.playerId AS STRING) = r.playerId
    AND o.team_code = r.team_code

WHERE r.playerId IS NULL;


-- ============================================================
-- PL006 - Valid season context
-- ============================================================

INSERT INTO failures

SELECT
    'PL006',
    '2_PlayerSeasonOffence',
    season,

    CONCAT(
        COALESCE(CAST(season AS STRING), 'NULL'), '|',
        COALESCE(SeasonPart, 'NULL'), '|',
        COALESCE(CAST(playerId AS STRING), 'NULL'), '|',
        COALESCE(team_code, 'NULL')
    ),

    'Invalid or missing season / SeasonPart',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            player,
            team_code
        )
    )

FROM `pacey32-agency.Player.2_PlayerSeasonOffence`

WHERE season IS NULL
   OR SeasonPart IS NULL
   OR SeasonPart NOT IN (
       'PreSeason',
       'RegularSeason',
       'Playoffs'
   );


-- ============================================================
-- PL007 - Required offence keys
-- ============================================================

INSERT INTO failures

SELECT
    'PL007',
    '2_PlayerSeasonOffence',
    season,

    CONCAT(
        COALESCE(CAST(season AS STRING), 'NULL'), '|',
        COALESCE(SeasonPart, 'NULL'), '|',
        COALESCE(CAST(playerId AS STRING), 'NULL'), '|',
        COALESCE(team_code, 'NULL')
    ),

    'Required PlayerSeasonOffence key is missing',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            player,
            team_code
        )
    )

FROM `pacey32-agency.Player.2_PlayerSeasonOffence`

WHERE season IS NULL
   OR SeasonPart IS NULL
   OR playerId IS NULL
   OR NULLIF(TRIM(team_code), '') IS NULL;


-- ============================================================
-- PL008 - Latest PlayerLanding -> PlayerProfile coverage
-- ============================================================

INSERT INTO failures

SELECT
    'PL008',
    'PlayerProfile',
    NULL,

    CAST(l.playerId AS STRING),

    'Latest PlayerLanding player missing from PlayerProfile',

    TO_JSON(
        STRUCT(
            l.playerId,
            l.firstName,
            l.lastName,
            l.RunDate
        )
    )

FROM latest_landing l

LEFT JOIN `pacey32-agency.Player.PlayerProfile` p
    ON l.playerId = p.playerId

WHERE p.playerId IS NULL;


-- ============================================================
-- PL009 - Agency Boxscore -> source reconciliation
-- ============================================================

INSERT INTO failures

WITH agency AS (

    SELECT DISTINCT
        id,
        playerId
    FROM `pacey32-agency.Player.Boxscore`

),

source AS (

    SELECT DISTINCT
        id,
        playerId
    FROM `nhl-pacey32-github.NHL_Views.Boxscore`

),

diff AS (

    SELECT
        COALESCE(a.id, s.id) AS id,
        COALESCE(a.playerId, s.playerId) AS playerId,

        CASE
            WHEN a.id IS NULL THEN 'Missing from Agency Boxscore'
            WHEN s.id IS NULL THEN 'Missing from source Boxscore'
        END AS reason

    FROM agency a

    FULL OUTER JOIN source s
        ON a.id = s.id
        AND a.playerId = s.playerId

    WHERE a.id IS NULL
       OR s.id IS NULL
)

SELECT
    'PL009',
    'Boxscore',
    NULL,

    CONCAT(
        CAST(id AS STRING), '|',
        CAST(playerId AS STRING)
    ),

    reason,

    TO_JSON(
        STRUCT(
            id,
            playerId,
            reason
        )
    )

FROM diff;


-- ============================================================
-- PL010 - Latest PlayerLanding uniqueness
-- ============================================================

INSERT INTO failures

WITH max_dates AS (

    SELECT
        playerId,
        MAX(RunDate) AS max_RunDate

    FROM `pacey32-agency.Player.PlayerLanding`

    GROUP BY playerId

),

latest_counts AS (

    SELECT
        l.playerId,
        m.max_RunDate,
        COUNT(*) AS cnt

    FROM `pacey32-agency.Player.PlayerLanding` l

    JOIN max_dates m
        ON l.playerId = m.playerId
        AND l.RunDate = m.max_RunDate

    GROUP BY
        l.playerId,
        m.max_RunDate
)

SELECT
    'PL010',
    'PlayerLanding',
    NULL,

    CAST(playerId AS STRING),

    'Multiple PlayerLanding records exist at the latest RunDate',

    TO_JSON(
        STRUCT(
            playerId,
            max_RunDate,
            cnt
        )
    )

FROM latest_counts

WHERE cnt > 1;


-- ============================================================
-- PL011 - Games played reconciliation
-- ============================================================

INSERT INTO failures

SELECT
    'PL011',
    '3_PlayerSeasonOffenceRate',
    r.season,

    CONCAT(
        CAST(r.season AS STRING), '|',
        r.SeasonPart, '|',
        r.playerId, '|',
        r.team_code
    ),

    'games_played does not reconcile to Boxscore',

    TO_JSON(
        STRUCT(
            r.season,
            r.SeasonPart,
            r.playerId,
            r.team_code,
            r.games_played AS actual_games,
            COALESCE(b.games_played, 0) AS expected_games
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r

LEFT JOIN expected_boxscore b
    ON r.season = b.season
    AND r.SeasonPart = b.SeasonPart
    AND SAFE_CAST(r.playerId AS INT64) = b.playerId
    AND r.team_code = b.team_code

WHERE r.games_played != COALESCE(b.games_played, 0);


-- ============================================================
-- PL012 - TOI reconciliation
-- ============================================================

INSERT INTO failures

SELECT
    'PL012',
    '3_PlayerSeasonOffenceRate',
    r.season,

    CONCAT(
        CAST(r.season AS STRING), '|',
        r.SeasonPart, '|',
        r.playerId, '|',
        r.team_code
    ),

    'toi_minutes does not reconcile to Boxscore',

    TO_JSON(
        STRUCT(
            r.season,
            r.SeasonPart,
            r.playerId,
            r.team_code,
            r.toi_minutes AS actual_toi_minutes,
            ROUND(
                SAFE_DIVIDE(
                    COALESCE(b.toi_seconds, 0),
                    60
                ),
                1
            ) AS expected_toi_minutes
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r

LEFT JOIN expected_boxscore b
    ON r.season = b.season
    AND r.SeasonPart = b.SeasonPart
    AND SAFE_CAST(r.playerId AS INT64) = b.playerId
    AND r.team_code = b.team_code

WHERE COALESCE(r.toi_minutes, 0)
      !=
      COALESCE(
          ROUND(
              SAFE_DIVIDE(b.toi_seconds, 60),
              1
          ),
          0
      );


-- ============================================================
-- PL013 - Shifts reconciliation
-- ============================================================

INSERT INTO failures

SELECT
    'PL013',
    '3_PlayerSeasonOffenceRate',
    r.season,

    CONCAT(
        CAST(r.season AS STRING), '|',
        r.SeasonPart, '|',
        r.playerId, '|',
        r.team_code
    ),

    'shifts does not reconcile to Boxscore',

    TO_JSON(
        STRUCT(
            r.season,
            r.SeasonPart,
            r.playerId,
            r.team_code,
            r.shifts AS actual_shifts,
            COALESCE(b.shifts, 0) AS expected_shifts
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r

LEFT JOIN expected_boxscore b
    ON r.season = b.season
    AND r.SeasonPart = b.SeasonPart
    AND SAFE_CAST(r.playerId AS INT64) = b.playerId
    AND r.team_code = b.team_code

WHERE r.shifts != COALESCE(b.shifts, 0);


-- ============================================================
-- PL014 - Per-game calculations
-- ============================================================

INSERT INTO failures

SELECT
    'PL014',
    '3_PlayerSeasonOffenceRate',
    season,

    CONCAT(
        CAST(season AS STRING), '|',
        SeasonPart, '|',
        playerId, '|',
        team_code
    ),

    'One or more per-game calculations are incorrect',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            team_code,

            goals_per_game,
            ROUND(SAFE_DIVIDE(goals, games_played), 3)
                AS expected_goals_per_game,

            assists_per_game,
            ROUND(SAFE_DIVIDE(assists, games_played), 3)
                AS expected_assists_per_game,

            points_per_game,
            ROUND(SAFE_DIVIDE(points, games_played), 3)
                AS expected_points_per_game,

            shifts_per_game,
            ROUND(SAFE_DIVIDE(shifts, games_played), 2)
                AS expected_shifts_per_game
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate`

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
    )

    OR COALESCE(shifts_per_game, -999999)
    != COALESCE(
        ROUND(SAFE_DIVIDE(shifts, games_played), 2),
        -999999
    );


-- ============================================================
-- PL015 - Per-60 calculations
-- ============================================================

INSERT INTO failures

SELECT
    'PL015',
    '3_PlayerSeasonOffenceRate',
    r.season,

    CONCAT(
        CAST(r.season AS STRING), '|',
        r.SeasonPart, '|',
        r.playerId, '|',
        r.team_code
    ),

    'One or more per-60 calculations are incorrect',

    TO_JSON(
        STRUCT(
            r.season,
            r.SeasonPart,
            r.playerId,
            r.team_code,

            r.goals_per_60,
            ROUND(
                SAFE_DIVIDE(
                    r.goals * 3600,
                    b.toi_seconds
                ),
                2
            ) AS expected_goals_per_60,

            r.assists_per_60,
            ROUND(
                SAFE_DIVIDE(
                    r.assists * 3600,
                    b.toi_seconds
                ),
                2
            ) AS expected_assists_per_60,

            r.points_per_60,
            ROUND(
                SAFE_DIVIDE(
                    r.points * 3600,
                    b.toi_seconds
                ),
                2
            ) AS expected_points_per_60
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r

LEFT JOIN expected_boxscore b
    ON r.season = b.season
    AND r.SeasonPart = b.SeasonPart
    AND SAFE_CAST(r.playerId AS INT64) = b.playerId
    AND r.team_code = b.team_code

WHERE
    COALESCE(r.goals_per_60, -999999)
    != COALESCE(
        ROUND(
            SAFE_DIVIDE(
                r.goals * 3600,
                b.toi_seconds
            ),
            2
        ),
        -999999
    )

    OR COALESCE(r.assists_per_60, -999999)
    != COALESCE(
        ROUND(
            SAFE_DIVIDE(
                r.assists * 3600,
                b.toi_seconds
            ),
            2
        ),
        -999999
    )

    OR COALESCE(r.points_per_60, -999999)
    != COALESCE(
        ROUND(
            SAFE_DIVIDE(
                r.points * 3600,
                b.toi_seconds
            ),
            2
        ),
        -999999
    );


-- ============================================================
-- PL016 - Non-negative measures
-- ============================================================

INSERT INTO failures

SELECT
    'PL016',
    '3_PlayerSeasonOffenceRate',
    season,

    CONCAT(
        CAST(season AS STRING), '|',
        SeasonPart, '|',
        playerId, '|',
        team_code
    ),

    'Negative counting or rate measure',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            team_code,
            games_played,
            toi_minutes,
            shifts,
            goals,
            assists,
            points,
            goals_per_game,
            assists_per_game,
            points_per_game,
            goals_per_60,
            assists_per_60,
            points_per_60
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate`

WHERE games_played < 0
   OR toi_minutes < 0
   OR shifts < 0
   OR goals < 0
   OR assists < 0
   OR points < 0
   OR goals_per_game < 0
   OR assists_per_game < 0
   OR points_per_game < 0
   OR goals_per_60 < 0
   OR assists_per_60 < 0
   OR points_per_60 < 0;


-- ============================================================
-- PL017 - PlayerProfile required identity
-- ============================================================

INSERT INTO failures

SELECT
    'PL017',
    'PlayerProfile',
    NULL,

    COALESCE(
        CAST(playerId AS STRING),
        'NULL'
    ),

    'Required PlayerProfile identity field is missing',

    TO_JSON(
        STRUCT(
            playerId,
            player_name,
            position
        )
    )

FROM `pacey32-agency.Player.PlayerProfile`

WHERE playerId IS NULL
   OR NULLIF(TRIM(player_name), '') IS NULL;


-- ============================================================
-- PL018 - PlayerProfile -> latest PlayerLanding reconciliation
-- ============================================================

INSERT INTO failures

SELECT
    'PL018',
    'PlayerProfile',
    NULL,

    CAST(p.playerId AS STRING),

    'PlayerProfile core fields do not reconcile to latest PlayerLanding',

    TO_JSON(
        STRUCT(
            p.playerId,

            p.player_name AS profile_name,

            CONCAT(
                COALESCE(l.firstName, ''),
                ' ',
                COALESCE(l.lastName, '')
            ) AS landing_name,

            p.is_active AS profile_active,
            l.isActive AS landing_active,

            p.current_team_id AS profile_team_id,
            l.currentTeamId AS landing_team_id,

            p.team_code AS profile_team_code,
            l.currentTeamAbbrev AS landing_team_code,

            p.sweater_number AS profile_sweater,
            l.sweaterNumber AS landing_sweater,

            p.birth_date AS profile_birth_date,
            l.birthDate AS landing_birth_date,

            p.RunDate AS profile_RunDate,
            l.RunDate AS landing_RunDate
        )
    )

FROM `pacey32-agency.Player.PlayerProfile` p

JOIN latest_landing l
    ON p.playerId = l.playerId

WHERE
    COALESCE(
        NULLIF(TRIM(p.player_name), ''),
        ''
    )
    !=
    COALESCE(
        NULLIF(
            TRIM(
                CONCAT(
                    COALESCE(l.firstName, ''),
                    ' ',
                    COALESCE(l.lastName, '')
                )
            ),
            ''
        ),
        ''
    )

    OR p.is_active IS DISTINCT FROM l.isActive

    OR p.current_team_id IS DISTINCT FROM l.currentTeamId

    OR COALESCE(p.team_code, '')
       != COALESCE(l.currentTeamAbbrev, '')

    OR p.sweater_number IS DISTINCT FROM l.sweaterNumber

    OR p.birth_date IS DISTINCT FROM l.birthDate

    OR p.RunDate IS DISTINCT FROM l.RunDate;


-- ============================================================
-- PL019 - Valid PlayerProfile position
-- ============================================================

INSERT INTO failures

SELECT
    'PL019',
    'PlayerProfile',
    NULL,

    CAST(playerId AS STRING),

    'Unexpected PlayerProfile position',

    TO_JSON(
        STRUCT(
            playerId,
            player_name,
            position
        )
    )

FROM `pacey32-agency.Player.PlayerProfile`

WHERE position IS NOT NULL
  AND position NOT IN (
      'C',
      'LW',
      'RW',
      'D',
      'G'
  );


-- ============================================================
-- PL020 - Regular-season career points arithmetic
-- ============================================================

INSERT INTO failures

SELECT
    'PL020',
    'PlayerProfile',
    NULL,

    CAST(playerId AS STRING),

    'Regular-season career points do not equal goals + assists',

    TO_JSON(
        STRUCT(
            playerId,
            player_name,
            rs_goals,
            rs_assists,
            rs_points
        )
    )

FROM `pacey32-agency.Player.PlayerProfile`

WHERE rs_points IS NOT NULL
  AND rs_goals IS NOT NULL
  AND rs_assists IS NOT NULL
  AND rs_points != rs_goals + rs_assists;


-- ============================================================
-- PL021 - Playoff career points arithmetic
-- ============================================================

INSERT INTO failures

SELECT
    'PL021',
    'PlayerProfile',
    NULL,

    CAST(playerId AS STRING),

    'Playoff career points do not equal goals + assists',

    TO_JSON(
        STRUCT(
            playerId,
            player_name,
            po_goals,
            po_assists,
            po_points
        )
    )

FROM `pacey32-agency.Player.PlayerProfile`

WHERE po_points IS NOT NULL
  AND po_goals IS NOT NULL
  AND po_assists IS NOT NULL
  AND po_points != po_goals + po_assists;


-- ============================================================
-- PL022 - Active-player current-team completeness
-- ============================================================

INSERT INTO failures

SELECT
    'PL022',
    'PlayerProfile',
    NULL,

    CAST(playerId AS STRING),

    'Active player is missing current-team information',

    TO_JSON(
        STRUCT(
            playerId,
            player_name,
            is_active,
            current_team_id,
            team_code,
            team_name
        )
    )

FROM `pacey32-agency.Player.PlayerProfile`

WHERE is_active = TRUE
  AND (
      current_team_id IS NULL
      OR NULLIF(TRIM(team_code), '') IS NULL
      OR NULLIF(TRIM(team_name), '') IS NULL
  );


-- ============================================================
-- PL023 - Goals / assists reconcile to 1_OffenceStats
-- ============================================================

INSERT INTO failures

WITH expected_goals AS (

    SELECT
        season,
        SeasonPart,
        scoringPlayerId AS playerId,
        eventOwnerTeamCode AS team_code,
        COUNT(*) AS goals

    FROM `pacey32-agency.Player.1_OffenceStats`

    WHERE periodType <> 'SO'
      AND season IS NOT NULL
      AND SeasonPart IS NOT NULL
      AND NULLIF(TRIM(eventOwnerTeamCode), '') IS NOT NULL

    GROUP BY
        season,
        SeasonPart,
        playerId,
        team_code
),

expected_assists AS (

    SELECT
        season,
        SeasonPart,
        playerId,
        team_code,
        COUNT(*) AS assists

    FROM (

        SELECT
            season,
            SeasonPart,
            assist1PlayerId AS playerId,
            eventOwnerTeamCode AS team_code

        FROM `pacey32-agency.Player.1_OffenceStats`

        WHERE assist1PlayerId IS NOT NULL
          AND assist1PlayerId <> 'n/a'
          AND season IS NOT NULL
          AND SeasonPart IS NOT NULL
          AND NULLIF(TRIM(eventOwnerTeamCode), '') IS NOT NULL

        UNION ALL

        SELECT
            season,
            SeasonPart,
            assist2PlayerId AS playerId,
            eventOwnerTeamCode AS team_code

        FROM `pacey32-agency.Player.1_OffenceStats`

        WHERE assist2PlayerId IS NOT NULL
          AND assist2PlayerId <> 'n/a'
          AND season IS NOT NULL
          AND SeasonPart IS NOT NULL
          AND NULLIF(TRIM(eventOwnerTeamCode), '') IS NOT NULL
    )

    GROUP BY
        season,
        SeasonPart,
        playerId,
        team_code
),

expected AS (

    SELECT
        COALESCE(g.season, a.season) AS season,
        COALESCE(g.SeasonPart, a.SeasonPart) AS SeasonPart,
        COALESCE(g.playerId, a.playerId) AS playerId,
        COALESCE(g.team_code, a.team_code) AS team_code,

        COALESCE(g.goals, 0) AS goals,
        COALESCE(a.assists, 0) AS assists

    FROM expected_goals g

    FULL OUTER JOIN expected_assists a
        ON g.season = a.season
        AND g.SeasonPart = a.SeasonPart
        AND g.playerId = a.playerId
        AND g.team_code = a.team_code
),

comparison AS (

    SELECT
        COALESCE(e.season, o.season) AS season,
        COALESCE(e.SeasonPart, o.SeasonPart) AS SeasonPart,
        COALESCE(e.playerId, o.playerId) AS playerId,
        COALESCE(e.team_code, o.team_code) AS team_code,

        e.goals AS expected_goals,
        o.goals AS actual_goals,

        e.assists AS expected_assists,
        o.assists AS actual_assists

    FROM expected e

    FULL OUTER JOIN `pacey32-agency.Player.2_PlayerSeasonOffence` o
        ON e.season = o.season
        AND e.SeasonPart = o.SeasonPart
        AND e.playerId = o.playerId
        AND e.team_code = o.team_code
)

SELECT
    'PL023',
    '2_PlayerSeasonOffence',
    season,

    CONCAT(
        CAST(season AS STRING), '|',
        SeasonPart, '|',
        CAST(playerId AS STRING), '|',
        team_code
    ),

    'Goals or assists do not reconcile to 1_OffenceStats',

    TO_JSON(
        STRUCT(
            season,
            SeasonPart,
            playerId,
            team_code,
            expected_goals,
            actual_goals,
            expected_assists,
            actual_assists
        )
    )

FROM comparison

WHERE COALESCE(expected_goals, -1)
      != COALESCE(actual_goals, -1)

   OR COALESCE(expected_assists, -1)
      != COALESCE(actual_assists, -1);


-- ============================================================
-- PL024 - Average TOI calculation
-- ============================================================

INSERT INTO failures

SELECT
    'PL024',
    '3_PlayerSeasonOffenceRate',
    r.season,

    CONCAT(
        CAST(r.season AS STRING), '|',
        r.SeasonPart, '|',
        r.playerId, '|',
        r.team_code
    ),

    'avg_toi_minutes calculation is incorrect',

    TO_JSON(
        STRUCT(
            r.season,
            r.SeasonPart,
            r.playerId,
            r.team_code,
            r.avg_toi_minutes AS actual_avg_toi_minutes,

            ROUND(
                SAFE_DIVIDE(
                    b.toi_seconds,
                    b.games_played
                ) / 60,
                2
            ) AS expected_avg_toi_minutes
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r

LEFT JOIN expected_boxscore b
    ON r.season = b.season
    AND r.SeasonPart = b.SeasonPart
    AND SAFE_CAST(r.playerId AS INT64) = b.playerId
    AND r.team_code = b.team_code

WHERE
    COALESCE(r.avg_toi_minutes, -999999)
    !=
    COALESCE(
        ROUND(
            SAFE_DIVIDE(
                b.toi_seconds,
                b.games_played
            ) / 60,
            2
        ),
        -999999
    );


-- ============================================================
-- PL025 - Seconds-per-shift calculation
-- ============================================================

INSERT INTO failures

SELECT
    'PL025',
    '3_PlayerSeasonOffenceRate',
    r.season,

    CONCAT(
        CAST(r.season AS STRING), '|',
        r.SeasonPart, '|',
        r.playerId, '|',
        r.team_code
    ),

    'seconds_per_shift calculation is incorrect',

    TO_JSON(
        STRUCT(
            r.season,
            r.SeasonPart,
            r.playerId,
            r.team_code,
            r.seconds_per_shift AS actual_seconds_per_shift,

            ROUND(
                SAFE_DIVIDE(
                    b.toi_seconds,
                    b.shifts
                ),
                2
            ) AS expected_seconds_per_shift
        )
    )

FROM `pacey32-agency.Player.3_PlayerSeasonOffenceRate` r

LEFT JOIN expected_boxscore b
    ON r.season = b.season
    AND r.SeasonPart = b.SeasonPart
    AND SAFE_CAST(r.playerId AS INT64) = b.playerId
    AND r.team_code = b.team_code

WHERE
    COALESCE(r.seconds_per_shift, -999999)
    !=
    COALESCE(
        ROUND(
            SAFE_DIVIDE(
                b.toi_seconds,
                b.shifts
            ),
            2
        ),
        -999999
    );


-- ============================================================
-- WRITE FAILURES
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

WITH tests AS (

    SELECT 'PL001' test_id, 'PlayerSeasonOffence unique grain' test_name,
           'UNIQUENESS' category, '2_PlayerSeasonOffence' source_object,
           'HIGH' severity,
           'One row per season / SeasonPart / playerId / team_code.' description

    UNION ALL SELECT
        'PL002', 'PlayerSeasonOffenceRate unique grain',
        'UNIQUENESS', '3_PlayerSeasonOffenceRate', 'HIGH',
        'One row per season / SeasonPart / playerId / team_code.'

    UNION ALL SELECT
        'PL003', 'PlayerProfile unique player',
        'UNIQUENESS', 'PlayerProfile', 'HIGH',
        'One row per playerId.'

    UNION ALL SELECT
        'PL004', 'Points arithmetic',
        'CONSISTENCY', '2_PlayerSeasonOffence', 'HIGH',
        'points must equal goals + assists.'

    UNION ALL SELECT
        'PL005', 'Offence to rate coverage',
        'COMPLETENESS', '3_PlayerSeasonOffenceRate', 'HIGH',
        'Every offence row must exist in the rate view.'

    UNION ALL SELECT
        'PL006', 'Valid season context',
        'VALIDITY', '2_PlayerSeasonOffence', 'HIGH',
        'Season and SeasonPart must be populated and valid.'

    UNION ALL SELECT
        'PL007', 'Required offence keys',
        'COMPLETENESS', '2_PlayerSeasonOffence', 'HIGH',
        'Required offence grain fields must be populated.'

    UNION ALL SELECT
        'PL008', 'PlayerProfile landing coverage',
        'COMPLETENESS', 'PlayerProfile', 'HIGH',
        'Every latest PlayerLanding player must exist in PlayerProfile.'

    UNION ALL SELECT
        'PL009', 'Boxscore source reconciliation',
        'RECONCILIATION', 'Boxscore', 'CRITICAL',
        'Agency Boxscore player-game population must reconcile to source Boxscore.'

    UNION ALL SELECT
        'PL010', 'Latest PlayerLanding uniqueness',
        'UNIQUENESS', 'PlayerLanding', 'HIGH',
        'Each player must have exactly one record at their latest PlayerLanding RunDate.'

    UNION ALL SELECT
        'PL011', 'Games played reconciliation',
        'RECONCILIATION', '3_PlayerSeasonOffenceRate', 'HIGH',
        'games_played must reconcile to distinct Boxscore games.'

    UNION ALL SELECT
        'PL012', 'TOI reconciliation',
        'RECONCILIATION', '3_PlayerSeasonOffenceRate', 'HIGH',
        'toi_minutes must reconcile to Boxscore TOI.'

    UNION ALL SELECT
        'PL013', 'Shifts reconciliation',
        'RECONCILIATION', '3_PlayerSeasonOffenceRate', 'MEDIUM',
        'shifts must reconcile to Boxscore shifts.'

    UNION ALL SELECT
        'PL014', 'Per-game calculations',
        'CALCULATION', '3_PlayerSeasonOffenceRate', 'HIGH',
        'Per-game metrics must reproduce from component measures.'

    UNION ALL SELECT
        'PL015', 'Per-60 calculations',
        'CALCULATION', '3_PlayerSeasonOffenceRate', 'HIGH',
        'Per-60 metrics must reproduce from offence and Boxscore TOI.'

    UNION ALL SELECT
        'PL016', 'Non-negative player measures',
        'VALIDITY', '3_PlayerSeasonOffenceRate', 'HIGH',
        'Counting and rate measures must not be negative.'

    UNION ALL SELECT
        'PL017', 'PlayerProfile required identity',
        'COMPLETENESS', 'PlayerProfile', 'HIGH',
        'PlayerProfile requires playerId and player_name.'

    UNION ALL SELECT
        'PL018', 'PlayerProfile landing reconciliation',
        'RECONCILIATION', 'PlayerProfile', 'HIGH',
        'Core PlayerProfile fields must reconcile to latest PlayerLanding.'

    UNION ALL SELECT
        'PL019', 'Valid PlayerProfile position',
        'VALIDITY', 'PlayerProfile', 'MEDIUM',
        'PlayerProfile position must use the expected position vocabulary.'

    UNION ALL SELECT
        'PL020', 'Regular-season career points arithmetic',
        'CONSISTENCY', 'PlayerProfile', 'HIGH',
        'Regular-season career points must equal goals + assists.'

    UNION ALL SELECT
        'PL021', 'Playoff career points arithmetic',
        'CONSISTENCY', 'PlayerProfile', 'HIGH',
        'Playoff career points must equal goals + assists.'

    UNION ALL SELECT
        'PL022', 'Active player team completeness',
        'COMPLETENESS', 'PlayerProfile', 'MEDIUM',
        'Active players should have current-team fields populated.'

    UNION ALL SELECT
        'PL023', 'Offence source reconciliation',
        'RECONCILIATION', '2_PlayerSeasonOffence', 'HIGH',
        'Goals and assists must reconcile to NHL-scoped 1_OffenceStats.'

    UNION ALL SELECT
        'PL024', 'Average TOI calculation',
        'CALCULATION', '3_PlayerSeasonOffenceRate', 'HIGH',
        'avg_toi_minutes must reconcile to Boxscore TOI and games played.'

    UNION ALL SELECT
        'PL025', 'Seconds per shift calculation',
        'CALCULATION', '3_PlayerSeasonOffenceRate', 'MEDIUM',
        'seconds_per_shift must reconcile to Boxscore TOI and shifts.'
),

failure_counts AS (

    SELECT
        test_id,
        COUNT(*) AS failure_count

    FROM failures

    GROUP BY test_id
)

SELECT
    v_run_id,
    v_run_datetime,
    t.test_id,
    t.test_name,
    t.category,
    'Player' AS source_dataset,
    t.source_object,
    NULL AS season,
    t.severity,

    CASE
        WHEN COALESCE(f.failure_count, 0) = 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS status,

    COALESCE(f.failure_count, 0) AS failure_count,

    t.description,

    CASE
        WHEN COALESCE(f.failure_count, 0) = 0
            THEN 'Test passed.'
        ELSE CONCAT(
            CAST(f.failure_count AS STRING),
            ' failing record(s).'
        )
    END AS details

FROM tests t

LEFT JOIN failure_counts f
    ON t.test_id = f.test_id;


-- ============================================================
-- RUN SUMMARY
-- ============================================================

SELECT
    test_id,
    test_name,
    severity,
    status,
    failure_count

FROM `pacey32-agency.QA.TestResults`

WHERE run_id = v_run_id

ORDER BY test_id;