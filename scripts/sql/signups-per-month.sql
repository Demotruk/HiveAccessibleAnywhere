-- New Hive account signups per month since chain inception (March 2020)
-- Run on HiveSQL: https://hivesql.io

SELECT
    FORMAT(created, 'yyyy-MM') AS month,
    COUNT(*) AS new_accounts
FROM Accounts
WHERE created >= '2020-03-01'
GROUP BY FORMAT(created, 'yyyy-MM')
ORDER BY month;
