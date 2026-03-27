-- Distribution of token holders by size bracket
-- Run on HiveSQL: https://hivesql.io

SELECT
    CASE
        WHEN pending_claimed_accounts >= 1000 THEN '1000+'
        WHEN pending_claimed_accounts >= 100 THEN '100-999'
        WHEN pending_claimed_accounts >= 10 THEN '10-99'
        ELSE '1-9'
    END AS token_range,
    COUNT(*) AS num_accounts,
    SUM(pending_claimed_accounts) AS total_tokens
FROM Accounts
WHERE pending_claimed_accounts > 0
GROUP BY
    CASE
        WHEN pending_claimed_accounts >= 1000 THEN '1000+'
        WHEN pending_claimed_accounts >= 100 THEN '100-999'
        WHEN pending_claimed_accounts >= 10 THEN '10-99'
        ELSE '1-9'
    END
ORDER BY MIN(pending_claimed_accounts) DESC;
