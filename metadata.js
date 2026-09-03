const sharp = require('sharp');

/**
 * Extracts image metadata and EXIF info using sharp.
 * Returns useful details about the uploaded image itself.
 */
async function extractMetadata(imagePath) {
  try {
    const meta = await sharp(imagePath).metadata();
    const d = meta.exif || {};

    const toStr = (v) => (v === null || v === undefined ? null : String(v));

    // GPS helpers
    let gps = null;
    if (d.GPSLatitude && d.GPSLatitudeRef) {
      try {
        const latRef = d.GPSLatitudeRef.toString().trim();
        const lonRef = (d.GPSLongitudeRef || '').toString().trim();
        const lat = Array.isArray(d.GPSLatitude) ? d.GPSLatitude.map(Number) : null;
        const lon = Array.isArray(d.GPSLongitude) ? d.GPSLongitude.map(Number) : null;
        if (lat && lon) {
          const toDec = (arr) => arr[0] + arr[1] / 60 + arr[2] / 3600;
          gps = {
            lat: latRef === 'S' ? -toDec(lat) : toDec(lat),
            lon: lonRef === 'W' ? -toDec(lon) : toDec(lon)
          };
        }
      } catch (e) {}
    }

    return {
      fileName: null,
      width: meta.width,
      height: meta.height,
      format: meta.format,
      sizeBytes: meta.size,
      // EXIF
      make: toStr(d.Make),            // camera brand
      model: toStr(d.Model),          // camera model
      software: toStr(d.Software),    // editing software
      dateTaken: toStr(d.DateTimeOriginal) || toStr(d.CreateDate) || toStr(d.DateTime),
      dateDigitized: toStr(d.DateTimeDigitized),
      artist: toStr(d.Artist),
      copyright: toStr(d.Copyright),
      exposureTime: toStr(d.ExposureTime),
      fNumber: toStr(d.FNumber),
      isoSpeed: toStr(d.ISOSpeedRatings) || toStr(d.PhotographicSensitivity),
      focalLength: toStr(d.FocalLength),
      orientation: d.orientation,
      gps,
      description: toStr(d.ImageDescription),
      userComment: toStr(d.UserComment)
    };
  } catch (e) {
    return {};
  }
}

module.exports = { extractMetadata };
