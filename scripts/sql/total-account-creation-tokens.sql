-- Total unclaimed account creation tokens across all Hive accounts
-- Run on HiveSQL: https://hivesql.io

SELECT
    SUM(pending_claimed_accounts) AS total_tokens
FROM Accounts
WHERE pending_claimed_accounts > 0;
