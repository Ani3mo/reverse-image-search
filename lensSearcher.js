const { launchBrowser, newPage, sleep, findChrome } = require('./browser');

/**
 * Attempts Google Lens reverse image search via local file upload.
 * NOTE: Google frequently serves a CAPTCHA (/sorry) to fresh/datacenter IPs,
 * so this may return no parsed results. The caller should fall back to other
 * engines and always surface a direct Google Lens link to the user.
 *
 * @param {string} imagePath
 * @returns {Promise<Object>} { meta, results }
 */
async function searchGoogleLens(imagePath) {
  const out = { meta: { engine: 'Google', blocked: false, blockedUrl: null }, results: [] };
  if (!findChrome()) return out;

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await newPage(browser);

    await page.goto('https://lens.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2500);

    const fi = await page.$('input[type=file]');
    if (!fi) return out;
    await fi.uploadFile(imagePath);
    await sleep(3000);

    // Detect CAPTCHA redirect
    if (page.url().includes('/sorry/')) {
      out.meta.blocked = true;
      out.meta.blockedMsg = 'Google served a CAPTCHA challenge (automation detected).';
      return out;
    }

    // Wait for result grid
    try {
      await page.waitForFunction(() => {
        let n = 0;
        ['a[data-ri]', '.ShfRuc', '[data-test-id="grid"] a', 'div[data-test-id="grid"]'].forEach(
          s => (n += document.querySelectorAll(s).length)
        );
        return n > 2;
      }, { timeout: 45000 });
    } catch (e) {}
    await sleep(3000);

    const results = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.href || '';
        if (!href.startsWith('http')) return;
        if (/google\.|lens\.google|\/goto\//.test(href)) return;
        const title = (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 120);
        const img = a.querySelector('img');
        const thumb = img ? (img.src || img.getAttribute('data-src') || '') : '';
        const key = href + title;
        if (seen.has(key) || items.length >= 20) return;
        seen.add(key);
        items.push({ source: href, title, thumb, snippet: '', date: null, engine: 'Google' });
      });
      return items;
    });

    out.results = results;
  } catch (e) {
    // blocked or error
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  return out;
}

module.exports = { searchGoogleLens };
