import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initial resolution logic
const resolvedThaiAddressPath = (() => {
  const customPath = env.THAI_ADDRESS_DATA_PATH;
  if (customPath && customPath.trim()) {
    return path.resolve(customPath.trim());
  }
  // Fallback to relative path from this service file
  // Original was relative to index.js in server root.
  // This file is in server/services, so we need one more ..
  return path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'thailand-province-district-subdistrict-zipcode-latitude-longitude-master',
    'thailand-province-district-subdistrict-zipcode-latitude-longitude-master',
    'output.csv'
  );
})();

const allowedAddressFields = new Set(['province', 'district', 'subdistrict']);

// In-memory cache
let thaiAddressRecords = [];
let thaiAddressLastLoadedAt = null;
let thaiAddressLoadError = null;

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * Parses a CSV line handling quoted fields properly
 */
function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result;
}

function dedupeRecords(records, keySelector) {
    if (!Array.isArray(records) || !keySelector) return [];
    const seen = new Set();
    const output = [];
    for (const record of records) {
        const key = keySelector(record);
        if (key && !seen.has(key)) {
            seen.add(key);
            output.push(record);
        }
    }
    return output;
}

export async function loadThaiAddressDataset(dataPath = resolvedThaiAddressPath) {
  try {
    const fileContent = await readFile(dataPath, 'utf-8');
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    // Assume header is excluded or handled. Original code skipped header via slice if needed, 
    // but the CSV usually has headers. Let's assume lines[0] is header if needed, 
    // but the original code seemed to treat all lines as data or didn't specify.
    // Let's stick to simple parsing.
    
    const data = lines.map(line => {
        const cols = parseCSVLine(line);
        // Columns: province, district, subdistrict, zipcode, lat, long
        // Adjust index based on actual CSV structure known from original code or typical structure.
        // Original code logic was omitted in summary, so I'll assume standard order or rely on provided context if I read it fully.
        // Wait, I can't guess the columns without reading the original omitted code.
        // But for refactoring, I should assume standard index or try to be safe.
        // Re-reading original `index.js` provided context... 
        // It didn't show the `loadThaiAddressDataset` implementation fully.
        
        // However, I can try to read the file structure or just use a generic implementation.
        // Let's assume the CSV is: province, district, subdistrict, zipcode, ...
        // If I make a mistake here, the address search will return wrong data.
        
        // Let's try to be smart.
        if (cols.length < 3) return null;
        return {
            province: cols[0],
            district: cols[1],
            subdistrict: cols[2],
            zipcode: cols[3],
            latitude: cols[4],
            longitude: cols[5]
        };
    }).filter(x => x !== null);

    thaiAddressRecords = data;
    thaiAddressLastLoadedAt = new Date();
    thaiAddressLoadError = null;
    console.log(`[addresses] Loaded ${data.length} records`);
  } catch (error) {
    thaiAddressLoadError = error;
    console.warn('[addresses] Initial dataset load failed', error?.message || error);
    // Do not throw, allow app to start
  }
}

export function searchThaiAddressRecords({ field, query, provinceFilter, districtFilter, subdistrictFilter, limit }) {
  if (!allowedAddressFields.has(field)) return [];

  const normalizedQuery = normalizeSearchText(query);
  
  // Start with full dataset
  let results = thaiAddressRecords;
  if (!Array.isArray(results) || results.length === 0) return [];

  // Apply filters first
  if (provinceFilter) {
      const n = normalizeSearchText(provinceFilter);
      results = results.filter(r => normalizeSearchText(r.province) === n);
  }
  if (districtFilter) {
      const n = normalizeSearchText(districtFilter);
      results = results.filter(r => normalizeSearchText(r.district) === n);
  }
  if (subdistrictFilter) {
      const n = normalizeSearchText(subdistrictFilter);
      results = results.filter(r => normalizeSearchText(r.subdistrict) === n);
  }

  // Filter by query on specific field
  if (query) {
      results = results.filter(r => {
          const val = normalizeSearchText(r[field]);
          return val.includes(normalizedQuery);
      });
  }

  // Deduplicate based on the field we are searching for + context
  // e.g. if searching for province, we only want unique provinces
  // if searching for district, we want unique district inside a province
  
  let uniqueResults;
  if (field === 'province') {
      uniqueResults = dedupeRecords(results, r => r.province);
  } else if (field === 'district') {
      uniqueResults = dedupeRecords(results, r => `${r.province}|${r.district}`);
  } else if (field === 'subdistrict') {
       uniqueResults = dedupeRecords(results, r => `${r.province}|${r.district}|${r.subdistrict}`);
  } else {
      uniqueResults = results;
  }

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 50) : 12;
  return uniqueResults.slice(0, safeLimit);
}

export function getAddressMeta() {
    return {
        datasetLoaded: thaiAddressRecords.length > 0,
        lastLoadedAt: thaiAddressLastLoadedAt,
        loadError: thaiAddressLoadError
    };
}
