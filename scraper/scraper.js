/**
 * TheScentReserve Product Scraper
 * ==============================
 *
 * Purpose: Scrapes fragrance product data from thescentreserve.com
 * and saves it to a structured JSON file for static site usage.
 *
 * Process Flow:
 * 1. Scrape product listings (paginated)
 * 2. Extract product URLs
 * 3. Visit each product page
 * 4. Extract fragrance notes
 * 5. Save to JSON
 *
 * Reference:
 * - Site structure: https://thescentreserve.com/collections/all-1
 * - Product schema based on: https://schema.org/Product
 *
 * @author Kira Takashi Kenjiro
 * @version 1.0.0
 * @lastModified 21/04/2025
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs/promises');
const path = require('path');

// * Configuration constants
const baseURL = 'https://thescentreserve.com/collections/all-1';
const productRoot = 'https://thescentreserve.com';
const outputPath = path.join(__dirname, '..', 'data', 'products.json');

// * Regex patterns for product name validation
const productPatterns = [
  /^\d+\s*-\s*Inspired by.+/i,
  /^\d+\s*x\s*\d+\s*-\s*Blended Inspired by.+/i
];

/**
 * Sanitizes fragrance notes by removing standardized prefixes
 * @param {string} rawNote - The raw note text from the website
 * @param {string} noteType - The type of note (Top/Middle/Bottom)
 * @returns {string} Cleaned note text
 */
function sanitizeNotes(rawNote, noteType) {
  if (!rawNote) return '';
  const regex = new RegExp(`^\\s*${noteType}\\s*:?\\s*`, 'i');
  return rawNote.replace(regex, '').trim();
}

/**
 * Scrapes individual product details
 *
 * Algorithm:
 * 1. Fetch product page HTML
 * 2. Extract notes using primary selectors
 * 3. If primary fails, try accordion fallback
 * 4. Sanitize and structure data
 *
 * Product Scraping Flow:
 * ┌─────────────┐     ┌──────────────┐     ┌────────────┐
 * │ List Pages  │ ──> │Product Pages │ ──> │Extract Data│
 * └─────────────┘     └──────────────┘     └────────────┘
 *       │                    │                    │
 *       v                    v                    v
 * Pagination          Product URLs         Notes Data
 *                                                 │
 *                                                 v
 *                                          products.json
 *
 * @param {string} url - Product page URL
 * @returns {Promise<Object|null>} Product details or null if failed
 */
async function scrapeProductDetails(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScentScraper/1.0)'
      }
    });
    const $ = cheerio.load(response.data);

    // * Primary selectors for fragrance notes
    let topNotes = $('#ProductAccordion-collapsible_tab_EjJ84U-template--17212741648578__main > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > p:nth-child(1)').text().trim();
    let middleNotes = $('#ProductAccordion-collapsible_tab_EjJ84U-template--17212741648578__main > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > p:nth-child(1)').text().trim();
    let bottomNotes = $('#ProductAccordion-collapsible_tab_EjJ84U-template--17212741648578__main > div:nth-child(1) > div:nth-child(3) > div:nth-child(2) > div:nth-child(1) > p:nth-child(1)').text().trim();

    // ? HACK: Fallback to accordion text if specific selectors fail
    if (!topNotes || !middleNotes || !bottomNotes) {
      const accordionText = $('div.product__accordion:nth-child(17) > div:nth-child(2)').text();
      const notesMatch = accordionText.match(/Top Notes:(.*?)Middle Notes:(.*?)Bottom Notes:(.*)/s);

      if (notesMatch) {
        [, topNotes, middleNotes, bottomNotes] = notesMatch;
      }
    }

    return {
      topNotes: sanitizeNotes(topNotes, 'Top Notes'),
      middleNotes: sanitizeNotes(middleNotes, 'Middle Notes'),
      bottomNotes: sanitizeNotes(bottomNotes, 'Bottom Notes')
    };
  } catch (error) {
    // ! BUG: Some products might have different HTML structure
    console.error(`Error scraping product details from ${url}:`, error.message);
    return null;
  }
}

/**
 * Main scraping function that processes all products
 *
 * Algorithm:
 * 1. Initialize empty products array
 * 2. For each page:
 *    a. Fetch product listings
 *    b. Extract matching products
 *    c. For each product:
 *       - Scrape details
 *       - Add to array
 * 3. Continue until "No products found"
 *
 * @returns {Promise<Array>} Array of product objects
 */
async function scrapeAllProducts() {
  let page = 1;
  let allProducts = [];
  let endReached = false;

  while (!endReached) {
    const url = `${baseURL}?page=${page}`;
    console.log(`Scraping page ${page}: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ScentScraper/1.0)'
        }
      });
      const $ = cheerio.load(response.data);

      // Check for pagination end
      const titleText = $('.title').first().text().trim();
      if (titleText.includes('No products found')) {
        endReached = true;
        break;
      }

      // Extract products from current page
      const pageProducts = [];
      $('#product-grid li.grid__item').each((i, elem) => {
        const productAnchor = $(elem).find('a[href^="/products/"]').first();
        const productName = productAnchor.text().trim();
        const productHref = productAnchor.attr('href');

        if (productName && productHref && productPatterns.some(pattern => pattern.test(productName))) {
          pageProducts.push({
            name: productName,
            url: `${productRoot}${productHref}`
          });
        }
      });

      // Scrape details for each product
      for (const product of pageProducts) {
        console.log(`Scraping details for: ${product.name}`);
        const details = await scrapeProductDetails(product.url);
        if (details) {
          allProducts.push({
            ...product,
            ...details,
            lastUpdated: new Date().toISOString()
          });
        }
        // * Note: Polite delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      page++;
    } catch (error) {
      console.error(`Error on page ${page}:`, error.message);
      break;
    }
  }

  return allProducts;
}

/**
 * Main execution function
 * Creates data directory if needed and saves scraped data
 */
async function main() {
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Scrape products
    const products = await scrapeAllProducts();

    // Save to JSON file
    await fs.writeFile(
      outputPath,
      JSON.stringify(products, null, 2),
      'utf8'
    );

    console.log(`\nScraping complete!`);
    console.log(`Total products saved: ${products.length}`);
    console.log(`Output saved to: ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().then(r => process.exit(1));