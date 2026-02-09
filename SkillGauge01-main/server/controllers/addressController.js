import { searchThaiAddressRecords, getAddressMeta } from '../services/thaiAddressService.js';

export const addressController = {
  search: (req, res) => {
    const fieldRaw = typeof req.query.field === 'string' ? req.query.field.toLowerCase() : '';
    const queryRaw = typeof req.query.query === 'string' ? req.query.query.trim() : '';

    const provinceFilter = typeof req.query.province === 'string' ? req.query.province : '';
    const districtFilter = typeof req.query.district === 'string' ? req.query.district : '';
    const subdistrictFilter = typeof req.query.subdistrict === 'string' ? req.query.subdistrict : '';

    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limitValue = Number.parseInt(typeof limitParam === 'string' ? limitParam : '', 10);

    const searchResults = searchThaiAddressRecords({
      field: fieldRaw,
      query: queryRaw,
      provinceFilter,
      districtFilter,
      subdistrictFilter,
      limit: Number.isNaN(limitValue) ? undefined : limitValue
    }).map(record => ({
      province: record.province,
      district: record.district,
      subdistrict: record.subdistrict,
      zipcode: record.zipcode,
      latitude: record.latitude,
      longitude: record.longitude
    }));

    const meta = getAddressMeta();

    res.json({
      query: queryRaw,
      field: fieldRaw,
      results: searchResults,
      meta: {
        total: searchResults.length,
        datasetLoaded: meta.datasetLoaded,
        lastLoadedAt: meta.lastLoadedAt ? meta.lastLoadedAt.toISOString() : null,
        loadError: meta.loadError ? String(meta.loadError.message || meta.loadError) : null
      }
    });
  }
};
