from google.cloud import bigquery

PROJECT_ID = "pacey32-agency"
DATASET_ID = "LLM"

client = bigquery.Client(
    project=PROJECT_ID
)


def create_dataset():
    dataset_id = (
        f"{PROJECT_ID}.{DATASET_ID}"
    )

    dataset = bigquery.Dataset(
        dataset_id
    )

    dataset.location = "US"

    client.create_dataset(
        dataset,
        exists_ok=True,
    )

    print(
        f"Dataset ready: {dataset_id}"
    )


def create_player_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.Player` AS

    SELECT
        playerId,
        player_name AS playerName,
        is_active AS isActive,

        current_team_id AS teamId,
        team_code AS teamCode,
        team_name AS teamName,
        team_logo AS teamLogo,

        sweater_number AS sweaterNumber,
        position,
        shoots_catches AS shootsCatches,

        height_inches AS heightInches,
        height_cm AS heightCm,
        weight_lbs AS weightLbs,
        weight_kg AS weightKg,

        birth_date AS birthDate,
        age,
        birth_city AS birthCity,
        birth_country AS birthCountry,
        nationality,

        draft_year AS draftYear,
        draft_team AS draftTeam,
        draft_round AS draftRound,
        draft_pick_in_round AS draftPickInRound,
        draft_overall AS draftOverall,

        headshot,
        hero_image AS heroImage,
        top_100_all_time AS top100AllTime,
        hall_of_fame AS hallOfFame,

        rs_games AS careerGames,
        rs_goals AS careerGoals,
        rs_assists AS careerAssists,
        rs_points AS careerPoints,

        po_games AS playoffGames,
        po_goals AS playoffGoals,
        po_assists AS playoffAssists,
        po_points AS playoffPoints,

        RunDate AS runDate

    FROM
        `{PROJECT_ID}.Player.PlayerProfile`
    """

    client.query(sql).result()

    print("View ready: LLM.Player")

def create_player_performance_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.PlayerPerformance` AS

    SELECT *
    FROM
        `{PROJECT_ID}.Comparison.09_PlayerCurrentSnapshot`
    """

    client.query(sql).result()

    print("View ready: LLM.PlayerPerformance")

def create_player_comparables_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.PlayerComparables` AS

    SELECT *
    FROM
        `{PROJECT_ID}.Comparison.11_ComparablePlayers_v3`
    """

    client.query(sql).result()

    print("View ready: LLM.PlayerComparables")

def create_player_contracts_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.PlayerContracts` AS

    SELECT
        playerID AS playerId,
        player AS playerName,

        contract_id AS contractId,
        contract_number AS contractNumber,

        team AS signingTeam,
        signing_team_slug AS signingTeamSlug,

        contract_type AS contractType,
        signed_date AS signedDate,
        signing_year AS signingYear,
        signing_status AS signingStatus,
        signing_age AS signingAge,

        expiry_status AS expiryStatus,
        expiry_age AS expiryAge,

        term,
        season_from AS seasonFrom,
        season_to AS seasonTo,

        cap_hit AS capHit,
        total_value AS totalValue,
        cap_pct_at_signing AS capPctAtSigning,

        signing_gm AS signingGM,
        signing_agent AS signingAgent,
        offer_sheet AS offerSheet,

        latest_completed_season AS latestCompletedSeason,

        last1_season AS lastSeason,
        last1_games AS lastSeasonGames,
        last1_goals AS lastSeasonGoals,
        last1_assists AS lastSeasonAssists,
        last1_points AS lastSeasonPoints,
        last1_points_per_game AS lastSeasonPPG,
        last1_avg_toi_minutes AS lastSeasonAvgTOI,
        last1_points_per_60 AS lastSeasonPointsPer60,

        points_per_game_change_1yr AS ppgChange1Yr,
        points_per_game_change_2yr AS ppgChange2Yr,
        avg_toi_change_1yr AS avgTOIChange1Yr,
        avg_toi_change_2yr AS avgTOIChange2Yr

    FROM
        `{PROJECT_ID}.Comparison.14_ContractPerformance`

    WHERE
        player_mapped = TRUE
    """

    client.query(sql).result()

    print("View ready: LLM.PlayerContracts")


def create_team_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.Team` AS

    SELECT
        id AS teamId,
        franchiseId,
        triCode AS teamCode,
        fullName AS teamName,

        venue,
        venueLocation,

        home_name AS homeName,
        HomeTeamPlaceName AS homeTeamPlaceName,
        home_logo AS teamLogo,

        conferenceName,
        conferenceAbbrev,
        divisionName,
        divisionAbbrev

    FROM
        `{PROJECT_ID}.Team.TeamList`
    """

    client.query(sql).result()

    print("View ready: LLM.Team")


def create_team_roster_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.TeamRoster` AS

    SELECT
        t.id AS teamId,

        r.team_code AS teamCode,
        r.team_name AS teamName,

        r.playerId,
        r.player AS playerName,
        r.position,

        r.depth_chart_position AS depthChartPosition,
        r.depth_chart_line AS depthChartLine,
        r.depth_group AS depthGroup,

        r.leadership_role AS leadershipRole,
        r.sweater_number AS sweaterNumber,
        r.age,

        r.cap_hit AS capHit,
        r.term,
        r.total_value AS totalValue,
        r.expiry_status AS expiryStatus,
        r.expiry_year AS expiryYear,

        r.agent,
        r.is_depth_chart AS isDepthChart

    FROM
        `{PROJECT_ID}.Team.TeamDepthChart` r

    LEFT JOIN
        `{PROJECT_ID}.Team.TeamList` t
        ON r.team_code = t.triCode
    """

    client.query(sql).result()

    print("View ready: LLM.TeamRoster")


def create_team_cap_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.TeamCap` AS

    SELECT
        t.id AS teamId,
        t.triCode AS teamCode,
        c.team_name AS teamName,

        c.projected_cap_hit AS projectedCapHit,
        c.projected_cap_space AS projectedCapSpace,
        c.current_cap_space AS currentCapSpace,
        c.deadline_cap_space AS deadlineCapSpace,
        c.dead_cap_space AS deadCapSpace,

        c.active_roster AS activeRoster,
        c.retained_salary_remaining AS retainedSalaryRemaining,
        c.contracts,

        c.draft_pick_value_2027 AS draftPickValue2027,
        c.average_age AS averageAge,

        c.forwards,
        c.defense,
        c.goalies,

        c.last_updated AS lastUpdated

    FROM
        `{PROJECT_ID}.Cap.Team` c

    LEFT JOIN `{PROJECT_ID}.Team.TeamList` t
        ON LOWER(c.team_name) = LOWER(t.fullName)
        OR (
            c.team_name = 'Montreal Canadiens'
            AND t.fullName = 'Montréal Canadiens'
        )
        OR (
            c.team_name = 'St Louis Blues'
            AND t.fullName = 'St. Louis Blues'
        )
    """

    client.query(sql).result()

    print("View ready: LLM.TeamCap")

def create_team_organisation_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.TeamOrganisation` AS

    SELECT
        o.id AS teamId,
        o.triCode AS teamCode,
        o.fullName AS teamName,

        o.arena_name AS arenaName,
        o.arena_capacity AS arenaCapacity,
        o.arena_opened AS arenaOpened,

        o.head_coach AS headCoach,
        o.head_coach_since AS headCoachSince,

        o.general_manager AS generalManager,
        o.gm_since AS generalManagerSince,
        o.gm_playing_career AS generalManagerPlayingCareer,

        o.principal_owner AS principalOwner,
        o.owner_since AS ownerSince,

        o.ahl_team AS ahlTeam,
        o.ahl_city AS ahlCity,
        o.ahl_arena AS ahlArena,
        o.ahl_head_coach AS ahlHeadCoach,

        o.captain,
        o.captain_since AS captainSince,
        o.captain_position AS captainPosition,

        o.alternate_captain_1 AS alternateCaptain1,
        o.alternate_captain_2 AS alternateCaptain2,
        o.alternate_captain_3 AS alternateCaptain3,
        o.alternate_captain_4 AS alternateCaptain4,
        o.alternate_captain_5 AS alternateCaptain5,
        o.alternate_captain_6 AS alternateCaptain6,

        o.stanley_cups AS stanleyCups,

        l.player_neighbourhoods AS playerNeighbourhoods,
        l.organization_summary AS organizationSummary,
        l.fanbase_media_pressure AS fanbaseMediaPressure

    FROM
        `{PROJECT_ID}.Team.OrganizationDetail` o

    LEFT JOIN
        `{PROJECT_ID}.Team.OrganizationDetail_LLM` l
        ON o.id = l.id
    """

    client.query(sql).result()

    print("View ready: LLM.TeamOrganisation")


def create_team_travel_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.TeamTravel` AS

    SELECT
        season,
        team_id AS teamId,
        team_abbrev AS teamCode,
        team_name AS teamName,

        total_games AS totalGames,
        home_games AS homeGames,
        away_games AS awayGames,

        travel_legs AS travelLegs,
        road_trip_count AS roadTripCount,

        total_distance_miles AS totalDistanceMiles,
        average_leg_km AS averageLegKm,
        median_leg_km AS medianLegKm,
        longest_leg_km AS longestLegKm,

        legs_over_1000km AS legsOver1000Km,
        legs_over_2000km AS legsOver2000Km,
        legs_over_3000km AS legsOver3000Km,

        distance_rank AS distanceRank,
        road_trip_rank AS roadTripRank,
        longest_leg_rank AS longestLegRank

    FROM
        `{PROJECT_ID}.Team.Travel_3_LastSeasonSummary`
    """

    client.query(sql).result()

    print("View ready: LLM.TeamTravel")


def create_city_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.City` AS

    SELECT
        t.id AS teamId,
        t.triCode AS teamCode,
        t.fullName AS teamName,

        c.city_name AS cityName,
        c.geocoded_city AS geocodedCity,
        c.state_province AS stateProvince,
        c.country,
        c.country_code AS countryCode,

        c.latitude,
        c.longitude,
        c.timezone,
        c.population,
        c.elevation

    FROM
        `{PROJECT_ID}.Team.TeamList` t

    LEFT JOIN
        `{PROJECT_ID}.City.CityReference` c
        ON t.venueLocation = c.city_name
    """

    client.query(sql).result()

    print("View ready: LLM.City")


def create_city_tax_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.CityTax` AS

    SELECT
        t.id AS teamId,
        t.triCode AS teamCode,
        t.fullName AS teamName,

        x.geocoded_city AS cityName,
        x.state_province AS stateProvince,
        x.country,
        x.country_code AS countryCode,

        x.combined_top_marginal_income_tax_rate AS topMarginalIncomeTaxRate,
        x.federal_income_tax_top_rate AS federalIncomeTaxTopRate,
        x.state_income_tax_rate AS stateIncomeTaxRate,

        x.combined_sales_tax_rate AS combinedSalesTaxRate,
        x.gst_hst_rate AS gstHstRate,
        x.pst_rate AS pstRate,

        x.tax_year AS taxYear,

        x.nhl_avg_income_tax_rate AS nhlAverageIncomeTaxRate,
        x.income_tax_vs_nhl_avg AS incomeTaxVsNhlAverage,
        x.income_tax_rank AS incomeTaxRank,

        x.nhl_avg_sales_tax_rate AS nhlAverageSalesTaxRate,
        x.sales_tax_vs_nhl_avg AS salesTaxVsNhlAverage,
        x.sales_tax_rank AS salesTaxRank

    FROM
        `{PROJECT_ID}.City.tax_summary` x

    LEFT JOIN
        `{PROJECT_ID}.Team.TeamList` t
        ON x.venueLocation = t.venueLocation
    """

    client.query(sql).result()

    print("View ready: LLM.CityTax")


def create_city_climate_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.CityClimate` AS

    SELECT
        t.id AS teamId,
        t.triCode AS teamCode,
        t.fullName AS teamName,

        c.venueLocation,

        c.avg_annual_temp AS avgAnnualTemp,
        c.avg_winter_temp AS avgWinterTemp,
        c.avg_summer_temp AS avgSummerTemp,

        c.annual_rain_mm AS annualRainMm,
        c.annual_snowfall AS annualSnowfall,
        c.avg_cloud_cover AS avgCloudCover,
        c.avg_solar_radiation AS avgSolarRadiation,

        c.annual_temp_vs_nhl_avg AS annualTempVsNhlAverage,
        c.winter_temp_vs_nhl_avg AS winterTempVsNhlAverage,
        c.summer_temp_vs_nhl_avg AS summerTempVsNhlAverage,

        c.rain_vs_nhl_avg_pct AS rainVsNhlAveragePct,
        c.snowfall_vs_nhl_avg_pct AS snowfallVsNhlAveragePct,
        c.cloud_vs_nhl_avg_pct AS cloudVsNhlAveragePct,
        c.solar_vs_nhl_avg_pct AS solarVsNhlAveragePct,

        c.sunshine_rank AS sunshineRank

    FROM
        `{PROJECT_ID}.City.climate_summary` c

    LEFT JOIN
        `{PROJECT_ID}.Team.TeamList` t
        ON c.venueLocation = t.venueLocation
    """

    client.query(sql).result()

    print("View ready: LLM.CityClimate")


def create_city_cost_of_living_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.CityCostOfLiving` AS

    SELECT
        t.id AS teamId,
        t.triCode AS teamCode,
        t.fullName AS teamName,

        c.venueLocation,

        c.cost_of_living_index AS costOfLivingIndex,
        c.housing_index AS housingIndex,
        c.utilities_index AS utilitiesIndex,
        c.groceries_index AS groceriesIndex,
        c.eating_out_index AS eatingOutIndex,
        c.transport_index AS transportIndex,
        c.lifestyle_index AS lifestyleIndex,
        c.family_index AS familyIndex,

        c.vs_nhl_average_pct AS vsNhlAveragePct,
        c.affordability_rank AS affordabilityRank

    FROM
        `{PROJECT_ID}.City.costofliving_summary` c

    LEFT JOIN
        `{PROJECT_ID}.Team.TeamList` t
        ON c.venueLocation = t.venueLocation
    """

    client.query(sql).result()

    print("View ready: LLM.CityCostOfLiving")

def create_player_current_contract_view():

    sql = f"""
    CREATE OR REPLACE VIEW
    `{PROJECT_ID}.{DATASET_ID}.PlayerCurrentContract` AS

    SELECT
        r.playerId,
        r.player AS playerName,

        t.id AS teamId,
        r.team_code AS teamCode,
        r.team_name AS teamName,

        r.position,

        r.cap_hit AS capHit,
        r.term,
        r.total_value AS totalValue,

        r.expiry_status AS expiryStatus,
        r.expiry_year AS expiryYear,

        r.agent

    FROM
        `{PROJECT_ID}.Team.TeamDepthChart` r

    LEFT JOIN
        `{PROJECT_ID}.Team.TeamList` t
        ON r.team_code = t.triCode

    WHERE
        r.playerId IS NOT NULL
    """

    client.query(sql).result()

    print("View ready: LLM.PlayerCurrentContract")

def create_player_team_fit_table():

    sql = f"""
    CREATE OR REPLACE TABLE
    `{PROJECT_ID}.{DATASET_ID}.PlayerTeamFit` AS

    WITH roster_position AS (
        SELECT
            teamId,
            TRIM(pos) AS position,
            COUNT(*) AS playersAtPosition
        FROM
            `{PROJECT_ID}.{DATASET_ID}.TeamRoster`,
            UNNEST(SPLIT(REPLACE(position, '"', ''), ',')) AS pos
        WHERE
            isDepthChart = TRUE
        GROUP BY
            teamId,
            TRIM(pos)
    )

    SELECT
        p.playerId,
        p.playerName,
        p.position,

        p.teamId AS currentTeamId,
        p.teamCode AS currentTeamCode,
        p.teamName AS currentTeamName,

        p.capHit AS playerCapHit,

        t.teamId AS destinationTeamId,
        t.teamCode AS destinationTeamCode,
        t.teamName AS destinationTeamName,

        cap.currentCapSpace,
        cap.projectedCapSpace,

        cap.currentCapSpace - p.capHit AS currentCapGap,
        cap.projectedCapSpace - p.capHit AS projectedCapGap,

        CASE
            WHEN cap.currentCapSpace >= p.capHit
            THEN TRUE
            ELSE FALSE
        END AS canAffordCurrent,

        CASE
            WHEN cap.projectedCapSpace >= p.capHit
            THEN TRUE
            ELSE FALSE
        END AS canAffordProjected,

        rp.playersAtPosition,

        tax.topMarginalIncomeTaxRate,
        tax.incomeTaxRank,

        col.costOfLivingIndex,
        col.affordabilityRank,

        climate.avgAnnualTemp,
        climate.avgWinterTemp,
        climate.sunshineRank,

        travel.totalDistanceMiles,
        travel.distanceRank,
        travel.roadTripCount,
        travel.roadTripRank

    FROM
        `{PROJECT_ID}.{DATASET_ID}.PlayerCurrentContract` p

    CROSS JOIN
        `{PROJECT_ID}.{DATASET_ID}.Team` t

    LEFT JOIN
        `{PROJECT_ID}.{DATASET_ID}.TeamCap` cap
        ON t.teamId = cap.teamId

    LEFT JOIN
        roster_position rp
        ON t.teamId = rp.teamId
        AND p.position = rp.position

    LEFT JOIN
        `{PROJECT_ID}.{DATASET_ID}.CityTax` tax
        ON t.teamId = tax.teamId

    LEFT JOIN
        `{PROJECT_ID}.{DATASET_ID}.CityCostOfLiving` col
        ON t.teamId = col.teamId

    LEFT JOIN
        `{PROJECT_ID}.{DATASET_ID}.CityClimate` climate
        ON t.teamId = climate.teamId

    LEFT JOIN
        `{PROJECT_ID}.{DATASET_ID}.TeamTravel` travel
        ON t.teamId = travel.teamId
    """

    client.query(sql).result()

    print("Table ready: LLM.PlayerTeamFit")

def main():

    create_dataset()

    create_player_view()
    create_player_performance_view()
    create_player_comparables_view()

    create_player_contracts_view()

    create_team_view()
    create_team_roster_view()
    create_team_cap_view()

    create_team_organisation_view()
    create_team_travel_view()

    create_city_view()
    create_city_tax_view()
    create_city_climate_view()
    create_city_cost_of_living_view()

    create_player_current_contract_view()

    create_player_team_fit_table()


if __name__ == "__main__":
    main()