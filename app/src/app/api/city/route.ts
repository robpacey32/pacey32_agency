import { NextRequest, NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(request: NextRequest) {
    try {
        const team = request.nextUrl.searchParams.get("team");

        if (!team) {
            return NextResponse.json(
                { error: "team is required" },
                { status: 400 }
            );
        }

        const [teamRows] = await bigquery.query({
            query: `
                SELECT
                    id,
                    triCode,
                    fullName,
                    venueLocation,
                    home_logo
                FROM \`pacey32-agency.Team.TeamList\`
                WHERE triCode = @team
                LIMIT 1
            `,
            params: { team },
        });

        if (!teamRows.length) {
            return NextResponse.json(
                { error: "Team not found" },
                { status: 404 }
            );
        }

        const teamRow = teamRows[0];
        const venueLocation = teamRow.venueLocation;

        const [
            climateResult,
            climateMonthlyResult,
            costResult,
            costDetailResult,
            taxResult,
            incomeTaxDistributionResult,
            salesTaxDistributionResult,
            summaryResult,
            cityResult,
            residentialResult,
            arenaResult,
            practiceResult,
            airportResult,
            hospitalResult,
            schoolResult,
            restaurantResult,
            shoppingResult,
            golfResult,
            countryClubResult,
            skiResult,
            beachResult,
            marinaResult,
        ] = await Promise.all([
            bigquery.query({
                query: `
                    SELECT *
                    FROM \`pacey32-agency.City.climate_summary\`
                    WHERE venueLocation = @venueLocation
                    LIMIT 1
                `,
                params: { venueLocation },
            }),

            bigquery.query({
                query: `
                    SELECT
                        Month AS month,
                        AvgTemp AS avgTemp,
                        MinTemp AS minTemp,
                        MaxTemp AS maxTemp,
                        RainMM AS rainMM,
                        Snowfall AS snowfall,
                        CloudCover AS cloudCover,
                        SolarRadiation AS solarRadiation,
                        nhl_avg_temp AS nhlAvgTemp,
                        nhl_avg_rain_mm AS nhlAvgRainMM,
                        nhl_avg_snowfall AS nhlAvgSnowfall,
                        nhl_avg_cloud_cover AS nhlAvgCloudCover,
                        nhl_avg_solar_radiation AS nhlAvgSolarRadiation
                    FROM \`pacey32-agency.City.climate_monthly_summary\`
                    WHERE venueLocation = @venueLocation
                    ORDER BY Month
                `,
                params: { venueLocation },
            }),

            bigquery.query({
                query: `
                    SELECT *
                    FROM \`pacey32-agency.City.costofliving_summary\`
                    WHERE venueLocation = @venueLocation
                    LIMIT 1
                `,
                params: { venueLocation },
            }),

            bigquery.query({
                query: `
                    SELECT
                        category,
                        metric,
                        local_value,
                        local_low,
                        local_high,
                        avg_usd,
                        nhl_avg_usd,
                        metric_index
                    FROM \`pacey32-agency.City.costofliving_detail\`
                    WHERE venueLocation = @venueLocation
                    ORDER BY category, metric
                `,
                params: { venueLocation },
            }),

            bigquery.query({
                query: `
                    SELECT *
                    FROM \`pacey32-agency.City.tax_summary\`
                    WHERE venueLocation = @venueLocation
                    LIMIT 1
                `,
                params: { venueLocation },
            }),

            bigquery.query({
                query: `
                    SELECT
                        venueLocation,
                        geocoded_city,
                        state_province,
                        country,
                        combined_top_marginal_income_tax_rate,
                        income_tax_rank
                    FROM \`pacey32-agency.City.tax_summary\`
                    WHERE combined_top_marginal_income_tax_rate IS NOT NULL
                    ORDER BY income_tax_rank
                `,
            }),

            bigquery.query({
                query: `
                    SELECT
                        venueLocation,
                        geocoded_city,
                        state_province,
                        country,
                        combined_sales_tax_rate,
                        sales_tax_rank
                    FROM \`pacey32-agency.City.tax_summary\`
                    WHERE combined_sales_tax_rate IS NOT NULL
                    ORDER BY sales_tax_rank
                `,
            }),

            bigquery.query({
                query: `
                    SELECT summary
                    FROM \`pacey32-agency.City.city_summary\`
                    WHERE venueLocation = @venueLocation
                    ORDER BY generated_datetime DESC
                    LIMIT 1
                `,
                params: { venueLocation },
            }),

            bigquery.query({
                query: `
                    SELECT
                        city_name,
                        geocoded_city,
                        state_province,
                        country,
                        country_code,
                        latitude,
                        longitude,
                        timezone,
                        population,
                        elevation
                    FROM \`pacey32-agency.City.CityReference\`
                    WHERE city_name = @venueLocation
                       OR search_name = @venueLocation
                    LIMIT 1
                `,
                params: { venueLocation },
            }),

            geoQuery(
                "PlayerResidentialArea",
                `
                    rank,
                    area_name AS name,
                    location_type AS type,
                    reason,
                    confidence,
                    matched_address AS address,
                    latitude,
                    longitude
                `,
                team
            ),

            geoQuery(
                "Arena",
                `
                    arena_name AS name,
                    matched_address AS address,
                    latitude,
                    longitude
                `,
                team
            ),

            geoQuery(
                "PracticeFacility",
                `
                    facility_name AS name,
                    facility_type AS type,
                    address,
                    notes,
                    latitude,
                    longitude
                `,
                team
            ),

            simpleGeoQuery("Airport", team),
            simpleGeoQuery("Hospital", team),
            simpleGeoQuery("School", team),
            simpleGeoQuery("Restaurant", team),
            simpleGeoQuery("ShoppingMall", team),
            simpleGeoQuery("GolfClub", team),
            simpleGeoQuery("CountryClub", team),
            simpleGeoQuery("Ski", team),
            simpleGeoQuery("Beach", team),
            simpleGeoQuery("Marina", team),
        ]);

        return NextResponse.json({
            team: {
                id: teamRow.id,
                code: teamRow.triCode,
                name: teamRow.fullName,
                venueLocation: teamRow.venueLocation,
                logo: teamRow.home_logo,
            },

            city: cityResult[0][0] ?? null,

            climate: {
                summary: climateResult[0][0] ?? null,
                monthly: climateMonthlyResult[0],
            },

            costOfLiving: {
                summary: costResult[0][0] ?? null,
                detail: costDetailResult[0],
            },

            tax: {
                summary: taxResult[0][0] ?? null,
                incomeTaxDistribution:
                    incomeTaxDistributionResult[0],
                salesTaxDistribution:
                    salesTaxDistributionResult[0],
            },

            overview: {
                summary:
                    summaryResult[0][0]?.summary ??
                    null,

                geo: {
                    residentialAreas:
                        residentialResult[0],
                    arena: arenaResult[0],
                    practiceFacility:
                        practiceResult[0],
                    airports: airportResult[0],
                    hospitals: hospitalResult[0],
                    schools: schoolResult[0],
                    restaurants:
                        restaurantResult[0],
                    shopping: shoppingResult[0],
                    golfClubs: golfResult[0],
                    countryClubs:
                        countryClubResult[0],
                    ski: skiResult[0],
                    beaches: beachResult[0],
                    marinas: marinaResult[0],
                },
            },
        });
    } catch (error) {
        console.error("City API error:", error);

        return NextResponse.json(
            { error: "Failed to load city data" },
            { status: 500 }
        );
    }
}

function geoQuery(
    table: string,
    fields: string,
    team: string
) {
    return bigquery.query({
        query: `
            SELECT
                ${fields}
            FROM \`pacey32-agency.Geo.${table}\`
            WHERE tricode = @team
        `,
        params: { team },
    });
}

function simpleGeoQuery(
    table: string,
    team: string
) {
    return geoQuery(
        table,
        `
            name,
            address,
            city,
            state_province,
            country,
            latitude,
            longitude
        `,
        team
    );
}