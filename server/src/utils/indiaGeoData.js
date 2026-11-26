/**
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

export const DISTRICTS_BY_STATE = {
  "Andaman and Nicobar Islands": [
    "Nicobars",
    "North and Middle Andaman",
    "South Andaman"
  ],
  "Andhra Pradesh": [
    "Alluri Sitharama Raju",
    "Anakapalli",
    "Ananthapuramu",
    "Annamayya",
    "Bapatla",
    "Chittoor",
    "Dr. B.R. Ambedkar Konaseema",
    "East Godavari",
    "Eluru",
    "Guntur",
    "Kakinada",
    "Krishna",
    "Kurnool",
    "Nandyal",
    "NTR",
    "Palnadu",
    "Parvathipuram Manyam",
    "Prakasam",
    "Sri Potti Sriramulu Nellore",
    "Sri Sathya Sai",
    "Srikakulam",
    "Tirupati",
    "Visakhapatnam",
    "Vizianagaram",
    "West Godavari",
    "YSR Kadapa"
  ],
  "Arunachal Pradesh": [
    "Anjaw",
    "Changlang",
    "Dibang Valley",
    "East Kameng",
    "East Siang",
    "Kamle",
    "Kra Daadi",
    "Kurung Kumey",
    "Lepa Rada",
    "Lohit",
    "Longding",
    "Lower Dibang Valley",
    "Lower Siang",
    "Lower Subansiri",
    "Namsai",
    "Pakke Kessang",
    "Papum Pare",
    "Shi Yomi",
    "Siang",
    "Tawang",
    "Tirap",
    "Upper Siang",
    "Upper Subansiri",
    "West Kameng",
    "West Siang"
  ],
  "Assam": [
    "Bajali",
    "Baksa",
    "Barpeta",
    "Biswanath",
    "Bongaigaon",
    "Cachar",
    "Charaideo",
    "Chirang",
    "Darrang",
    "Dhemaji",
    "Dhubri",
    "Dibrugarh",
    "Dima Hasao",
    "Goalpara",
    "Golaghat",
    "Hailakandi",
    "Hojai",
    "Jorhat",
    "Kamrup",
    "Kamrup Metropolitan",
    "Karbi Anglong",
    "Karimganj",
    "Kokrajhar",
    "Lakhimpur",
    "Majuli",
    "Morigaon",
    "Nagaon",
    "Nalbari",
    "Sivasagar",
    "Sonitpur",
    "South Salmara-Mankachar",
    "Tamulpur",
    "Tinsukia",
    "Udalguri",
    "West Karbi Anglong"
  ],
  "Bihar": [
    "Araria",
    "Arwal",
    "Aurangabad",
    "Banka",
    "Begusarai",
    "Bhagalpur",
    "Bhojpur",
    "Buxar",
    "Darbhanga",
    "East Champaran",
    "Gaya",
    "Gopalganj",
    "Jamui",
    "Jehanabad",
    "Kaimur",
    "Katihar",
    "Khagaria",
    "Kishanganj",
    "Lakhisarai",
    "Madhepura",
    "Madhubani",
    "Munger",
    "Muzaffarpur",
    "Nalanda",
    "Nawada",
    "Patna",
    "Purnia",
    "Rohtas",
    "Saharsa",
    "Samastipur",
    "Saran",
    "Sheikhpura",
    "Sheohar",
    "Sitamarhi",
    "Siwan",
    "Supaul",
    "Vaishali",
    "West Champaran"
  ],
  "Chandigarh": [
    "Chandigarh"
  ],
  "Chhattisgarh": [
    "Balod",
    "Baloda Bazar",
    "Balrampur",
    "Bastar",
    "Bemetara",
    "Bijapur",
    "Bilaspur",
    "Dantewada",
    "Dhamtari",
    "Durg",
    "Gariaband",
    "Gaurela-Pendra-Marwahi",
    "Janjgir-Champa",
    "Jashpur",
    "Kabirdham",
    "Kanker",
    "Khairagarh-Chhuikhadan-Gandai",
    "Kondagaon",
    "Korba",
    "Koriya",
    "Mahasamund",
    "Manendragarh-Chirmiri-Bharatpur",
    "Mohla-Manpur-Ambagarh Chowki",
    "Mungeli",
    "Narayanpur",
    "Raigarh",
    "Raipur",
    "Rajnandgaon",
    "Sarangarh-Bilaigarh",
    "Sakti",
    "Sukma",
    "Surajpur",
    "Surguja"
  ],
  "Dadra and Nagar Haveli and Daman and Diu": [
    "Dadra and Nagar Haveli",
    "Daman",
    "Diu"
  ],
  "Delhi": [
    "Central Delhi",
    "East Delhi",
    "New Delhi",
    "North Delhi",
    "North East Delhi",
    "North West Delhi",
    "Shahdara",
    "South Delhi",
    "South East Delhi",
    "South West Delhi",
    "West Delhi"
  ],
  "Goa": [
    "North Goa",
    "South Goa"
  ],
  "Gujarat": [
    "Ahmedabad",
    "Amreli",
    "Anand",
    "Aravalli",
    "Banaskantha",
    "Bharuch",
    "Bhavnagar",
    "Botad",
    "Chhota Udaipur",
    "Dahod",
    "Dang",
    "Devbhumi Dwarka",
    "Gandhinagar",
    "Gir Somnath",
    "Jamnagar",
    "Junagadh",
    "Kheda",
    "Kutch",
    "Mahisagar",
    "Mehsana",
    "Morbi",
    "Narmada",
    "Navsari",
    "Panchmahal",
    "Patan",
    "Porbandar",
    "Rajkot",
    "Sabarkantha",
    "Surat",
    "Surendranagar",
    "Tapi",
    "Vadodara",
    "Valsad"
  ],
  "Haryana": [
    "Ambala",
    "Bhiwani",
    "Charkhi Dadri",
    "Faridabad",
    "Fatehabad",
    "Gurugram",
    "Hisar",
    "Jhajjar",
    "Jind",
    "Kaithal",
    "Karnal",
    "Kurukshetra",
    "Mahendragarh",
    "Nuh",
    "Palwal",
    "Panchkula",
    "Panipat",
    "Rewari",
    "Rohtak",
    "Sirsa",
    "Sonipat",
    "Yamunanagar"
  ],
  "Himachal Pradesh": [
    "Bilaspur",
    "Chamba",
    "Hamirpur",
    "Kangra",
    "Kinnaur",
    "Kullu",
    "Lahaul and Spiti",
    "Mandi",
    "Shimla",
    "Sirmaur",
    "Solan",
    "Una"
  ],
  "Jammu and Kashmir": [
    "Anantnag",
    "Bandipora",
    "Baramulla",
    "Budgam",
    "Doda",
    "Ganderbal",
    "Jammu",
    "Kathua",
    "Kishtwar",
    "Kulgam",
    "Kupwara",
    "Poonch",
    "Pulwama",
    "Rajouri",
    "Ramban",
    "Reasi",
    "Samba",
    "Shopian",
    "Srinagar",
    "Udhampur"
  ],
  "Jharkhand": [
    "Bokaro",
    "Chatra",
    "Deoghar",
    "Dhanbad",
    "Dumka",
    "East Singhbhum",
    "Garhwa",
    "Giridih",
    "Godda",
    "Gumla",
    "Hazaribagh",
    "Jamtara",
    "Khunti",
    "Koderma",
    "Latehar",
    "Lohardaga",
    "Pakur",
    "Palamu",
    "Ramgarh",
    "Ranchi",
    "Sahibganj",
    "Seraikela Kharsawan",
    "Simdega",
    "West Singhbhum"
  ],
  "Karnataka": [
    "Bagalkote",
    "Ballari",
    "Belagavi",
    "Bengaluru Rural",
    "Bengaluru Urban",
    "Bidar",
    "Chamarajanagara",
    "Chikkaballapura",
    "Chikkamagaluru",
    "Chitradurga",
    "Dakshina Kannada",
    "Davanagere",
    "Dharwad",
    "Gadag",
    "Hassan",
    "Haveri",
    "Kalaburagi",
    "Kodagu",
    "Kolar",
    "Koppal",
    "Mandya",
    "Mysuru",
    "Raichur",
    "Ramanagara",
    "Shivamogga",
    "Tumakuru",
    "Udupi",
    "Uttara Kannada",
    "Vijayanagara",
    "Vijayapura",
    "Yadgir"
  ],
  "Kerala": [
    "Alappuzha",
    "Ernakulam",
    "Idukki",
    "Kannur",
    "Kasaragod",
    "Kollam",
    "Kottayam",
    "Kozhikode",
    "Malappuram",
    "Palakkad",
    "Pathanamthitta",
    "Thiruvananthapuram",
    "Thrissur",
    "Wayanad"
  ],
  "Ladakh": [
    "Kargil",
    "Leh"
  ],
  "Lakshadweep": [
    "Lakshadweep"
  ],
  "Madhya Pradesh": [
    "Agar Malwa",
    "Alirajpur",
    "Anuppur",
    "Ashoknagar",
    "Balaghat",
    "Barwani",
    "Betul",
    "Bhind",
    "Bhopal",
    "Burhanpur",
    "Chhatarpur",
    "Chhindwara",
    "Damoh",
    "Datia",
    "Dewas",
    "Dhar",
    "Dindori",
    "Guna",
    "Gwalior",
    "Harda",
    "Hoshangabad",
    "Indore",
    "Jabalpur",
    "Jhabua",
    "Katni",
    "Khandwa",
    "Khargone",
    "Maihar",
    "Mandla",
    "Mandsaur",
    "Mauganj",
    "Morena",
    "Narsinghpur",
    "Neemuch",
    "Niwari",
    "Pandhurna",
    "Panna",
    "Raisen",
    "Rajgarh",
    "Ratlam",
    "Rewa",
    "Sagar",
    "Satna",
    "Sehore",
    "Seoni",
    "Shahdol",
    "Shajapur",
    "Sheopur",
    "Shivpuri",
    "Sidhi",
    "Singrauli",
    "Tikamgarh",
    "Ujjain",
    "Umaria",
    "Vidisha"
  ],
  "Maharashtra": [
    "Ahmednagar",
    "Akola",
    "Amravati",
    "Chhatrapati Sambhajinagar",
    "Beed",
    "Bhandara",
    "Buldhana",
    "Chandrapur",
    "Dhule",
    "Gadchiroli",
    "Gondia",
    "Hingoli",
    "Jalgaon",
    "Jalna",
    "Kolhapur",
    "Latur",
    "Mumbai City",
    "Mumbai Suburban",
    "Nagpur",
    "Nanded",
    "Nandurbar",
    "Nashik",
    "Dharashiv",
    "Palghar",
    "Parbhani",
    "Pune",
    "Raigad",
    "Ratnagiri",
    "Sangli",
    "Satara",
    "Sindhudurg",
    "Solapur",
    "Thane",
    "Wardha",
    "Washim",
    "Yavatmal"
  ],
  "Manipur": [
    "Bishnupur",
    "Chandel",
    "Churachandpur",
    "Imphal East",
    "Imphal West",
    "Jiribam",
    "Kakching",
    "Kamjong",
    "Kangpokpi",
    "Noney",
    "Pherzawl",
    "Senapati",
    "Tamenglong",
    "Tengnoupal",
    "Thoubal",
    "Ukhrul"
  ],
  "Meghalaya": [
    "East Garo Hills",
    "East Jaintia Hills",
    "East Khasi Hills",
    "Eastern West Khasi Hills",
    "North Garo Hills",
    "Ri Bhoi",
    "South Garo Hills",
    "South West Garo Hills",
    "South West Khasi Hills",
    "West Garo Hills",
    "West Jaintia Hills",
    "West Khasi Hills"
  ],
  "Mizoram": [
    "Aizawl",
    "Champhai",
    "Hnahthial",
    "Khawzawl",
    "Kolasib",
    "Lawngtlai",
    "Lunglei",
    "Mamit",
    "Saitual",
    "Serchhip",
    "Siaha"
  ],
  "Nagaland": [
    "Chumoukedima",
    "Dimapur",
    "Kiphire",
    "Kohima",
    "Longleng",
    "Mokokchung",
    "Mon",
    "Niuland",
    "Noklak",
    "Peren",
    "Phek",
    "Shamator",
    "Tseminyu",
    "Tuensang",
    "Wokha",
    "Zunheboto"
  ],
  "Odisha": [
    "Angul",
    "Balangir",
    "Balasore",
    "Bargarh",
    "Bhadrak",
    "Boudh",
    "Cuttack",
    "Deogarh",
    "Dhenkanal",
    "Gajapati",
    "Ganjam",
    "Jagatsinghapur",
    "Jajpur",
    "Jharsuguda",
    "Kalahandi",
    "Kandhamal",
    "Kendrapara",
    "Kendujhar",
    "Khordha",
    "Koraput",
    "Malkangiri",
    "Mayurbhanj",
    "Nabarangpur",
    "Nayagarh",
    "Nuapada",
    "Puri",
    "Rayagada",
    "Sambalpur",
    "Subarnapur",
    "Sundargarh"
  ],
  "Puducherry": [
    "Karaikal",
    "Mahe",
    "Puducherry",
    "Yanam"
  ],
  "Punjab": [
    "Amritsar",
    "Barnala",
    "Bathinda",
    "Faridkot",
    "Fatehgarh Sahib",
    "Fazilka",
    "Ferozepur",
    "Gurdaspur",
    "Hoshiarpur",
    "Jalandhar",
    "Kapurthala",
    "Ludhiana",
    "Malerkotla",
    "Mansa",
    "Moga",
    "Pathankot",
    "Patiala",
    "Rupnagar",
    "Sahibzada Ajit Singh Nagar",
    "Sangrur",
    "Shahid Bhagat Singh Nagar",
    "Sri Muktsar Sahib",
    "Tarn Taran"
  ],
  "Rajasthan": [
    "Ajmer",
    "Alwar",
    "Anupgarh",
    "Balotra",
    "Banswara",
    "Baran",
    "Barmer",
    "Beawar",
    "Bharatpur",
    "Bhilwara",
    "Bikaner",
    "Bundi",
    "Chittorgarh",
    "Churu",
    "Dausa",
    "Deeg",
    "Dholpur",
    "Didwana-Kuchaman",
    "Dudu",
    "Dungarpur",
    "Ganganagar",
    "Gangapur City",
    "Hanumangarh",
    "Jaipur",
    "Jaipur Rural",
    "Jaisalmer",
    "Jalore",
    "Jhalawar",
    "Jhunjhunu",
    "Jodhpur",
    "Jodhpur Rural",
    "Karauli",
    "Kekri",
    "Khairthal-Tijara",
    "Kota",
    "Kotputli-Behror",
    "Nagaur",
    "Neem Ka Thana",
    "Pali",
    "Phalodi",
    "Pratapgarh",
    "Rajsamand",
    "Salumbar",
    "Sanchore",
    "Sawai Madhopur",
    "Shahpura",
    "Sikar",
    "Sirohi",
    "Tonk",
    "Udaipur"
  ],
  "Sikkim": [
    "Gangtok",
    "Gyalshing",
    "Mangan",
    "Namchi",
    "Pakyong",
    "Soreng"
  ],
  "Tamil Nadu": [
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kanchipuram",
    "Kanyakumari",
    "Karur",
    "Krishnagiri",
    "Madurai",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Nilgiris",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Salem",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "Theni",
    "Thoothukudi",
    "Tiruchirappalli",
    "Tirunelveli",
    "Tirupathur",
    "Tiruppur",
    "Tiruvallur",
    "Tiruvannamalai",
    "Tiruvarur",
    "Vellore",
    "Viluppuram",
    "Virudhunagar"
  ],
  "Telangana": [
    "Adilabad",
    "Bhadradri Kothagudem",
    "Hanamkonda",
    "Hyderabad",
    "Jagtial",
    "Jangaon",
    "Jayashankar Bhupalpally",
    "Jogulamba Gadwal",
    "Kamareddy",
    "Karimnagar",
    "Khammam",
    "Kumuram Bheem Asifabad",
    "Mahabubabad",
    "Mahabubnagar",
    "Mancherial",
    "Medak",
    "Medchal-Malkajgiri",
    "Mulugu",
    "Nagarkurnool",
    "Nalgonda",
    "Narayanpet",
    "Nirmal",
    "Nizamabad",
    "Peddapalli",
    "Rajanna Sircilla",
    "Rangareddy",
    "Sangareddy",
    "Siddipet",
    "Suryapet",
    "Vikarabad",
    "Wanaparthy",
    "Warangal",
    "Yadadri Bhuvanagiri"
  ],
  "Tripura": [
    "Dhalai",
    "Gomati",
    "Khowai",
    "North Tripura",
    "Sepahijala",
    "South Tripura",
    "Unakoti",
    "West Tripura"
  ],
  "Uttar Pradesh": [
    "Agra",
    "Aligarh",
    "Ambedkar Nagar",
    "Amethi",
    "Amroha",
    "Auraiya",
    "Ayodhya",
    "Azamgarh",
    "Baghpat",
    "Bahraich",
    "Ballia",
    "Balrampur",
    "Banda",
    "Barabanki",
    "Bareilly",
    "Basti",
    "Bhadohi",
    "Bijnor",
    "Budaun",
    "Bulandshahr",
    "Chandauli",
    "Chitrakoot",
    "Deoria",
    "Etah",
    "Etawah",
    "Farrukhabad",
    "Fatehpur",
    "Firozabad",
    "Gautam Buddha Nagar",
    "Ghaziabad",
    "Ghazipur",
    "Gonda",
    "Gorakhpur",
    "Hamirpur",
    "Hapur",
    "Hardoi",
    "Hathras",
    "Jalaun",
    "Jaunpur",
    "Jhansi",
    "Kannauj",
    "Kanpur Dehat",
    "Kanpur Nagar",
    "Kasganj",
    "Kaushambi",
    "Kheri",
    "Kushinagar",
    "Lalitpur",
    "Lucknow",
    "Maharajganj",
    "Mahoba",
    "Mainpuri",
    "Mathura",
    "Mau",
    "Meerut",
    "Mirzapur",
    "Moradabad",
    "Muzaffarnagar",
    "Pilibhit",
    "Pratapgarh",
    "Prayagraj",
    "Raebareli",
    "Rampur",
    "Saharanpur",
    "Sambhal",
    "Sant Kabir Nagar",
    "Shahjahanpur",
    "Shamli",
    "Shravasti",
    "Siddharthnagar",
    "Sitapur",
    "Sonbhadra",
    "Sultanpur",
    "Unnao",
    "Varanasi"
  ],
  "Uttarakhand": [
    "Almora",
    "Bageshwar",
    "Chamoli",
    "Champawat",
    "Dehradun",
    "Haridwar",
    "Nainital",
    "Pauri Garhwal",
    "Pithoragarh",
    "Rudraprayag",
    "Tehri Garhwal",
    "Udham Singh Nagar",
    "Uttarkashi"
  ],
  "West Bengal": [
    "Alipurduar",
    "Bankura",
    "Birbhum",
    "Cooch Behar",
    "Dakshin Dinajpur",
    "Darjeeling",
    "Hooghly",
    "Howrah",
    "Jalpaiguri",
    "Jhargram",
    "Kalimpong",
    "Kolkata",
    "Malda",
    "Murshidabad",
    "Nadia",
    "North 24 Parganas",
    "Paschim Bardhaman",
    "Paschim Medinipur",
    "Purba Bardhaman",
    "Purba Medinipur",
    "Purulia",
    "South 24 Parganas",
    "Uttar Dinajpur"
  ]
};

export const REPRESENTATIVE_ULBS = {
  "Karnataka": {
    "Bengaluru Urban": [
      "Bruhat Bengaluru Mahanagara Palike (BBMP) (Municipal Corporation)"
    ],
    "Bengaluru Rural": [
      "Doddaballapura (City Municipal Council)",
      "Hosakote (City Municipal Council)",
      "Devanahalli (Town Municipal Council)",
      "Nelamangala (Town Municipal Council)"
    ],
    "Mysuru": [
      "Mysuru City Corporation (MCC) (Municipal Corporation)",
      "Hunsur (City Municipal Council)",
      "Nanjangud (City Municipal Council)"
    ],
    "Dharwad": [
      "Hubballi-Dharwad Municipal Corporation (HDMC) (Municipal Corporation)"
    ],
    "Dakshina Kannada": [
      "Mangaluru City Corporation (MCC) (Municipal Corporation)",
      "Ullal (City Municipal Council)"
    ],
    "Belagavi": [
      "Belagavi City Corporation (Municipal Corporation)",
      "Gokak (City Municipal Council)"
    ],
    "Shivamogga": [
      "Shivamogga City Corporation (Municipal Corporation)",
      "Bhadravati (City Municipal Council)"
    ],
    "Tumakuru": [
      "Tumakuru City Corporation (Municipal Corporation)",
      "Tiptur (City Municipal Council)"
    ],
    "Ballari": [
      "Ballari City Corporation (Municipal Corporation)"
    ],
    "Kalaburagi": [
      "Kalaburagi City Corporation (Municipal Corporation)"
    ],
    "Davanagere": [
      "Davanagere City Corporation (Municipal Corporation)"
    ],
    "Udupi": [
      "Udupi (City Municipal Council)",
      "Kundapura (Town Municipal Council)"
    ]
  },
  "Maharashtra": {
    "Mumbai City": [
      "Brihanmumbai Municipal Corporation (BMC / MCGM) (Municipal Corporation)"
    ],
    "Mumbai Suburban": [
      "Brihanmumbai Municipal Corporation (BMC / MCGM) (Municipal Corporation)"
    ],
    "Pune": [
      "Pune Municipal Corporation (PMC) (Municipal Corporation)",
      "Pimpri Chinchwad Municipal Corporation (PCMC) (Municipal Corporation)",
      "Pune Cantonment Board (Cantonment Board)",
      "Dehu Road Cantonment Board (Cantonment Board)"
    ],
    "Thane": [
      "Thane Municipal Corporation (TMC) (Municipal Corporation)",
      "Navi Mumbai Municipal Corporation (NMMC) (Municipal Corporation)",
      "Kalyan-Dombivli Municipal Corporation (KDMC) (Municipal Corporation)",
      "Mira-Bhayandar Municipal Corporation (MBMC) (Municipal Corporation)",
      "Ulhasnagar Municipal Corporation (Municipal Corporation)"
    ],
    "Nagpur": [
      "Nagpur Municipal Corporation (NMC) (Municipal Corporation)",
      "Kamthi (Municipal Council)"
    ],
    "Nashik": [
      "Nashik Municipal Corporation (NMC) (Municipal Corporation)",
      "Malegaon (Municipal Corporation)"
    ],
    "Chhatrapati Sambhajinagar": [
      "Chhatrapati Sambhajinagar Municipal Corporation (CSMC) (Municipal Corporation)"
    ],
    "Solapur": [
      "Solapur Municipal Corporation (Municipal Corporation)"
    ],
    "Kolhapur": [
      "Kolhapur Municipal Corporation (Municipal Corporation)"
    ],
    "Amravati": [
      "Amravati Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Delhi": {
    "New Delhi": [
      "New Delhi Municipal Council (NDMC) (Municipal Council)",
      "Delhi Cantonment Board (Cantonment Board)"
    ],
    "Central Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "East Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "North Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "North East Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "North West Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "Shahdara": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "South Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "South East Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ],
    "South West Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)",
      "Delhi Cantonment Board (Cantonment Board)"
    ],
    "West Delhi": [
      "Municipal Corporation of Delhi (MCD) (Municipal Corporation)"
    ]
  },
  "Tamil Nadu": {
    "Chennai": [
      "Greater Chennai Corporation (GCC) (Municipal Corporation)"
    ],
    "Coimbatore": [
      "Coimbatore City Municipal Corporation (CCMC) (Municipal Corporation)"
    ],
    "Madurai": [
      "Madurai City Municipal Corporation (Municipal Corporation)"
    ],
    "Tiruchirappalli": [
      "Tiruchirappalli City Municipal Corporation (Municipal Corporation)"
    ],
    "Salem": [
      "Salem City Municipal Corporation (Municipal Corporation)"
    ],
    "Tiruppur": [
      "Tiruppur City Municipal Corporation (Municipal Corporation)"
    ],
    "Erode": [
      "Erode City Municipal Corporation (Municipal Corporation)"
    ],
    "Tirunelveli": [
      "Tirunelveli City Municipal Corporation (Municipal Corporation)"
    ],
    "Vellore": [
      "Vellore City Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Telangana": {
    "Hyderabad": [
      "Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)",
      "Secunderabad Cantonment Board (Cantonment Board)"
    ],
    "Medchal-Malkajgiri": [
      "Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)",
      "Nizampet (Municipal Corporation)",
      "Boduppal (Municipal Corporation)",
      "Peerzadiguda (Municipal Corporation)"
    ],
    "Rangareddy": [
      "Greater Hyderabad Municipal Corporation (GHMC) (Municipal Corporation)",
      "Badangpet (Municipal Corporation)",
      "Bandlaguda Jagir (Municipal Corporation)",
      "Meerpet (Municipal Corporation)"
    ],
    "Warangal": [
      "Greater Warangal Municipal Corporation (GWMC) (Municipal Corporation)"
    ],
    "Karimnagar": [
      "Karimnagar Municipal Corporation (Municipal Corporation)"
    ],
    "Nizamabad": [
      "Nizamabad Municipal Corporation (Municipal Corporation)"
    ]
  },
  "West Bengal": {
    "Kolkata": [
      "Kolkata Municipal Corporation (KMC) (Municipal Corporation)"
    ],
    "Howrah": [
      "Howrah Municipal Corporation (HMC) (Municipal Corporation)",
      "Bally (Municipality)"
    ],
    "North 24 Parganas": [
      "Bidhannagar Municipal Corporation (Municipal Corporation)",
      "Barasat (Municipality)",
      "Barrackpore (Municipality)",
      "Kamarhati (Municipality)",
      "Panihati (Municipality)"
    ],
    "Paschim Bardhaman": [
      "Asansol Municipal Corporation (Municipal Corporation)",
      "Durgapur Municipal Corporation (Municipal Corporation)"
    ],
    "Darjeeling": [
      "Siliguri Municipal Corporation (Municipal Corporation)",
      "Darjeeling (Municipality)"
    ]
  },
  "Gujarat": {
    "Ahmedabad": [
      "Amdavad Municipal Corporation (AMC) (Municipal Corporation)"
    ],
    "Surat": [
      "Surat Municipal Corporation (SMC) (Municipal Corporation)"
    ],
    "Vadodara": [
      "Vadodara Municipal Corporation (VMC) (Municipal Corporation)"
    ],
    "Rajkot": [
      "Rajkot Municipal Corporation (RMC) (Municipal Corporation)"
    ],
    "Gandhinagar": [
      "Gandhinagar Municipal Corporation (GMC) (Municipal Corporation)"
    ],
    "Bhavnagar": [
      "Bhavnagar Municipal Corporation (Municipal Corporation)"
    ],
    "Jamnagar": [
      "Jamnagar Municipal Corporation (Municipal Corporation)"
    ],
    "Junagadh": [
      "Junagadh Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Uttar Pradesh": {
    "Lucknow": [
      "Lucknow Municipal Corporation (LMC) (Municipal Corporation)"
    ],
    "Kanpur Nagar": [
      "Kanpur Municipal Corporation (KMC) (Municipal Corporation)"
    ],
    "Gautam Buddha Nagar": [
      "New Okhla Industrial Development Authority (NOIDA) (Development Authority)",
      "Greater Noida Industrial Development Authority (GNIDA) (Development Authority)",
      "Dadri (Municipal Council)"
    ],
    "Ghaziabad": [
      "Ghaziabad Municipal Corporation (Municipal Corporation)"
    ],
    "Agra": [
      "Agra Municipal Corporation (Municipal Corporation)",
      "Agra Cantonment Board (Cantonment Board)"
    ],
    "Varanasi": [
      "Varanasi Municipal Corporation (Municipal Corporation)",
      "Varanasi Cantonment Board (Cantonment Board)"
    ],
    "Prayagraj": [
      "Prayagraj Municipal Corporation (Municipal Corporation)"
    ],
    "Meerut": [
      "Meerut Municipal Corporation (Municipal Corporation)",
      "Meerut Cantonment Board (Cantonment Board)"
    ],
    "Bareilly": [
      "Bareilly Municipal Corporation (Municipal Corporation)"
    ],
    "Aligarh": [
      "Aligarh Municipal Corporation (Municipal Corporation)"
    ],
    "Moradabad": [
      "Moradabad Municipal Corporation (Municipal Corporation)"
    ],
    "Gorakhpur": [
      "Gorakhpur Municipal Corporation (Municipal Corporation)"
    ],
    "Ayodhya": [
      "Ayodhya Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Rajasthan": {
    "Jaipur": [
      "Jaipur Greater Municipal Corporation (Municipal Corporation)",
      "Jaipur Heritage Municipal Corporation (Municipal Corporation)"
    ],
    "Jodhpur": [
      "Jodhpur North Municipal Corporation (Municipal Corporation)",
      "Jodhpur South Municipal Corporation (Municipal Corporation)"
    ],
    "Kota": [
      "Kota North Municipal Corporation (Municipal Corporation)",
      "Kota South Municipal Corporation (Municipal Corporation)"
    ],
    "Bikaner": [
      "Bikaner Municipal Corporation (Municipal Corporation)"
    ],
    "Ajmer": [
      "Ajmer Municipal Corporation (Municipal Corporation)"
    ],
    "Udaipur": [
      "Udaipur Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Kerala": {
    "Thiruvananthapuram": [
      "Thiruvananthapuram Municipal Corporation (Municipal Corporation)",
      "Neyyattinkara (Municipality)",
      "Attingal (Municipality)"
    ],
    "Ernakulam": [
      "Kochi Municipal Corporation (Municipal Corporation)",
      "Thrikkakara (Municipality)",
      "Aluva (Municipality)"
    ],
    "Kozhikode": [
      "Kozhikode Municipal Corporation (Municipal Corporation)"
    ],
    "Thrissur": [
      "Thrissur Municipal Corporation (Municipal Corporation)"
    ],
    "Kollam": [
      "Kollam Municipal Corporation (Municipal Corporation)"
    ],
    "Kannur": [
      "Kannur Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Andhra Pradesh": {
    "Visakhapatnam": [
      "Greater Visakhapatnam Municipal Corporation (GVMC) (Municipal Corporation)"
    ],
    "NTR": [
      "Vijayawada Municipal Corporation (VMC) (Municipal Corporation)"
    ],
    "Guntur": [
      "Guntur Municipal Corporation (GMC) (Municipal Corporation)"
    ],
    "Tirupati": [
      "Tirupati Municipal Corporation (Municipal Corporation)"
    ],
    "Kurnool": [
      "Kurnool Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Bihar": {
    "Patna": [
      "Patna Municipal Corporation (Municipal Corporation)",
      "Danapur Nizamat (Nagar Parishad)"
    ],
    "Gaya": [
      "Gaya Municipal Corporation (Municipal Corporation)"
    ],
    "Bhagalpur": [
      "Bhagalpur Municipal Corporation (Municipal Corporation)"
    ],
    "Muzaffarpur": [
      "Muzaffarpur Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Madhya Pradesh": {
    "Bhopal": [
      "Bhopal Municipal Corporation (Municipal Corporation)"
    ],
    "Indore": [
      "Indore Municipal Corporation (Municipal Corporation)"
    ],
    "Jabalpur": [
      "Jabalpur Municipal Corporation (Municipal Corporation)"
    ],
    "Gwalior": [
      "Gwalior Municipal Corporation (Municipal Corporation)"
    ],
    "Ujjain": [
      "Ujjain Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Punjab": {
    "Amritsar": [
      "Amritsar Municipal Corporation (Municipal Corporation)"
    ],
    "Ludhiana": [
      "Ludhiana Municipal Corporation (Municipal Corporation)"
    ],
    "Jalandhar": [
      "Jalandhar Municipal Corporation (Municipal Corporation)"
    ],
    "Patiala": [
      "Patiala Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Haryana": {
    "Gurugram": [
      "Municipal Corporation of Gurugram (MCG) (Municipal Corporation)"
    ],
    "Faridabad": [
      "Municipal Corporation of Faridabad (MCF) (Municipal Corporation)"
    ],
    "Panchkula": [
      "Municipal Corporation Panchkula (Municipal Corporation)"
    ],
    "Karnal": [
      "Municipal Corporation Karnal (Municipal Corporation)"
    ]
  },
  "Chandigarh": {
    "Chandigarh": [
      "Municipal Corporation Chandigarh (MCC) (Municipal Corporation)"
    ]
  },
  "Odisha": {
    "Khordha": [
      "Bhubaneswar Municipal Corporation (BMC) (Municipal Corporation)"
    ],
    "Cuttack": [
      "Cuttack Municipal Corporation (CMC) (Municipal Corporation)"
    ],
    "Sambalpur": [
      "Sambalpur Municipal Corporation (Municipal Corporation)"
    ],
    "Sundargarh": [
      "Rourkela Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Assam": {
    "Kamrup Metropolitan": [
      "Guwahati Municipal Corporation (GMC) (Municipal Corporation)"
    ]
  },
  "Goa": {
    "North Goa": [
      "Corporation of the City of Panaji (CCP) (Municipal Corporation)",
      "Mapusa (Municipal Council)"
    ],
    "South Goa": [
      "Margao (Municipal Council)",
      "Mormugao (Municipal Council)"
    ]
  },
  "Uttarakhand": {
    "Dehradun": [
      "Dehradun Municipal Corporation (Municipal Corporation)",
      "Clement Town Cantonment Board (Cantonment Board)"
    ],
    "Haridwar": [
      "Haridwar Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Himachal Pradesh": {
    "Shimla": [
      "Shimla Municipal Corporation (Municipal Corporation)"
    ],
    "Kangra": [
      "Dharamshala Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Jharkhand": {
    "Ranchi": [
      "Ranchi Municipal Corporation (Municipal Corporation)"
    ],
    "Dhanbad": [
      "Dhanbad Municipal Corporation (Municipal Corporation)"
    ],
    "East Singhbhum": [
      "Jamshedpur Notified Area Committee (JNAC) (Notified Area Committee)"
    ]
  },
  "Chhattisgarh": {
    "Raipur": [
      "Raipur Municipal Corporation (Municipal Corporation)"
    ],
    "Bilaspur": [
      "Bilaspur Municipal Corporation (Municipal Corporation)"
    ],
    "Durg": [
      "Bhilai Municipal Corporation (Municipal Corporation)",
      "Durg Municipal Corporation (Municipal Corporation)"
    ]
  },
  "Jammu and Kashmir": {
    "Srinagar": [
      "Srinagar Municipal Corporation (SMC) (Municipal Corporation)"
    ],
    "Jammu": [
      "Jammu Municipal Corporation (JMC) (Municipal Corporation)"
    ]
  },
  "Puducherry": {
    "Puducherry": [
      "Puducherry Municipality (Municipality)",
      "Oulgaret Municipality (Municipality)"
    ]
  }
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
    const baseName = cleanUlb.replace(/\s*\([^)]*\)/g, '').trim();
    const inputBaseName = cleanInput.replace(/\s*\([^)]*\)/g, '').trim();
    return baseName === inputBaseName || cleanUlb.includes(cleanInput);
  });
}
