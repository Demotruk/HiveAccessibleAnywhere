import 'dotenv/config';

/**
 * Publish bootstrap HTML as a Hive post.
 *
 * This makes the bootstrap loader discoverable on-chain — users can find it
 * on any Hive frontend (peakd.com, hive.blog, ecency.com), copy the HTML,
 * save it as a file, and open it in a browser to load the full wallet.
 *
 * Usage:
 *   npx tsx publish-bootstrap.ts [--locale en] [--version 1] [--dry-run]
 *   npx tsx publish-bootstrap.ts --all-locales [--version 1] [--dry-run]
 */

import { Transaction, PrivateKey, config as hiveTxConfig } from 'hive-tx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// -- Config --

const SUPPORTED_LOCALES = ['en', 'zh', 'ar', 'fa', 'ru', 'tr', 'vi'];
const INTER_LOCALE_DELAY_MS = 5 * 60 * 1000 + 10_000; // 5 min 10s between root posts

// -- Parse args --

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allLocales = args.includes('--all-locales');

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const version = getArg('--version', '1');
const singleLocale = getArg('--locale', 'en');

// -- Load environment --

const ACCOUNT = process.env.PROPOLIS_ACCOUNT || process.env.HAA_SERVICE_ACCOUNT;
const POSTING_KEY = process.env.PROPOLIS_POSTING_KEY || process.env.HAA_POSTING_KEY;

if (!ACCOUNT || !POSTING_KEY) {
  console.error('Missing environment variables: PROPOLIS_ACCOUNT, PROPOLIS_POSTING_KEY');
  process.exit(1);
}

// -- Config --

const DIST_DIR = resolve(import.meta.dirname, '..', 'wallet', 'dist');

// -- Localized post content --

interface PostStrings {
  title: string;
  heading: string;
  intro: string;
  howToUseHeading: string;
  steps: string[];
  whatThisDoesHeading: string;
  bullets: (account: string, version: string, locale: string) => string[];
  bootstrapHeading: string;
  footer: (account: string) => string;
}

const POST_STRINGS: Record<string, PostStrings> = {
  en: {
    title: 'Propolis Wallet — Bootstrap Loader (EN)',
    heading: '# Propolis Wallet — Bootstrap Loader',
    intro: 'This post contains a self-bootstrapping HTML loader for the **Propolis Wallet**.',
    howToUseHeading: '## How to use',
    steps: [
      '1. Copy the HTML code below',
      '2. Save it as a `.html` file (e.g. `propolis.html`)',
      '3. Open the file in any modern browser (Chrome, Firefox, Safari)',
      '4. The loader will fetch the full wallet from the Hive blockchain, verify its integrity via SHA-256, and load it automatically',
    ],
    whatThisDoesHeading: '## What this does',
    bullets: (account, version, locale) => [
      `- Fetches the Propolis Wallet application from [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) and its comments`,
      `- Verifies every chunk against its SHA-256 hash before executing anything`,
      `- Only loads code published by \`@${account}\` — comments from other accounts are ignored`,
      `- Caches the wallet locally (via IndexedDB) for faster subsequent loads`,
      `- The entire wallet runs locally in your browser — your keys never leave your device`,
    ],
    bootstrapHeading: '## Bootstrap HTML',
    footer: (account) => `*Published by @${account} — [MIT License](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  zh: {
    title: 'Propolis 钱包 — 引导加载器 (ZH)',
    heading: '# Propolis 钱包 — 引导加载器',
    intro: '本帖包含 **Propolis 钱包** 的自引导 HTML 加载器。',
    howToUseHeading: '## 使用方法',
    steps: [
      '1. 复制下方的 HTML 代码',
      '2. 将其保存为 `.html` 文件（例如 `propolis.html`）',
      '3. 用任意现代浏览器打开该文件（Chrome、Firefox、Safari）',
      '4. 加载器将从 Hive 区块链获取完整钱包，通过 SHA-256 验证其完整性，并自动加载',
    ],
    whatThisDoesHeading: '## 工作原理',
    bullets: (account, version, locale) => [
      `- 从 [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) 及其评论中获取 Propolis 钱包应用`,
      `- 在执行任何代码之前，逐块验证 SHA-256 哈希值`,
      `- 仅加载由 \`@${account}\` 发布的代码——其他账户的评论将被忽略`,
      `- 通过 IndexedDB 在本地缓存钱包，加快后续加载速度`,
      `- 整个钱包在您的浏览器中本地运行——您的密钥永远不会离开您的设备`,
    ],
    bootstrapHeading: '## 引导 HTML',
    footer: (account) => `*由 @${account} 发布 — [MIT 许可证](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  ar: {
    title: 'محفظة Propolis — محمّل التشغيل (AR)',
    heading: '# محفظة Propolis — محمّل التشغيل',
    intro: 'يحتوي هذا المنشور على محمّل HTML ذاتي التشغيل لـ **محفظة Propolis**.',
    howToUseHeading: '## طريقة الاستخدام',
    steps: [
      '1. انسخ كود HTML أدناه',
      '2. احفظه كملف `.html` (مثلاً `propolis.html`)',
      '3. افتح الملف في أي متصفح حديث (Chrome، Firefox، Safari)',
      '4. سيقوم المحمّل بجلب المحفظة الكاملة من بلوكتشين Hive، والتحقق من سلامتها عبر SHA-256، وتحميلها تلقائياً',
    ],
    whatThisDoesHeading: '## ماذا يفعل هذا',
    bullets: (account, version, locale) => [
      `- يجلب تطبيق محفظة Propolis من [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) وتعليقاته`,
      `- يتحقق من كل جزء مقابل تجزئة SHA-256 قبل تنفيذ أي شيء`,
      `- يحمّل فقط الكود المنشور بواسطة \`@${account}\` — يتم تجاهل تعليقات الحسابات الأخرى`,
      `- يخزّن المحفظة محلياً (عبر IndexedDB) لتسريع التحميلات اللاحقة`,
      `- تعمل المحفظة بالكامل محلياً في متصفحك — مفاتيحك لا تغادر جهازك أبداً`,
    ],
    bootstrapHeading: '## كود HTML للتشغيل',
    footer: (account) => `*نُشر بواسطة @${account} — [رخصة MIT](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  fa: {
    title: 'کیف پول Propolis — بارگذار راه‌اندازی (FA)',
    heading: '# کیف پول Propolis — بارگذار راه‌اندازی',
    intro: 'این پست حاوی یک بارگذار HTML خودراه‌انداز برای **کیف پول Propolis** است.',
    howToUseHeading: '## نحوه استفاده',
    steps: [
      '1. کد HTML زیر را کپی کنید',
      '2. آن را به عنوان فایل `.html` ذخیره کنید (مثلاً `propolis.html`)',
      '3. فایل را در هر مرورگر مدرنی باز کنید (Chrome، Firefox، Safari)',
      '4. بارگذار کیف پول کامل را از بلاکچین Hive دریافت، یکپارچگی آن را از طریق SHA-256 تأیید و به صورت خودکار بارگذاری می‌کند',
    ],
    whatThisDoesHeading: '## این چه کار می‌کند',
    bullets: (account, version, locale) => [
      `- برنامه کیف پول Propolis را از [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) و نظرات آن دریافت می‌کند`,
      `- هر قطعه را در مقابل هش SHA-256 آن قبل از اجرای هر چیزی تأیید می‌کند`,
      `- فقط کدهای منتشر شده توسط \`@${account}\` را بارگذاری می‌کند — نظرات سایر حساب‌ها نادیده گرفته می‌شوند`,
      `- کیف پول را به صورت محلی (از طریق IndexedDB) ذخیره می‌کند تا بارگذاری‌های بعدی سریع‌تر شوند`,
      `- کل کیف پول به صورت محلی در مرورگر شما اجرا می‌شود — کلیدهای شما هرگز دستگاهتان را ترک نمی‌کنند`,
    ],
    bootstrapHeading: '## کد HTML راه‌اندازی',
    footer: (account) => `*منتشر شده توسط @${account} — [مجوز MIT](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  ru: {
    title: 'Кошелёк Propolis — Загрузчик (RU)',
    heading: '# Кошелёк Propolis — Загрузчик',
    intro: 'Этот пост содержит самозагружающийся HTML-загрузчик для **кошелька Propolis**.',
    howToUseHeading: '## Как использовать',
    steps: [
      '1. Скопируйте HTML-код ниже',
      '2. Сохраните его как файл `.html` (например, `propolis.html`)',
      '3. Откройте файл в любом современном браузере (Chrome, Firefox, Safari)',
      '4. Загрузчик получит полный кошелёк из блокчейна Hive, проверит его целостность через SHA-256 и загрузит автоматически',
    ],
    whatThisDoesHeading: '## Что это делает',
    bullets: (account, version, locale) => [
      `- Получает приложение кошелька Propolis из [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) и его комментариев`,
      `- Проверяет каждый фрагмент по хешу SHA-256 перед выполнением чего-либо`,
      `- Загружает только код, опубликованный \`@${account}\` — комментарии других аккаунтов игнорируются`,
      `- Кеширует кошелёк локально (через IndexedDB) для ускорения последующих загрузок`,
      `- Весь кошелёк работает локально в вашем браузере — ваши ключи никогда не покидают ваше устройство`,
    ],
    bootstrapHeading: '## HTML-код загрузчика',
    footer: (account) => `*Опубликовано @${account} — [Лицензия MIT](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  tr: {
    title: 'Propolis Cüzdanı — Önyükleyici (TR)',
    heading: '# Propolis Cüzdanı — Önyükleyici',
    intro: 'Bu gönderi, **Propolis Cüzdanı** için kendi kendini başlatan bir HTML yükleyici içerir.',
    howToUseHeading: '## Nasıl kullanılır',
    steps: [
      '1. Aşağıdaki HTML kodunu kopyalayın',
      '2. Bir `.html` dosyası olarak kaydedin (örn. `propolis.html`)',
      '3. Dosyayı herhangi bir modern tarayıcıda açın (Chrome, Firefox, Safari)',
      '4. Yükleyici, tam cüzdanı Hive blokzincirinden alacak, SHA-256 ile bütünlüğünü doğrulayacak ve otomatik olarak yükleyecektir',
    ],
    whatThisDoesHeading: '## Bu ne yapar',
    bullets: (account, version, locale) => [
      `- Propolis Cüzdan uygulamasını [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) ve yorumlarından alır`,
      `- Herhangi bir şeyi çalıştırmadan önce her parçayı SHA-256 karması ile doğrular`,
      `- Yalnızca \`@${account}\` tarafından yayınlanan kodu yükler — diğer hesapların yorumları göz ardı edilir`,
      `- Sonraki yüklemeleri hızlandırmak için cüzdanı yerel olarak (IndexedDB aracılığıyla) önbelleğe alır`,
      `- Tüm cüzdan tarayıcınızda yerel olarak çalışır — anahtarlarınız cihazınızdan asla ayrılmaz`,
    ],
    bootstrapHeading: '## Önyükleyici HTML',
    footer: (account) => `*@${account} tarafından yayınlandı — [MIT Lisansı](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
  vi: {
    title: 'Ví Propolis — Trình Tải Khởi Động (VI)',
    heading: '# Ví Propolis — Trình Tải Khởi Động',
    intro: 'Bài đăng này chứa trình tải HTML tự khởi động cho **Ví Propolis**.',
    howToUseHeading: '## Cách sử dụng',
    steps: [
      '1. Sao chép mã HTML bên dưới',
      '2. Lưu thành tệp `.html` (ví dụ: `propolis.html`)',
      '3. Mở tệp trong bất kỳ trình duyệt hiện đại nào (Chrome, Firefox, Safari)',
      '4. Trình tải sẽ tải ví đầy đủ từ blockchain Hive, xác minh tính toàn vẹn qua SHA-256 và tải tự động',
    ],
    whatThisDoesHeading: '## Chức năng',
    bullets: (account, version, locale) => [
      `- Tải ứng dụng Ví Propolis từ [@${account}/propolis-wallet-v${version}-${locale}](https://hive.blog/@${account}/propolis-wallet-v${version}-${locale}) và các bình luận`,
      `- Xác minh từng phần với mã băm SHA-256 trước khi thực thi bất cứ điều gì`,
      `- Chỉ tải mã được xuất bản bởi \`@${account}\` — bình luận từ các tài khoản khác bị bỏ qua`,
      `- Lưu ví vào bộ nhớ cục bộ (qua IndexedDB) để tải nhanh hơn trong các lần sau`,
      `- Toàn bộ ví chạy cục bộ trong trình duyệt của bạn — khóa của bạn không bao giờ rời khỏi thiết bị`,
    ],
    bootstrapHeading: '## HTML Khởi Động',
    footer: (account) => `*Xuất bản bởi @${account} — [Giấy phép MIT](https://github.com/nicholidev/HiveAccessibleAnywhere/blob/develop/LICENSE)*`,
  },
};

// -- Helpers --

async function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// -- Publish a single locale --

async function publishLocale(locale: string): Promise<void> {
  const bootstrapPath = resolve(DIST_DIR, `propolis-bootstrap-${locale}.html`);
  let bootstrapHtml: string;
  try {
    bootstrapHtml = readFileSync(bootstrapPath, 'utf-8');
  } catch {
    console.error(`Bootstrap file not found: ${bootstrapPath}`);
    console.error('Run the distribute script first to generate bootstrap files.');
    process.exit(1);
  }

  const strings = POST_STRINGS[locale] || POST_STRINGS['en'];
  const permlink = `propolis-bootstrap-v${version}-${locale}`;
  const title = strings.title;

  const body = [
    strings.heading,
    '',
    strings.intro,
    '',
    strings.howToUseHeading,
    '',
    ...strings.steps,
    '',
    strings.whatThisDoesHeading,
    '',
    ...strings.bullets(ACCOUNT!, version, locale),
    '',
    strings.bootstrapHeading,
    '',
    '```html',
    bootstrapHtml,
    '```',
    '',
    '---',
    strings.footer(ACCOUNT!),
  ].join('\n');

  console.log(`\nPublishing bootstrap post: @${ACCOUNT}/${permlink}`);
  console.log(`Title: ${title}`);
  console.log(`Body size: ${(Buffer.byteLength(body, 'utf-8') / 1024).toFixed(1)} KB`);

  if (dryRun) {
    console.log('[DRY RUN] Would publish post');
    console.log(`\nPreview:\n${body.slice(0, 500)}...`);
    return;
  }

  const tx = new Transaction();
  await tx.addOperation('comment' as any, {
    parent_author: '',
    parent_permlink: 'propolis-wallet',
    author: ACCOUNT,
    permlink,
    title,
    body,
    json_metadata: JSON.stringify({
      app: 'propolis-wallet/1.0.0',
      tags: ['propolis-wallet', 'hive-wallet', 'bootstrap', 'open-source'],
      format: 'markdown',
    }),
  } as any);

  const key = PrivateKey.from(POSTING_KEY!);
  tx.sign(key);
  const result = await tx.broadcast(true);
  console.log(`Published! TX: ${result.tx_id?.slice(0, 12)}... (${result.status})`);
  console.log(`View at:`);
  console.log(`  https://peakd.com/@${ACCOUNT}/${permlink}`);
  console.log(`  https://hive.blog/@${ACCOUNT}/${permlink}`);
}

// -- Main --

async function main() {
  hiveTxConfig.nodes = ['https://api.hive.blog'];

  const locales = allLocales ? SUPPORTED_LOCALES : [singleLocale];

  console.log('=== Propolis Bootstrap Publisher ===');
  console.log(`Account: @${ACCOUNT}`);
  console.log(`Version: v${version}`);
  console.log(`Locales: ${locales.join(', ')}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  for (let i = 0; i < locales.length; i++) {
    if (i > 0 && !dryRun) {
      console.log(`\nWaiting ${INTER_LOCALE_DELAY_MS / 1000}s before next locale (Hive 5-min root post limit)...`);
      await delay(INTER_LOCALE_DELAY_MS);
    }
    await publishLocale(locales[i]);
  }

  console.log('\n=== Done ===');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
