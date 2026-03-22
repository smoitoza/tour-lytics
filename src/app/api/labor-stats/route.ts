import { NextRequest, NextResponse } from 'next/server'

/**
 * Labor Market Stats API - BLS QCEW (Quarterly Census of Employment and Wages)
 * Returns county-level employment data for heatmap visualization.
 *
 * POST body: {
 *   lat: number,        // map center latitude
 *   lng: number,        // map center longitude
 *   radius: number,     // search radius in km (default 80)
 *   industry: string,   // NAICS industry code
 * }
 *
 * Industry codes (NAICS supersectors):
 *   '51'       - Information (Tech)
 *   '52'       - Finance and Insurance
 *   '54'       - Professional, Scientific, and Technical Services
 *   '62'       - Health Care
 *   '31_33'    - Manufacturing
 *   '10'       - Total, all industries
 */

// County centroids for major US metro areas (FIPS -> [lat, lng, name])
// Pre-computed centroids for the ~200 most-populated counties
const COUNTY_CENTROIDS: Record<string, [number, number, string]> = {
  // California
  '06001': [37.6468, -121.8893, 'Alameda County, CA'],
  '06013': [37.9194, -122.0911, 'Contra Costa County, CA'],
  '06041': [38.0515, -122.7413, 'Marin County, CA'],
  '06055': [38.5068, -122.3286, 'Napa County, CA'],
  '06059': [33.7175, -117.8311, 'Orange County, CA'],
  '06065': [33.7428, -116.3100, 'Riverside County, CA'],
  '06067': [38.4500, -121.3400, 'Sacramento County, CA'],
  '06071': [34.8414, -116.1785, 'San Bernardino County, CA'],
  '06073': [33.0236, -116.7792, 'San Diego County, CA'],
  '06075': [37.7599, -122.4148, 'San Francisco County, CA'],
  '06077': [37.9519, -121.2908, 'San Joaquin County, CA'],
  '06081': [37.4340, -122.3553, 'San Mateo County, CA'],
  '06085': [37.2320, -121.6961, 'Santa Clara County, CA'],
  '06087': [37.0000, -122.0000, 'Santa Cruz County, CA'],
  '06095': [38.2572, -122.0534, 'Solano County, CA'],
  '06097': [38.5111, -122.8450, 'Sonoma County, CA'],
  '06037': [34.0522, -118.2437, 'Los Angeles County, CA'],
  '06111': [34.3519, -119.1371, 'Ventura County, CA'],
  '06029': [35.3733, -119.0187, 'Kern County, CA'],
  '06019': [36.7500, -119.7500, 'Fresno County, CA'],

  // New York
  '36061': [40.7831, -73.9712, 'New York County, NY'],
  '36047': [40.6500, -73.9500, 'Kings County, NY'],
  '36081': [40.7282, -73.7949, 'Queens County, NY'],
  '36005': [40.8448, -73.8648, 'Bronx County, NY'],
  '36085': [40.5795, -74.1502, 'Richmond County, NY'],
  '36103': [40.7872, -73.1351, 'Suffolk County, NY'],
  '36059': [40.7222, -73.5884, 'Nassau County, NY'],
  '36119': [41.1220, -73.7949, 'Westchester County, NY'],

  // Texas
  '48201': [29.7604, -95.3698, 'Harris County, TX'],
  '48113': [32.7672, -96.7779, 'Dallas County, TX'],
  '48029': [29.4241, -98.4936, 'Bexar County, TX'],
  '48439': [30.3265, -97.7713, 'Travis County, TX'],
  '48141': [32.5200, -97.3200, 'El Paso County, TX'],
  '48453': [30.2672, -97.7431, 'Travis County, TX'],
  '48121': [32.7500, -96.8500, 'Denton County, TX'],
  '48085': [33.0198, -96.7115, 'Collin County, TX'],
  '48157': [32.8998, -97.3195, 'Fort Worth, TX'],
  '48491': [31.7619, -106.4850, 'Williamson County, TX'],

  // Illinois
  '17031': [41.8119, -87.6818, 'Cook County, IL'],
  '17043': [41.8498, -88.0900, 'DuPage County, IL'],
  '17089': [42.2500, -87.8600, 'Kane County, IL'],
  '17097': [42.3222, -87.8407, 'Lake County, IL'],
  '17197': [41.6870, -88.0654, 'Will County, IL'],

  // Florida
  '12086': [25.7617, -80.1918, 'Miami-Dade County, FL'],
  '12011': [26.1224, -80.1373, 'Broward County, FL'],
  '12099': [26.6516, -80.0569, 'Palm Beach County, FL'],
  '12057': [28.5383, -81.3792, 'Hillsborough County, FL'],
  '12095': [28.5383, -81.3792, 'Orange County, FL'],
  '12031': [30.3322, -81.6557, 'Duval County, FL'],
  '12103': [27.7703, -82.6794, 'Pinellas County, FL'],

  // Washington
  '53033': [47.4905, -121.8355, 'King County, WA'],
  '53053': [47.2529, -122.4443, 'Pierce County, WA'],
  '53061': [47.9413, -122.2177, 'Snohomish County, WA'],

  // Massachusetts
  '25025': [42.3301, -71.0589, 'Suffolk County, MA'],
  '25017': [42.4551, -71.0660, 'Middlesex County, MA'],
  '25021': [42.0987, -71.0319, 'Norfolk County, MA'],
  '25023': [42.4501, -70.9500, 'Plymouth County, MA'],
  '25009': [42.4724, -70.9469, 'Essex County, MA'],
  '25027': [42.1660, -72.6414, 'Worcester County, MA'],

  // Pennsylvania
  '42101': [39.9526, -75.1652, 'Philadelphia County, PA'],
  '42003': [40.4406, -79.9959, 'Allegheny County, PA'],
  '42045': [40.0379, -75.3134, 'Delaware County, PA'],
  '42091': [40.2116, -75.4734, 'Montgomery County, PA'],
  '42017': [40.0694, -75.6249, 'Bucks County, PA'],
  '42029': [39.9734, -75.6010, 'Chester County, PA'],

  // Georgia
  '13121': [33.7581, -84.3963, 'Fulton County, GA'],
  '13089': [33.7757, -84.1824, 'DeKalb County, GA'],
  '13067': [33.9519, -84.5417, 'Cobb County, GA'],
  '13135': [33.9600, -84.0200, 'Gwinnett County, GA'],

  // Colorado
  '08031': [39.7392, -104.9903, 'Denver County, CO'],
  '08001': [39.8868, -105.0665, 'Adams County, CO'],
  '08005': [39.6468, -104.8258, 'Arapahoe County, CO'],
  '08035': [39.5800, -105.0300, 'Douglas County, CO'],
  '08059': [39.8808, -105.7649, 'Jefferson County, CO'],
  '08013': [40.0150, -105.2705, 'Boulder County, CO'],

  // Arizona
  '04013': [33.3490, -112.4920, 'Maricopa County, AZ'],
  '04019': [32.1574, -110.8841, 'Pima County, AZ'],

  // Michigan
  '26163': [42.3314, -83.0458, 'Wayne County, MI'],
  '26125': [42.4733, -83.2500, 'Oakland County, MI'],
  '26099': [42.6000, -82.9000, 'Macomb County, MI'],

  // Ohio
  '39035': [41.4993, -81.6944, 'Cuyahoga County, OH'],
  '39049': [39.9612, -82.9988, 'Franklin County, OH'],
  '39061': [39.1031, -84.5120, 'Hamilton County, OH'],

  // Virginia
  '51059': [38.8462, -77.3064, 'Fairfax County, VA'],
  '51107': [38.9849, -77.3942, 'Loudoun County, VA'],
  '51013': [38.8729, -77.1119, 'Arlington County, VA'],
  '51510': [38.3032, -77.4605, 'Alexandria City, VA'],

  // Maryland
  '24031': [39.1547, -77.2405, 'Montgomery County, MD'],
  '24033': [38.8188, -76.7487, 'Prince Georges County, MD'],
  '24003': [39.0458, -76.6413, 'Anne Arundel County, MD'],
  '24005': [39.4143, -76.6105, 'Baltimore County, MD'],
  '24510': [39.2904, -76.6122, 'Baltimore City, MD'],

  // DC
  '11001': [38.9072, -77.0369, 'District of Columbia'],

  // New Jersey
  '34013': [40.4774, -74.2591, 'Essex County, NJ'],
  '34003': [40.8710, -74.0420, 'Bergen County, NJ'],
  '34017': [40.6340, -74.3080, 'Hudson County, NJ'],
  '34023': [40.5081, -74.3618, 'Middlesex County, NJ'],
  '34025': [40.4093, -74.2322, 'Monmouth County, NJ'],
  '34039': [40.5752, -74.6110, 'Union County, NJ'],
  '34027': [40.4137, -74.5089, 'Morris County, NJ'],

  // Connecticut
  '09001': [41.2230, -73.1960, 'Fairfield County, CT'],
  '09003': [41.3948, -72.5280, 'Hartford County, CT'],
  '09009': [41.3502, -72.8973, 'New Haven County, CT'],

  // North Carolina
  '37119': [35.2271, -80.8431, 'Mecklenburg County, NC'],
  '37183': [35.7900, -78.6500, 'Wake County, NC'],
  '37081': [36.0726, -79.7920, 'Guilford County, NC'],

  // Minnesota
  '27053': [44.9778, -93.2650, 'Hennepin County, MN'],
  '27123': [44.9300, -93.0900, 'Ramsey County, MN'],
  '27037': [44.7400, -93.2700, 'Dakota County, MN'],
  '27003': [45.2400, -93.4700, 'Anoka County, MN'],

  // Oregon
  '41051': [45.5152, -122.6784, 'Multnomah County, OR'],
  '41067': [45.5600, -122.9100, 'Washington County, OR'],
  '41005': [45.3600, -122.6100, 'Clackamas County, OR'],

  // Indiana
  '18097': [39.7684, -86.1581, 'Marion County, IN'],
  '18063': [39.7700, -86.3900, 'Hamilton County, IN'],

  // Tennessee
  '47037': [36.1627, -86.7816, 'Davidson County, TN'],
  '47157': [35.1495, -90.0490, 'Shelby County, TN'],
  '47065': [35.0456, -85.3097, 'Hamilton County, TN'],

  // Missouri
  '29189': [38.6270, -90.1994, 'St. Louis County, MO'],
  '29510': [38.6270, -90.1994, 'St. Louis City, MO'],
  '29095': [39.0997, -94.5786, 'Jackson County, MO'],

  // Wisconsin
  '55079': [43.0389, -87.9065, 'Milwaukee County, WI'],
  '55025': [43.0731, -89.4012, 'Dane County, WI'],

  // Nevada
  '32003': [36.0800, -115.1500, 'Clark County, NV'],
  '32031': [39.5296, -119.8138, 'Washoe County, NV'],

  // Utah
  '49035': [40.6609, -111.9383, 'Salt Lake County, UT'],
  '49049': [40.2338, -111.6585, 'Utah County, UT'],

  // South Carolina
  '45019': [32.8998, -80.0245, 'Charleston County, SC'],
  '45045': [34.8500, -82.3900, 'Greenville County, SC'],
}

// Calculate distance between two lat/lng points (km)
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Find counties within radius of center point
function findNearbyCounties(lat: number, lng: number, radiusKm: number): string[] {
  const nearby: string[] = []
  for (const [fips, [clat, clng]] of Object.entries(COUNTY_CENTROIDS)) {
    if (haversineKm(lat, lng, clat, clng) <= radiusKm) {
      nearby.push(fips)
    }
  }
  return nearby
}

// BLS QCEW data cache (in-memory, keyed by year+quarter+fips+industry)
const blsCache: Record<string, any> = {}

async function fetchBLSCountyData(fips: string, industry: string): Promise<any | null> {
  // Use annual average data for most recent available year
  const year = '2024'
  const quarter = 'a' // annual average

  const cacheKey = `${year}:${quarter}:${fips}:${industry}`
  if (blsCache[cacheKey] !== undefined) {
    return blsCache[cacheKey]
  }

  try {
    const url = `https://data.bls.gov/cew/data/api/${year}/${quarter}/area/${fips}.csv`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'TourLytics/1.0 (CRE Analytics Platform)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!resp.ok) {
      // Try previous year if 2024 annual not available yet
      const fallbackUrl = `https://data.bls.gov/cew/data/api/2023/${quarter}/area/${fips}.csv`
      const fallbackResp = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'TourLytics/1.0 (CRE Analytics Platform)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!fallbackResp.ok) {
        blsCache[cacheKey] = null
        return null
      }
      const text = await fallbackResp.text()
      return parseBLSData(text, fips, industry, cacheKey)
    }

    const text = await resp.text()
    return parseBLSData(text, fips, industry, cacheKey)
  } catch (err) {
    console.error(`BLS fetch error for ${fips}:`, err)
    blsCache[cacheKey] = null
    return null
  }
}

function parseBLSData(csvText: string, fips: string, industry: string, cacheKey: string): any | null {
  const lines = csvText.split('\n')
  if (lines.length < 2) {
    blsCache[cacheKey] = null
    return null
  }

  const headers = lines[0].replace(/"/g, '').split(',')
  const fipsIdx = headers.indexOf('area_fips')
  const ownIdx = headers.indexOf('own_code')
  const indIdx = headers.indexOf('industry_code')
  const empIdx = headers.indexOf('annual_avg_emplvl')
  const wageIdx = headers.indexOf('annual_avg_wkly_wage')
  const estIdx = headers.indexOf('annual_avg_estabs')
  const payIdx = headers.indexOf('avg_annual_pay')

  // Find matching row: own_code=5 (private), industry matching
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/"/g, '').split(',')
    if (!cols[fipsIdx]) continue

    const own = cols[ownIdx]
    const ind = cols[indIdx]

    // own_code 5 = private sector, match industry code
    if (own === '5' && ind === industry) {
      const result = {
        fips: fips,
        employment: parseInt(cols[empIdx]) || 0,
        avgWeeklyWage: parseInt(cols[wageIdx]) || 0,
        establishments: parseInt(cols[estIdx]) || 0,
        avgAnnualPay: parseInt(cols[payIdx]) || 0,
      }
      blsCache[cacheKey] = result
      return result
    }
  }

  blsCache[cacheKey] = null
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng, radius = 80, industry = '10' } = await request.json()

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'lat and lng are required' },
        { status: 400 }
      )
    }

    // Valid NAICS industry codes for our use case
    const validIndustries = ['10', '51', '52', '54', '62', '31_33', '42', '44_45', '23', '48_49', '72', '56']
    if (!validIndustries.includes(industry)) {
      return NextResponse.json(
        { error: 'Invalid industry code' },
        { status: 400 }
      )
    }

    // Find nearby counties
    const nearbyFips = findNearbyCounties(lat, lng, radius)

    if (nearbyFips.length === 0) {
      return NextResponse.json({ points: [], meta: { industry, countyCount: 0 } })
    }

    // Fetch BLS data for each county (parallel, max 15)
    const fipsToFetch = nearbyFips.slice(0, 15)
    const results = await Promise.all(
      fipsToFetch.map(fips => fetchBLSCountyData(fips, industry))
    )

    // Build heatmap points: [lat, lng, intensity]
    const points: Array<{ lat: number; lng: number; intensity: number; name: string; employment: number; avgPay: number; establishments: number }> = []
    let maxEmp = 1

    // First pass: find max employment for normalization
    results.forEach((r) => {
      if (r && r.employment > maxEmp) maxEmp = r.employment
    })

    // Second pass: build points
    results.forEach((r, idx) => {
      if (!r) return
      const fips = fipsToFetch[idx]
      const centroid = COUNTY_CENTROIDS[fips]
      if (!centroid) return

      points.push({
        lat: centroid[0],
        lng: centroid[1],
        intensity: r.employment / maxEmp,
        name: centroid[2],
        employment: r.employment,
        avgPay: r.avgAnnualPay,
        establishments: r.establishments,
      })
    })

    return NextResponse.json({
      points,
      meta: {
        industry,
        countyCount: points.length,
        maxEmployment: maxEmp,
      },
    })
  } catch (err) {
    console.error('Labor stats error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch labor statistics' },
      { status: 500 }
    )
  }
}
