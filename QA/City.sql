-- ============================================================
-- CITY DATA QUALITY
-- pacey32-agency
--
-- Objects:
--   City.CityReference
--   City.city_summary
--   City.climate
--   City.climate_monthly_summary
--   City.climate_summary
--   City.costofliving
--   City.costofliving_detail
--   City.costofliving_summary
--   City.fxrate
-- ============================================================

DECLARE v_run_id STRING DEFAULT GENERATE_UUID();
DECLARE v_run_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP();


-- ============================================================
-- CT001
-- CityReference grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT city_name
    FROM `pacey32-agency.City.CityReference`
    GROUP BY city_name
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT001',
    'CityReference unique city grain',
    'Grain',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'CityReference should contain at most one row per city_name.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT001',
    'CityReference',
    CAST(NULL AS INT64),
    city_name,
    'Duplicate city_name in CityReference.',
    TO_JSON(STRUCT(city_name))
FROM (
    SELECT city_name
    FROM `pacey32-agency.City.CityReference`
    GROUP BY city_name
    HAVING COUNT(*) > 1
);


-- ============================================================
-- CT002
-- Current NHL city coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH current_cities AS (
    SELECT DISTINCT venueLocation
    FROM `pacey32-agency.Team.TeamList`
),
failures AS (
    SELECT t.venueLocation
    FROM current_cities t
    LEFT JOIN `pacey32-agency.City.CityReference` c
        ON t.venueLocation = c.city_name
    WHERE c.city_name IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT002',
    'Current NHL city coverage',
    'Coverage',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current TeamList venueLocation should exist in CityReference.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT002',
    'CityReference',
    CAST(NULL AS INT64),
    venueLocation,
    'Current NHL venueLocation missing from CityReference.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.City.CityReference` c
        ON t.venueLocation = c.city_name
    WHERE c.city_name IS NULL
);


-- ============================================================
-- CT003
-- CityReference required geocoding fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.CityReference`
    WHERE NULLIF(TRIM(city_name), '') IS NULL
       OR latitude IS NULL
       OR longitude IS NULL
       OR geography IS NULL
       OR NULLIF(TRIM(country), '') IS NULL
       OR NULLIF(TRIM(country_code), '') IS NULL
       OR NULLIF(TRIM(timezone), '') IS NULL
       OR NULLIF(TRIM(geocode_status), '') IS NULL
       OR last_updated IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT003',
    'CityReference required geocoding fields',
    'Completeness',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'CityReference rows should contain the required geocoding fields.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT003',
    'CityReference',
    CAST(NULL AS INT64),
    COALESCE(city_name, 'NULL'),
    'Required CityReference geocoding field is missing.',
    TO_JSON(t)
FROM `pacey32-agency.City.CityReference` t
WHERE NULLIF(TRIM(city_name), '') IS NULL
   OR latitude IS NULL
   OR longitude IS NULL
   OR geography IS NULL
   OR NULLIF(TRIM(country), '') IS NULL
   OR NULLIF(TRIM(country_code), '') IS NULL
   OR NULLIF(TRIM(timezone), '') IS NULL
   OR NULLIF(TRIM(geocode_status), '') IS NULL
   OR last_updated IS NULL;


-- ============================================================
-- CT004
-- Coordinates valid
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.CityReference`
    WHERE latitude NOT BETWEEN -90 AND 90
       OR longitude NOT BETWEEN -180 AND 180
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT004',
    'CityReference coordinate validity',
    'Validity',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Latitude must be -90 to 90 and longitude -180 to 180.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT004',
    'CityReference',
    CAST(NULL AS INT64),
    city_name,
    'Invalid latitude or longitude.',
    TO_JSON(STRUCT(city_name, latitude, longitude))
FROM `pacey32-agency.City.CityReference`
WHERE latitude NOT BETWEEN -90 AND 90
   OR longitude NOT BETWEEN -180 AND 180;


-- ============================================================
-- CT005
-- Geography agrees with coordinates
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.CityReference`
    WHERE geography IS NOT NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ST_DISTANCE(
            geography,
            ST_GEOGPOINT(longitude, latitude)
          ) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT005',
    'CityReference geography reconciliation',
    'Reconciliation',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Stored GEOGRAPHY should agree with latitude and longitude.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT005',
    'CityReference',
    CAST(NULL AS INT64),
    city_name,
    'GEOGRAPHY does not agree with stored coordinates.',
    TO_JSON(STRUCT(
        city_name,
        latitude,
        longitude,
        ST_ASTEXT(geography) AS geography_wkt
    ))
FROM `pacey32-agency.City.CityReference`
WHERE geography IS NOT NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND ST_DISTANCE(
        geography,
        ST_GEOGPOINT(longitude, latitude)
      ) > 1;


-- ============================================================
-- CT006
-- Country codes
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.CityReference`
    WHERE country_code NOT IN ('US', 'CA')
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT006',
    'CityReference NHL country codes',
    'Validity',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'NHL CityReference locations should currently be in the US or Canada.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT006',
    'CityReference',
    CAST(NULL AS INT64),
    city_name,
    'Unexpected country_code.',
    TO_JSON(STRUCT(city_name, country, country_code))
FROM `pacey32-agency.City.CityReference`
WHERE country_code NOT IN ('US', 'CA');


-- ============================================================
-- CT007
-- Successful geocoding status
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.CityReference`
    WHERE UPPER(geocode_status) != 'FOUND'
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT007',
    'CityReference geocoding success',
    'Validity',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'CityReference rows should have geocode_status FOUND.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT007',
    'CityReference',
    CAST(NULL AS INT64),
    city_name,
    'City geocoding status is not FOUND.',
    TO_JSON(STRUCT(city_name, geocode_status, geocode_source))
FROM `pacey32-agency.City.CityReference`
WHERE UPPER(geocode_status) != 'FOUND';


-- ============================================================
-- CT008
-- Current city geocoding uniqueness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH current_cities AS (
    SELECT DISTINCT venueLocation
    FROM `pacey32-agency.Team.TeamList`
),
failures AS (
    SELECT
        t.venueLocation,
        COUNT(c.city_name) AS match_count
    FROM current_cities t
    LEFT JOIN `pacey32-agency.City.CityReference` c
        ON t.venueLocation = c.city_name
    GROUP BY t.venueLocation
    HAVING COUNT(c.city_name) != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT008',
    'Current NHL city unique reference match',
    'Reconciliation',
    'City',
    'CityReference',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each current NHL venueLocation should resolve to exactly one CityReference row.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT008',
    'CityReference',
    CAST(NULL AS INT64),
    venueLocation,
    'Current venueLocation does not resolve exactly once.',
    TO_JSON(STRUCT(venueLocation, match_count))
FROM (
    SELECT
        t.venueLocation,
        COUNT(c.city_name) AS match_count
    FROM (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.Team.TeamList`
    ) t
    LEFT JOIN `pacey32-agency.City.CityReference` c
        ON t.venueLocation = c.city_name
    GROUP BY t.venueLocation
    HAVING COUNT(c.city_name) != 1
);


-- ============================================================
-- CT009
-- City summary grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT venueLocation
    FROM `pacey32-agency.City.city_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT009',
    'City summary unique venue grain',
    'Grain',
    'City',
    'city_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'city_summary should contain one row per venueLocation.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT009',
    'city_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Duplicate city summary.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT venueLocation
    FROM `pacey32-agency.City.city_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
);


-- ============================================================
-- CT010
-- City summary current coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.City.city_summary` s
        ON t.venueLocation = s.venueLocation
    WHERE s.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT010',
    'City summary current NHL coverage',
    'Coverage',
    'City',
    'city_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL venueLocation should have a city summary.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT010',
    'city_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Current NHL city missing city summary.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.City.city_summary` s
        ON t.venueLocation = s.venueLocation
    WHERE s.venueLocation IS NULL
);


-- ============================================================
-- CT011
-- City summary required content
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.city_summary`
    WHERE NULLIF(TRIM(venueLocation), '') IS NULL
       OR NULLIF(TRIM(summary), '') IS NULL
       OR NULLIF(TRIM(model), '') IS NULL
       OR NULLIF(TRIM(prompt_version), '') IS NULL
       OR generated_datetime IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT011',
    'City summary required content',
    'Completeness',
    'City',
    'city_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'City summaries should contain summary text and generation metadata.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT011',
    'city_summary',
    CAST(NULL AS INT64),
    COALESCE(venueLocation, 'NULL'),
    'Required city summary content or metadata missing.',
    TO_JSON(t)
FROM `pacey32-agency.City.city_summary` t
WHERE NULLIF(TRIM(venueLocation), '') IS NULL
   OR NULLIF(TRIM(summary), '') IS NULL
   OR NULLIF(TRIM(model), '') IS NULL
   OR NULLIF(TRIM(prompt_version), '') IS NULL
   OR generated_datetime IS NULL;


-- ============================================================
-- CT012
-- Climate city/month grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT venueLocation, Month
    FROM `pacey32-agency.City.climate`
    GROUP BY venueLocation, Month
    HAVING COUNT(*) != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT012',
    'Climate unique city month grain',
    'Grain',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Climate should contain one row per venueLocation and month.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT012',
    'climate',
    CAST(NULL AS INT64),
    CONCAT(
        COALESCE(venueLocation, 'NULL'),
        '|',
        COALESCE(CAST(Month AS STRING), 'NULL')
    ),
    'Duplicate climate city/month.',
    TO_JSON(STRUCT(venueLocation, Month))
FROM (
    SELECT venueLocation, Month
    FROM `pacey32-agency.City.climate`
    GROUP BY venueLocation, Month
    HAVING COUNT(*) != 1
);


-- ============================================================
-- CT013
-- Climate 12-month completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT
        venueLocation,
        COUNT(*) AS cnt,
        COUNT(DISTINCT Month) AS month_count
    FROM `pacey32-agency.City.climate`
    GROUP BY venueLocation
    HAVING COUNT(*) != 12
        OR COUNT(DISTINCT Month) != 12
        OR MIN(Month) != 1
        OR MAX(Month) != 12
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT013',
    'Climate twelve month completeness',
    'Completeness',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Each climate city should contain exactly months 1 through 12.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT013',
    'climate',
    CAST(NULL AS INT64),
    venueLocation,
    'Climate city does not contain exactly twelve months.',
    TO_JSON(STRUCT(venueLocation, cnt, month_count))
FROM (
    SELECT
        venueLocation,
        COUNT(*) AS cnt,
        COUNT(DISTINCT Month) AS month_count
    FROM `pacey32-agency.City.climate`
    GROUP BY venueLocation
    HAVING COUNT(*) != 12
        OR COUNT(DISTINCT Month) != 12
        OR MIN(Month) != 1
        OR MAX(Month) != 12
);


-- ============================================================
-- CT014
-- Climate current NHL coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.climate`
    ) c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT014',
    'Climate current NHL coverage',
    'Coverage',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL venueLocation should have climate data.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT014',
    'climate',
    CAST(NULL AS INT64),
    venueLocation,
    'Current NHL city missing climate data.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.climate`
    ) c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
);


-- ============================================================
-- CT015
-- Climate required measures
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.climate`
    WHERE venueLocation IS NULL
       OR Month IS NULL
       OR AvgTemp IS NULL
       OR MinTemp IS NULL
       OR MaxTemp IS NULL
       OR RainMM IS NULL
       OR Snowfall IS NULL
       OR CloudCover IS NULL
       OR SolarRadiation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT015',
    'Climate required measures',
    'Completeness',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Core monthly climate measures should be populated.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT015',
    'climate',
    CAST(NULL AS INT64),
    CONCAT(
        COALESCE(venueLocation, 'NULL'),
        '|',
        COALESCE(CAST(Month AS STRING), 'NULL')
    ),
    'Required climate measure missing.',
    TO_JSON(t)
FROM `pacey32-agency.City.climate` t
WHERE venueLocation IS NULL
   OR Month IS NULL
   OR AvgTemp IS NULL
   OR MinTemp IS NULL
   OR MaxTemp IS NULL
   OR RainMM IS NULL
   OR Snowfall IS NULL
   OR CloudCover IS NULL
   OR SolarRadiation IS NULL;


-- ============================================================
-- CT016
-- Climate temperature relationship
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.climate`
    WHERE MinTemp > AvgTemp
       OR AvgTemp > MaxTemp
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT016',
    'Climate temperature relationship',
    'Arithmetic',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Monthly temperature should satisfy MinTemp <= AvgTemp <= MaxTemp.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT016',
    'climate',
    CAST(NULL AS INT64),
    CONCAT(venueLocation, '|', CAST(Month AS STRING)),
    'Temperature relationship invalid.',
    TO_JSON(STRUCT(venueLocation, Month, MinTemp, AvgTemp, MaxTemp))
FROM `pacey32-agency.City.climate`
WHERE MinTemp > AvgTemp
   OR AvgTemp > MaxTemp;


-- ============================================================
-- CT017
-- Climate physical validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.climate`
    WHERE RainMM < 0
       OR Snowfall < 0
       OR CloudCover < 0
       OR CloudCover > 100
       OR SolarRadiation < 0
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT017',
    'Climate physical value validity',
    'Validity',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Precipitation and solar radiation cannot be negative and cloud cover must be 0-100.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT017',
    'climate',
    CAST(NULL AS INT64),
    CONCAT(venueLocation, '|', CAST(Month AS STRING)),
    'Climate value outside valid physical range.',
    TO_JSON(STRUCT(
        venueLocation,
        Month,
        RainMM,
        Snowfall,
        CloudCover,
        SolarRadiation
    ))
FROM `pacey32-agency.City.climate`
WHERE RainMM < 0
   OR Snowfall < 0
   OR CloudCover < 0
   OR CloudCover > 100
   OR SolarRadiation < 0;


-- ============================================================
-- CT018
-- Climate coordinates reconcile to CityReference
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT
        c.venueLocation,
        c.Month,
        c.latitude,
        c.longitude,
        r.latitude AS reference_latitude,
        r.longitude AS reference_longitude,
        ST_DISTANCE(
            ST_GEOGPOINT(c.longitude, c.latitude),
            ST_GEOGPOINT(r.longitude, r.latitude)
        ) / 1000 AS distance_km
    FROM `pacey32-agency.City.climate` c
    JOIN `pacey32-agency.City.CityReference` r
        ON c.venueLocation = r.city_name
    WHERE ST_DISTANCE(
        ST_GEOGPOINT(c.longitude, c.latitude),
        ST_GEOGPOINT(r.longitude, r.latitude)
    ) > 25000
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT018',
    'Climate coordinate reconciliation',
    'Reconciliation',
    'City',
    'climate',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Climate coordinates should be within 25 km of the CityReference location.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT018',
    'climate',
    CAST(NULL AS INT64),
    CONCAT(venueLocation, '|', CAST(Month AS STRING)),
    'Climate coordinates are more than 25 km from CityReference.',
    TO_JSON(STRUCT(
        venueLocation,
        Month,
        latitude,
        longitude,
        reference_latitude,
        reference_longitude,
        ROUND(distance_km, 2) AS distance_km
    ))
FROM (
    SELECT
        c.venueLocation,
        c.Month,
        c.latitude,
        c.longitude,
        r.latitude AS reference_latitude,
        r.longitude AS reference_longitude,
        ST_DISTANCE(
            ST_GEOGPOINT(c.longitude, c.latitude),
            ST_GEOGPOINT(r.longitude, r.latitude)
        ) / 1000 AS distance_km
    FROM `pacey32-agency.City.climate` c
    JOIN `pacey32-agency.City.CityReference` r
        ON c.venueLocation = r.city_name
    WHERE ST_DISTANCE(
        ST_GEOGPOINT(c.longitude, c.latitude),
        ST_GEOGPOINT(r.longitude, r.latitude)
    ) > 25000
);


-- ============================================================
-- CT019
-- Climate monthly view reconciliation
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT
        COALESCE(c.venueLocation, s.venueLocation) AS venueLocation,
        COALESCE(c.Month, s.Month) AS Month
    FROM `pacey32-agency.City.climate` c
    FULL OUTER JOIN `pacey32-agency.City.climate_monthly_summary` s
        USING (venueLocation, Month)
    WHERE c.venueLocation IS NULL
       OR s.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT019',
    'Climate monthly summary grain reconciliation',
    'Reconciliation',
    'City',
    'climate_monthly_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'climate_monthly_summary should contain exactly the same city/month population as climate.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT019',
    'climate_monthly_summary',
    CAST(NULL AS INT64),
    CONCAT(
        COALESCE(venueLocation, 'NULL'),
        '|',
        COALESCE(CAST(Month AS STRING), 'NULL')
    ),
    'Climate monthly summary population differs from climate.',
    TO_JSON(STRUCT(venueLocation, Month))
FROM (
    SELECT
        COALESCE(c.venueLocation, s.venueLocation) AS venueLocation,
        COALESCE(c.Month, s.Month) AS Month
    FROM `pacey32-agency.City.climate` c
    FULL OUTER JOIN `pacey32-agency.City.climate_monthly_summary` s
        USING (venueLocation, Month)
    WHERE c.venueLocation IS NULL
       OR s.venueLocation IS NULL
);


-- ============================================================
-- CT020
-- Climate summary grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT venueLocation
    FROM `pacey32-agency.City.climate_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) != 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT020',
    'Climate summary unique city grain',
    'Grain',
    'City',
    'climate_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'climate_summary should contain one row per climate city.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT020',
    'climate_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Duplicate climate summary city.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT venueLocation
    FROM `pacey32-agency.City.climate_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) != 1
);


-- ============================================================
-- CT021
-- Climate summary city count
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT COUNT(DISTINCT venueLocation) AS expected_count
    FROM `pacey32-agency.City.climate`
),
failures AS (
    SELECT s.*
    FROM `pacey32-agency.City.climate_summary` s
    CROSS JOIN expected e
    WHERE s.nhl_city_count != e.expected_count
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT021',
    'Climate summary NHL city count',
    'Arithmetic',
    'City',
    'climate_summary',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'nhl_city_count should equal the number of climate cities.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT021',
    'climate_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Incorrect nhl_city_count.',
    TO_JSON(STRUCT(venueLocation, nhl_city_count))
FROM `pacey32-agency.City.climate_summary`
WHERE nhl_city_count != (
    SELECT COUNT(DISTINCT venueLocation)
    FROM `pacey32-agency.City.climate`
);


-- ============================================================
-- CT022
-- Climate sunshine rank validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.climate_summary`
    WHERE sunshine_rank < 1
       OR sunshine_rank > nhl_city_count
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT022',
    'Climate sunshine rank validity',
    'Validity',
    'City',
    'climate_summary',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Sunshine rank should be between 1 and nhl_city_count.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT022',
    'climate_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Invalid sunshine rank.',
    TO_JSON(STRUCT(venueLocation, sunshine_rank, nhl_city_count))
FROM `pacey32-agency.City.climate_summary`
WHERE sunshine_rank < 1
   OR sunshine_rank > nhl_city_count;


-- ============================================================
-- CT023
-- Cost of living current coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.costofliving`
    ) c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT023',
    'Cost of living current NHL coverage',
    'Coverage',
    'City',
    'costofliving',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL venueLocation should have cost-of-living source data.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT023',
    'costofliving',
    CAST(NULL AS INT64),
    venueLocation,
    'Current NHL city missing cost-of-living data.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.costofliving`
    ) c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
);


-- ============================================================
-- CT024
-- Cost-of-living numeric validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving`
    WHERE avg < 0
       OR low < 0
       OR high < 0
       OR (low IS NOT NULL AND high IS NOT NULL AND low > high)
       OR (
            avg IS NOT NULL
            AND low IS NOT NULL
            AND avg < low
          )
       OR (
            avg IS NOT NULL
            AND high IS NOT NULL
            AND avg > high
          )
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT024',
    'Cost of living numeric validity',
    'Validity',
    'City',
    'costofliving',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Cost-of-living values should be non-negative and averages should fall within populated ranges.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT024',
    'costofliving',
    CAST(NULL AS INT64),
    CONCAT(COALESCE(venueLocation, 'NULL'), '|', COALESCE(metric, 'NULL')),
    'Invalid cost-of-living numeric values.',
    TO_JSON(t)
FROM `pacey32-agency.City.costofliving` t
WHERE avg < 0
   OR low < 0
   OR high < 0
   OR (low IS NOT NULL AND high IS NOT NULL AND low > high)
   OR (
        avg IS NOT NULL
        AND low IS NOT NULL
        AND avg < low
      )
   OR (
        avg IS NOT NULL
        AND high IS NOT NULL
        AND avg > high
      );


-- ============================================================
-- CT025
-- Cost-of-living scrape metadata
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving`
    WHERE venueLocation IS NULL
       OR scrape_datetime IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT025',
    'Cost of living scrape metadata',
    'Completeness',
    'City',
    'costofliving',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Cost-of-living source rows should identify their venue and scrape time.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT025',
    'costofliving',
    CAST(NULL AS INT64),
    CONCAT(COALESCE(venueLocation, 'NULL'), '|', COALESCE(metric, 'NULL')),
    'Missing cost-of-living venue or scrape timestamp.',
    TO_JSON(t)
FROM `pacey32-agency.City.costofliving` t
WHERE venueLocation IS NULL
   OR scrape_datetime IS NULL;


-- ============================================================
-- CT026
-- Cost-of-living detail grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT venueLocation, metric
    FROM `pacey32-agency.City.costofliving_detail`
    GROUP BY venueLocation, metric
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT026',
    'Cost of living detail unique city metric grain',
    'Grain',
    'City',
    'costofliving_detail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Selected cost-of-living detail should contain one row per city and metric.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT026',
    'costofliving_detail',
    CAST(NULL AS INT64),
    CONCAT(venueLocation, '|', metric),
    'Duplicate selected cost-of-living city/metric.',
    TO_JSON(STRUCT(venueLocation, metric))
FROM (
    SELECT venueLocation, metric
    FROM `pacey32-agency.City.costofliving_detail`
    GROUP BY venueLocation, metric
    HAVING COUNT(*) > 1
);


-- ============================================================
-- CT027
-- Cost-of-living detail required fields
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving_detail`
    WHERE venueLocation IS NULL
       OR country IS NULL
       OR category IS NULL
       OR metric IS NULL
       OR local_value IS NULL
       OR avg_usd IS NULL
       OR nhl_avg_usd IS NULL
       OR metric_index IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT027',
    'Cost of living detail completeness',
    'Completeness',
    'City',
    'costofliving_detail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Selected cost-of-living detail rows should contain values required for comparison.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT027',
    'costofliving_detail',
    CAST(NULL AS INT64),
    CONCAT(COALESCE(venueLocation, 'NULL'), '|', COALESCE(metric, 'NULL')),
    'Required cost-of-living detail value missing.',
    TO_JSON(t)
FROM `pacey32-agency.City.costofliving_detail` t
WHERE venueLocation IS NULL
   OR country IS NULL
   OR category IS NULL
   OR metric IS NULL
   OR local_value IS NULL
   OR avg_usd IS NULL
   OR nhl_avg_usd IS NULL
   OR metric_index IS NULL;


-- ============================================================
-- CT028
-- Cost-of-living metric index arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving_detail`
    WHERE nhl_avg_usd = 0
       OR ABS(
            metric_index -
            (100 * avg_usd / NULLIF(nhl_avg_usd, 0))
          ) > 0.5
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT028',
    'Cost of living metric index arithmetic',
    'Arithmetic',
    'City',
    'costofliving_detail',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'metric_index should reconcile to 100 times city USD value divided by NHL metric average, allowing 0.5 index points for exposed-value rounding.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT028',
    'costofliving_detail',
    CAST(NULL AS INT64),
    CONCAT(venueLocation, '|', metric),
    'metric_index does not reconcile within the 0.5-point rounding tolerance.',
    TO_JSON(STRUCT(
        venueLocation,
        metric,
        avg_usd,
        nhl_avg_usd,
        metric_index,
        ROUND(
            100 * avg_usd / NULLIF(nhl_avg_usd, 0),
            4
        ) AS recalculated_metric_index,
        ROUND(
            metric_index -
            (100 * avg_usd / NULLIF(nhl_avg_usd, 0)),
            4
        ) AS difference
    ))
FROM `pacey32-agency.City.costofliving_detail`
WHERE nhl_avg_usd = 0
   OR ABS(
        metric_index -
        (100 * avg_usd / NULLIF(nhl_avg_usd, 0))
      ) > 0.5;


-- ============================================================
-- CT029
-- Cost-of-living summary grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT venueLocation
    FROM `pacey32-agency.City.costofliving_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT029',
    'Cost of living summary unique city grain',
    'Grain',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'costofliving_summary should contain one row per venueLocation.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT029',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Duplicate cost-of-living summary city.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT venueLocation
    FROM `pacey32-agency.City.costofliving_summary`
    GROUP BY venueLocation
    HAVING COUNT(*) > 1
);


-- ============================================================
-- CT030
-- Cost-of-living summary current coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.City.costofliving_summary` c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT030',
    'Cost of living summary current NHL coverage',
    'Coverage',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL venueLocation should have a cost-of-living summary.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT030',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Current NHL city missing cost-of-living summary.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT DISTINCT t.venueLocation
    FROM `pacey32-agency.Team.TeamList` t
    LEFT JOIN `pacey32-agency.City.costofliving_summary` c
        ON t.venueLocation = c.venueLocation
    WHERE c.venueLocation IS NULL
);


-- ============================================================
-- CT031
-- Cost-of-living summary completeness
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving_summary`
    WHERE cost_of_living_index IS NULL
       OR housing_index IS NULL
       OR utilities_index IS NULL
       OR groceries_index IS NULL
       OR eating_out_index IS NULL
       OR transport_index IS NULL
       OR lifestyle_index IS NULL
       OR family_index IS NULL
       OR metrics_used IS NULL
       OR affordability_rank IS NULL
       OR nhl_city_count IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT031',
    'Cost of living summary completeness',
    'Completeness',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Cost-of-living summary metrics should be populated.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT031',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Required cost-of-living summary metric missing.',
    TO_JSON(t)
FROM `pacey32-agency.City.costofliving_summary` t
WHERE cost_of_living_index IS NULL
   OR housing_index IS NULL
   OR utilities_index IS NULL
   OR groceries_index IS NULL
   OR eating_out_index IS NULL
   OR transport_index IS NULL
   OR lifestyle_index IS NULL
   OR family_index IS NULL
   OR metrics_used IS NULL
   OR affordability_rank IS NULL
   OR nhl_city_count IS NULL;


-- ============================================================
-- CT032
-- Summary vs NHL average arithmetic
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving_summary`
    WHERE ABS(
        vs_nhl_average_pct -
        ROUND(cost_of_living_index - 100, 1)
    ) > 0.1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT032',
    'Cost of living NHL average arithmetic',
    'Arithmetic',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'vs_nhl_average_pct should equal cost_of_living_index minus 100.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT032',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'vs_nhl_average_pct does not reconcile.',
    TO_JSON(STRUCT(
        venueLocation,
        cost_of_living_index,
        vs_nhl_average_pct
    ))
FROM `pacey32-agency.City.costofliving_summary`
WHERE ABS(
    vs_nhl_average_pct -
    ROUND(cost_of_living_index - 100, 1)
) > 0.1;


-- ============================================================
-- CT033
-- Affordability rank validity
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.costofliving_summary`
    WHERE affordability_rank < 1
       OR affordability_rank > nhl_city_count
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT033',
    'Cost of living affordability rank validity',
    'Validity',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Affordability rank should be between 1 and nhl_city_count.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT033',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Invalid affordability rank.',
    TO_JSON(STRUCT(
        venueLocation,
        affordability_rank,
        nhl_city_count
    ))
FROM `pacey32-agency.City.costofliving_summary`
WHERE affordability_rank < 1
   OR affordability_rank > nhl_city_count;


-- ============================================================
-- CT034
-- Cost-of-living city count
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH expected AS (
    SELECT COUNT(*) AS expected_count
    FROM `pacey32-agency.City.costofliving_summary`
),
failures AS (
    SELECT s.*
    FROM `pacey32-agency.City.costofliving_summary` s
    CROSS JOIN expected e
    WHERE s.nhl_city_count != e.expected_count
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT034',
    'Cost of living NHL city count',
    'Arithmetic',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'MEDIUM',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'nhl_city_count should equal the number of cost-of-living summary cities.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT034',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'Incorrect nhl_city_count.',
    TO_JSON(STRUCT(venueLocation, nhl_city_count))
FROM `pacey32-agency.City.costofliving_summary`
WHERE nhl_city_count != (
    SELECT COUNT(*)
    FROM `pacey32-agency.City.costofliving_summary`
);


-- ============================================================
-- CT035
-- Metrics-used consistency
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH detail AS (
    SELECT
        venueLocation,
        COUNT(DISTINCT metric) AS expected_metrics
    FROM `pacey32-agency.City.costofliving_detail`
    GROUP BY venueLocation
),
failures AS (
    SELECT
        s.venueLocation,
        s.metrics_used,
        d.expected_metrics
    FROM `pacey32-agency.City.costofliving_summary` s
    JOIN detail d
        USING (venueLocation)
    WHERE s.metrics_used != d.expected_metrics
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT035',
    'Cost of living metrics used reconciliation',
    'Reconciliation',
    'City',
    'costofliving_summary',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'metrics_used should reconcile to distinct selected metrics in costofliving_detail.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT035',
    'costofliving_summary',
    CAST(NULL AS INT64),
    venueLocation,
    'metrics_used does not reconcile to costofliving_detail.',
    TO_JSON(STRUCT(venueLocation, metrics_used, expected_metrics))
FROM (
    SELECT
        s.venueLocation,
        s.metrics_used,
        COUNT(DISTINCT d.metric) AS expected_metrics
    FROM `pacey32-agency.City.costofliving_summary` s
    JOIN `pacey32-agency.City.costofliving_detail` d
        USING (venueLocation)
    GROUP BY s.venueLocation, s.metrics_used
    HAVING s.metrics_used != COUNT(DISTINCT d.metric)
);


-- ============================================================
-- CT036
-- FX unique pair grain
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT currency_from, currency_to
    FROM `pacey32-agency.City.fxrate`
    GROUP BY currency_from, currency_to
    HAVING COUNT(*) > 1
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT036',
    'FX unique currency pair grain',
    'Grain',
    'City',
    'fxrate',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'fxrate should contain at most one row per currency pair.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT036',
    'fxrate',
    CAST(NULL AS INT64),
    CONCAT(currency_from, '|', currency_to),
    'Duplicate FX currency pair.',
    TO_JSON(STRUCT(currency_from, currency_to))
FROM (
    SELECT currency_from, currency_to
    FROM `pacey32-agency.City.fxrate`
    GROUP BY currency_from, currency_to
    HAVING COUNT(*) > 1
);


-- ============================================================
-- CT037
-- Required CAD/USD FX pairs
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH required AS (
    SELECT 'CAD' AS currency_from, 'USD' AS currency_to
    UNION ALL
    SELECT 'USD', 'CAD'
),
failures AS (
    SELECT r.*
    FROM required r
    LEFT JOIN `pacey32-agency.City.fxrate` f
        USING (currency_from, currency_to)
    WHERE f.currency_from IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT037',
    'Required NHL FX pairs',
    'Coverage',
    'City',
    'fxrate',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'CAD/USD and USD/CAD FX rates are required.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT037',
    'fxrate',
    CAST(NULL AS INT64),
    CONCAT(currency_from, '|', currency_to),
    'Required FX pair missing.',
    TO_JSON(STRUCT(currency_from, currency_to))
FROM (
    SELECT 'CAD' AS currency_from, 'USD' AS currency_to
    UNION ALL
    SELECT 'USD', 'CAD'
) r
WHERE NOT EXISTS (
    SELECT 1
    FROM `pacey32-agency.City.fxrate` f
    WHERE f.currency_from = r.currency_from
      AND f.currency_to = r.currency_to
);


-- ============================================================
-- CT038
-- FX positive values
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH failures AS (
    SELECT *
    FROM `pacey32-agency.City.fxrate`
    WHERE value <= 0
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT038',
    'FX positive values',
    'Validity',
    'City',
    'fxrate',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'FX values must be greater than zero.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT038',
    'fxrate',
    CAST(NULL AS INT64),
    CONCAT(currency_from, '|', currency_to),
    'FX value is not positive.',
    TO_JSON(STRUCT(currency_from, currency_to, value))
FROM `pacey32-agency.City.fxrate`
WHERE value <= 0;


-- ============================================================
-- CT039
-- CAD/USD reciprocal consistency
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH rates AS (
    SELECT
        MAX(IF(
            currency_from = 'CAD'
            AND currency_to = 'USD',
            value,
            NULL
        )) AS cad_usd,
        MAX(IF(
            currency_from = 'USD'
            AND currency_to = 'CAD',
            value,
            NULL
        )) AS usd_cad
    FROM `pacey32-agency.City.fxrate`
),
failures AS (
    SELECT *
    FROM rates
    WHERE cad_usd IS NULL
       OR usd_cad IS NULL
       OR ABS(cad_usd * usd_cad - 1) > 0.02
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT039',
    'FX reciprocal consistency',
    'Arithmetic',
    'City',
    'fxrate',
    CAST(NULL AS INT64),
    'HIGH',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'CAD/USD and USD/CAD should be approximately reciprocal allowing for stored rounding.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT039',
    'fxrate',
    CAST(NULL AS INT64),
    'CAD|USD',
    'CAD/USD and USD/CAD rates are not approximately reciprocal.',
    TO_JSON(t)
FROM (
    SELECT
        MAX(IF(
            currency_from = 'CAD'
            AND currency_to = 'USD',
            value,
            NULL
        )) AS cad_usd,
        MAX(IF(
            currency_from = 'USD'
            AND currency_to = 'CAD',
            value,
            NULL
        )) AS usd_cad
    FROM `pacey32-agency.City.fxrate`
) t
WHERE cad_usd IS NULL
   OR usd_cad IS NULL
   OR ABS(cad_usd * usd_cad - 1) > 0.02;


-- ============================================================
-- CT040
-- End-to-end current city coverage
-- ============================================================

INSERT INTO `pacey32-agency.QA.TestResults` (
    run_id, run_datetime, test_id, test_name, category,
    source_dataset, source_object, season, severity, status,
    failure_count, description, details
)
WITH current_cities AS (
    SELECT DISTINCT venueLocation
    FROM `pacey32-agency.Team.TeamList`
),
failures AS (
    SELECT t.venueLocation
    FROM current_cities t

    LEFT JOIN `pacey32-agency.City.CityReference` r
        ON t.venueLocation = r.city_name

    LEFT JOIN `pacey32-agency.City.city_summary` s
        ON t.venueLocation = s.venueLocation

    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.climate`
    ) cl
        ON t.venueLocation = cl.venueLocation

    LEFT JOIN `pacey32-agency.City.climate_summary` cls
        ON t.venueLocation = cls.venueLocation

    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.costofliving`
    ) col
        ON t.venueLocation = col.venueLocation

    LEFT JOIN `pacey32-agency.City.costofliving_summary` cols
        ON t.venueLocation = cols.venueLocation

    WHERE r.city_name IS NULL
       OR s.venueLocation IS NULL
       OR cl.venueLocation IS NULL
       OR cls.venueLocation IS NULL
       OR col.venueLocation IS NULL
       OR cols.venueLocation IS NULL
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT040',
    'Current NHL city end-to-end coverage',
    'Coverage',
    'City',
    'City domain',
    CAST(NULL AS INT64),
    'CRITICAL',
    IF(COUNT(*) = 0, 'PASS', 'FAIL'),
    COUNT(*),
    'Every current NHL venueLocation should exist throughout the City reference, summary, climate and cost-of-living outputs.',
    CAST(NULL AS STRING)
FROM failures;

INSERT INTO `pacey32-agency.QA.TestFailures` (
    run_id, run_datetime, test_id, source_object,
    season, record_key, failure_reason, record_json
)
SELECT
    v_run_id,
    v_run_datetime,
    'CT040',
    'City domain',
    CAST(NULL AS INT64),
    venueLocation,
    'Current NHL city does not have complete end-to-end City domain coverage.',
    TO_JSON(STRUCT(venueLocation))
FROM (
    SELECT t.venueLocation
    FROM (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.Team.TeamList`
    ) t

    LEFT JOIN `pacey32-agency.City.CityReference` r
        ON t.venueLocation = r.city_name

    LEFT JOIN `pacey32-agency.City.city_summary` s
        ON t.venueLocation = s.venueLocation

    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.climate`
    ) cl
        ON t.venueLocation = cl.venueLocation

    LEFT JOIN `pacey32-agency.City.climate_summary` cls
        ON t.venueLocation = cls.venueLocation

    LEFT JOIN (
        SELECT DISTINCT venueLocation
        FROM `pacey32-agency.City.costofliving`
    ) col
        ON t.venueLocation = col.venueLocation

    LEFT JOIN `pacey32-agency.City.costofliving_summary` cols
        ON t.venueLocation = cols.venueLocation

    WHERE r.city_name IS NULL
       OR s.venueLocation IS NULL
       OR cl.venueLocation IS NULL
       OR cls.venueLocation IS NULL
       OR col.venueLocation IS NULL
       OR cols.venueLocation IS NULL
);