/**
 * Build Hive blockchain operations (unsigned).
 *
 * Each function returns an operation tuple: [operation_name, params]
 */

export type HiveOperation = [string, Record<string, unknown>];

/** Transfer HIVE or HBD between accounts */
export function transfer(
  from: string,
  to: string,
  amount: string,
  memo = '',
): HiveOperation {
  return [
    'transfer',
    { from, to, amount, memo },
  ];
}

/** Move HIVE or HBD into savings */
export function transferToSavings(
  from: string,
  to: string,
  amount: string,
  memo = '',
): HiveOperation {
  return [
    'transfer_to_savings',
    { from, to, amount, memo },
  ];
}

/** Initiate withdrawal from savings (3-day delay) */
export function transferFromSavings(
  from: string,
  requestId: number,
  to: string,
  amount: string,
  memo = '',
): HiveOperation {
  return [
    'transfer_from_savings',
    { from, request_id: requestId, to, amount, memo },
  ];
}

/** Cancel a pending savings withdrawal */
export function cancelTransferFromSavings(
  from: string,
  requestId: number,
): HiveOperation {
  return [
    'cancel_transfer_from_savings',
    { from, request_id: requestId },
  ];
}
