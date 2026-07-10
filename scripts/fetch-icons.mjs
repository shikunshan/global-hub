// fetch-icons.mjs
// 下载 sites.json 中所有网站的真实 favicon 到本地 assets/icons/ 目录
// 运行方式：node scripts/fetch-icons.mjs
// 作用：将网站 Logo 缓存到项目文件中，前端直接引用本地文件以提升加载速度

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import ico from 'sharp-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const ICON_SIZE = 64; // px, square — favicons render at ~28-44px on the page

// 检测图片真实格式（很多站点把 ico/svg 直接返回，需按魔术字节判断）
function detectFormat(buf) {
  const hex = buf.subarray(0, 4).toString('hex');
  if (hex.startsWith('89504e47')) return 'png';
  if (hex.startsWith('47494638')) return 'gif';
  if (hex.startsWith('ffd8ff')) return 'jpeg';
  if (hex.startsWith('52494646')) return 'webp';
  if (hex.startsWith('00000100') || hex.startsWith('00000200')) return 'ico';
  const head = buf.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'svg';
  if (head.startsWith('<!') || head.startsWith('<html') || head.startsWith('<head')) return 'html';
  return 'unknown';
}

// 把任意 favicon 缓冲区转换为统一的小尺寸 PNG
async function toOptimizedPng(buf) {
  const fmt = detectFormat(buf);
  if (fmt === 'html' || fmt === 'unknown') {
    throw new Error(`unsupported/broken content (${fmt})`);
  }
  let img;
  if (fmt === 'ico') {
    const frames = ico.sharpsFromIco(buf, undefined, true);
    let best = null;
    let bestArea = -1;
    for (const entry of frames) {
      const candidate = entry.image || entry;
      const meta = await candidate.metadata();
      const area = (meta.width || 0) * (meta.height || 0);
      if (area > bestArea) { bestArea = area; best = candidate; }
    }
    if (!best) throw new Error('empty ICO');
    img = best;
  } else if (fmt === 'svg') {
    img = sharp(buf, { density: 256 });
  } else {
    img = sharp(buf, { animated: false });
  }
  return img
    .resize(ICON_SIZE, ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true, quality: 80, effort: 8 })
    .toBuffer();
}

const sitesData = JSON.parse(
  fs.readFileSync(path.join(root, 'data/sites.json'), 'utf-8')
);
const iconsDir = path.join(root, 'assets/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TIMEOUT_MS = 8000;

// 从网站 URL 提取主机名（去除 www. 前缀）
function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// 带超时的 fetch
function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, {
    redirect: 'follow',
    signal: controller.signal,
    headers: { 'User-Agent': UA },
  }).finally(() => clearTimeout(timer));
}

// 下载图片、优化为小尺寸 PNG 后写入本地文件
async function download(url, dest) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 过滤掉空文件或 HTML 错误页（favicon 至少几百字节）
  if (buf.length < 100) throw new Error('File too small, likely error page');
  // 转换 + 压缩为统一 64x64 PNG（同时会拒绝 HTML 错误页）
  const optimized = await toOptimizedPng(buf);
  fs.writeFileSync(dest, optimized);
}

// 从网站 HTML 中解析 <link rel="icon"> 的 href
async function parseIconFromHtml(siteUrl) {
  const res = await fetchWithTimeout(siteUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // 匹配 <link rel="icon" ...> 或 <link rel="shortcut icon" ...>
  const match = html.match(/<link[^>]*rel=["'](?:shortcut icon|icon)["'][^>]*>/i)
    || html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*>/i);
  if (!match) throw new Error('No icon link found in HTML');
  const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
  if (!hrefMatch) throw new Error('No href in icon link');
  let href = hrefMatch[1];
  // 处理相对路径
  if (href.startsWith('//')) {
    href = 'https:' + href;
  } else if (href.startsWith('/')) {
    href = new URL(siteUrl).origin + href;
  } else if (!href.startsWith('http')) {
    href = new URL(href, siteUrl).href;
  }
  return href;
}

// 主流程：遍历所有网站下载 favicon
async function main() {
  const force = process.argv.includes('--force');
  console.log(
    `开始处理 ${sitesData.sites.length} 个网站的 favicon${force ? '（强制重新下载全部）' : '（仅补齐缺失的）'}...\n`
  );
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const failedList = [];

  for (const site of sitesData.sites) {
    const hostname = getHostname(site.url);
    const iconPath = path.join(iconsDir, `${site.id}.png`);

    // 默认只补齐缺失的图标；已存在则跳过（用 --force 可全部重下）
    if (!force && fs.existsSync(iconPath)) {
      skipped++;
      continue;
    }

    let done = false;

    // 策略1：直接请求 /favicon.ico
    if (!done) {
      try {
        await download(`https://${hostname}/favicon.ico`, iconPath);
        console.log(`✓ ${site.id.padEnd(20)} <- /favicon.ico`);
        success++;
        done = true;
      } catch (e) { /* 继续下一步 */ }
    }

    // 策略2：从 HTML 解析 <link rel="icon">
    if (!done) {
      try {
        const iconUrl = await parseIconFromHtml(site.url);
        await download(iconUrl, iconPath);
        console.log(`✓ ${site.id.padEnd(20)} <- html parse`);
        success++;
        done = true;
      } catch (e) { /* 继续下一步 */ }
    }

    // 策略3：Google Favicon API（部分地区可能不可用）
    if (!done) {
      try {
        await download(`https://www.google.com/s2/favicons?sz=64&domain=${hostname}`, iconPath);
        console.log(`✓ ${site.id.padEnd(20)} <- google`);
        success++;
        done = true;
      } catch (e) { /* 继续下一步 */ }
    }

    if (!done) {
      console.error(`✗ ${site.id.padEnd(20)} failed`);
      failed++;
      failedList.push(site.id);
    }

    // 礼貌延迟
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n完成：成功 ${success}，跳过 ${skipped}，失败 ${failed}`);
  if (failedList.length > 0) {
    console.log(`失败列表：${failedList.join(', ')}`);
    console.log('失败的网站将在线上前端自动 fallback 到在线 API 加载。');
  }
}

main().catch((err) => {
  console.error('脚本执行出错:', err);
  process.exit(1);
});
