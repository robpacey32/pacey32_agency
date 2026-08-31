"use client";

import { useEffect, useState } from "react";
import ExpandableCard from "@/components/ExpandableCard";
import ClimatePanel from "@/components/ClimatePanel";
import CostOfLivingPanel from "@/components/CostOfLivingPanel";
import { useAppContext } from "@/context/AppContext";
import CityLocationMap from "@/components/CityLocationMapDynamic";
import CityOverviewMap from "@/components/CityOverviewMapDynamic";

type GeoItem = {
    name: string | null;
    address: string | null;
    city?: string | null;
    state_province?: string | null;
    country?: string | null;
    latitude: number;
    longitude: number;
};

type CostOfLivingSummary = {
    venueLocation: string;
    cost_of_living_index: number;
    housing_index: number;
    utilities_index: number;
    groceries_index: number;
    eating_out_index: number;
    transport_index: number;
    lifestyle_index: number;
    family_index: number;
    metrics_used: number;
    vs_nhl_average_pct: number;
    affordability_rank: number;
    nhl_city_count: number;
};

type CostOfLivingDetail = {
    category: string;
    metric: string;
    local_value: number;
    local_low: number | null;
    local_high: number | null;
    avg_usd: number;
    nhl_avg_usd: number;
    metric_index: number;
};

type CityData = {
    team: {
        id: number;
        code: string;
        name: string;
        venueLocation: string;
        logo: string;
    };
    city: {
        city_name: string;
        geocoded_city: string;
        state_province: string;
        country: string;
        country_code: string;
        latitude: number;
        longitude: number;
        timezone: string;
        population: number;
        elevation: number;
    } | null;
    climate: {
        summary: {
            avg_annual_temp: number;
            avg_winter_temp: number;
            avg_summer_temp: number;
            annual_rain_mm: number;
            annual_snowfall: number;
            avg_cloud_cover: number;
            avg_solar_radiation: number;

            nhl_avg_annual_temp: number;
            nhl_avg_winter_temp: number;
            nhl_avg_summer_temp: number;
            nhl_avg_annual_rain_mm: number;
            nhl_avg_annual_snowfall: number;
            nhl_avg_cloud_cover: number;
            nhl_avg_solar_radiation: number;

            annual_temp_vs_nhl_avg: number;
            winter_temp_vs_nhl_avg: number;
            summer_temp_vs_nhl_avg: number;
            rain_vs_nhl_avg_pct: number;
            snowfall_vs_nhl_avg_pct: number;
            cloud_vs_nhl_avg_pct: number;
            solar_vs_nhl_avg_pct: number;

            sunshine_rank: number;
            nhl_city_count: number;
        } | null;
        monthly: {
            month: number;
            avgTemp: number;
            minTemp: number;
            maxTemp: number;
            rainMM: number;
            snowfall: number;
            cloudCover: number;
            solarRadiation: number;
            nhlAvgTemp: number;
            nhlAvgRainMM: number;
            nhlAvgSnowfall: number;
            nhlAvgCloudCover: number;
            nhlAvgSolarRadiation: number;
        }[];
    };
    costOfLiving: {
        summary: CostOfLivingSummary | null;
        detail: CostOfLivingDetail[];
    };
    tax: {
        combined_top_marginal_income_tax_rate: number;
        federal_income_tax_top_rate: number;
        state_income_tax_rate: number;
        combined_sales_tax_rate: number;
        sales_tax_state_rate: number | null;
        sales_tax_average_local_rate: number | null;
        gst_hst_rate: number | null;
        pst_rate: number | null;
        income_tax_rate_basis: string;
        state_income_tax_basis: string;
        sales_tax_basis: string;
        tax_year: number;
        nhl_avg_income_tax_rate: number;
        nhl_avg_sales_tax_rate: number;
        income_tax_vs_nhl_avg: number;
        income_tax_rank: number;
        sales_tax_vs_nhl_avg: number;
        sales_tax_rank: number;
        nhl_city_count: number;
    } | null;
    overview: {
        summary: string | null;
        geo: {
            residentialAreas: {
                rank: number;
                name: string;
                type: string;
                reason: string;
                confidence: number;
                address: string;
                latitude: number;
                longitude: number;
            }[];
            arena: GeoItem[];
            practiceFacility: GeoItem[];
            airports: GeoItem[];
            hospitals: GeoItem[];
            schools: GeoItem[];
            restaurants: GeoItem[];
            shopping: GeoItem[];
            golfClubs: GeoItem[];
            countryClubs: GeoItem[];
            ski: GeoItem[];
            beaches: GeoItem[];
            marinas: GeoItem[];
        };
    };
};

type Card = {
    id: string;
    title: string;
    value: string;
    detail: string;
    openDetail?: string;
    content: React.ReactNode;
};

export default function CityPage() {
    const { team: selectedTeam } = useAppContext();

    const [data, setData] = useState<CityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCard, setOpenCard] = useState<string | null>(null);

    useEffect(() => {
        async function loadCity() {
            try {
                setLoading(true);
                setError(null);
                setOpenCard(null);

                const response = await fetch(`/api/city?team=${selectedTeam}`);

                if (!response.ok) {
                    throw new Error("Failed to load city data");
                }

                const result = await response.json();
                setData(result);
            } catch (err) {
                console.error(err);
                setError("Failed to load city data");
            } finally {
                setLoading(false);
            }
        }

        loadCity();
    }, [selectedTeam]);

    const toggleCard = (card: string) => {
        setOpenCard(openCard === card ? null : card);
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 px-8 py-10">
                <div className="mx-auto max-w-7xl text-slate-400">
                    Loading city data...
                </div>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main className="min-h-screen bg-slate-950 px-8 py-10">
                <div className="mx-auto max-w-7xl text-red-400">
                    {error ?? "City data unavailable"}
                </div>
            </main>
        );
    }

    const climate = data.climate.summary;
    const cost = data.costOfLiving.summary;
    const costDetail = data.costOfLiving.detail;
    const tax = data.tax;
    const city = data.city;

    const cards: Card[] = [
        {
            id: "climate",
            title: "Climate",
            value: climate ? `#${climate.sunshine_rank}` : "—",
            detail: climate
                ? `${formatSigned(climate.solar_vs_nhl_avg_pct)} vs NHL sunshine average`
                : "Climate data unavailable",
            content:
                climate && city ? (
                    <ClimatePanel
                        city={city.geocoded_city}
                        stateProvince={city.state_province}
                        country={city.country}
                        climate={climate}
                        monthly={data.climate.monthly}
                    />
                ) : null,
        },
        {
            id: "cost",
            title: "Cost of Living",
            value: cost ? `#${cost.affordability_rank}` : "—",
            detail: cost
                ? `${formatSigned(cost.vs_nhl_average_pct)} vs NHL average`
                : "Cost data unavailable",
            content:
                cost && city ? (
                    <CostOfLivingPanel
                        city={city.geocoded_city}
                        stateProvince={city.state_province}
                        country={city.country}
                        cost={cost}
                        detail={costDetail}
                    />
                ) : null,
        },
        {
            id: "income-tax",
            title: "Income Tax",
            value: tax
                ? `${tax.combined_top_marginal_income_tax_rate.toFixed(1)}%`
                : "—",
            detail: tax
                ? `#${tax.income_tax_rank} NHL · ${formatPoints(
                      tax.income_tax_vs_nhl_avg
                  )} vs average`
                : "Tax data unavailable",
            content: tax ? (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric
                        label="Combined Top Rate"
                        value={`${tax.combined_top_marginal_income_tax_rate.toFixed(
                            1
                        )}%`}
                    />
                    <Metric
                        label="NHL Rank"
                        value={`#${tax.income_tax_rank} of ${tax.nhl_city_count}`}
                    />
                    <Metric
                        label="vs NHL Average"
                        value={formatPoints(tax.income_tax_vs_nhl_avg)}
                    />
                    <Metric
                        label="Federal Rate"
                        value={`${tax.federal_income_tax_top_rate.toFixed(1)}%`}
                    />
                    <Metric
                        label="State / Provincial Rate"
                        value={`${tax.state_income_tax_rate.toFixed(1)}%`}
                    />
                    <Metric
                        label="Tax Year"
                        value={`${tax.tax_year}`}
                    />
                    <TextMetric
                        label="Basis"
                        value={tax.income_tax_rate_basis}
                    />
                    <TextMetric
                        label="Regional Basis"
                        value={tax.state_income_tax_basis}
                    />
                </div>
            ) : null,
        },
        {
            id: "sales-tax",
            title: "Sales Tax",
            value: tax
                ? `${tax.combined_sales_tax_rate.toFixed(2)}%`
                : "—",
            detail: tax
                ? `#${tax.sales_tax_rank} NHL · ${formatPoints(
                      tax.sales_tax_vs_nhl_avg
                  )} vs average`
                : "Tax data unavailable",
            content: tax ? (
                <div className="grid gap-6 md:grid-cols-3">
                    <Metric
                        label="Combined Sales Tax"
                        value={`${tax.combined_sales_tax_rate.toFixed(2)}%`}
                    />
                    <Metric
                        label="NHL Rank"
                        value={`#${tax.sales_tax_rank} of ${tax.nhl_city_count}`}
                    />
                    <Metric
                        label="vs NHL Average"
                        value={formatPoints(tax.sales_tax_vs_nhl_avg)}
                    />
                    <Metric
                        label="State Rate"
                        value={formatNullablePercent(
                            tax.sales_tax_state_rate
                        )}
                    />
                    <Metric
                        label="Average Local Rate"
                        value={formatNullablePercent(
                            tax.sales_tax_average_local_rate
                        )}
                    />
                    <Metric
                        label="GST / HST"
                        value={formatNullablePercent(
                            tax.gst_hst_rate
                        )}
                    />
                    <Metric
                        label="PST"
                        value={formatNullablePercent(
                            tax.pst_rate
                        )}
                    />
                    <TextMetric
                        label="Basis"
                        value={tax.sales_tax_basis}
                    />
                </div>
            ) : null,
        },
        {
            id: "overview",
            title: "City Overview",
            value: data.team.venueLocation,
            detail: truncate(data.overview.summary, 80),
            openDetail:
                data.overview.summary ??
                "City profile and local amenities",
            content: (
                <div className="space-y-10">
                    <CityOverviewMap
                        cityLatitude={city?.latitude ?? 0}
                        cityLongitude={city?.longitude ?? 0}
                        arena={data.overview.geo.arena}
                        practiceFacility={
                            data.overview.geo.practiceFacility
                        }
                        residentialAreas={
                            data.overview.geo.residentialAreas
                        }
                        airports={data.overview.geo.airports}
                        hospitals={data.overview.geo.hospitals}
                        schools={data.overview.geo.schools}
                        restaurants={data.overview.geo.restaurants}
                        shopping={data.overview.geo.shopping}
                        golfClubs={data.overview.geo.golfClubs}
                        countryClubs={
                            data.overview.geo.countryClubs
                        }
                        ski={data.overview.geo.ski}
                        beaches={data.overview.geo.beaches}
                        marinas={data.overview.geo.marinas}
                    />

                    <div>
                        <div className="mb-4">
                            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                                Recommended Player Areas
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                                Residential areas commonly suited to NHL
                                players and their families.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {data.overview.geo.residentialAreas.map(
                                (area) => (
                                    <Neighbourhood
                                        key={`${area.rank}-${area.name}`}
                                        name={`${area.rank}. ${area.name}`}
                                        detail={area.reason}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: "location",
            title: "Location",
            value:
                city?.geocoded_city ??
                data.team.venueLocation,
            detail: city
                ? `${city.state_province}, ${city.country}`
                : "Location data unavailable",
            content: city ? (
                <div className="grid gap-8 lg:grid-cols-2">
                    <CityLocationMap
                        latitude={city.latitude}
                        longitude={city.longitude}
                        city={city.geocoded_city}
                        teamName={data.team.name}
                        logo={data.team.logo}
                    />

                    <div className="grid grid-cols-2 content-center gap-x-6 gap-y-8">
                        <Metric
                            label="City"
                            value={city.geocoded_city}
                        />
                        <Metric
                            label="State / Province"
                            value={city.state_province}
                        />
                        <Metric
                            label="Country"
                            value={city.country}
                        />
                        <Metric
                            label="Timezone"
                            value={city.timezone}
                        />
                        <Metric
                            label="Population"
                            value={city.population.toLocaleString()}
                        />
                        <Metric
                            label="Elevation"
                            value={`${city.elevation.toLocaleString()} m`}
                        />
                        <Metric
                            label="Latitude"
                            value={city.latitude.toFixed(4)}
                        />
                        <Metric
                            label="Longitude"
                            value={city.longitude.toFixed(4)}
                        />
                    </div>
                </div>
            ) : null,
        },
    ];

    const selectedCard = cards.find(
        (card) => card.id === openCard
    );

    return (
        <main className="min-h-screen bg-slate-950 px-8 py-10">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex items-center gap-5">
                    <img
                        src={data.team.logo}
                        alt={data.team.name}
                        className="h-16 w-16 object-contain"
                    />

                    <div>
                        <p className="text-sm font-medium text-slate-500">
                            CITY
                        </p>

                        <h1 className="text-4xl font-bold">
                            {city?.geocoded_city ??
                                data.team.venueLocation}
                        </h1>

                        <p className="mt-1 text-slate-400">
                            {city
                                ? `${city.state_province}, ${city.country}`
                                : data.team.name}
                        </p>
                    </div>
                </div>

                {!openCard && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {cards.map((card) => (
                            <ExpandableCard
                                key={card.id}
                                title={card.title}
                                value={card.value}
                                detail={card.detail}
                                open={false}
                                onClick={() =>
                                    toggleCard(card.id)
                                }
                            />
                        ))}
                    </div>
                )}

                {openCard && (
                    <>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                            {cards
                                .filter(
                                    (card) =>
                                        card.id !== openCard
                                )
                                .map((card) => (
                                    <ExpandableCard
                                        key={card.id}
                                        title={card.title}
                                        value={card.value}
                                        detail={card.detail}
                                        compact
                                        open={false}
                                        onClick={() =>
                                            toggleCard(card.id)
                                        }
                                    />
                                ))}
                        </div>

                        {selectedCard && (
                            <div className="mt-4">
                                <ExpandableCard
                                    title={selectedCard.title}
                                    value={selectedCard.value}
                                    detail={selectedCard.detail}
                                    openDetail={
                                        selectedCard.openDetail
                                    }
                                    open
                                    onClick={() =>
                                        toggleCard(
                                            selectedCard.id
                                        )
                                    }
                                >
                                    {selectedCard.content}
                                </ExpandableCard>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

function Metric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <p className="text-sm text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-2xl font-semibold">
                {value}
            </p>
        </div>
    );
}

function TextMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <p className="text-sm text-slate-500">
                {label}
            </p>
            <p className="mt-1 text-base font-medium text-slate-200">
                {value}
            </p>
        </div>
    );
}

function Neighbourhood({
    name,
    detail,
}: {
    name: string;
    detail: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="font-semibold">{name}</p>
            <p className="mt-2 text-sm leading-5 text-slate-500">
                {detail}
            </p>
        </div>
    );
}

function formatSigned(value: number) {
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPoints(value: number) {
    const abs = Math.abs(value).toFixed(1);

    if (value < 0) return `${abs} pts below`;
    if (value > 0) return `${abs} pts above`;

    return "NHL average";
}

function formatNullablePercent(
    value: number | null
) {
    return value == null
        ? "—"
        : `${value.toFixed(2)}%`;
}

function truncate(
    value: string | null,
    length: number
) {
    if (!value) {
        return "City profile and local amenities";
    }

    return value.length > length
        ? `${value.slice(0, length)}...`
        : value;
}