-- Daily change in account creation tokens for @demotruk
-- Run against HiveSQL (https://hivesql.io)
-- Account creation tokens were introduced with HF20 (Sep 2018 on Steem, available since Hive genesis Mar 2020)

-- claim_account adds +1 token, create_claimed_account spends -1 token
SELECT
    CAST(Timestamp AS DATE) AS [Date],
    SUM(CASE WHEN Type = 'claim_account' THEN 1 ELSE 0 END) AS TokensClaimed,
    SUM(CASE WHEN Type = 'create_claimed_account' THEN -1 ELSE 0 END) AS TokensUsed,
    SUM(CASE
        WHEN Type = 'claim_account' THEN 1
        WHEN Type = 'create_claimed_account' THEN -1
        ELSE 0
    END) AS NetChange
FROM TxAccountCreates
WHERE creator = 'demotruk'
  AND Type IN ('claim_account', 'create_claimed_account')
GROUP BY CAST(Timestamp AS DATE)
ORDER BY [Date];
