-- ============================================================
-- PACEY32 AGENCY - CAP DATA QUALITY
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
-- LATEST PLAYERDETAIL
-- One latest record per player_url / contract_id
-- ============================================================

CREATE TEMP TABLE latest_player_detail AS

SELECT *
FROM `pacey32-agency.Cap.PlayerDetail`

QUALIFY ROW_NUMBER() OVER (
    PARTITION BY player_url, contract_id
    ORDER BY scrape_datetime DESC
) = 1;


-- ============================================================
-- CP001
-- Team unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CP001',
    'Team',
    NULL,
    team_slug,
    'Duplicate team_slug',
    TO_JSON(STRUCT(
        team_slug,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Cap.Team`

GROUP BY team_slug

HAVING COUNT(*) > 1;


-- ============================================================
-- CP002
-- Team count
-- ============================================================

INSERT INTO failures

SELECT
    'CP002',
    'Team',
    NULL,
    'NHL',
    'Expected exactly 32 NHL teams',
    TO_JSON(STRUCT(
        COUNT(*) AS actual_team_count,
        32 AS expected_team_count
    ))

FROM `pacey32-agency.Cap.Team`

HAVING COUNT(*) != 32;


-- ============================================================
-- CP003
-- Required Team fields
-- ============================================================

INSERT INTO failures

SELECT
    'CP003',
    'Team',
    NULL,
    COALESCE(team_slug, 'NULL'),
    'Required Team field is missing',
    TO_JSON(STRUCT(
        team_slug,
        team_name,
        url,
        last_updated
    ))

FROM `pacey32-agency.Cap.Team`

WHERE team_slug IS NULL
   OR TRIM(team_slug) = ''
   OR team_name IS NULL
   OR TRIM(team_name) = ''
   OR url IS NULL
   OR TRIM(url) = ''
   OR last_updated IS NULL;


-- ============================================================
-- CP004
-- Non-negative Team monetary values
-- ============================================================

INSERT INTO failures

SELECT
    'CP004',
    'Team',
    NULL,
    team_slug,
    'Team monetary measure is unexpectedly negative',
    TO_JSON(STRUCT(
        team_slug,
        projected_cap_hit,
        projected_cap_space,
        current_cap_space,
        deadline_cap_space,
        dead_cap_space,
        retained_salary_remaining
    ))

FROM `pacey32-agency.Cap.Team`

WHERE projected_cap_hit < 0
   OR dead_cap_space < 0
   OR retained_salary_remaining < 0;


-- ============================================================
-- CP005
-- Team roster/count validity
-- ============================================================

INSERT INTO failures

SELECT
    'CP005',
    'Team',
    NULL,
    team_slug,
    'Team roster/count measure is invalid',
    TO_JSON(STRUCT(
        team_slug,
        active_roster,
        contracts,
        average_age
    ))

FROM `pacey32-agency.Cap.Team`

WHERE active_roster < 0
   OR contracts < 0
   OR average_age < 0
   OR average_age > 50;


-- ============================================================
-- CP006
-- Player unique grain
-- ============================================================

INSERT INTO failures

SELECT
    'CP006',
    'Player',
    NULL,
    CONCAT(
        team_slug, '|',
        COALESCE(player_url, player), '|',
        CAST(year AS STRING), '|',
        season, '|',
        COALESCE(contract_section, 'NULL')
    ),
    'Duplicate Player contract-season grain',
    TO_JSON(STRUCT(
        team_slug,
        player,
        player_url,
        year,
        season,
        contract_section,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Cap.Player`

GROUP BY
    team_slug,
    player,
    player_url,
    year,
    season,
    contract_section

HAVING COUNT(*) > 1;


-- ============================================================
-- CP007
-- Player team coverage
-- ============================================================

INSERT INTO failures

SELECT
    'CP007',
    'Player',
    NULL,
    'NHL',
    'Player table does not contain exactly 32 teams',
    TO_JSON(STRUCT(
        COUNT(DISTINCT team_slug) AS actual_team_count,
        32 AS expected_team_count
    ))

FROM `pacey32-agency.Cap.Player`

HAVING COUNT(DISTINCT team_slug) != 32;


-- ============================================================
-- CP008
-- Player required fields
-- ============================================================

INSERT INTO failures

SELECT
    'CP008',
    'Player',
    NULL,
    CONCAT(
        COALESCE(team_slug, 'NULL'), '|',
        COALESCE(player, 'NULL'), '|',
        CAST(year AS STRING)
    ),
    'Required Player field is missing',
    TO_JSON(STRUCT(
        team_slug,
        team_name,
        player,
        year,
        season,
        source_url,
        scrape_datetime
    ))

FROM `pacey32-agency.Cap.Player`

WHERE team_slug IS NULL
   OR TRIM(team_slug) = ''
   OR team_name IS NULL
   OR TRIM(team_name) = ''
   OR player IS NULL
   OR TRIM(player) = ''
   OR year IS NULL
   OR season IS NULL
   OR TRIM(season) = ''
   OR source_url IS NULL
   OR TRIM(source_url) = ''
   OR scrape_datetime IS NULL;


-- ============================================================
-- CP009
-- Player year / season validity
-- ============================================================

INSERT INTO failures

SELECT
    'CP009',
    'Player',
    NULL,
    CONCAT(
        team_slug, '|',
        player, '|',
        CAST(year AS STRING)
    ),
    'Invalid Player year or season',
    TO_JSON(STRUCT(
        team_slug,
        player,
        year,
        season
    ))

FROM `pacey32-agency.Cap.Player`

WHERE year < 1
   OR NOT REGEXP_CONTAINS(
        season,
        r'^\d{4}-\d{2}$'
   );


-- ============================================================
-- CP010
-- Player contract section validity
-- ============================================================

INSERT INTO failures

SELECT
    'CP010',
    'Player',
    NULL,
    CONCAT(
        team_slug, '|',
        player, '|',
        CAST(year AS STRING)
    ),
    'Unexpected contract_section',
    TO_JSON(STRUCT(
        team_slug,
        player,
        contract_section
    ))

FROM `pacey32-agency.Cap.Player`

WHERE contract_section NOT IN (
    'Forwards',
    'Defence',
    'Goaltenders',
    'Non-roster Forwards',
    'Non-roster Defence',
    'Non-roster Goaltenders',
    'Buyout & Cap Charges',
    'Retained',
    'Buried'
)
OR contract_section IS NULL;


-- ============================================================
-- CP011
-- Player monetary validity
-- ============================================================

INSERT INTO failures

SELECT
    'CP011',
    'Player',
    NULL,
    CONCAT(
        team_slug, '|',
        player, '|',
        CAST(year AS STRING)
    ),
    'Negative contract monetary value',
    TO_JSON(STRUCT(
        team_slug,
        player,
        year,
        cap_hit,
        aav,
        total_salary,
        signing_bonus,
        performance_bonus_amount
    ))

FROM `pacey32-agency.Cap.Player`

WHERE cap_hit < 0
   OR aav < 0
   OR total_salary < 0
   OR signing_bonus < 0
   OR performance_bonus_amount < 0;


-- ============================================================
-- CP012
-- Latest PlayerDetail unique grain
-- ============================================================

INSERT INTO failures

WITH latest AS (

    SELECT *
    FROM `pacey32-agency.Cap.PlayerDetail`

    QUALIFY scrape_datetime = MAX(scrape_datetime) OVER (
        PARTITION BY player_url, contract_id
    )

)

SELECT
    'CP012',
    'PlayerDetail',
    NULL,
    CONCAT(
        COALESCE(player_url, 'NULL'),
        '|',
        CAST(contract_id AS STRING)
    ),
    'Multiple records exist at latest scrape for contract',
    TO_JSON(STRUCT(
        player_url,
        contract_id,
        COUNT(*) AS cnt
    ))

FROM latest

GROUP BY
    player_url,
    contract_id

HAVING COUNT(*) > 1;


-- ============================================================
-- CP013
-- PlayerDetail required contract identifiers
-- ============================================================

INSERT INTO failures

SELECT
    'CP013',
    'PlayerDetail',
    NULL,
    CONCAT(
        COALESCE(player_url, 'NULL'),
        '|',
        COALESCE(CAST(contract_id AS STRING), 'NULL')
    ),
    'Required contract identifier is missing',
    TO_JSON(STRUCT(
        player,
        player_url,
        contract_id,
        contract_number
    ))

FROM latest_player_detail

WHERE player_url IS NULL
   OR TRIM(player_url) = ''
   OR contract_id IS NULL;


-- ============================================================
-- CP014
-- Exactly one current contract per PlayerDetail player
-- ============================================================

INSERT INTO failures

SELECT
    'CP014',
    'PlayerDetail',
    NULL,
    player_url,
    'Player does not have exactly one current contract',
    TO_JSON(STRUCT(
        ANY_VALUE(player) AS player,
        player_url,
        COUNTIF(current_contract = TRUE)
            AS current_contract_count,
        COUNT(*) AS total_contracts
    ))

FROM latest_player_detail

GROUP BY player_url

HAVING COUNTIF(current_contract = TRUE) != 1;


-- ============================================================
-- CP015
-- Contract term validity
-- Historical contracts may exceed modern NHL limits.
-- ============================================================

INSERT INTO failures

SELECT
    'CP015',
    'PlayerDetail',
    NULL,
    CONCAT(
        player_url,
        '|',
        CAST(contract_id AS STRING)
    ),
    'Contract term must be at least one year',
    TO_JSON(STRUCT(
        player,
        contract_id,
        term
    ))

FROM latest_player_detail

WHERE term IS NULL
   OR term < 1;


-- ============================================================
-- CP016
-- Contract monetary validity
-- ============================================================

INSERT INTO failures

SELECT
    'CP016',
    'PlayerDetail',
    NULL,
    CONCAT(
        player_url,
        '|',
        CAST(contract_id AS STRING)
    ),
    'Negative contract monetary value',
    TO_JSON(STRUCT(
        player,
        contract_id,
        cap_hit,
        total_value
    ))

FROM latest_player_detail

WHERE cap_hit < 0
   OR total_value < 0;


-- ============================================================
-- CP017
-- Contract total-value arithmetic
--
-- cap_hit is integer-rounded, so allow up to term dollars
-- difference from cap_hit * term.
-- ============================================================

INSERT INTO failures

SELECT
    'CP017',
    'PlayerDetail',
    NULL,
    CONCAT(
        player_url,
        '|',
        CAST(contract_id AS STRING)
    ),
    'Contract total value does not reconcile to cap hit and term',
    TO_JSON(STRUCT(
        player,
        contract_id,
        term,
        cap_hit,
        total_value,
        cap_hit * term AS expected_total_value,
        total_value - (cap_hit * term) AS difference
    ))

FROM latest_player_detail

WHERE term IS NOT NULL
  AND cap_hit IS NOT NULL
  AND total_value IS NOT NULL
  AND ABS(
      total_value - (cap_hit * term)
  ) > term;


-- ============================================================
-- CP018
-- Required annual cap-hit fields
-- Validate only the eight years represented by schema.
-- ============================================================

INSERT INTO failures

SELECT
    'CP018',
    'PlayerDetail',
    NULL,
    CONCAT(
        player_url,
        '|',
        CAST(contract_id AS STRING)
    ),
    'Required annual cap-hit field is missing',
    TO_JSON(STRUCT(
        player,
        contract_id,
        term,
        cap_hit_yr1,
        cap_hit_yr2,
        cap_hit_yr3,
        cap_hit_yr4,
        cap_hit_yr5,
        cap_hit_yr6,
        cap_hit_yr7,
        cap_hit_yr8
    ))

FROM latest_player_detail

WHERE (term >= 1 AND cap_hit_yr1 IS NULL)
   OR (term >= 2 AND cap_hit_yr2 IS NULL)
   OR (term >= 3 AND cap_hit_yr3 IS NULL)
   OR (term >= 4 AND cap_hit_yr4 IS NULL)
   OR (term >= 5 AND cap_hit_yr5 IS NULL)
   OR (term >= 6 AND cap_hit_yr6 IS NULL)
   OR (term >= 7 AND cap_hit_yr7 IS NULL)
   OR (term >= 8 AND cap_hit_yr8 IS NULL);

-- ============================================================
-- CP020
-- Season range validity when populated
-- ============================================================

INSERT INTO failures

SELECT
    'CP020',
    'PlayerDetail',
    NULL,
    CONCAT(
        player_url,
        '|',
        CAST(contract_id AS STRING)
    ),
    'Invalid populated contract season range',
    TO_JSON(STRUCT(
        player,
        contract_id,
        season_from,
        season_to,
        term
    ))

FROM latest_player_detail

WHERE (
        season_from IS NOT NULL
        AND NOT REGEXP_CONTAINS(
            season_from,
            r'^\d{4}-\d{2}$'
        )
      )
   OR (
        season_to IS NOT NULL
        AND NOT REGEXP_CONTAINS(
            season_to,
            r'^\d{4}-\d{2}$'
        )
      )
   OR (
        season_from IS NOT NULL
        AND season_to IS NOT NULL
        AND SAFE_CAST(
            SUBSTR(season_to, 1, 4)
            AS INT64
        )
        <
        SAFE_CAST(
            SUBSTR(season_from, 1, 4)
            AS INT64
        )
      );


-- ============================================================
-- CP021
-- PlayerReference unique NHL player
-- ============================================================

INSERT INTO failures

SELECT
    'CP021',
    'PlayerReference',
    NULL,
    CAST(playerId AS STRING),
    'Duplicate NHL player in PlayerReference',
    TO_JSON(STRUCT(
        playerId,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Cap.PlayerReference`

GROUP BY playerId

HAVING COUNT(*) > 1;


-- ============================================================
-- CP022
-- PlayerReference valid match type
-- NULL is allowed for unmatched players.
-- ============================================================

INSERT INTO failures

SELECT
    'CP022',
    'PlayerReference',
    NULL,
    CAST(playerId AS STRING),
    'Unexpected PlayerReference match_type',
    TO_JSON(STRUCT(
        playerId,
        nhl_player,
        puckpedia_player,
        match_type
    ))

FROM `pacey32-agency.Cap.PlayerReference`

WHERE match_type IS NOT NULL
  AND match_type NOT IN (
      'Exact',
      'Normalised'
  );


-- ============================================================
-- CP023
-- Matched PlayerReference requires PuckPedia identifiers
-- ============================================================

INSERT INTO failures

SELECT
    'CP023',
    'PlayerReference',
    NULL,
    CAST(playerId AS STRING),
    'Matched PlayerReference is missing PuckPedia fields',
    TO_JSON(STRUCT(
        playerId,
        nhl_player,
        puckpedia_player,
        player_url,
        match_type
    ))

FROM `pacey32-agency.Cap.PlayerReference`

WHERE match_type IS NOT NULL
  AND (
      puckpedia_player IS NULL
      OR TRIM(puckpedia_player) = ''
      OR player_url IS NULL
      OR TRIM(player_url) = ''
  );


-- ============================================================
-- CP024
-- PlayerReference matching logic
-- ============================================================

INSERT INTO failures

SELECT
    'CP024',
    'PlayerReference',
    NULL,
    CAST(playerId AS STRING),
    'PlayerReference match_type does not agree with names',
    TO_JSON(STRUCT(
        playerId,
        nhl_player,
        puckpedia_player,
        match_type
    ))

FROM `pacey32-agency.Cap.PlayerReference`

WHERE
    (
        match_type = 'Exact'
        AND nhl_player != puckpedia_player
    )
    OR
    (
        match_type = 'Normalised'
        AND LOWER(
            REGEXP_REPLACE(
                NORMALIZE(nhl_player, NFD),
                r'\pM',
                ''
            )
        )
        !=
        LOWER(
            REGEXP_REPLACE(
                NORMALIZE(puckpedia_player, NFD),
                r'\pM',
                ''
            )
        )
    );


-- ============================================================
-- CP025
-- PlayerReference coverage
--
-- Unmatched players are not necessarily bad records
-- (e.g. unsigned/RFA players), therefore WARN severity later.
-- ============================================================

INSERT INTO failures

SELECT
    'CP025',
    'PlayerReference',
    NULL,
    CAST(playerId AS STRING),
    'NHL player is not matched to PuckPedia',
    TO_JSON(STRUCT(
        playerId,
        nhl_player,
        puckpedia_player,
        player_url
    ))

FROM `pacey32-agency.Cap.PlayerReference`

WHERE match_type IS NULL;


-- ============================================================
-- CP026
-- TeamSalaryCapContracts unique current player
-- ============================================================

INSERT INTO failures

SELECT
    'CP026',
    'TeamSalaryCapContracts',
    NULL,
    player_url,
    'Duplicate player in current-contract view',
    TO_JSON(STRUCT(
        player_url,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapContracts`

GROUP BY player_url

HAVING COUNT(*) > 1;


-- ============================================================
-- CP027
-- TeamSalaryCapContracts reconciliation to PlayerDetail
-- ============================================================

INSERT INTO failures

SELECT
    'CP027',
    'TeamSalaryCapContracts',
    NULL,
    d.player_url,
    'Current PlayerDetail contract missing from current-contract view',
    TO_JSON(STRUCT(
        d.player,
        d.player_url,
        d.contract_id,
        d.team,
        d.cap_hit,
        d.term
    ))

FROM latest_player_detail d

LEFT JOIN `pacey32-agency.Cap.TeamSalaryCapContracts` c
    ON d.player_url = c.player_url

WHERE d.current_contract = TRUE
  AND c.player_url IS NULL;


-- ============================================================
-- CP028
-- TeamSalaryCapContracts years_to_expiry calculation
-- ============================================================

INSERT INTO failures

SELECT
    'CP028',
    'TeamSalaryCapContracts',
    NULL,
    player_url,
    'years_to_expiry calculation is incorrect',
    TO_JSON(STRUCT(
        player,
        player_url,
        expiry_year,
        years_to_expiry,
        expiry_year - EXTRACT(YEAR FROM CURRENT_DATE())
            AS expected_years_to_expiry
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapContracts`

WHERE
    COALESCE(years_to_expiry, -999999)
    !=
    COALESCE(
        expiry_year - EXTRACT(YEAR FROM CURRENT_DATE()),
        -999999
    );


-- ============================================================
-- CP029
-- TeamSalaryCapFuture unique team-season
-- ============================================================

INSERT INTO failures

SELECT
    'CP029',
    'TeamSalaryCapFuture',
    year,
    CONCAT(
        team_slug, '|',
        CAST(year AS STRING)
    ),
    'Duplicate team-season in future cap view',
    TO_JSON(STRUCT(
        team_slug,
        year,
        season,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapFuture`

GROUP BY
    team_slug,
    year,
    season

HAVING COUNT(*) > 1;


-- ============================================================
-- CP030
-- TeamSalaryCapFuture 32-team coverage
-- ============================================================

INSERT INTO failures

SELECT
    'CP030',
    'TeamSalaryCapFuture',
    year,
    CAST(year AS STRING),
    'Future cap season does not contain exactly 32 teams',
    TO_JSON(STRUCT(
        year,
        ANY_VALUE(season) AS season,
        COUNT(DISTINCT team_slug) AS actual_team_count,
        32 AS expected_team_count
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapFuture`

GROUP BY year

HAVING COUNT(DISTINCT team_slug) != 32;


-- ============================================================
-- CP031
-- TeamSalaryCapFuture component arithmetic
-- ============================================================

INSERT INTO failures

SELECT
    'CP031',
    'TeamSalaryCapFuture',
    year,
    CONCAT(
        team_slug, '|',
        CAST(year AS STRING)
    ),
    'Future cap component arithmetic is incorrect',
    TO_JSON(STRUCT(
        team_slug,
        year,
        forward_cap,
        defense_cap,
        goalie_cap,
        non_roster_cap,
        roster_cap,
        total_contract_cap
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapFuture`

WHERE roster_cap
      != forward_cap + defense_cap + goalie_cap

   OR total_contract_cap
      != roster_cap + non_roster_cap;


-- ============================================================
-- CP032
-- TeamSalaryCapFuture reconciliation to Player
-- ============================================================

INSERT INTO failures

WITH expected AS (

    SELECT
        team_slug,
        year,

        SUM(
            CASE
                WHEN contract_section = 'Forwards'
                THEN cap_hit
                ELSE 0
            END
        ) AS forward_cap,

        SUM(
            CASE
                WHEN contract_section = 'Defence'
                THEN cap_hit
                ELSE 0
            END
        ) AS defense_cap,

        SUM(
            CASE
                WHEN contract_section = 'Goaltenders'
                THEN cap_hit
                ELSE 0
            END
        ) AS goalie_cap,

        SUM(
            CASE
                WHEN contract_section NOT IN (
                    'Forwards',
                    'Defence',
                    'Goaltenders'
                )
                THEN cap_hit
                ELSE 0
            END
        ) AS non_roster_cap,

        SUM(cap_hit) AS total_contract_cap

    FROM `pacey32-agency.Cap.Player`

    GROUP BY
        team_slug,
        year
)

SELECT
    'CP032',
    'TeamSalaryCapFuture',
    f.year,
    CONCAT(
        f.team_slug, '|',
        CAST(f.year AS STRING)
    ),
    'Future cap aggregation does not reconcile to Player',
    TO_JSON(STRUCT(
        f.team_slug,
        f.year,

        f.forward_cap AS actual_forward_cap,
        e.forward_cap AS expected_forward_cap,

        f.defense_cap AS actual_defense_cap,
        e.defense_cap AS expected_defense_cap,

        f.goalie_cap AS actual_goalie_cap,
        e.goalie_cap AS expected_goalie_cap,

        f.non_roster_cap AS actual_non_roster_cap,
        e.non_roster_cap AS expected_non_roster_cap,

        f.total_contract_cap AS actual_total_contract_cap,
        e.total_contract_cap AS expected_total_contract_cap
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapFuture` f

LEFT JOIN expected e
    ON f.team_slug = e.team_slug
    AND f.year = e.year

WHERE
    COALESCE(f.forward_cap, -1)
        != COALESCE(e.forward_cap, -1)

    OR COALESCE(f.defense_cap, -1)
        != COALESCE(e.defense_cap, -1)

    OR COALESCE(f.goalie_cap, -1)
        != COALESCE(e.goalie_cap, -1)

    OR COALESCE(f.non_roster_cap, -1)
        != COALESCE(e.non_roster_cap, -1)

    OR COALESCE(f.total_contract_cap, -1)
        != COALESCE(e.total_contract_cap, -1);


-- ============================================================
-- CP033
-- TeamSalaryCapSummary unique team
-- ============================================================

INSERT INTO failures

SELECT
    'CP033',
    'TeamSalaryCapSummary',
    NULL,
    team_slug,
    'Duplicate team in salary-cap summary',
    TO_JSON(STRUCT(
        team_slug,
        COUNT(*) AS cnt
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapSummary`

GROUP BY team_slug

HAVING COUNT(*) > 1;


-- ============================================================
-- CP034
-- TeamSalaryCapSummary 32-team coverage
-- ============================================================

INSERT INTO failures

SELECT
    'CP034',
    'TeamSalaryCapSummary',
    NULL,
    'NHL',
    'Salary-cap summary does not contain exactly 32 teams',
    TO_JSON(STRUCT(
        COUNT(*) AS actual_team_count,
        COUNT(DISTINCT team_slug) AS distinct_team_count,
        32 AS expected_team_count
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapSummary`

HAVING COUNT(*) != 32
    OR COUNT(DISTINCT team_slug) != 32;


-- ============================================================
-- CP035
-- Cap ceiling calculation
-- ============================================================

INSERT INTO failures

SELECT
    'CP035',
    'TeamSalaryCapSummary',
    NULL,
    team_slug,
    'cap_ceiling calculation is incorrect',
    TO_JSON(STRUCT(
        team_slug,
        cap_ceiling,
        projected_cap_hit,
        projected_cap_space,
        projected_cap_hit + projected_cap_space
            AS expected_cap_ceiling
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapSummary`

WHERE
    COALESCE(cap_ceiling, -1)
    !=
    COALESCE(
        projected_cap_hit + projected_cap_space,
        -1
    );


-- ============================================================
-- CP036
-- Cap utilisation calculation
-- ============================================================

INSERT INTO failures

SELECT
    'CP036',
    'TeamSalaryCapSummary',
    NULL,
    team_slug,
    'cap_utilisation_pct calculation is incorrect',
    TO_JSON(STRUCT(
        team_slug,
        cap_utilisation_pct,
        SAFE_DIVIDE(
            projected_cap_hit,
            cap_ceiling
        ) * 100 AS expected_cap_utilisation_pct
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapSummary`

WHERE ABS(
    COALESCE(cap_utilisation_pct, -999999)
    -
    COALESCE(
        SAFE_DIVIDE(
            projected_cap_hit,
            cap_ceiling
        ) * 100,
        -999999
    )
) > 0.000001;


-- ============================================================
-- CP037
-- Positional cap percentage calculations
-- ============================================================

INSERT INTO failures

SELECT
    'CP037',
    'TeamSalaryCapSummary',
    NULL,
    team_slug,
    'Positional cap percentage calculation is incorrect',
    TO_JSON(STRUCT(
        team_slug,

        forward_cap_pct,
        SAFE_DIVIDE(
            forward_cap,
            cap_ceiling
        ) * 100 AS expected_forward_cap_pct,

        defense_cap_pct,
        SAFE_DIVIDE(
            defense_cap,
            cap_ceiling
        ) * 100 AS expected_defense_cap_pct,

        goalie_cap_pct,
        SAFE_DIVIDE(
            goalie_cap,
            cap_ceiling
        ) * 100 AS expected_goalie_cap_pct
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapSummary`

WHERE ABS(
    COALESCE(forward_cap_pct, -999999)
    -
    COALESCE(
        SAFE_DIVIDE(forward_cap, cap_ceiling) * 100,
        -999999
    )
) > 0.000001

OR ABS(
    COALESCE(defense_cap_pct, -999999)
    -
    COALESCE(
        SAFE_DIVIDE(defense_cap, cap_ceiling) * 100,
        -999999
    )
) > 0.000001

OR ABS(
    COALESCE(goalie_cap_pct, -999999)
    -
    COALESCE(
        SAFE_DIVIDE(goalie_cap, cap_ceiling) * 100,
        -999999
    )
) > 0.000001;


-- ============================================================
-- CP038
-- TeamSalaryCapSummary reconciliation to Team
-- ============================================================

INSERT INTO failures

SELECT
    'CP038',
    'TeamSalaryCapSummary',
    NULL,
    s.team_slug,
    'Salary-cap summary does not reconcile to Team',
    TO_JSON(STRUCT(
        s.team_slug,

        s.projected_cap_hit
            AS summary_projected_cap_hit,
        t.projected_cap_hit
            AS team_projected_cap_hit,

        s.projected_cap_space
            AS summary_projected_cap_space,
        t.projected_cap_space
            AS team_projected_cap_space,

        s.current_cap_space
            AS summary_current_cap_space,
        t.current_cap_space
            AS team_current_cap_space,

        s.dead_cap_space
            AS summary_dead_cap_space,
        t.dead_cap_space
            AS team_dead_cap_space,

        s.active_roster
            AS summary_active_roster,
        t.active_roster
            AS team_active_roster,

        s.average_age
            AS summary_average_age,
        t.average_age
            AS team_average_age
    ))

FROM `pacey32-agency.Cap.TeamSalaryCapSummary` s

LEFT JOIN `pacey32-agency.Cap.Team` t
    ON s.team_slug = t.team_slug

WHERE t.team_slug IS NULL

   OR COALESCE(s.projected_cap_hit, -1)
      != COALESCE(t.projected_cap_hit, -1)

   OR COALESCE(s.projected_cap_space, -1)
      != COALESCE(t.projected_cap_space, -1)

   OR COALESCE(s.current_cap_space, -1)
      != COALESCE(t.current_cap_space, -1)

   OR COALESCE(s.dead_cap_space, -1)
      != COALESCE(t.dead_cap_space, -1)

   OR COALESCE(s.active_roster, -1)
      != COALESCE(t.active_roster, -1)

   OR COALESCE(s.average_age, -1)
      != COALESCE(t.average_age, -1);


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
    'CP001' AS test_id,
    'Team unique grain' AS test_name,
    'UNIQUENESS' AS category,
    'Team' AS source_object,
    'HIGH' AS severity,
    'One row per team_slug.' AS description

UNION ALL SELECT
    'CP002', 'NHL team count',
    'COMPLETENESS', 'Team', 'CRITICAL',
    'Cap Team must contain exactly 32 NHL teams.'

UNION ALL SELECT
    'CP003', 'Team required fields',
    'COMPLETENESS', 'Team', 'HIGH',
    'Core Team identifiers and source metadata must be populated.'

UNION ALL SELECT
    'CP004', 'Team monetary validity',
    'VALIDITY', 'Team', 'HIGH',
    'Cap hit, dead cap and retained salary must not be negative; cap-space measures may legitimately be negative.'

UNION ALL SELECT
    'CP005', 'Team roster validity',
    'VALIDITY', 'Team', 'MEDIUM',
    'Team roster counts and average age must be plausible.'

UNION ALL SELECT
    'CP006', 'Player unique grain',
    'UNIQUENESS', 'Player', 'HIGH',
    'Player contract-season rows must be unique at their intended grain.'

UNION ALL SELECT
    'CP007', 'Player team coverage',
    'COMPLETENESS', 'Player', 'HIGH',
    'Player contract data must cover all 32 NHL teams.'

UNION ALL SELECT
    'CP008', 'Player required fields',
    'COMPLETENESS', 'Player', 'HIGH',
    'Core Player contract fields must be populated.'

UNION ALL SELECT
    'CP009', 'Player season validity',
    'VALIDITY', 'Player', 'HIGH',
    'Player year and season values must be valid.'

UNION ALL SELECT
    'CP010', 'Contract section validity',
    'VALIDITY', 'Player', 'MEDIUM',
    'Player contract_section must use the expected PuckPedia categories.'

UNION ALL SELECT
    'CP011', 'Player monetary validity',
    'VALIDITY', 'Player', 'HIGH',
    'Player contract monetary measures must not be negative.'

UNION ALL SELECT
    'CP012', 'Latest PlayerDetail uniqueness',
    'UNIQUENESS', 'PlayerDetail', 'HIGH',
    'Each player_url / contract_id must have one latest record.'

UNION ALL SELECT
    'CP013', 'PlayerDetail contract identifiers',
    'COMPLETENESS', 'PlayerDetail', 'HIGH',
    'Latest contract records require player_url and contract_id.'

UNION ALL SELECT
    'CP014', 'Current contract uniqueness',
    'CONSISTENCY', 'PlayerDetail', 'HIGH',
    'Each PlayerDetail player must have exactly one current contract.'

UNION ALL SELECT
    'CP015', 'Contract term validity',
    'VALIDITY', 'PlayerDetail', 'HIGH',
    'Contract term must be at least one year.'

UNION ALL SELECT
    'CP016', 'Contract monetary validity',
    'VALIDITY', 'PlayerDetail', 'HIGH',
    'Contract cap hit and total value must not be negative.'

UNION ALL SELECT
    'CP017', 'Contract total-value arithmetic',
    'CALCULATION', 'PlayerDetail', 'HIGH',
    'Total value must reconcile to integer cap hit and term within rounding tolerance.'

UNION ALL SELECT
    'CP018', 'Annual cap-hit completeness',
    'COMPLETENESS', 'PlayerDetail', 'MEDIUM',
    'Annual cap-hit fields required by the contract term must be populated.'

UNION ALL SELECT
    'CP020', 'Contract season validity',
    'VALIDITY', 'PlayerDetail', 'MEDIUM',
    'Populated contract season ranges must have valid format and ordering.'

UNION ALL SELECT
    'CP021', 'PlayerReference unique player',
    'UNIQUENESS', 'PlayerReference', 'HIGH',
    'Each NHL playerId must appear once in PlayerReference.'

UNION ALL SELECT
    'CP022', 'PlayerReference match type',
    'VALIDITY', 'PlayerReference', 'MEDIUM',
    'Match type must be Exact, Normalised or NULL.'

UNION ALL SELECT
    'CP023', 'PlayerReference matched fields',
    'COMPLETENESS', 'PlayerReference', 'HIGH',
    'Matched players require PuckPedia player name and URL.'

UNION ALL SELECT
    'CP024', 'PlayerReference match logic',
    'CONSISTENCY', 'PlayerReference', 'HIGH',
    'PlayerReference match classifications must agree with player names.'

UNION ALL SELECT
    'CP025', 'PlayerReference match coverage',
    'COMPLETENESS', 'PlayerReference', 'MEDIUM',
    'Monitor NHL players that currently have no PuckPedia match.'

UNION ALL SELECT
    'CP026', 'Current-contract view uniqueness',
    'UNIQUENESS', 'TeamSalaryCapContracts', 'HIGH',
    'Current-contract view must contain one row per player_url.'

UNION ALL SELECT
    'CP027', 'Current-contract reconciliation',
    'RECONCILIATION', 'TeamSalaryCapContracts', 'HIGH',
    'Current PlayerDetail contracts must appear in TeamSalaryCapContracts.'

UNION ALL SELECT
    'CP028', 'Years-to-expiry calculation',
    'CALCULATION', 'TeamSalaryCapContracts', 'MEDIUM',
    'years_to_expiry must reconcile to expiry_year and the current year.'

UNION ALL SELECT
    'CP029', 'Future cap unique grain',
    'UNIQUENESS', 'TeamSalaryCapFuture', 'HIGH',
    'Future cap data must contain one row per team and year.'

UNION ALL SELECT
    'CP030', 'Future cap team coverage',
    'COMPLETENESS', 'TeamSalaryCapFuture', 'HIGH',
    'Every future cap season must contain all 32 NHL teams.'

UNION ALL SELECT
    'CP031', 'Future cap component arithmetic',
    'CALCULATION', 'TeamSalaryCapFuture', 'HIGH',
    'Roster and total contract cap must equal their component measures.'

UNION ALL SELECT
    'CP032', 'Future cap source reconciliation',
    'RECONCILIATION', 'TeamSalaryCapFuture', 'HIGH',
    'Future cap aggregations must reconcile directly to Cap.Player.'

UNION ALL SELECT
    'CP033', 'Cap summary unique team',
    'UNIQUENESS', 'TeamSalaryCapSummary', 'HIGH',
    'TeamSalaryCapSummary must contain one row per team.'

UNION ALL SELECT
    'CP034', 'Cap summary team coverage',
    'COMPLETENESS', 'TeamSalaryCapSummary', 'CRITICAL',
    'TeamSalaryCapSummary must contain exactly 32 NHL teams.'

UNION ALL SELECT
    'CP035', 'Cap ceiling calculation',
    'CALCULATION', 'TeamSalaryCapSummary', 'HIGH',
    'Cap ceiling must equal projected cap hit plus projected cap space.'

UNION ALL SELECT
    'CP036', 'Cap utilisation calculation',
    'CALCULATION', 'TeamSalaryCapSummary', 'HIGH',
    'Cap utilisation percentage must reconcile to projected cap hit and cap ceiling.'

UNION ALL SELECT
    'CP037', 'Positional cap percentages',
    'CALCULATION', 'TeamSalaryCapSummary', 'HIGH',
    'Forward, defence and goalie cap percentages must reconcile to cap ceiling.'

UNION ALL SELECT
    'CP038', 'Cap summary source reconciliation',
    'RECONCILIATION', 'TeamSalaryCapSummary', 'CRITICAL',
    'TeamSalaryCapSummary core measures must reconcile directly to Cap.Team.';


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

    'Cap',

    m.source_object,

    NULL,

    m.severity,

    CASE
        WHEN COUNT(f.test_id) = 0
            THEN 'PASS'

        WHEN m.test_id IN ('CP018', 'CP025')
            THEN 'WARN'

        ELSE 'FAIL'
    END AS status,

    COUNT(f.test_id) AS failure_count,

    m.description,

    CASE
        WHEN COUNT(f.test_id) = 0
            THEN 'Test passed.'

        WHEN m.test_id = 'CP018'
            THEN CONCAT(
                CAST(COUNT(f.test_id) AS STRING),
                ' contracts with incomplete annual cap-hit data.'
            )

        WHEN m.test_id = 'CP025'
            THEN CONCAT(
                CAST(COUNT(f.test_id) AS STRING),
                ' unmatched NHL players.'
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