const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const puppeteerCore = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

puppeteer.use(StealthPlugin());

// Fixed executable paths
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // Linux (Render / Docker / CI)
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/google/chrome/chrome'
];

// Recursively search common cache dirs for a bundled Chrome/Chromium
function searchChromeDirs() {
  const roots = [
    path.join(os.homedir(), '.cache', 'puppeteer', 'chrome'),
    '/root/.cache/puppeteer/chrome',
    '/tmp/puppeteer'
  ];
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/^chrome$|^chrome\.exe$/.test(e.name) && full.includes('chrome-linux')) {
        found.push(full);
      }
    }
  };
  for (const r of roots) walk(r, 0);
  return found;
}

function findChrome() {
  for (const c of CHROME_PATHS) {
    if (c && fs.existsSync(c)) return c;
  }
  // puppeteer's bundled Chromium executable path
  try {
    const bundled = puppeteerCore.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch (e) {}
  // search cache dirs
  const searched = searchChromeDirs();
  if (searched.length) return searched[0];
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchBrowser() {
  const chromePath = findChrome();
  const launchOpts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--lang=en-US,en'
    ],
    defaultViewport: { width: 1400, height: 1000 },
    ignoreDefaultArgs: ['--enable-automation']
  };
  if (chromePath) launchOpts.executablePath = chromePath;
  return puppeteer.launch(launchOpts);
}

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setDefaultNavigationTimeout(60000);
  await page.setDefaultTimeout(30000);
  return page;
}

module.exports = { findChrome, launchBrowser, newPage, sleep, puppeteer };
