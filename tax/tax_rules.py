import os
from datetime import datetime, timezone

import pandas as pd
from google.cloud import bigquery


# =========================================================
# CONFIG
# =========================================================

GCP_PROJECT = os.getenv(
    "GCP_PROJECT",
    "pacey32-agency",
)

TAX_RULES_TABLE = os.getenv(
    "TAX_RULES_TABLE",
    "pacey32-agency.City.tax_rules",
)

TAX_YEAR = int(
    os.getenv(
        "TAX_YEAR",
        "2026",
    )
)


# =========================================================
# SOURCES
# =========================================================

IRS_2026_URL = (
    "https://www.irs.gov/newsroom/"
    "irs-releases-tax-inflation-adjustments-for-tax-year-2026-"
    "including-amendments-from-the-one-big-beautiful-bill"
)

CRA_2026_URL = (
    "https://www.canada.ca/en/revenue-agency/services/"
    "forms-publications/payroll/payroll-deductions-t4127-"
    "payroll-deductions-formulas/t4127-jul/"
    "t4127-jul-payroll-deductions-formulas.html"
)

CRA_ON_2026_URL = (
    "https://www.canada.ca/en/revenue-agency/services/"
    "forms-publications/payroll/t4032-payroll-deductions-tables/"
    "t4032on-jan/t4032on-january-general-information.html"
)

CRA_MB_2026_URL = (
    "https://www.canada.ca/en/revenue-agency/services/"
    "forms-publications/payroll/t4032-payroll-deductions-tables/"
    "t4032mb-jan/t4032mb-january-general-information.html"
)

REVENU_QUEBEC_2026_URL = (
    "https://www.revenuquebec.ca/en/businesses/"
    "source-deductions-and-employer-contributions/"
    "employers-principal-changes-for-2026/"
)

NYC_TAX_URL = (
    "https://www.tax.ny.gov/forms/current-forms/it/it201i.htm"
)

PHILADELPHIA_TAX_URL = (
    "https://www.phila.gov/services/business-self-employment/"
    "business-taxes/wage-tax-employers/"
)

COLUMBUS_TAX_URL = (
    "https://www.columbus.gov/Government/"
    "City-Auditor/Income-Tax-Division/"
    "General-Income-Tax-Information"
)

ST_LOUIS_TAX_URL = (
    "https://www.stlouis-mo.gov/government/departments/"
    "collector/earnings-tax/individual-earnings-tax-info.cfm"
)

DETROIT_TAX_URL = (
    "https://detroitmi.gov/departments/"
    "office-chief-financial-officer/ocfo-divisions/"
    "office-treasury/income-tax/income-tax-information"
)

PITTSBURGH_TAX_URL = (
    "https://www.pittsburghpa.gov/"
    "City-Government/Finance-Budget/Taxes"
)

SWEDEN_ASINK_URL = (
    "https://www.skatteverket.se/foretag/internationellt/"
    "utomlandsbosattaartisterartistskatt."
    "4.71004e4c133e23bf6db800028935.html"
)


# =========================================================
# HELPERS
# =========================================================

rules = []


def add_rule(
    country_code: str,
    country: str,
    jurisdiction: str,
    jurisdiction_id: str,
    currency_code: str,
    rule_key: str,
    rule_type: str,
    rule_name: str,
    value: float | None = None,
    rate: float | None = None,
    threshold: float | None = None,
    rule_order: int = 1,
    calculation_base: str | None = None,
    applies_to: str = "Individual",
    source_url: str | None = None,
    notes: str | None = None,
):
    rules.append(
        {
            "tax_year": TAX_YEAR,
            "country_code": country_code,
            "country": country,
            "jurisdiction": jurisdiction,
            "jurisdiction_id": jurisdiction_id,
            "currency_code": currency_code,
            "rule_key": rule_key,
            "rule_type": rule_type,
            "rule_name": rule_name,
            "value": value,
            "rate": rate,
            "threshold": threshold,
            "rule_order": rule_order,
            "calculation_base": calculation_base,
            "applies_to": applies_to,
            "source_url": source_url,
            "notes": notes,
        }
    )


# =========================================================
# UNITED STATES — FEDERAL
# =========================================================

add_rule(
    country_code="US",
    country="United States",
    jurisdiction="Federal",
    jurisdiction_id="US-Federal",
    currency_code="USD",
    rule_key="standard_deduction_single",
    rule_type="deduction",
    rule_name="Federal standard deduction - single",
    value=16100.00,
    calculation_base="federal_taxable_income",
    source_url=IRS_2026_URL,
    notes=(
        "2026 standard deduction for a single taxpayer. "
        "Used as the generic filing assumption for V1."
    ),
)


# =========================================================
# CANADA — FEDERAL
# =========================================================

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Federal",
    jurisdiction_id="CA-Federal",
    currency_code="CAD",
    rule_key="basic_personal_amount_high_income",
    rule_type="non_refundable_credit_base",
    rule_name="Federal basic personal amount - high income",
    value=14829.00,
    calculation_base="federal_tax_before_credits",
    source_url=CRA_2026_URL,
    notes=(
        "Minimum 2026 federal Basic Personal Amount. "
        "NHL salaries exceed the income level at which "
        "the minimum BPA applies."
    ),
)

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Federal",
    jurisdiction_id="CA-Federal",
    currency_code="CAD",
    rule_key="canada_employment_amount",
    rule_type="non_refundable_credit_base",
    rule_name="Canada employment amount",
    value=1501.00,
    calculation_base="federal_tax_before_credits",
    source_url=CRA_2026_URL,
    notes=(
        "2026 maximum Canada Employment Amount. "
        "NHL salary exceeds this limit."
    ),
)


# =========================================================
# CANADA — ALBERTA
# Calgary Flames / Edmonton Oilers
# =========================================================

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Alberta",
    jurisdiction_id="CA-Alberta",
    currency_code="CAD",
    rule_key="basic_personal_amount",
    rule_type="non_refundable_credit_base",
    rule_name="Alberta basic personal amount",
    value=22769.00,
    calculation_base="provincial_tax_before_credits",
    source_url=CRA_2026_URL,
)


# =========================================================
# CANADA — BRITISH COLUMBIA
# Vancouver Canucks
# =========================================================

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="British Columbia",
    jurisdiction_id="CA-British Columbia",
    currency_code="CAD",
    rule_key="basic_personal_amount",
    rule_type="non_refundable_credit_base",
    rule_name="British Columbia basic personal amount",
    value=13216.00,
    calculation_base="provincial_tax_before_credits",
    source_url=CRA_2026_URL,
)


# =========================================================
# CANADA — MANITOBA
# Winnipeg Jets
# =========================================================

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Manitoba",
    jurisdiction_id="CA-Manitoba",
    currency_code="CAD",
    rule_key="basic_personal_amount_high_income",
    rule_type="non_refundable_credit_base",
    rule_name="Manitoba basic personal amount - NHL income",
    value=0.00,
    calculation_base="provincial_tax_before_credits",
    source_url=CRA_MB_2026_URL,
    notes=(
        "Manitoba BPA phases out to zero at high income. "
        "V1 assumes NHL salary income exceeds the phase-out ceiling."
    ),
)


# =========================================================
# CANADA — ONTARIO
# Toronto Maple Leafs / Ottawa Senators
# =========================================================

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Ontario",
    jurisdiction_id="CA-Ontario",
    currency_code="CAD",
    rule_key="basic_personal_amount",
    rule_type="non_refundable_credit_base",
    rule_name="Ontario basic personal amount",
    value=12989.00,
    calculation_base="provincial_tax_before_credits",
    source_url=CRA_ON_2026_URL,
)

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Ontario",
    jurisdiction_id="CA-Ontario",
    currency_code="CAD",
    rule_key="surtax_tier_1",
    rule_type="surtax",
    rule_name="Ontario surtax tier 1",
    rate=0.20,
    threshold=5818.00,
    rule_order=1,
    calculation_base="provincial_tax_payable",
    source_url=CRA_ON_2026_URL,
)

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Ontario",
    jurisdiction_id="CA-Ontario",
    currency_code="CAD",
    rule_key="surtax_tier_2",
    rule_type="surtax",
    rule_name="Ontario surtax tier 2",
    rate=0.36,
    threshold=7446.00,
    rule_order=2,
    calculation_base="provincial_tax_payable",
    source_url=CRA_ON_2026_URL,
)


# =========================================================
# CANADA — QUEBEC
# Montreal Canadiens
# =========================================================

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Quebec",
    jurisdiction_id="CA-Quebec",
    currency_code="CAD",
    rule_key="basic_personal_amount",
    rule_type="non_refundable_credit_base",
    rule_name="Quebec basic personal amount",
    value=18952.00,
    calculation_base="provincial_tax_before_credits",
    source_url=REVENU_QUEBEC_2026_URL,
)

add_rule(
    country_code="CA",
    country="Canada",
    jurisdiction="Quebec",
    jurisdiction_id="CA-Quebec",
    currency_code="CAD",
    rule_key="federal_tax_abatement",
    rule_type="abatement",
    rule_name="Quebec federal tax abatement",
    rate=0.165,
    calculation_base="basic_federal_tax",
    source_url=CRA_2026_URL,
    notes=(
        "Federal tax abatement applicable to Quebec residents."
    ),
)


# =========================================================
# SWEDEN — NHL GLOBAL SERIES
# =========================================================

add_rule(
    country_code="SE",
    country="Sweden",
    jurisdiction="Sweden",
    jurisdiction_id="SE",
    currency_code="USD",
    rule_key="athlete_nonresident_tax",
    rule_type="flat_rate",
    rule_name="Sweden non-resident athlete tax",
    rate=0.15,
    calculation_base="allocated_income",
    applies_to="nonresident_athlete",
    source_url=SWEDEN_ASINK_URL,
    notes=(
        "Swedish A-SINK rate for non-resident athletes is 15%. "
        "NHL model applies this rate to salary allocated to games "
        "played in Sweden."
    ),
)


# =========================================================
# UNITED STATES — LOCAL TAXES
# =========================================================


# ---------------------------------------------------------
# New York City
# New York Rangers
#
# V1 residency assumption:
# Rangers player treated as NYC resident.
#
# NYC resident income tax is progressive.
#
# For single filers:
# 3.078%  $0 - $12,000
# 3.762%  $12,000 - $25,000
# 3.819%  $25,000 - $50,000
# 3.876%  $50,000+
# ---------------------------------------------------------

NYC_BRACKETS = [
    (0.00, 12000.00, 0.03078),
    (12000.00, 25000.00, 0.03762),
    (25000.00, 50000.00, 0.03819),
    (50000.00, None, 0.03876),
]

for i, (lower, upper, rate) in enumerate(
    NYC_BRACKETS,
    start=1,
):
    add_rule(
        country_code="US",
        country="United States",
        jurisdiction="New York City",
        jurisdiction_id="US-New York City",
        currency_code="USD",
        rule_key=f"local_income_tax_bracket_{i}",
        rule_type="local_tax_bracket",
        rule_name=f"New York City income tax bracket {i}",
        value=lower,
        rate=rate,
        threshold=upper,
        rule_order=i,
        calculation_base="local_taxable_income",
        applies_to="resident",
        source_url=NYC_TAX_URL,
        notes=(
            "NYC resident income tax. "
            "V1 assumes a Rangers player is resident in New York City."
        ),
    )


# ---------------------------------------------------------
# Philadelphia
# Philadelphia Flyers
#
# Resident Wage Tax.
# V1 uses the resident rate effective July 1, 2026.
# ---------------------------------------------------------

add_rule(
    country_code="US",
    country="United States",
    jurisdiction="Philadelphia",
    jurisdiction_id="US-Philadelphia",
    currency_code="USD",
    rule_key="local_wage_tax",
    rule_type="local_flat_tax",
    rule_name="Philadelphia resident wage tax",
    rate=0.03735,
    calculation_base="gross_salary",
    applies_to="resident",
    source_url=PHILADELPHIA_TAX_URL,
    notes=(
        "Philadelphia resident Wage Tax. "
        "V1 applies the resident rate to gross NHL salary."
    ),
)


# ---------------------------------------------------------
# Columbus
# Columbus Blue Jackets
#
# Municipal income tax.
# ---------------------------------------------------------

add_rule(
    country_code="US",
    country="United States",
    jurisdiction="Columbus",
    jurisdiction_id="US-Columbus",
    currency_code="USD",
    rule_key="local_income_tax",
    rule_type="local_flat_tax",
    rule_name="Columbus municipal income tax",
    rate=0.025,
    calculation_base="gross_salary",
    applies_to="resident",
    source_url=COLUMBUS_TAX_URL,
    notes=(
        "Columbus municipal income tax. "
        "V1 applies the resident rate to gross NHL salary."
    ),
)


# ---------------------------------------------------------
# St. Louis
# St. Louis Blues
#
# Resident earnings tax.
# ---------------------------------------------------------

add_rule(
    country_code="US",
    country="United States",
    jurisdiction="St. Louis",
    jurisdiction_id="US-St Louis",
    currency_code="USD",
    rule_key="local_earnings_tax",
    rule_type="local_flat_tax",
    rule_name="St. Louis earnings tax",
    rate=0.01,
    calculation_base="gross_salary",
    applies_to="resident",
    source_url=ST_LOUIS_TAX_URL,
    notes=(
        "St. Louis resident earnings tax. "
        "V1 applies the rate to gross NHL salary."
    ),
)

# ---------------------------------------------------------
# Detroit
# Detroit Red Wings
#
# Resident city income tax.
# ---------------------------------------------------------

add_rule(
    country_code="US",
    country="United States",
    jurisdiction="Detroit",
    jurisdiction_id="US-Detroit",
    currency_code="USD",
    rule_key="local_income_tax",
    rule_type="local_flat_tax",
    rule_name="Detroit resident income tax",
    rate=0.024,
    calculation_base="gross_salary",
    applies_to="resident",
    source_url=DETROIT_TAX_URL,
    notes=(
        "Detroit resident income tax. "
        "V1 applies the 2.4% resident rate to gross NHL salary."
    ),
)


# ---------------------------------------------------------
# Pittsburgh
# Pittsburgh Penguins
#
# Resident Earned Income Tax:
# 1% City + 2% School District = 3%.
# ---------------------------------------------------------

add_rule(
    country_code="US",
    country="United States",
    jurisdiction="Pittsburgh",
    jurisdiction_id="US-Pittsburgh",
    currency_code="USD",
    rule_key="local_earned_income_tax",
    rule_type="local_flat_tax",
    rule_name="Pittsburgh resident earned income tax",
    rate=0.03,
    calculation_base="gross_salary",
    applies_to="resident",
    source_url=PITTSBURGH_TAX_URL,
    notes=(
        "Pittsburgh resident Earned Income Tax. "
        "Includes 1% City and 2% School District. "
        "V1 applies the combined 3% resident rate to gross NHL salary."
    ),
)


# =========================================================
# DATAFRAME
# =========================================================

df = pd.DataFrame(rules)

scrape_datetime = datetime.now(timezone.utc)

df["scrape_datetime"] = scrape_datetime


# =========================================================
# VALIDATION
# =========================================================

required_columns = [
    "tax_year",
    "country_code",
    "jurisdiction",
    "jurisdiction_id",
    "currency_code",
    "rule_key",
    "rule_type",
]

for column in required_columns:
    if df[column].isna().any():
        raise ValueError(
            f"NULL values found in required column: {column}"
        )


duplicate_keys = df.duplicated(
    subset=[
        "tax_year",
        "jurisdiction_id",
        "rule_key",
    ],
    keep=False,
)

if duplicate_keys.any():
    print(
        df.loc[
            duplicate_keys,
            [
                "tax_year",
                "jurisdiction_id",
                "rule_key",
            ],
        ]
    )

    raise ValueError(
        "Duplicate tax rule keys detected."
    )


invalid_rates = (
    df["rate"].notna()
    & (
        (df["rate"] < 0)
        | (df["rate"] > 1)
    )
)

if invalid_rates.any():
    print(
        df.loc[
            invalid_rates,
            [
                "jurisdiction_id",
                "rule_key",
                "rate",
            ],
        ]
    )

    raise ValueError(
        "Invalid rate detected."
    )


print("\nTax rules preview:")
print(
    df[
        [
            "tax_year",
            "jurisdiction_id",
            "rule_key",
            "value",
            "rate",
            "threshold",
        ]
    ].to_string(
        index=False
    )
)


# =========================================================
# BIGQUERY SCHEMA
# =========================================================

schema = [
    bigquery.SchemaField(
        "tax_year",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "country_code",
        "STRING",
    ),
    bigquery.SchemaField(
        "country",
        "STRING",
    ),
    bigquery.SchemaField(
        "jurisdiction",
        "STRING",
    ),
    bigquery.SchemaField(
        "jurisdiction_id",
        "STRING",
    ),
    bigquery.SchemaField(
        "currency_code",
        "STRING",
    ),
    bigquery.SchemaField(
        "rule_key",
        "STRING",
    ),
    bigquery.SchemaField(
        "rule_type",
        "STRING",
    ),
    bigquery.SchemaField(
        "rule_name",
        "STRING",
    ),
    bigquery.SchemaField(
        "value",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "rate",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "threshold",
        "FLOAT",
    ),
    bigquery.SchemaField(
        "rule_order",
        "INTEGER",
    ),
    bigquery.SchemaField(
        "calculation_base",
        "STRING",
    ),
    bigquery.SchemaField(
        "applies_to",
        "STRING",
    ),
    bigquery.SchemaField(
        "source_url",
        "STRING",
    ),
    bigquery.SchemaField(
        "notes",
        "STRING",
    ),
    bigquery.SchemaField(
        "scrape_datetime",
        "TIMESTAMP",
    ),
]


# =========================================================
# LOAD BIGQUERY
# =========================================================

client = bigquery.Client(
    project=GCP_PROJECT
)

job_config = bigquery.LoadJobConfig(
    schema=schema,
    write_disposition=(
        bigquery.WriteDisposition.WRITE_TRUNCATE
    ),
)

print(
    f"\nLoading {len(df)} tax rules "
    f"to {TAX_RULES_TABLE}..."
)

job = client.load_table_from_dataframe(
    df,
    TAX_RULES_TABLE,
    job_config=job_config,
)

job.result()

table = client.get_table(
    TAX_RULES_TABLE
)

print(
    f"Loaded {table.num_rows} rows "
    f"to {TAX_RULES_TABLE}"
)

print("\nTax rules refresh complete.")