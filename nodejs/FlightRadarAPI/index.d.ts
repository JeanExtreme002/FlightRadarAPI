// Type definitions for FlightRadar24 API

/**
 * Zone boundary coordinates
 */
export interface Zone {
    tl_y: number;
    br_y: number;
    tl_x: number;
    br_x: number;
}

/**
 * Options for TLS impersonation. Currently maps Chrome major versions to
 * the ciphers/sigalgs/curves the runtime should use.
 */
export interface ImpersonateOptions {
    /** Chrome major version label, e.g. "chrome136". Defaults to the latest supported. */
    profile?: string;
}

/**
 * Central HTTP client. Internal class exposed for advanced use cases (custom retries,
 * cookie inspection). Most users should rely on FlightRadar24API directly.
 */
export class APIClient {
    constructor(options?: { impersonate?: ImpersonateOptions; retry?: RetryPolicy });
    request(url: string, options?: object): Promise<{content: any; statusCode: number; cookies: Record<string, string>}>;
    /**
     * Make a stateless request that bypasses the shared cookie jar. Safe to
     * call from concurrent fan-outs (e.g. `getAirports`).
     */
    requestStandalone(url: string, options?: object): Promise<{content: any; statusCode: number; cookies: Record<string, string>}>;
    getCookie(name: string): string | undefined;
    clearCookies(): void;
}

/**
 * Retry policy for transient errors (CloudflareError + AbortError / network errors).
 */
export class RetryPolicy {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterMs: number;
    constructor(options?: {
        maxAttempts?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
        jitterMs?: number;
    });
    sleepFor(attemptIndex: number): number;
}

/**
 * Main class of the FlightRadarAPI
 */
export class FlightRadar24API {
    private __flightTrackerConfig: FlightTrackerConfig;
    private __loginData: {userData: any} | null;
    private __client: APIClient;
    timeout: number;
    maxWorkers: number;

    constructor(options?: {
        timeout?: number;
        maxWorkers?: number;
        impersonate?: ImpersonateOptions;
        retry?: RetryPolicy;
    });

    /**
     * Return a list with all airlines.
     */
    getAirlines(): Promise<Array<object>>;
    
    /**
     * Download the logo of an airline from FlightRadar24 and return it as bytes.
     *
     * @param {string} iata - IATA of the airline
     * @param {string} icao - ICAO of the airline
     */
    getAirlineLogo(
        iata: string,
        icao: string,
    ): Promise<[object, string] | null>;
    
    /**
     * Return basic information about a specific airport.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @param {boolean} details - If true, it returns flights with detailed information
     */
    getAirport(code: string, details?: boolean): Promise<Airport>;
    
    /**
     * Return the airport details from FlightRadar24.
     *
     * @param {string} code - ICAO or IATA of the airport
     * @param {number} [flightLimit=100] - Limit of flights related to the airport
     * @param {number} [page=1] - Page of result to display
     */
    getAirportDetails(
        code: string,
        flightLimit?: number,
        page?: number,
    ): Promise<object>;
    
    /**
     * Return airport disruptions.
     */
    getAirportDisruptions(): Promise<object>;
    
    /**
     * Return a list with all airports for specified countries.
     *
     * @param {string[]} countries - Array of country names
     */
    getAirports(countries: string[]): Promise<Airport[]>;
    
    /**
     * Return the bookmarks from the FlightRadar24 account.
     */
    getBookmarks(): Promise<object>;
    
    /**
     * Convert coordinate dictionary to a string "y1, y2, x1, x2".
     *
     * @param {Zone} zone - Dictionary containing the following keys: tl_y, tl_x, br_y, br_x
     */
    getBounds(zone: Zone): string;
    
    /**
     * Convert a point coordinate and a radius to a string "y1, y2, x1, x2".
     *
     * @param {number} latitude - Latitude of the point
     * @param {number} longitude - Longitude of the point
     * @param {number} radius - Radius in meters to create area around the point
     */
    getBoundsByPoint(
        latitude: number,
        longitude: number,
        radius: number,
    ): string;
    
    /**
     * Download the flag of a country from FlightRadar24 and return it as bytes.
     *
     * @param {string} country - Country name
     */
    getCountryFlag(country: string): Promise<[object, string] | null>;
    
    /**
     * Return the flight details from Data Live FlightRadar24.
     *
     * @param {Flight} flight - A Flight instance
     */
    getFlightDetails(flight: Flight): Promise<object>;
    
    /**
     * Return a list of flights. See more options at setFlightTrackerConfig() method.
     *
     * @param {string} [airline] - The airline ICAO. Ex: "DAL"
     * @param {string} [bounds] - Coordinates (y1, y2 ,x1, x2). Ex: "75.78,-75.78,-427.56,427.56"
     * @param {string} [registration] - Aircraft registration
     * @param {string} [aircraftType] - Aircraft model code. Ex: "B737"
     * @param {boolean} [details] -  If true, it returns flights with detailed information
     */
    getFlights(
        airline?: string | null,
        bounds?: string | null,
        registration?: string | null,
        aircraftType?: string | null,
        details?: boolean,
    ): Promise<Flight[]>;
    
    /**
     * Return a copy of the current config of the Real Time Flight Tracker, used by getFlights() method.
     */
    getFlightTrackerConfig(): FlightTrackerConfig;
    
    /**
     * Download historical data of a flight.
     *
     * @param {Flight} flight - A Flight instance.
     * @param {string} fileType - Must be "CSV" or "KML"
     * @param {number} timestamp - A Unix timestamp
     */
    getHistoryData(
        flight: Flight,
        fileType: "CSV" | "KML",
        timestamp: number,
    ): Promise<any>;
    
    /**
     * Return the user data.
     */
    getLoginData(): object;
    
    /**
     * Return the most tracked data.
     */
    getMostTracked(): Promise<object>;
    
    /**
     * Return boundaries of volcanic eruptions and ash clouds impacting aviation.
     */
    getVolcanicEruptions(): Promise<object>;
    
    /**
     * Return all major zones on the globe.
     */
    getZones(): object;
    
    /**
     * Return the search result.
     *
     * @param {string} query
     * @param {number} [limit=50]
     */
    search(query: string, limit?: number): Promise<Record<string, object[]>>;
    
    /**
     * Check if the user is logged into the FlightRadar24 account.
     */
    isLoggedIn(): boolean;
    
    /**
     * Log in to a FlightRadar24 account.
     *
     * @param {string} user - Your email.
     * @param {string} password - Your password.
     */
    login(user: string, password: string): Promise<void>;
    
    /**
     * Log out of the FlightRadar24 account.
     */
    logout(): Promise<boolean>;
    
    /**
     * Set config for the Real Time Flight Tracker, used by getFlights() method.
     *
     * @param {FlightTrackerConfig} [flightTrackerConfig] - If null, set to the default config.
     * @param {object} [config={}] - Config as an JSON object
     */
    setFlightTrackerConfig(
        flightTrackerConfig: FlightTrackerConfig | null,
        config?: Partial<Record<keyof FlightTrackerConfig, string | number>>,
    ): void;
}

/**
 * Data class with settings of the Real Time Flight Tracker.
 */
export class FlightTrackerConfig {
    faa: string;
    satellite: string;
    mlat: string;
    flarm: string;
    adsb: string;
    gnd: string;
    air: string;
    vehicles: string;
    estimated: string;
    maxage: string;
    gliders: string;
    stats: string;
    limit: string;
    
    /**
     * Constructor of FlightTrackerConfig class.
     */
    constructor(data?: object);
}

/**
 * Representation of a real entity, at some location.
 */
export class Entity {
    latitude: number | null;
    longitude: number | null;
    
    /**
     * Constructor of Entity class.
     *
     * @param {number} latitude
     * @param {number} longitude
     */
    constructor(latitude?: number | null, longitude?: number | null);
    
    private __setPosition(
        latitude: number | null,
        longitude: number | null,
    ): void;
    
    private __getInfo(info: any, replaceBy?: any): any;
    
    /**
     * Return the distance from another entity (in kilometers).
     *
     * @param {Entity} entity
     * @return {number}
     */
    getDistanceFrom(entity: Entity): number;
}

/**
 * Airport representation.
 */
export class Airport extends Entity {
    latitude: number;
    longitude: number;
    altitude: number | null;
    name: string;
    icao: string;
    iata: string;
    country: string;
    countryCode?: string;
    countryId?: string;
    city?: string | null;
    timezoneName?: string | null;
    timezoneOffset?: number | null;
    timezoneOffsetHours?: string | null;
    timezoneAbbr?: string | null;
    timezoneAbbrName?: string | null;
    visible?: any;
    website?: string | null;
    reviewsUrl?: string | null;
    reviews?: any;
    evaluation?: any;
    averageRating?: any;
    totalRating?: any;
    weather?: object;
    runways?: any[];
    aircraftOnGround?: number | null;
    aircraftVisibleOnGround?: number | null;
    arrivals?: object;
    departures?: object;
    wikipedia?: string | null;
    images?: object;
    
    /**
     * Constructor of Airport class.
     *
     * The parameters below are optional. You can just create an Airport instance with no information
     * and use the setAirportDetails(...) method for having an instance with detailed information.
     *
     * @param {object} [basicInfo] - Basic information about the airport received from FlightRadar24
     * @param {object} [info] - Dictionary with more information about the airport received from FlightRadar24
     */
    constructor(basicInfo?: object, info?: object);

    /** Build an Airport from the listing payload. */
    static fromBasicInfo(basicInfo: object): Airport;
    /** Build an Airport from the airport.json `details` block. */
    static fromInfo(info: object): Airport;
    /** Build an Airport from a full `getAirportDetails` response. */
    static fromDetails(airportDetails: object): Airport;

    /**
     * Initialize instance with basic information about the airport.
     *
     * @param {object} basicInfo
     */
    private __initializeWithBasicInfo(basicInfo: object): void;
    
    /**
     * Initialize instance with extra information about the airport.
     *
     * @param {object} info
     */
    private __initializeWithInfo(info: object): void;
    
    /**
     * Set airport details to the instance. Use FlightRadar24API.getAirportDetails(...) method to get it.
     *
     * @param {object} airportDetails
     */
    setAirportDetails(airportDetails: object): void;
}

/**
 * Flight representation.
 */
export class Flight extends Entity {
    latitude: number;
    longitude: number;
    altitude: number;
    id: string;
    aircraftCode: string;
    airlineIcao: string;
    airlineIata: string;
    callsign: string;
    destinationAirportIata: string;
    groundSpeed: number;
    heading: number;
    number: string;
    icao24bit: string;
    squawk: string;
    registration: string;
    time: number;
    originAirportIata: string;
    onGround: number;
    verticalSpeed: number;

    // Set by setFlightDetails()
    aircraftAge?: any;
    aircraftCountryId?: any;
    aircraftHistory?: any[];
    aircraftImages?: any[];
    aircraftModel?: string | null;
    airlineName?: string | null;
    airlineShortName?: string | null;
    destinationAirportAltitude?: number | null;
    destinationAirportCountryCode?: string | null;
    destinationAirportCountryName?: string | null;
    destinationAirportLatitude?: number | null;
    destinationAirportLongitude?: number | null;
    destinationAirportIcao?: string | null;
    destinationAirportBaggage?: string | null;
    destinationAirportGate?: string | null;
    destinationAirportName?: string | null;
    destinationAirportTerminal?: string | null;
    destinationAirportVisible?: any;
    destinationAirportWebsite?: string | null;
    destinationAirportTimezoneAbbr?: string | null;
    destinationAirportTimezoneAbbrName?: string | null;
    destinationAirportTimezoneName?: string | null;
    destinationAirportTimezoneOffset?: number | null;
    destinationAirportTimezoneOffsetHours?: string | null;
    originAirportAltitude?: number | null;
    originAirportCountryCode?: string | null;
    originAirportCountryName?: string | null;
    originAirportLatitude?: number | null;
    originAirportLongitude?: number | null;
    originAirportIcao?: string | null;
    originAirportBaggage?: string | null;
    originAirportGate?: string | null;
    originAirportName?: string | null;
    originAirportTerminal?: string | null;
    originAirportVisible?: any;
    originAirportWebsite?: string | null;
    originAirportTimezoneAbbr?: string | null;
    originAirportTimezoneAbbrName?: string | null;
    originAirportTimezoneName?: string | null;
    originAirportTimezoneOffset?: number | null;
    originAirportTimezoneOffsetHours?: string | null;
    statusIcon?: string | null;
    statusText?: string | null;
    timeDetails?: object;
    trail?: any[];
    
    /**
     * Constructor of Flight class.
     *
     * @param {*} flightId - The flight ID specifically used by FlightRadar24
     * @param {*} info - Dictionary with received data from FlightRadar24
     */
    constructor(flightId: string, info: object);
    
    /**
     * Check one or more flight information.
     *
     * You can use the prefix "max" or "min" in the parameter
     * to compare numeric data with ">" or "<".
     *
     * Example: checkInfo({minAltitude: 6700, maxAltitude: 13000, airlineIcao: "THY"})
     *
     * @param {object} info
     */
    checkInfo(info: object): boolean;
    
    /**
     * Return the formatted altitude, with the unit of measure.
     */
    getAltitude(): string;
    
    /**
     * Return the formatted flight level, with the unit of measure.
     */
    getFlightLevel(): string;
    
    /**
     * Return the formatted ground speed, with the unit of measure.
     */
    getGroundSpeed(): string;
    
    /**
     * Return the formatted heading, with the unit of measure.
     */
    getHeading(): string;
    
    /**
     * Return the formatted vertical speed, with the unit of measure.
     */
    getVerticalSpeed(): string;
    
    /**
     * Set flight details to the instance. Use FlightRadar24API.getFlightDetails(...) method to get it.
     *
     * @param {object} flightDetails
     */
    setFlightDetails(flightDetails: object): void;
}

export class FlightRadarError extends Error {
    constructor(message?: string);
}

export class AirportNotFoundError extends FlightRadarError {
    constructor(message?: string);
}

export class CloudflareError extends FlightRadarError {
    response: any;
    constructor(message?: string, response?: any);
}

export class LoginError extends FlightRadarError {
    constructor(message?: string);
}

/**
 * Enum mapping country names to their URL-friendly string representations,
 * used by FlightRadar24API.getAirports().
 */
export const Countries: Readonly<{
    AFGHANISTAN: "afghanistan";
    ALBANIA: "albania";
    ALGERIA: "algeria";
    AMERICAN_SAMOA: "american-samoa";
    ANGOLA: "angola";
    ANGUILLA: "anguilla";
    ANTARCTICA: "antarctica";
    ANTIGUA_AND_BARBUDA: "antigua-and-barbuda";
    ARGENTINA: "argentina";
    ARMENIA: "armenia";
    ARUBA: "aruba";
    AUSTRALIA: "australia";
    AUSTRIA: "austria";
    AZERBAIJAN: "azerbaijan";
    BAHAMAS: "bahamas";
    BAHRAIN: "bahrain";
    BANGLADESH: "bangladesh";
    BARBADOS: "barbados";
    BELARUS: "belarus";
    BELGIUM: "belgium";
    BELIZE: "belize";
    BENIN: "benin";
    BERMUDA: "bermuda";
    BHUTAN: "bhutan";
    BOLIVIA: "bolivia";
    BOSNIA_AND_HERZEGOVINA: "bosnia-and-herzegovina";
    BOTSWANA: "botswana";
    BRAZIL: "brazil";
    BRUNEI: "brunei";
    BULGARIA: "bulgaria";
    BURKINA_FASO: "burkina-faso";
    BURUNDI: "burundi";
    CAMBODIA: "cambodia";
    CAMEROON: "cameroon";
    CANADA: "canada";
    CAPE_VERDE: "cape-verde";
    CAYMAN_ISLANDS: "cayman-islands";
    CENTRAL_AFRICAN_REPUBLIC: "central-african-republic";
    CHAD: "chad";
    CHILE: "chile";
    CHINA: "china";
    COCOS_KEELING_ISLANDS: "cocos-keeling-islands";
    COLOMBIA: "colombia";
    COMOROS: "comoros";
    CONGO: "congo";
    COOK_ISLANDS: "cook-islands";
    COSTA_RICA: "costa-rica";
    CROATIA: "croatia";
    CUBA: "cuba";
    CURACAO: "curacao";
    CYPRUS: "cyprus";
    CZECHIA: "czechia";
    DEMOCRATIC_REPUBLIC_OF_THE_CONGO: "democratic-republic-of-the-congo";
    DENMARK: "denmark";
    DJIBOUTI: "djibouti";
    DOMINICA: "dominica";
    DOMINICAN_REPUBLIC: "dominican-republic";
    ECUADOR: "ecuador";
    EGYPT: "egypt";
    EL_SALVADOR: "el-salvador";
    EQUATORIAL_GUINEA: "equatorial-guinea";
    ERITREA: "eritrea";
    ESTONIA: "estonia";
    ESWATINI: "eswatini";
    ETHIOPIA: "ethiopia";
    FALKLAND_ISLANDS_MALVINAS: "falkland-islands-malvinas";
    FAROE_ISLANDS: "faroe-islands";
    FIJI: "fiji";
    FINLAND: "finland";
    FRANCE: "france";
    FRENCH_GUIANA: "french-guiana";
    FRENCH_POLYNESIA: "french-polynesia";
    GABON: "gabon";
    GAMBIA: "gambia";
    GEORGIA: "georgia";
    GERMANY: "germany";
    GHANA: "ghana";
    GIBRALTAR: "gibraltar";
    GREECE: "greece";
    GREENLAND: "greenland";
    GRENADA: "grenada";
    GUADELOUPE: "guadeloupe";
    GUAM: "guam";
    GUATEMALA: "guatemala";
    GUERNSEY: "guernsey";
    GUINEA: "guinea";
    GUINEA_BISSAU: "guinea-bissau";
    GUYANA: "guyana";
    HAITI: "haiti";
    HONDURAS: "honduras";
    HONG_KONG: "hong-kong";
    HUNGARY: "hungary";
    ICELAND: "iceland";
    INDIA: "india";
    INDONESIA: "indonesia";
    IRAN: "iran";
    IRAQ: "iraq";
    IRELAND: "ireland";
    ISLE_OF_MAN: "isle-of-man";
    ISRAEL: "israel";
    ITALY: "italy";
    IVORY_COAST: "ivory-coast";
    JAMAICA: "jamaica";
    JAPAN: "japan";
    JERSEY: "jersey";
    JORDAN: "jordan";
    KAZAKHSTAN: "kazakhstan";
    KENYA: "kenya";
    KIRIBATI: "kiribati";
    KOSOVO: "kosovo";
    KUWAIT: "kuwait";
    KYRGYZSTAN: "kyrgyzstan";
    LAOS: "laos";
    LATVIA: "latvia";
    LEBANON: "lebanon";
    LESOTHO: "lesotho";
    LIBERIA: "liberia";
    LIBYA: "libya";
    LITHUANIA: "lithuania";
    LUXEMBOURG: "luxembourg";
    MACAO: "macao";
    MADAGASCAR: "madagascar";
    MALAWI: "malawi";
    MALAYSIA: "malaysia";
    MALDIVES: "maldives";
    MALI: "mali";
    MALTA: "malta";
    MARSHALL_ISLANDS: "marshall-islands";
    MARTINIQUE: "martinique";
    MAURITANIA: "mauritania";
    MAURITIUS: "mauritius";
    MAYOTTE: "mayotte";
    MEXICO: "mexico";
    MICRONESIA: "micronesia";
    MOLDOVA: "moldova";
    MONACO: "monaco";
    MONGOLIA: "mongolia";
    MONTENEGRO: "montenegro";
    MONTSERRAT: "montserrat";
    MOROCCO: "morocco";
    MOZAMBIQUE: "mozambique";
    MYANMAR_BURMA: "myanmar-burma";
    NAMIBIA: "namibia";
    NAURU: "nauru";
    NEPAL: "nepal";
    NETHERLANDS: "netherlands";
    NEW_CALEDONIA: "new-caledonia";
    NEW_ZEALAND: "new-zealand";
    NICARAGUA: "nicaragua";
    NIGER: "niger";
    NIGERIA: "nigeria";
    NORTH_KOREA: "north-korea";
    NORTH_MACEDONIA: "north-macedonia";
    NORTHERN_MARIANA_ISLANDS: "northern-mariana-islands";
    NORWAY: "norway";
    OMAN: "oman";
    PAKISTAN: "pakistan";
    PALAU: "palau";
    PANAMA: "panama";
    PAPUA_NEW_GUINEA: "papua-new-guinea";
    PARAGUAY: "paraguay";
    PERU: "peru";
    PHILIPPINES: "philippines";
    POLAND: "poland";
    PORTUGAL: "portugal";
    PUERTO_RICO: "puerto-rico";
    QATAR: "qatar";
    REUNION: "reunion";
    ROMANIA: "romania";
    RUSSIA: "russia";
    RWANDA: "rwanda";
    SAINT_HELENA: "saint-helena";
    SAINT_KITTS_AND_NEVIS: "saint-kitts-and-nevis";
    SAINT_LUCIA: "saint-lucia";
    SAINT_PIERRE_AND_MIQUELON: "saint-pierre-and-miquelon";
    SAINT_VINCENT_AND_THE_GRENADINES: "saint-vincent-and-the-grenadines";
    SAMOA: "samoa";
    SAO_TOME_AND_PRINCIPE: "sao-tome-and-principe";
    SAUDI_ARABIA: "saudi-arabia";
    SENEGAL: "senegal";
    SERBIA: "serbia";
    SEYCHELLES: "seychelles";
    SIERRA_LEONE: "sierra-leone";
    SINGAPORE: "singapore";
    SLOVAKIA: "slovakia";
    SLOVENIA: "slovenia";
    SOLOMON_ISLANDS: "solomon-islands";
    SOMALIA: "somalia";
    SOUTH_AFRICA: "south-africa";
    SOUTH_KOREA: "south-korea";
    SOUTH_SUDAN: "south-sudan";
    SPAIN: "spain";
    SRI_LANKA: "sri-lanka";
    SUDAN: "sudan";
    SURINAME: "suriname";
    SWEDEN: "sweden";
    SWITZERLAND: "switzerland";
    SYRIA: "syria";
    TAIWAN: "taiwan";
    TAJIKISTAN: "tajikistan";
    TANZANIA: "tanzania";
    THAILAND: "thailand";
    TIMOR_LESTE_EAST_TIMOR: "timor-leste-east-timor";
    TOGO: "togo";
    TONGA: "tonga";
    TRINIDAD_AND_TOBAGO: "trinidad-and-tobago";
    TUNISIA: "tunisia";
    TURKEY: "turkey";
    TURKMENISTAN: "turkmenistan";
    TURKS_AND_CAICOS_ISLANDS: "turks-and-caicos-islands";
    TUVALU: "tuvalu";
    UGANDA: "uganda";
    UKRAINE: "ukraine";
    UNITED_ARAB_EMIRATES: "united-arab-emirates";
    UNITED_KINGDOM: "united-kingdom";
    UNITED_STATES: "united-states";
    UNITED_STATES_MINOR_OUTLYING_ISLANDS: "united-states-minor-outlying-islands";
    URUGUAY: "uruguay";
    UZBEKISTAN: "uzbekistan";
    VANUATU: "vanuatu";
    VENEZUELA: "venezuela";
    VIETNAM: "vietnam";
    VIRGIN_ISLANDS_BRITISH: "virgin-islands-british";
    VIRGIN_ISLANDS_US: "virgin-islands-us";
    WALLIS_AND_FUTUNA: "wallis-and-futuna";
    YEMEN: "yemen";
    ZAMBIA: "zambia";
    ZIMBABWE: "zimbabwe";
}>;

export const author: string;
export const version: string;