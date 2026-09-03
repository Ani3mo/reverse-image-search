# Reverse Image Search

A web app that finds the **source** and **date** an image appeared online, shows **visually similar images**, and extracts **EXIF metadata** (camera, GPS, date taken).

## How it works
1. Drag & drop any image (or browse).
2. The app uploads it and searches **TinEye, Google Lens, Yandex, and Bing** automatically.
3. Results show the source URL, the date it appeared, and similar-image thumbnails.

## Deployment
- **Platform:** Render (free web service)
- **Start:** `npm start` → runs `server.js`
- **Port:** controlled by `PORT` env var (Render injects it automatically)
- **Puppeteer:** full `puppeteer` is used so Chromium is downloaded during `npm install` and auto-discovered at runtime.

## Local dev
```bash
npm install
npm start
# open http://localhost:3000
```