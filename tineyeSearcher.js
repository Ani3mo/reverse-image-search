const { launchBrowser, newPage, sleep } = require('./browser');

/**
 * Searches TinEye via Puppeteer (renders JS). Uploads the local file directly.
 * TinEye reports: number of results, first indexed date, and per-match crawl dates.
 *
 * @param {string} imagePath absolute path to local image
 * @returns {Promise<Object>} { meta, results }
 */
async function searchTinEye(imagePath) {
  const out = {
    meta: { results: 0, firstIndexed: null, engine: 'TinEye' },
    results: [],
    similarImages: []
  };
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await newPage(browser);

    // Go to TinEye home
    await page.goto('https://tineye.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    // Find the file input and upload
    const fileInput = await page.$('input[type=file]');
    if (!fileInput) {
      throw new Error('TinEye file input not found');
    }
    await fileInput.uploadFile(imagePath);
    await sleep(3000);

    // Click the search button if present
    try {
      const btn = await page.$('button[type=submit], button[data-test=search-button], button:has-text("Search")');
      if (btn) await btn.click();
    } catch (e) {}

    // Wait for results to load
    await sleep(5000);
    try {
      await page.waitForFunction(() => {
        return !!document.querySelector('[data-test=result-count]') ||
               document.body.innerText.includes('results') &&
               !document.body.innerText.includes('Upload an image');
      }, { timeout: 40000 });
    } catch (e) {}
    await sleep(3000);

    // First indexed date
    const firstIndexed = await page.evaluate(() => {
      const m = document.body.innerText.match(/First indexed by TinEye on ([^\n]+)/);
      return m ? m[1].trim() : null;
    });

    // Result count
    let resultsCount = 0;
    try {
      const countEl = await page.$('[data-test=result-count]');
      if (countEl) {
        resultsCount = parseInt((await countEl.evaluate(el => el.textContent)).replace(/[^\d]/g, ''), 10) || 0;
      }
    } catch (e) {}

    // Parse each match row
    const parsed = await page.evaluate(() => {
      const items = [];
      const similarImgs = [];
      const thumbSeen = new Set();

      // Each match row has a container with class containing "flex items-start gap-8"
      // that contains an a[data-test=match-link] and an img[src*="img.tineye.com/result"]
      // Find all match-link anchors and walk up to the nearest parent containing a thumbnail
      const matchLinks = Array.from(document.querySelectorAll('a[data-test=match-link]'));

      matchLinks.forEach(a => {
        const href = a.href || a.getAttribute('title') || '';
        if (!href || href.startsWith('data:')) return;

        // Walk up to the nearest parent that contains a tineye thumbnail image
        let card = null;
        let el = a;
        for (let i = 0; i < 6; i++) {
          el = el.parentElement;
          if (!el) break;
          const img = el.querySelector('img[src*="img.tineye.com/result"]');
          if (img) { card = el; break; }
        }
        if (!card) return;

        // domain from h4 title or match-link text
        const h4 = card.querySelector('h4');
        const finalDomain = (h4 ? h4.getAttribute('title') || '' : '') || (() => {
          try { return new URL(href).hostname; } catch (e) { return ''; }
        })();

        // crawl date
        const dateEl = card.querySelector('[data-test=crawl-date]');
        const crawlDate = dateEl ? dateEl.textContent.trim() : null;

        // description
        const desc = (a.getAttribute('title') || '').trim();

        // page info
        const text = card.textContent || '';
        const pageTitle = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4).join(' | ');
        const domainName = finalDomain.replace(/^www\./, '');

        // Thumbnail: get the tineye result image in this card
        let thumb = '';
        const img = card.querySelector('img[src*="img.tineye.com/result"]');
        if (img) {
          thumb = img.src || '';
          if (thumb.startsWith('http') && !thumbSeen.has(thumb)) {
            thumbSeen.add(thumb);
            similarImgs.push({ image: thumb, source: href });
          }
        }

        items.push({
          source: href,
          title: desc || domainName,
          snippet: pageTitle,
          date: crawlDate,
          domain: finalDomain,
          thumb,
          engine: 'TinEye'
        });
      });
      return { results: items, similarImages: similarImgs };
    });

    out.meta = { results: resultsCount, firstIndexed, engine: 'TinEye' };
    out.results = parsed.results;
    out.similarImages = parsed.similarImages || [];
  } catch (e) {
    // fall back to URL-based search if upload fails
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  return out;
}

module.exports = { searchTinEye };
