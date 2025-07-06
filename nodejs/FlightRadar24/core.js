const {staticZones} = require("./zones");

String.prototype.format = function() {
    const args = arguments;
    let index = 0;

    return this.replace(/{}/g, function(match, position) {
        return (typeof args[index] == "undefined") ? match : args[index++];
    });
};


/**
 * Class which contains all URLs used by the package.
 */
class Core {
    /**
     * Constructor of the Core class
     */
    constructor() {
        this.apiFlightradarBaseUrl = "https://api.flightradar24.com/common/v1";
        this.cdnFlightradarBaseUrl = "https://cdn.flightradar24.com";
        this.flightRadarBaseUrl = "https://www.flightradar24.com";
        this.dataLiveBaseUrl = "https://data-live.flightradar24.com";
        this.dataCloudBaseUrl = "https://data-cloud.flightradar24.com";

        // User login URL.
        this.userLoginUrl = this.flightRadarBaseUrl + "/user/login";
        this.userLogoutUrl = this.flightRadarBaseUrl + "/user/logout";

        // Search data URL
        this.searchDataUrl = this.flightRadarBaseUrl + "/v1/search/web/find?query={}&limit={}";

        // Flights data URLs.
        this.realTimeFlightTrackerDataUrl = this.dataCloudBaseUrl + "/zones/fcgi/feed.js";
        this.flightDataUrl = this.dataLiveBaseUrl + "/clickhandler/?flight={}";

        // Historical data URL.
        this.historicalDataUrl = this.flightradarBaseUrl + "/download/?flight={}&file={}&trailLimit=0&history={}";

        // Airports data URLs.
        this.apiAirportDataUrl = this.apiFlightradarBaseUrl + "/airport.json";
        this.airportDataUrl = this.flightRadarBaseUrl + "/airports/traffic-stats/?airport={}";
        this.airportsDataUrl = this.flightRadarBaseUrl + "/data/airports";

        // Airlines data URL.
        this.airlinesDataUrl = this.flightRadarBaseUrl + "/data/airlines";

        // Zones data URL.
        this.zonesDataUrl = this.flightRadarBaseUrl + "/js/zones.js.php";

        // Weather data URL.
        this.volcanicEruptionDataUrl = this.flightRadarBaseUrl + "/weather/volcanic";

        // Most tracked URL
        this.mostTrackedUrl = this.flightRadarBaseUrl + "/flights/most-tracked";

        // Airport disruptions URL.
        this.airportDisruptionsUrl = this.flightRadarBaseUrl + "/webapi/v1/airport-disruptions";

        // Bookmarks URL.
        this.bookmarksUrl = this.flightRadarBaseUrl + "/webapi/v1/bookmarks";

        // Country flag image URL.
        this.countryFlagUrl = this.flightRadarBaseUrl + "/static/images/data/flags-small/{}.svg";

        // Airline logo image URL.
        this.airlineLogoUrl = this.cdnFlightradarBaseUrl + "/assets/airlines/logotypes/{}_{}.png";
        this.alternativeAirlineLogoUrl = this.flightRadarBaseUrl + "/static/images/data/operators/{}_logo0.png";

        this.staticZones = staticZones;

        this.headers = {
            "accept-encoding": "gzip, br",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "max-age=0",
            "origin": "https://www.flightradar24.com",
            "referer": "https://www.flightradar24.com/",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
        };

        this.jsonHeaders = {accept: "application/json", ...this.headers};

        this.imageHeaders = {accept: "image/gif, image/jpg, image/jpeg, image/png", ...this.headers};
        
        this.htmlHeaders = {accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7", ...this.headers};
    }
}

/**
 * Enum mapping country names to their URL-friendly string representations.
 */
const Countries = {
    AFGHANISTAN: "afghanistan",
    ALBANIA: "albania",
    ALGERIA: "algeria",
    AMERICAN_SAMOA: "american-samoa",
    ANGOLA: "angola",
    ANGUILLA: "anguilla",
    ANTARCTICA: "antarctica",
    ANTIGUA_AND_BARBUDA: "antigua-and-barbuda",
    ARGENTINA: "argentina",
    ARMENIA: "armenia",
    ARUBA: "aruba",
    AUSTRALIA: "australia",
    AUSTRIA: "austria",
    AZERBAIJAN: "azerbaijan",
    BAHAMAS: "bahamas",
    BAHRAIN: "bahrain",
    BANGLADESH: "bangladesh",
    BARBADOS: "barbados",
    BELARUS: "belarus",
    BELGIUM: "belgium",
    BELIZE: "belize",
    BENIN: "benin",
    BERMUDA: "bermuda",
    BHUTAN: "bhutan",
    BOLIVIA: "bolivia",
    BOSNIA_AND_HERZEGOVINA: "bosnia-and-herzegovina",
    BOTSWANA: "botswana",
    BRAZIL: "brazil",
    BRUNEI: "brunei",
    BULGARIA: "bulgaria",
    BURKINA_FASO: "burkina-faso",
    BURUNDI: "burundi",
    CAMBODIA: "cambodia",
    CAMEROON: "cameroon",
    CANADA: "canada",
    CAPE_VERDE: "cape-verde",
    CAYMAN_ISLANDS: "cayman-islands",
    CENTRAL_AFRICAN_REPUBLIC: "central-african-republic",
    CHAD: "chad",
    CHILE: "chile",
    CHINA: "china",
    COCOS_KEELING_ISLANDS: "cocos-keeling-islands",
    COLOMBIA: "colombia",
    COMOROS: "comoros",
    CONGO: "congo",
    COOK_ISLANDS: "cook-islands",
    COSTA_RICA: "costa-rica",
    CROATIA: "croatia",
    CUBA: "cuba",
    CURACAO: "curacao",
    CYPRUS: "cyprus",
    CZECHIA: "czechia",
    DEMOCRATIC_REPUBLIC_OF_THE_CONGO: "democratic-republic-of-the-congo",
    DENMARK: "denmark",
    DJIBOUTI: "djibouti",
    DOMINICA: "dominica",
    DOMINICAN_REPUBLIC: "dominican-republic",
    ECUADOR: "ecuador",
    EGYPT: "egypt",
    EL_SALVADOR: "el-salvador",
    EQUATORIAL_GUINEA: "equatorial-guinea",
    ERITREA: "eritrea",
    ESTONIA: "estonia",
    ESWATINI: "eswatini",
    ETHIOPIA: "ethiopia",
    FALKLAND_ISLANDS_MALVINAS: "falkland-islands-malvinas",
    FAROE_ISLANDS: "faroe-islands",
    FIJI: "fiji",
    FINLAND: "finland",
    FRANCE: "france",
    FRENCH_GUIANA: "french-guiana",
    FRENCH_POLYNESIA: "french-polynesia",
    GABON: "gabon",
    GAMBIA: "gambia",
    GEORGIA: "georgia",
    GERMANY: "germany",
    GHANA: "ghana",
    GIBRALTAR: "gibraltar",
    GREECE: "greece",
    GREENLAND: "greenland",
    GRENADA: "grenada",
    GUADELOUPE: "guadeloupe",
    GUAM: "guam",
    GUATEMALA: "guatemala",
    GUERNSEY: "guernsey",
    GUINEA: "guinea",
    GUINEA_BISSAU: "guinea-bissau",
    GUYANA: "guyana",
    HAITI: "haiti",
    HONDURAS: "honduras",
    HONG_KONG: "hong-kong",
    HUNGARY: "hungary",
    ICELAND: "iceland",
    INDIA: "india",
    INDONESIA: "indonesia",
    IRAN: "iran",
    IRAQ: "iraq",
    IRELAND: "ireland",
    ISLE_OF_MAN: "isle-of-man",
    ISRAEL: "israel",
    ITALY: "italy",
    IVORY_COAST: "ivory-coast",
    JAMAICA: "jamaica",
    JAPAN: "japan",
    JERSEY: "jersey",
    JORDAN: "jordan",
    KAZAKHSTAN: "kazakhstan",
    KENYA: "kenya",
    KIRIBATI: "kiribati",
    KOSOVO: "kosovo",
    KUWAIT: "kuwait",
    KYRGYZSTAN: "kyrgyzstan",
    LAOS: "laos",
    LATVIA: "latvia",
    LEBANON: "lebanon",
    LESOTHO: "lesotho",
    LIBERIA: "liberia",
    LIBYA: "libya",
    LITHUANIA: "lithuania",
    LUXEMBOURG: "luxembourg",
    MACAO: "macao",
    MADAGASCAR: "madagascar",
    MALAWI: "malawi",
    MALAYSIA: "malaysia",
    MALDIVES: "maldives",
    MALI: "mali",
    MALTA: "malta",
    MARSHALL_ISLANDS: "marshall-islands",
    MARTINIQUE: "martinique",
    MAURITANIA: "mauritania",
    MAURITIUS: "mauritius",
    MAYOTTE: "mayotte",
    MEXICO: "mexico",
    MICRONESIA: "micronesia",
    MOLDOVA: "moldova",
    MONACO: "monaco",
    MONGOLIA: "mongolia",
    MONTENEGRO: "montenegro",
    MONTSERRAT: "montserrat",
    MOROCCO: "morocco",
    MOZAMBIQUE: "mozambique",
    MYANMAR_BURMA: "myanmar-burma",
    NAMIBIA: "namibia",
    NAURU: "nauru",
    NEPAL: "nepal",
    NETHERLANDS: "netherlands",
    NEW_CALEDONIA: "new-caledonia",
    NEW_ZEALAND: "new-zealand",
    NICARAGUA: "nicaragua",
    NIGER: "niger",
    NIGERIA: "nigeria",
    NORTH_KOREA: "north-korea",
    NORTH_MACEDONIA: "north-macedonia",
    NORTHERN_MARIANA_ISLANDS: "northern-mariana-islands",
    NORWAY: "norway",
    OMAN: "oman",
    PAKISTAN: "pakistan",
    PALAU: "palau",
    PANAMA: "panama",
    PAPUA_NEW_GUINEA: "papua-new-guinea",
    PARAGUAY: "paraguay",
    PERU: "peru",
    PHILIPPINES: "philippines",
    POLAND: "poland",
    PORTUGAL: "portugal",
    PUERTO_RICO: "puerto-rico",
    QATAR: "qatar",
    REUNION: "reunion",
    ROMANIA: "romania",
    RUSSIA: "russia",
    RWANDA: "rwanda",
    SAINT_HELENA: "saint-helena",
    SAINT_KITTS_AND_NEVIS: "saint-kitts-and-nevis",
    SAINT_LUCIA: "saint-lucia",
    SAINT_PIERRE_AND_MIQUELON: "saint-pierre-and-miquelon",
    SAINT_VINCENT_AND_THE_GRENADINES: "saint-vincent-and-the-grenadines",
    SAMOA: "samoa",
    SAO_TOME_AND_PRINCIPE: "sao-tome-and-principe",
    SAUDI_ARABIA: "saudi-arabia",
    SENEGAL: "senegal",
    SERBIA: "serbia",
    SEYCHELLES: "seychelles",
    SIERRA_LEONE: "sierra-leone",
    SINGAPORE: "singapore",
    SLOVAKIA: "slovakia",
    SLOVENIA: "slovenia",
    SOLOMON_ISLANDS: "solomon-islands",
    SOMALIA: "somalia",
    SOUTH_AFRICA: "south-africa",
    SOUTH_KOREA: "south-korea",
    SOUTH_SUDAN: "south-sudan",
    SPAIN: "spain",
    SRI_LANKA: "sri-lanka",
    SUDAN: "sudan",
    SURINAME: "suriname",
    SWEDEN: "sweden",
    SWITZERLAND: "switzerland",
    SYRIA: "syria",
    TAIWAN: "taiwan",
    TAJIKISTAN: "tajikistan",
    TANZANIA: "tanzania",
    THAILAND: "thailand",
    TIMOR_LESTE_EAST_TIMOR: "timor-leste-east-timor",
    TOGO: "togo",
    TONGA: "tonga",
    TRINIDAD_AND_TOBAGO: "trinidad-and-tobago",
    TUNISIA: "tunisia",
    TURKEY: "turkey",
    TURKMENISTAN: "turkmenistan",
    TURKS_AND_CAICOS_ISLANDS: "turks-and-caicos-islands",
    TUVALU: "tuvalu",
    UGANDA: "uganda",
    UKRAINE: "ukraine",
    UNITED_ARAB_EMIRATES: "united-arab-emirates",
    UNITED_KINGDOM: "united-kingdom",
    UNITED_STATES: "united-states",
    UNITED_STATES_MINOR_OUTLYING_ISLANDS: "united-states-minor-outlying-islands",
    URUGUAY: "uruguay",
    UZBEKISTAN: "uzbekistan",
    VANUATU: "vanuatu",
    VENEZUELA: "venezuela",
    VIETNAM: "vietnam",
    VIRGIN_ISLANDS_BRITISH: "virgin-islands-british",
    VIRGIN_ISLANDS_US: "virgin-islands-us",
    WALLIS_AND_FUTUNA: "wallis-and-futuna",
    YEMEN: "yemen",
    ZAMBIA: "zambia",
    ZIMBABWE: "zimbabwe"
};

module.exports = new Core();
module.exports.Countries = Countries;
