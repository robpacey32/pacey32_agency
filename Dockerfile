FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install --with-deps chromium

COPY cap ./cap
COPY cityreference ./cityreference
COPY citysummary ./citysummary
COPY comparisonmodel ./comparisonmodel
COPY costofliving ./costofliving
COPY distancetravelled ./distancetravelled
COPY geospatial ./geospatial
COPY organisation ./organisation
COPY QA ./QA
COPY tax ./tax
COPY weather ./weather