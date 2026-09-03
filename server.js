const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { searchTinEye } = require('./tineyeSearcher');
const { searchYandex } = require('./yandexSearcher');
const { searchBing } = require('./bingSearcher');
const { searchGoogleLens } = require('./lensSearcher');
const { extractMetadata } = require('./metadata');
const { buildManualLinks } = require('./manualLinks');
const { findChrome } = require('./browser');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.post('/api/search', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const imagePath = req.file.path;
  // Build image URL from the request host so manual links work from any device (phone etc.)
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const baseUrl = `${proto}://${host}`;
  const servedUrl = `${baseUrl}/uploads/${req.file.filename}`;

  try {
    // Extract metadata about the image itself (camera, date, GPS, etc.)
    const meta = await extractMetadata(imagePath);
    meta.fileName = req.file.originalname;

    // Run all engines in parallel (each opens its own browser)
    let tinEye = { meta: { engine: 'TinEye' }, results: [] };
    let yandex = { meta: { engine: 'Yandex' }, results: [] };
    let bing = { meta: { engine: 'Bing' }, results: [] };
    let lens = { meta: { engine: 'Google' }, results: [] };

    const tasks = [
      searchTinEye(imagePath).then(r => { tinEye = r; }).catch(() => {}),
      searchYandex(imagePath).then(r => { yandex = r; }).catch(() => {}),
      searchBing(imagePath).then(r => { bing = r; }).catch(() => {})
    ];
    if (findChrome()) {
      tasks.push(searchGoogleLens(imagePath).then(r => { lens = r; }).catch(() => {}));
    }
    await Promise.all(tasks);

    // Consolidate & dedupe results
    const seen = new Set();
    const merged = [];
    const addAll = (arr, engine) => {
      for (const r of arr) {
        if (!r || !r.source) continue;
        const normalized = (r.source || '').replace(/\/+$/, '').replace(/utm_/g, '');
        const key = normalized + '|' + (r.title || '') + '|' + (r.date || '');
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...r, engine: r.engine || engine });
      }
    };
    // Prefer results that have dates
    addAll(tinEye.results, 'TinEye');
    addAll(lens.results, 'Google');
    addAll(yandex.results, 'Yandex');
    addAll(bing.results, 'Bing');

    merged.sort((a, b) => {
      const ad = a.date ? 1 : 0, bd = b.date ? 1 : 0;
      if (ad !== bd) return bd - ad;
      return 0;
    });

    // Collect similar images (thumbnails of matches) across all engines
    const simSeen = new Set();
    const similarImages = [];
    const addSimilar = (imgUrl, source) => {
      if (!imgUrl || !imgUrl.startsWith('http') || imgUrl.startsWith('data:')) return;
      if (simSeen.has(imgUrl)) return;
      simSeen.add(imgUrl);
      similarImages.push({ image: imgUrl, source: source || '' });
    };
    (tinEye.similarImages || []).forEach(s => addSimilar(s.image, s.source));
    merged.forEach(r => {
      if (r.thumb) addSimilar(r.thumb, r.source);
    });

    res.json({
      success: true,
      imageUrl: servedUrl,
      fileName: req.file.originalname,
      metadata: meta,
      engines: {
        tineye: { count: tinEye.results.length, info: tinEye.meta },
        yandex: { count: yandex.results.length },
        bing: { count: bing.results.length },
        google: { count: lens.results.length }
      },
      manualLinks: buildManualLinks(servedUrl),
      similarImages: similarImages.slice(0, 24),
      results: merged.slice(0, 60)
    });
  } catch (e) {
    res.status(500).json({ error: 'Search failed: ' + e.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    chrome: findChrome() ? 'found' : 'not found',
    version: '2.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`Reverse Image Search v2 running at http://localhost:${PORT}`);
  console.log(`Chrome: ${findChrome() || 'NOT FOUND'}`);
});
