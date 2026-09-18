const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = require('url');

(async () => {
  try {
    const htmlPath = path.resolve(__dirname, '../product-knowledge-v2.html');
    const pdfPathRoot = path.resolve(__dirname, '../product-knowledge-v2.pdf');
    const pdfPathDocs = path.resolve(__dirname, '../docs/PRODUCT_KNOWLEDGE_V2.pdf');

    console.log('Reading HTML from:', htmlPath);
    const fileUrl = url.pathToFileURL(htmlPath).href;

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // Wait 1 second for Google Fonts & layout to finish rendering
    await page.waitForTimeout(1000);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '16mm',
        bottom: '16mm',
        left: '12mm',
        right: '12mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 8pt; color: #94a3b8; width: 100%; text-align: right; padding-right: 12mm; font-family: sans-serif;">AI Teacher Assistant &bull; Product Knowledge V2</div>',
      footerTemplate: '<div style="font-size: 8pt; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm; font-family: sans-serif;"><span>Teacher OS &bull; Ringkasan Pengetahuan Produk Resmi</span><span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span></div>'
    });

    fs.writeFileSync(pdfPathRoot, pdfBuffer);
    fs.writeFileSync(pdfPathDocs, pdfBuffer);

    console.log('PDF V2 successfully generated!');
    console.log('1. ', pdfPathRoot);
    console.log('2. ', pdfPathDocs);

    await browser.close();
  } catch (err) {
    console.error('Error generating PDF V2:', err);
    process.exit(1);
  }
})();
