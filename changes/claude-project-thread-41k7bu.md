# Cached readings take today's teacher spelling

- `scripts/precepts/readings.py`: a transcript whose readings come from the cache now passes its teacher through `prep.official_name`, so a class cached as "Elder Nathanyel" is written as "Bishop Nathanyel" without a forced rerun (follow-up to #751's review).
