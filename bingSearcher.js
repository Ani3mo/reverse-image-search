const { launchBrowser, newPage, sleep } = require('./browser');

/**
 * Searches Bing Visual Search by local file upload via Puppeteer.
 *
 * @param {string} imagePath
 * @returns {Promise<Object>} { meta, results }
 */
async function searchBing(imagePath) {
  const out = { meta: { engine: 'Bing' }, results: [] };
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await newPage(browser);

    await page.goto('https://www.bing.com/images', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    // Open the visual search upload modal
    const opened = await page.evaluate(() => {
      const vis = document.querySelector('#visual_search, .isv_camera, a[aria-label*="visual" i]');
      if (vis) { vis.click(); return true; }
      return false;
    });
    await sleep(1500);

    // upload file
    let done = false;
    const accepted = await page.evaluate(() => {
      const input = document.querySelector('input[type=file]');
      if (input) { input.removeAttribute('hidden'); return true; }
      return false;
    });
    if (accepted) {
      const fi = await page.$('input[type=file]');
      await fi.uploadFile(imagePath);
      await sleep(6000);
      done = true;
    }

    // Wait for results
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('.iusc, .mimg, .dg_u, [class*=result]').length > 3;
      }, { timeout: 40000 });
    } catch (e) {}
    await sleep(3000);

    const results = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      document.querySelectorAll('.mimg').forEach((img, idx) => {
        // walk up to the card
        let card = img;
        for (let i = 0; i < 5; i++) {
          const p = card.parentElement;
          if (!p) break;
          card = p;
          if (card.querySelectorAll('a[href]').length) break;
        }
        const a = card.querySelector('a[href]');
        const href = a ? a.href : (img.getAttribute('data-m') ? (() => {
          try { return JSON.parse(img.getAttribute('data-m')).purl; } catch (e) { return ''; }
        })() : '');
        if (!href || !href.startsWith('http') || href.includes('bing.com')) return;
        const key = href;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          source: href,
          title: (img.getAttribute('alt') || '').trim(),
          snippet: (a ? a.textContent : '').trim(),
          thumb: img.src || '',
          date: null,
          engine: 'Bing'
        });
      });
      return items.slice(0, 20);
    });

    out.results = results;
  } catch (e) {
    // none
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  return out;
}

module.exports = { searchBing };
