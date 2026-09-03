/**
 * Builds direct search URLs the user can click to inspect an image manually
 * on each engine. Used when automated scraping returns few/no results.
 */
function buildManualLinks(imageUrl) {
  const enc = encodeURIComponent(imageUrl);
  return {
    googleLens: `https://lens.google.com/uploadbyurl?url=${enc}`,
    tinEye: `https://tineye.com/search?url=${enc}`,
    bing: `https://www.bing.com/images/searchbyimage?q=imgurl:${enc}`,
    yandex: `https://yandex.com/images/search?rpt=imageview&url=${enc}`
  };
}

module.exports = { buildManualLinks };
