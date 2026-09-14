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
# UNITED STATES
# =========================================================

# ---------------------------------------------------------
# Federal standard deduction
#
# Assumption for V1:
# Generic player is treated as a single individual.
# ---------------------------------------------------------

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

# Federal Basic Personal Amount.
#
# For NHL-level income the player is well above the income
# threshold at which the minimum BPA applies.
#
# 2026:
# maximum = 16,452
# minimum = 14,829
#
# For V1 we therefore use the high-income/minimum amount.
#
# IMPORTANT:
# This is a NON-REFUNDABLE TAX CREDIT base, not a deduction
# from taxable income.
# ---------------------------------------------------------

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


# Canada Employment Amount.
#
# Employment income receives a federal non-refundable
# employment credit.
# ---------------------------------------------------------

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

# Manitoba BPA phases out at higher income.
#
# Maximum 2026 BPA = 15,780
# Phase-out begins = 200,000
# BPA reaches zero = 400,000
#
# Every NHL salary is well above this in CAD.
# V1 therefore uses zero for NHL-player comparisons.
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Ontario surtax
#
# Applied to Ontario BASIC PROVINCIAL TAX PAYABLE,
# not taxable income.
#
# 20% on tax above $5,818
# PLUS
# 36% on tax above $7,446
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Quebec federal tax abatement
#
# Quebec residents receive a 16.5% abatement of basic
# federal tax.
# ---------------------------------------------------------

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


# Each jurisdiction/rule should only occur once.
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


# Rates should always be between 0 and 1.
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