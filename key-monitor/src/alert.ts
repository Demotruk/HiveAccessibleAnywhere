/**
 * Telegram alerting.
 *
 * Sends alert messages via the Telegram Bot API using raw fetch.
 * No framework dependency needed for simple sendMessage calls.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendAlert(
  botToken: string,
  chatId: string,
  account: string,
  opType: string,
  opData: Record<string, string>,
  trxId: string,
): Promise<void> {
  const authoritiesUrl = `https://peakd.com/@${account}/authorities`;
  const explorerUrl = `https://hivehub.dev/tx/${trxId}`;

  const lines = [
    `\u26a0\ufe0f *Unexpected operation detected*`,
    ``,
    `*Account:* \`${account}\``,
    `*Operation:* \`${opType}\``,
    `*Transaction:* [${trxId.slice(0, 8)}...](${explorerUrl})`,
    ``,
    `This operation is not in the expected set for the gift card service.`,
    `This could indicate a security compromise.`,
    ``,
    `[Review & revoke authorities](${authoritiesUrl})`,
  ];

  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`Telegram alert failed (${resp.status}): ${body}`);
  }
}
