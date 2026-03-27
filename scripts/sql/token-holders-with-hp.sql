-- Accounts with tokens that also have enough HP to delegate to new users (10+ HP available)
-- Run on HiveSQL: https://hivesql.io

SELECT
    a.name,
    a.pending_claimed_accounts AS available_tokens,
    ROUND((a.vesting_shares - a.delegated_vesting_shares - a.vesting_withdraw_rate)
        / 1000000.0 * dp.base_per_mvest, 2) AS available_hp_approx
FROM Accounts a
CROSS JOIN (
    SELECT TOP 1
        total_vesting_fund_hive / (total_vesting_shares / 1000000.0) AS base_per_mvest
    FROM DynamicGlobalProperties
) dp
WHERE a.pending_claimed_accounts > 0
  AND (a.vesting_shares - a.delegated_vesting_shares - a.vesting_withdraw_rate)
      / 1000000.0 * dp.base_per_mvest > 10
ORDER BY a.pending_claimed_accounts DESC;
