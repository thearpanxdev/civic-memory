import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const serverFilePath = path.join(rootDir, 'server/src/utils/indiaGeoData.js');
const clientFilePath = path.join(rootDir, 'client/src/utils/indiaGeoData.js');

// Read existing server file to extract DISTRICTS_BY_STATE safely
const existingContent = fs.readFileSync(serverFilePath, 'utf8');

// Parse DISTRICTS_BY_STATE block
const distMatch = existingContent.match(/export const DISTRICTS_BY_STATE = (\{[\s\S]*?\n\};)/);
if (!distMatch) {
  throw new Error('Could not find DISTRICTS_BY_STATE in existing file');
}

let districtsObj;
try {
  districtsObj = eval('(' + distMatch[1].slice(0, -1) + ')');
} catch (e) {
  throw new Error('Failed to evaluate existing districts: ' + e.message);
}

// 1. Fix Punjab: remove 'Muktsar' alias, retain 'Sri Muktsar Sahib'
if (districtsObj['Punjab']) {
  districtsObj['Punjab'] = districtsObj['Punjab'].filter(d => d !== 'Muktsar');
  if (!districtsObj['Punjab'].includes('Sri Muktsar Sahib')) {
    districtsObj['Punjab'].push('Sri Muktsar Sahib');
  }
  districtsObj['Punjab'].sort();
}

// 2. Fix Madhya Pradesh: add Mauganj, Maihar, Pandhurna (official LGD count 55)
if (districtsObj['Madhya Pradesh']) {
  const toAdd = ['Mauganj', 'Maihar', 'Pandhurna'];
  for (const d of toAdd) {
    if (!districtsObj['Madhya Pradesh'].includes(d)) {
      districtsObj['Madhya Pradesh'].push(d);
    }
  }
  districtsObj['Madhya Pradesh'].sort();
}

// 3. Fix Assam: add Bajali, Tamulpur (official LGD count 35)
if (districtsObj['Assam']) {
  const toAdd = ['Bajali', 'Tamulpur'];
  for (const d of toAdd) {
    if (!districtsObj['Assam'].includes(d)) {
      districtsObj['Assam'].push(d);
    }
  }
  districtsObj['Assam'].sort();
}

// 4. Fix Rajasthan: Gangapur City formatting
if (districtsObj['Rajasthan']) {
  districtsObj['Rajasthan'] = districtsObj['Rajasthan'].map(d => d === 'Gangapurcity' ? 'Gangapur City' : d);
  districtsObj['Rajasthan'].sort();
}

// Comprehensive Categorized Urban Local Bodies mapped to canonical State and District
const REPRESENTATIVE_ULBS = {
  'Karnataka': {
    'Bengaluru Urban': [
      'Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)',
    ],
    'Bengaluru Rural': [
      'Doddaballapura (City Municipal Council)',
      'Hosakote (City Municipal Council)',
      'Devanahalli (Town Municipal Council)',
      'Nelamangala (Town Municipal Council)',
    ],
    'Mysuru': [
      'Mysuru City Corporation (MCC) (Municipal Corporation)',
      'Hunsur (City Municipal Council)',
      'Nanjangud (City Municipal Council)',
    ],
    'Dharwad': [
      'Hubballi-Dharwad Municipal Corporation (HDMC) (Municipal Corporation)',
    ],
    'Dakshina Kannada': [
      'Mangaluru City Corporation (MCC) (Municipal Corporation)',
      'Ullal (City Municipal Council)',
    ],
    'Belagavi': [
      'Belagavi City Corporation (Municipal Corporation)',
      'Gokak (City Municipal Council)',
    ],
    'Shivamogga': [
      'Shivamogga City Corporation (Municipal Corporation)',
      'Bhadravati (City Municipal Council)',
    ],
    'Tumakuru': [
      'Tumakuru City Corporation (Municipal Corporation)',
      'Tiptur (City Municipal Council)',
    ],
    'Ballari': [
      'Ballari City Corporation (Municipal Corporation)',
    ],
    'Kalaburagi': [
      'Kalaburagi City Corporation (Municipal Corporation)',
    ],
    'Davanagere': [
      'Davanagere City Corporation (Municipal Corporation)',
    ],
    'Udupi': [
      'Udupi (City Municipal Council)',
      'Kundapura (Town Municipal Council)',
    ],
  },
  'Maharashtra': {
    'Mumbai City': [
      'Brihanmumbai Municipal Corporation (BMC / MCGM) (Municipal Corporation)',
    ],
    'Mumbai Suburban': [
      'Brihanmumbai Municipal Corporation (BMC / MCGM) (Municipal Corporation)',
    ],
    'Pune': [
      'Pune Municipal Corporation (PMC) (Municipal Corporation)',
      'Pimpri Chinchwad Municipal Corporation (PCMC) (Municipal Corporation)',
      'Pune Cantonment Board (Cantonment Board)',
      'Dehu Road Cantonment Board (Cantonment Board)',
    ],
    'Thane': [
      'Thane Municipal Corporation (TMC) (Municipal Corporation)',
      'Navi Mumbai Municipal Corporation (NMMC) (Municipal Corporation)',
      'Kalyan-Dombivli Municipal Corporation (KDMC) (Municipal Corporation)',
      'Mira-Bhayandar Municipal Corporation (MBMC) (Municipal Corporation)',
      'Ulhasnagar Municipal Corporation (Municipal Corporation)',
    ],
    'Nagpur': [
      'Nagpur Municipal Corporation (NMC) (Municipal Corporation)',
      'Kamthi (Municipal Council)',
    ],
    'Nashik': [
      'Nashik Municipal Corporation (NMC) (Municipal Corporation)',
      'Malegaon (Municipal Corporation)',
    ],
    'Chhatrapati Sambhajinagar': [
      'Chhatrapati Sambhajinagar Municipal Corporation (CSMC) (Municipal Corporation)',
    ],
    'Solapur': [
      'Solapur Municipal Corporation (Municipal Corporation)',
    ],
    'Kolhapur': [
      'Kolhapur Municipal Corporation (Municipal Corporation)',
    ],
    'Amravati': [
      'Amravati Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Delhi': {
    'New Delhi': [
      'New Delhi Municipal Council (NDMC) (Municipal Council)',
      'Delhi Cantonment Board (Cantonment Board)',
    ],
    'Central Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'East Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'North Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'North East Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'North West Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'Shahdara': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'South Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'South East Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
    'South West Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
      'Delhi Cantonment Board (Cantonment Board)',
    ],
    'West Delhi': [
      'Municipal Corporation of Delhi (MCD) (Municipal Corporation)',
    ],
  },
  'Tamil Nadu': {
    'Chennai': [
      'Greater Chennai Corporation (GCC) (Municipal Corporation)',
    ],
    'Coimbatore': [
      'Coimbatore City Municipal Corporation (CCMC) (Municipal Corporation)',
    ],
    'Madurai': [
      'Madurai City Municipal Corporation (Municipal Corporation)',
    ],
    'Tiruchirappalli': [
      'Tiruchirappalli City Municipal Corporation (Municipal Corporation)',
    ],
    'Salem': [
      'Salem City Municipal Corporation (Municipal Corporation)',
    ],
    'Tiruppur': [
      'Tiruppur City Municipal Corporation (Municipal Corporation)',
    ],
    'Erode': [
      'Erode City Municipal Corporation (Municipal Corporation)',
    ],
    'Tirunelveli': [
      'Tirunelveli City Municipal Corporation (Municipal Corporation)',
    ],
    'Vellore': [
      'Vellore City Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Telangana': {
    'Hyderabad': [
      'Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)',
      'Secunderabad Cantonment Board (Cantonment Board)',
    ],
    'Medchal-Malkajgiri': [
      'Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)',
      'Nizampet (Municipal Corporation)',
      'Boduppal (Municipal Corporation)',
      'Peerzadiguda (Municipal Corporation)',
    ],
    'Rangareddy': [
      'Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)',
      'Badangpet (Municipal Corporation)',
      'Bandlaguda Jagir (Municipal Corporation)',
      'Meerpet (Municipal Corporation)',
    ],
    'Warangal': [
      'Greater Warangal Municipal Corporation (GWMC) (Municipal Corporation)',
    ],
    'Karimnagar': [
      'Karimnagar Municipal Corporation (Municipal Corporation)',
    ],
    'Nizamabad': [
      'Nizamabad Municipal Corporation (Municipal Corporation)',
    ],
  },
  'West Bengal': {
    'Kolkata': [
      'Kolkata Municipal Corporation (KMC) (Municipal Corporation)',
    ],
    'Howrah': [
      'Howrah Municipal Corporation (HMC) (Municipal Corporation)',
      'Bally (Municipality)',
    ],
    'North 24 Parganas': [
      'Bidhannagar Municipal Corporation (Municipal Corporation)',
      'Barasat (Municipality)',
      'Barrackpore (Municipality)',
      'Kamarhati (Municipality)',
      'Panihati (Municipality)',
    ],
    'Paschim Bardhaman': [
      'Asansol Municipal Corporation (Municipal Corporation)',
      'Durgapur Municipal Corporation (Municipal Corporation)',
    ],
    'Darjeeling': [
      'Siliguri Municipal Corporation (Municipal Corporation)',
      'Darjeeling (Municipality)',
    ],
  },
  'Gujarat': {
    'Ahmedabad': [
      'Amdavad Municipal Corporation (AMC) (Municipal Corporation)',
    ],
    'Surat': [
      'Surat Municipal Corporation (SMC) (Municipal Corporation)',
    ],
    'Vadodara': [
      'Vadodara Municipal Corporation (VMC) (Municipal Corporation)',
    ],
    'Rajkot': [
      'Rajkot Municipal Corporation (RMC) (Municipal Corporation)',
    ],
    'Gandhinagar': [
      'Gandhinagar Municipal Corporation (GMC) (Municipal Corporation)',
    ],
    'Bhavnagar': [
      'Bhavnagar Municipal Corporation (Municipal Corporation)',
    ],
    'Jamnagar': [
      'Jamnagar Municipal Corporation (Municipal Corporation)',
    ],
    'Junagadh': [
      'Junagadh Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Uttar Pradesh': {
    'Lucknow': [
      'Lucknow Municipal Corporation (LMC) (Municipal Corporation)',
    ],
    'Kanpur Nagar': [
      'Kanpur Municipal Corporation (KMC) (Municipal Corporation)',
    ],
    'Gautam Buddha Nagar': [
      'New Okhla Industrial Development Authority (NOIDA) (Development Authority)',
      'Greater Noida Industrial Development Authority (GNIDA) (Development Authority)',
      'Dadri (Municipal Council)',
    ],
    'Ghaziabad': [
      'Ghaziabad Municipal Corporation (Municipal Corporation)',
    ],
    'Agra': [
      'Agra Municipal Corporation (Municipal Corporation)',
      'Agra Cantonment Board (Cantonment Board)',
    ],
    'Varanasi': [
      'Varanasi Municipal Corporation (Municipal Corporation)',
      'Varanasi Cantonment Board (Cantonment Board)',
    ],
    'Prayagraj': [
      'Prayagraj Municipal Corporation (Municipal Corporation)',
    ],
    'Meerut': [
      'Meerut Municipal Corporation (Municipal Corporation)',
      'Meerut Cantonment Board (Cantonment Board)',
    ],
    'Bareilly': [
      'Bareilly Municipal Corporation (Municipal Corporation)',
    ],
    'Aligarh': [
      'Aligarh Municipal Corporation (Municipal Corporation)',
    ],
    'Moradabad': [
      'Moradabad Municipal Corporation (Municipal Corporation)',
    ],
    'Gorakhpur': [
      'Gorakhpur Municipal Corporation (Municipal Corporation)',
    ],
    'Ayodhya': [
      'Ayodhya Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Rajasthan': {
    'Jaipur': [
      'Jaipur Greater Municipal Corporation (Municipal Corporation)',
      'Jaipur Heritage Municipal Corporation (Municipal Corporation)',
    ],
    'Jodhpur': [
      'Jodhpur North Municipal Corporation (Municipal Corporation)',
      'Jodhpur South Municipal Corporation (Municipal Corporation)',
    ],
    'Kota': [
      'Kota North Municipal Corporation (Municipal Corporation)',
      'Kota South Municipal Corporation (Municipal Corporation)',
    ],
    'Bikaner': [
      'Bikaner Municipal Corporation (Municipal Corporation)',
    ],
    'Ajmer': [
      'Ajmer Municipal Corporation (Municipal Corporation)',
    ],
    'Udaipur': [
      'Udaipur Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Kerala': {
    'Thiruvananthapuram': [
      'Thiruvananthapuram Municipal Corporation (Municipal Corporation)',
      'Neyyattinkara (Municipality)',
      'Attingal (Municipality)',
    ],
    'Ernakulam': [
      'Kochi Municipal Corporation (Municipal Corporation)',
      'Thrikkakara (Municipality)',
      'Aluva (Municipality)',
    ],
    'Kozhikode': [
      'Kozhikode Municipal Corporation (Municipal Corporation)',
    ],
    'Thrissur': [
      'Thrissur Municipal Corporation (Municipal Corporation)',
    ],
    'Kollam': [
      'Kollam Municipal Corporation (Municipal Corporation)',
    ],
    'Kannur': [
      'Kannur Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Andhra Pradesh': {
    'Visakhapatnam': [
      'Greater Visakhapatnam Municipal Corporation (GVMC) (Municipal Corporation)',
    ],
    'NTR': [
      'Vijayawada Municipal Corporation (VMC) (Municipal Corporation)',
    ],
    'Guntur': [
      'Guntur Municipal Corporation (GMC) (Municipal Corporation)',
    ],
    'Tirupati': [
      'Tirupati Municipal Corporation (Municipal Corporation)',
    ],
    'Kurnool': [
      'Kurnool Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Bihar': {
    'Patna': [
      'Patna Municipal Corporation (Municipal Corporation)',
      'Danapur Nizamat (Nagar Parishad)',
    ],
    'Gaya': [
      'Gaya Municipal Corporation (Municipal Corporation)',
    ],
    'Bhagalpur': [
      'Bhagalpur Municipal Corporation (Municipal Corporation)',
    ],
    'Muzaffarpur': [
      'Muzaffarpur Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Madhya Pradesh': {
    'Bhopal': [
      'Bhopal Municipal Corporation (Municipal Corporation)',
    ],
    'Indore': [
      'Indore Municipal Corporation (Municipal Corporation)',
    ],
    'Jabalpur': [
      'Jabalpur Municipal Corporation (Municipal Corporation)',
    ],
    'Gwalior': [
      'Gwalior Municipal Corporation (Municipal Corporation)',
    ],
    'Ujjain': [
      'Ujjain Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Punjab': {
    'Amritsar': [
      'Amritsar Municipal Corporation (Municipal Corporation)',
    ],
    'Ludhiana': [
      'Ludhiana Municipal Corporation (Municipal Corporation)',
    ],
    'Jalandhar': [
      'Jalandhar Municipal Corporation (Municipal Corporation)',
    ],
    'Patiala': [
      'Patiala Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Haryana': {
    'Gurugram': [
      'Municipal Corporation of Gurugram (MCG) (Municipal Corporation)',
    ],
    'Faridabad': [
      'Municipal Corporation of Faridabad (MCF) (Municipal Corporation)',
    ],
    'Panchkula': [
      'Municipal Corporation Panchkula (Municipal Corporation)',
    ],
    'Karnal': [
      'Municipal Corporation Karnal (Municipal Corporation)',
    ],
  },
  'Chandigarh': {
    'Chandigarh': [
      'Municipal Corporation Chandigarh (MCC) (Municipal Corporation)',
    ],
  },
  'Odisha': {
    'Khordha': [
      'Bhubaneswar Municipal Corporation (BMC) (Municipal Corporation)',
    ],
    'Cuttack': [
      'Cuttack Municipal Corporation (CMC) (Municipal Corporation)',
    ],
    'Sambalpur': [
      'Sambalpur Municipal Corporation (Municipal Corporation)',
    ],
    'Sundargarh': [
      'Rourkela Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Assam': {
    'Kamrup Metropolitan': [
      'Guwahati Municipal Corporation (GMC) (Municipal Corporation)',
    ],
  },
  'Goa': {
    'North Goa': [
      'Corporation of the City of Panaji (CCP) (Municipal Corporation)',
      'Mapusa (Municipal Council)',
    ],
    'South Goa': [
      'Margao (Municipal Council)',
      'Mormugao (Municipal Council)',
    ],
  },
  'Uttarakhand': {
    'Dehradun': [
      'Dehradun Municipal Corporation (Municipal Corporation)',
      'Clement Town Cantonment Board (Cantonment Board)',
    ],
    'Haridwar': [
      'Haridwar Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Himachal Pradesh': {
    'Shimla': [
      'Shimla Municipal Corporation (Municipal Corporation)',
    ],
    'Kangra': [
      'Dharamshala Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Jharkhand': {
    'Ranchi': [
      'Ranchi Municipal Corporation (Municipal Corporation)',
    ],
    'Dhanbad': [
      'Dhanbad Municipal Corporation (Municipal Corporation)',
    ],
    'East Singhbhum': [
      'Jamshedpur Notified Area Committee (JNAC) (Notified Area Committee)',
    ],
  },
  'Chhattisgarh': {
    'Raipur': [
      'Raipur Municipal Corporation (Municipal Corporation)',
    ],
    'Bilaspur': [
      'Bilaspur Municipal Corporation (Municipal Corporation)',
    ],
    'Durg': [
      'Bhilai Municipal Corporation (Municipal Corporation)',
      'Durg Municipal Corporation (Municipal Corporation)',
    ],
  },
  'Jammu and Kashmir': {
    'Srinagar': [
      'Srinagar Municipal Corporation (SMC) (Municipal Corporation)',
    ],
    'Jammu': [
      'Jammu Municipal Corporation (JMC) (Municipal Corporation)',
    ],
  },
  'Puducherry': {
    'Puducherry': [
      'Puducherry Municipality (Municipality)',
      'Oulgaret Municipality (Municipality)',
    ],
  },
};

const fullSource = `/**
 * CivicMemory — Authoritative Indian Administrative Geography Module
 * Source: Local Government Directory (LGD), Ministry of Panchayati Raj, Government of India
 * URL: https://lgd.gov.in (Baseline Release: 2024)
 *
 * Covers all 28 States and 8 Union Territories (36 total), comprehensive
 * canonical district mappings, categorized Urban Local Bodies (ULBs),
 * legacy alias normalizations, and validation helpers.
 */

export const LGD_DATASET_METADATA = {
  source: 'Local Government Directory (LGD), Ministry of Panchayati Raj, Government of India (https://lgd.gov.in)',
  versionDate: '2024-06-01',
  description: 'Authoritative Indian Administrative Geography & Urban Local Bodies (ULBs)',
  statesAndUtsCount: 36,
  coverageNotes: 'Comprehensive coverage of 28 States and 8 Union Territories; verified Urban Local Bodies categorized by administrative type (Municipal Corporation, Municipal Council, Town Panchayat, Cantonment Board, Development Authority). Custom manual entry supported for unlisted municipalities.',
};

export const INDIAN_STATES_AND_UTS = [
  // 28 States
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // 8 Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const STATE_ALIASES = {
  'orissa': 'Odisha',
  'pondicherry': 'Puducherry',
  'uttaranchal': 'Uttarakhand',
  'delhi nct': 'Delhi',
  'nct of delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  'jammu & kashmir': 'Jammu and Kashmir',
  'j&k': 'Jammu and Kashmir',
  'andaman & nicobar': 'Andaman and Nicobar Islands',
  'andaman and nicobar': 'Andaman and Nicobar Islands',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
};

export const DISTRICT_ALIASES = {
  'bangalore': 'Bengaluru Urban',
  'bangalore urban': 'Bengaluru Urban',
  'bangalore rural': 'Bengaluru Rural',
  'bengaluru': 'Bengaluru Urban',
  'gurgaon': 'Gurugram',
  'allahabad': 'Prayagraj',
  'faizabad': 'Ayodhya',
  'aurangabad': 'Chhatrapati Sambhajinagar',
  'osmanabad': 'Dharashiv',
  'bellary': 'Ballari',
  'belgaum': 'Belagavi',
  'mysore': 'Mysuru',
  'hubli': 'Dharwad',
  'hubballi': 'Dharwad',
  'shimoga': 'Shivamogga',
  'tumkur': 'Tumakuru',
  'bijapur': 'Vijayapura',
  'gulbarga': 'Kalaburagi',
  'mangalore': 'Dakshina Kannada',
  'calicut': 'Kozhikode',
  'cochin': 'Ernakulam',
  'trivandrum': 'Thiruvananthapuram',
  'madras': 'Chennai',
  'calcutta': 'Kolkata',
  'bombay': 'Mumbai City',
  'baroda': 'Vadodara',
  'gauhati': 'Kamrup Metropolitan',
  'muktsar': 'Sri Muktsar Sahib',
  'firozpur': 'Ferozepur',
  'kanpur': 'Kanpur Nagar',
  'pondicherry': 'Puducherry',
  'gangapurcity': 'Gangapur City',
};

export const DISTRICTS_BY_STATE = ${JSON.stringify(districtsObj, null, 2)};

export const REPRESENTATIVE_ULBS = ${JSON.stringify(REPRESENTATIVE_ULBS, null, 2)};

/**
 * Advisory PIN prefix map.
 * WARNING: Two-digit PIN prefixes do NOT strictly prove State or District.
 * Used exclusively for non-authoritative hint displays when network is offline.
 */
export const PIN_PREFIX_STATE_MAP = {
  '11': 'Delhi',
  '12': 'Haryana',
  '13': 'Haryana',
  '14': 'Punjab',
  '15': 'Punjab',
  '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu and Kashmir',
  '19': 'Jammu and Kashmir',
  '20': 'Uttar Pradesh',
  '21': 'Uttar Pradesh',
  '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh',
  '24': 'Uttarakhand',
  '25': 'Uttar Pradesh',
  '26': 'Uttarakhand',
  '27': 'Uttar Pradesh',
  '28': 'Uttar Pradesh',
  '30': 'Rajasthan',
  '31': 'Rajasthan',
  '32': 'Rajasthan',
  '33': 'Rajasthan',
  '34': 'Rajasthan',
  '36': 'Gujarat',
  '37': 'Gujarat',
  '38': 'Gujarat',
  '39': 'Gujarat',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '43': 'Maharashtra',
  '44': 'Maharashtra',
  '45': 'Madhya Pradesh',
  '46': 'Madhya Pradesh',
  '47': 'Madhya Pradesh',
  '48': 'Madhya Pradesh',
  '49': 'Chhattisgarh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh',
  '52': 'Andhra Pradesh',
  '53': 'Andhra Pradesh',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '58': 'Karnataka',
  '59': 'Karnataka',
  '60': 'Tamil Nadu',
  '61': 'Tamil Nadu',
  '62': 'Tamil Nadu',
  '63': 'Tamil Nadu',
  '64': 'Tamil Nadu',
  '67': 'Kerala',
  '68': 'Kerala',
  '69': 'Kerala',
  '70': 'West Bengal',
  '71': 'West Bengal',
  '72': 'West Bengal',
  '73': 'West Bengal',
  '74': 'West Bengal',
  '75': 'Odisha',
  '76': 'Odisha',
  '77': 'Odisha',
  '78': 'Assam',
  '79': 'Arunachal Pradesh',
  '80': 'Bihar',
  '81': 'Bihar',
  '82': 'Jharkhand',
  '83': 'Jharkhand',
  '84': 'Bihar',
  '85': 'Bihar',
};

/**
 * Local offline cache / preloaded fixture records for test and deterministic offline demo
 */
export const LOCAL_PINCODE_CACHE = {
  '560038': {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    postOffices: ['Indiranagar', 'HAL II Stage'],
    suggestedUlbs: ['Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)'],
  },
  '560001': {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    postOffices: ['Bangalore G.P.O.', 'Raj Bhavan', 'Vidhana Soudha'],
    suggestedUlbs: ['Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)'],
  },
  '560034': {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    postOffices: ['Koramangala', 'St. John’s Medical College'],
    suggestedUlbs: ['Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)'],
  },
  '560066': {
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    postOffices: ['Whitefield'],
    suggestedUlbs: ['Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)'],
  },
  '110001': {
    state: 'Delhi',
    district: 'New Delhi',
    postOffices: ['Connaught Place', 'Baroda House', 'Janpath'],
    suggestedUlbs: ['New Delhi Municipal Council (NDMC) (Municipal Council)'],
  },
  '400001': {
    state: 'Maharashtra',
    district: 'Mumbai City',
    postOffices: ['Mumbai G.P.O.', 'Fort', 'Stock Exchange'],
    suggestedUlbs: ['Brihanmumbai Municipal Corporation (BMC / MCGM) (Municipal Corporation)'],
  },
  '411001': {
    state: 'Maharashtra',
    district: 'Pune',
    postOffices: ['Pune Station', 'Rasta Peth'],
    suggestedUlbs: ['Pune Municipal Corporation (PMC) (Municipal Corporation)', 'Pune Cantonment Board (Cantonment Board)'],
  },
  '600001': {
    state: 'Tamil Nadu',
    district: 'Chennai',
    postOffices: ['Chennai G.P.O.', 'Mannady', 'Sowcarpet'],
    suggestedUlbs: ['Greater Chennai Corporation (GCC) (Municipal Corporation)'],
  },
  '500001': {
    state: 'Telangana',
    district: 'Hyderabad',
    postOffices: ['Hyderabad G.P.O.', 'Abids', 'Moazzam Jahi Market'],
    suggestedUlbs: ['Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)'],
  },
  '700001': {
    state: 'West Bengal',
    district: 'Kolkata',
    postOffices: ['Kolkata G.P.O.', 'Dalhousie Square', 'Reserve Bank'],
    suggestedUlbs: ['Kolkata Municipal Corporation (KMC) (Municipal Corporation)'],
  },
};

/**
 * Validates if the supplied state is a recognized Indian State or Union Territory
 */
export function isValidState(stateName) {
  if (!stateName || typeof stateName !== 'string') return false;
  return getCanonicalState(stateName) !== null;
}

/**
 * Returns the canonical name of the state if matched (including alias normalization)
 */
export function getCanonicalState(stateName) {
  if (!stateName || typeof stateName !== 'string') return null;
  const normalized = stateName.trim().toLowerCase();

  // 1. Direct match
  const direct = INDIAN_STATES_AND_UTS.find((s) => s.toLowerCase() === normalized);
  if (direct) return direct;

  // 2. Alias resolution
  if (STATE_ALIASES[normalized]) {
    return STATE_ALIASES[normalized];
  }

  return null;
}

/**
 * Returns all recognized districts belonging to a state
 */
export function getDistrictsForState(stateName) {
  const canonical = getCanonicalState(stateName);
  if (!canonical) return [];
  return DISTRICTS_BY_STATE[canonical] || [];
}

/**
 * Normalizes a raw district name to its canonical name for a given state
 */
export function getCanonicalDistrict(stateName, districtName) {
  if (!districtName || typeof districtName !== 'string') return null;
  const canonicalState = getCanonicalState(stateName);
  if (!canonicalState) return null;

  const validDistricts = DISTRICTS_BY_STATE[canonicalState] || [];
  const normalized = districtName.trim().toLowerCase();

  // 1. Direct match
  const direct = validDistricts.find((d) => d.toLowerCase() === normalized);
  if (direct) return direct;

  // 2. Alias resolution
  const alias = DISTRICT_ALIASES[normalized];
  if (alias) {
    const aliasMatch = validDistricts.find((d) => d.toLowerCase() === alias.toLowerCase());
    if (aliasMatch) return aliasMatch;
  }

  return null;
}

/**
 * Validates if a district belongs to a specified state
 */
export function isValidDistrictForState(stateName, districtName) {
  if (!districtName || typeof districtName !== 'string') return false;
  return getCanonicalDistrict(stateName, districtName) !== null;
}

/**
 * Returns known categorized ULBs for a state and district
 */
export function getUlbsForDistrict(stateName, districtName) {
  const canonicalState = getCanonicalState(stateName);
  if (!canonicalState) return [];

  const canonicalDistrict = getCanonicalDistrict(canonicalState, districtName);
  if (!canonicalDistrict) return [];

  const stateUlbs = REPRESENTATIVE_ULBS[canonicalState];
  if (!stateUlbs) return [];

  const distUlbs = stateUlbs[canonicalDistrict];
  if (Array.isArray(distUlbs)) {
    return [...distUlbs];
  }

  return [];
}

/**
 * Checks whether a given ULB string is a recognized, verified ULB for a district
 */
export function isKnownUlb(stateName, districtName, ulbName) {
  if (!ulbName || typeof ulbName !== 'string') return false;
  const available = getUlbsForDistrict(stateName, districtName);
  if (available.length === 0) return false;

  const cleanInput = ulbName.trim().toLowerCase();
  return available.some((u) => {
    const cleanUlb = u.trim().toLowerCase();
    if (cleanUlb === cleanInput) return true;
    // Match base name without parenthetical category (e.g. "BBMP" or base corporation name)
    const baseName = cleanUlb.replace(/\\s*\\([^)]*\\)/g, '').trim();
    const inputBaseName = cleanInput.replace(/\\s*\\([^)]*\\)/g, '').trim();
    return baseName === inputBaseName || cleanUlb.includes(cleanInput);
  });
}
`;

fs.writeFileSync(serverFilePath, fullSource, 'utf8');
fs.writeFileSync(clientFilePath, fullSource, 'utf8');
console.log('Successfully updated both server and client indiaGeoData.js');
