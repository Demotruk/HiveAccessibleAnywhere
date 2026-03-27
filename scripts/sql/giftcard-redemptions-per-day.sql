-- Gift card redemptions per day
-- Queries HiveSQL for accounts created via the Propolis gift card service.
-- Identified by json_metadata containing "propolis-giftcard" in create_claimed_account ops.

SELECT
    CAST(t.expiration AS DATE) AS redemption_date,
    COUNT(*) AS redemptions
FROM
    TxAccountCreates ac
    INNER JOIN Transactions t ON t.tx_id = ac.tx_id
WHERE
    ac.json_metadata LIKE '%propolis-giftcard%'
GROUP BY
    CAST(t.expiration AS DATE)
ORDER BY
    redemption_date DESC;
