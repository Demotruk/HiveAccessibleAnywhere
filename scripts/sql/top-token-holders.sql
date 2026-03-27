-- Top 50 accounts by available account creation tokens
-- Run on HiveSQL: https://hivesql.io

SELECT TOP 50
    name,
    pending_claimed_accounts AS available_tokens
FROM Accounts
WHERE pending_claimed_accounts > 0
ORDER BY pending_claimed_accounts DESC;
