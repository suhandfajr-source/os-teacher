const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = require('url');

(async () => {
  try {
    const htmlPath = path.resolve(__dirname, '../docs/brand/KLASSA_BRAND_ASSET_CHECKLIST.html');
    const pdfPathDocs = path.resolve(__dirname, '../docs/brand/KLASSA_BRAND_ASSET_CHECKLIST.pdf');
    const pdfPathRoot = path.resolve(__dirname, '../KLASSA_BRAND_ASSET_CHECKLIST.pdf');

    console.log('Reading HTML from:', htmlPath);
    const fileUrl = url.pathToFileURL(htmlPath).href;

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // Wait 1.5 seconds for Google Fonts & Tailwind to finish rendering
    await page.waitForTimeout(1500);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        bottom: '12mm',
        left: '10mm',
        right: '10mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 7.5pt; color: #94a3b8; width: 100%; text-align: right; padding-right: 10mm; font-family: sans-serif;">KLASSA &bull; Brand Asset Handoff Guide & Checklist</div>',
      footerTemplate: '<div style="font-size: 7.5pt; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 10mm; font-family: sans-serif;"><span>KLASSA — Ruang Kerja Cerdas Guru</span><span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span></div>'
    });

    fs.writeFileSync(pdfPathDocs, pdfBuffer);
    fs.writeFileSync(pdfPathRoot, pdfBuffer);

    console.log('PDF successfully generated!');
    console.log('1. ', pdfPathDocs);
    console.log('2. ', pdfPathRoot);

    await browser.close();
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
})();
