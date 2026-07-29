-- Delete seeded PRISM demo submissions and the dummy FIR 'ok'.
-- Intended targets:
--   1. Rows with FIR numbers PRISM/2026/001 ... PRISM/2026/012
--   2. Any row with fir_number = 'ok'
--
-- Recommended usage in production:
-- 1. Run the preview SELECT first and confirm the rows.
-- 2. Run the transactional DELETE block.
-- 3. Verify the remaining count is 0 before COMMIT completes.

-- Preview the rows that will be removed.
SELECT
    id,
    fir_number,
    accident_date,
    place_of_accident,
    created_at
FROM accident_submissions
WHERE fir_number LIKE 'PRISM/%'
   OR fir_number = 'ok'
ORDER BY fir_number;

-- Delete the matching demo submissions in a transaction.
BEGIN;

DELETE FROM accident_submissions
WHERE fir_number LIKE 'PRISM/%'
   OR fir_number = 'ok'
RETURNING
    id,
    fir_number,
    accident_date,
    place_of_accident;

-- Verify cleanup before commit.
SELECT COUNT(*) AS remaining_demo_submissions
FROM accident_submissions
WHERE fir_number LIKE 'PRISM/%'
   OR fir_number = 'ok';

COMMIT;
