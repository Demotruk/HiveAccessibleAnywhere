-- Token holders broken down by active vs inactive (posted or voted in last 90 days)
-- Run on HiveSQL: https://hivesql.io

SELECT
    CASE
        WHEN last_post >= DATEADD(DAY, -90, GETUTCDATE())
          OR last_vote_time >= DATEADD(DAY, -90, GETUTCDATE())
        THEN 'Active (90 days)'
        ELSE 'Inactive'
    END AS activity_status,
    COUNT(*) AS num_accounts,
    SUM(pending_claimed_accounts) AS total_tokens
FROM Accounts
WHERE pending_claimed_accounts > 0
GROUP BY
    CASE
        WHEN last_post >= DATEADD(DAY, -90, GETUTCDATE())
          OR last_vote_time >= DATEADD(DAY, -90, GETUTCDATE())
        THEN 'Active (90 days)'
        ELSE 'Inactive'
    END
ORDER BY activity_status;
