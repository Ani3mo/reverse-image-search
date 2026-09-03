const { launchBrowser, newPage, sleep } = require('./browser');

/**
 * Searches Yandex Images by local file upload via Puppeteer.
 * Yandex reports approximate dates for matches.
 *
 * @param {string} imagePath
 * @returns {Promise<Object>} { meta, results }
 */
async function searchYandex(imagePath) {
  const out = { meta: { engine: 'Yandex' }, results: [] };
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await newPage(browser);

    await page.goto('https://yandex.com/images/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    // Open the upload input. Yandex has a hidden input[type=file]
    const accepted = await page.evaluate(() => {
      const input = document.querySelector('input[type=file]');
      if (input) {
        input.removeAttribute('hidden');
        input.removeAttribute('style');
        return true;
      }
      return false;
    });

    if (!accepted) throw new Error('Yandex file input not found');
    const fi = await page.$('input[type=file]');
    await fi.uploadFile(imagePath);
    await sleep(6000);

    // Wait for results grid
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('.serp-item, [data-cid], .CbirItem, a[href*="yandex"] img').length > 0;
      }, { timeout: 40000 });
    } catch (e) {}
    await sleep(3000);

    const results = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      // collect each serp item card
      document.querySelectorAll('.serp-item, .CbirItem, [data-cid]').forEach(card => {
        const a = card.querySelector('a[href]');
        let href = a ? a.href : '';
        if (href && href.startsWith('/')) href = 'https://yandex.com' + href;
        if (!href || !href.startsWith('http') || href.includes('yandex.')) return;
        const img = card.querySelector('img');
        const thumb = img ? (img.src || '') : '';
        let title = '';
        const tEl = card.querySelector('[class*="extended-title"], .title, h2, [class*=OrganicTitle]');
        if (tEl) title = tEl.textContent.trim();
        // date detection in snippet
        let snippet = '';
        const sEl = card.querySelector('[class*="snippet"], .TextContainer, [class*=snippet]');
        if (sEl) snippet = sEl.textContent.trim();
        const dateMatch = (snippet + ' ' + card.textContent).match(/\b(20\d{2}|19\d{2})\b/);
        const key = href;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          source: href,
          title: title || '',
          snippet: snippet || '',
          thumb,
          date: dateMatch ? dateMatch[1] : null,
          engine: 'Yandex'
        });
      });
      return items.slice(0, 20);
    });

    out.results = results;
  } catch (e) {
    // no results
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  return out;
}

module.exports = { searchYandex };
