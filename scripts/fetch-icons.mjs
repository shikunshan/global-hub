// fetch-icons.mjs
// 下载 sites.json 中所有网站的真实 favicon 到本地 assets/icons/ 目录
// 运行方式：node scripts/fetch-icons.mjs
// 作用：将网站 Logo 缓存到项目文件中，前端直接引用本地文件以提升加载速度

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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

// 下载图片到本地文件
async function download(url, dest) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 过滤掉空文件或 HTML 错误页（favicon 至少几百字节）
  if (buf.length < 100) throw new Error('File too small, likely error page');
  fs.writeFileSync(dest, buf);
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
  console.log(`开始下载 ${sitesData.sites.length} 个网站的 favicon...\n`);
  let success = 0;
  let failed = 0;
  const failedList = [];

  for (const site of sitesData.sites) {
    const hostname = getHostname(site.url);
    const iconPath = path.join(iconsDir, `${site.id}.png`);
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

  console.log(`\n完成：成功 ${success}，失败 ${failed}`);
  if (failedList.length > 0) {
    console.log(`失败列表：${failedList.join(', ')}`);
    console.log('失败的网站将在线上前端自动 fallback 到在线 API 加载。');
  }
}

main().catch((err) => {
  console.error('脚本执行出错:', err);
  process.exit(1);
});
