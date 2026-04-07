-- Delete seeded PRISM demo submissions.
-- Intended target: rows with FIR numbers PRISM/2026/001 ... PRISM/2026/012.
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
ORDER BY fir_number;

-- Delete the PRISM demo submissions in a transaction.
BEGIN;

DELETE FROM accident_submissions
WHERE fir_number LIKE 'PRISM/%'
RETURNING
    id,
    fir_number,
    accident_date,
    place_of_accident;

-- Verify cleanup before commit.
SELECT COUNT(*) AS remaining_prism_demo_submissions
FROM accident_submissions
WHERE fir_number LIKE 'PRISM/%';

COMMIT;
