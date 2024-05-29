/**
 * Main class of the FlightRadarAPI
 */
export class FlightRadar24API {
    private __flightTrackerConfig: FlightTrackerConfig;
    private __loginData: {userData: any; cookies: any;} | null;
    
    /**
     * Constructor of FlightRadar24API class
     */
    constructor();
    
    /**
     * Return a list with all airlines.
     */
    getAirlines(): Promise<object>;
    
    /**
     * Download the logo of an airline from FlightRadar24 and return it as bytes.
     *
     * @param {string} iata - IATA of the airline
     * @param {string} icao - ICAO of the airline
     */
    getAirlineLogo(
        iata: string,
        icao: string,
    ): Promise<[object, string] | undefined>;
    
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
     * Return a list with all airports.
     */
    getAirports(): Promise<Airport[]>;
    
    /**
     * Return the bookmarks from the FlightRadar24 account.
     */
    getBookmarks(): Promise<object>;
    
    /**
     * Convert coordinate dictionary to a string "y1, y2, x1, x2".
     *
     * @param {object} zone - Dictionary containing the following keys: tl_y, tl_x, br_y, br_x
     */
    getBounds(zone: {
        tl_y: number;
        br_y: number;
        tl_x: number;
        br_x: number;
    }): string;
    
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
    getCountryFlag(country: string): Promise<[object, string] | undefined>;
    
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
        fileType: string,
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
    getZones(): Promise<object>;
    
    /**
     * Return the search result.
     *
     * @param {string} query
     * @param {number} [limit=50]
     */
    search(query: string, limit?: number): Promise<object>;
    
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
        config?: object,
    ): Promise<void>;
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
     * Constructor of FlighTrackerConfig class.
     *
     * @param {object} data
     */
    constructor(data: object);
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
    altitude: number;
    name: string;
    icao: string;
    iata: string;
    country: string;
    
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

export class AirportNotFoundError extends Error {
    constructor(message?: string);
}

export class CloudflareError extends Error {
    constructor(message?: string);
}

export class LoginError extends Error {
    constructor(message?: string);
}

export const author: string;
export const version: string;