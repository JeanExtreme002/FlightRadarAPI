export class FlightRadar24API {
  private __flightTrackerConfig: FlightTrackerConfig;
  private __loginData: {userData: any; cookies: any;} | null;
  
  constructor();
  
  async getAirlines(): Promise<object>;
  
  async getAirlineLogo(
    iata: string,
    icao: string,
  ): Promise<[object, string] | undefined>;
  
  async getAirport(code: string, details?: boolean): Promise<Airport>;
  
  async getAirportDetails(
    code: string,
    flightLimit?: number,
    page?: number,
  ): Promise<object>;
  
  async getAirportDisruptions(): Promise<object>;
  
  async getAirports(): Promise<Airport[]>;
  
  async getBookmarks(): Promise<object>;
  
  getBounds(zone: {
    tl_y: number;
    br_y: number;
    tl_x: number;
    br_x: number;
  }): string;
  
  getBoundsByPoint(
    latitude: number,
    longitude: number,
    radius: number,
  ): string;
  
  async getCountryFlag(country: string): Promise<[object, string] | undefined>;
  
  async getFlightDetails(flight: Flight): Promise<object>;
  
  async getFlights(
    airline?: string | null,
    bounds?: string | null,
    registration?: string | null,
    aircraftType?: string | null,
    details?: boolean,
  ): Promise<Flight[]>;
  
  getFlightTrackerConfig(): FlightTrackerConfig;
  
  async getHistoryData(
    flight: Flight,
    fileType: string,
    timestamp: number,
  ): Promise<any>;
  
  getLoginData(): object;
  
  async getMostTracked(): Promise<object>;
  
  async getVolcanicEruptions(): Promise<object>;
  
  async getZones(): Promise<object>;
  
  async search(query: string, limit?: number): Promise<object>;
  
  isLoggedIn(): boolean;
  
  async login(user: string, password: string): Promise<void>;
  
  async logout(): Promise<boolean>;
  
  async setFlightTrackerConfig(
    flightTrackerConfig: FlightTrackerConfig | null,
    config?: object,
  ): Promise<void>;
}

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

  constructor(data: object);
}

export class Airport extends Entity {
  latitude: number;
  longitude: number;
  altitude: number;
  name: string;
  icao: string;
  iata: string;
  country: string;
  
  constructor(basicInfo?: AirportData, info?: object) {
    super();

    if (basicInfo) {
      this.__initializeWithBasicInfo(basicInfo);
    }
    if (info) {
      this.__initializeWithInfo(info);
    }
  }
  
  private __initializeWithBasicInfo(basicInfo: AirportData): void {
    this.latitude = basicInfo.latitude;
    this.longitude = basicInfo.longitude;
    this.altitude = basicInfo.altitude;
    this.name = basicInfo.name;
    this.icao = basicInfo.icao;
    this.iata = basicInfo.iata;
    this.country = basicInfo.country;
  }
  
  private __initializeWithInfo(info: object): void {
    // Initialize with info
  }
  
  setAirportDetails(airportDetails: object): void {
    // Set airport details
  }
}

export class Entity {
  latitude: number | null;
  longitude: number | null;

  constructor(latitude?: number | null, longitude?: number | null);

  private __setPosition(
    latitude: number | null,
    longitude: number | null,
  ): void;

  private __getInfo(info: any, replaceBy?: any): any;

  getDistanceFrom(entity: Entity): number;
}

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
  
  constructor(flightId: string, info: object);
  
  checkInfo(info: object): boolean;

  getAltitude(): string;

  getFlightLevel(): string;

  getGroundSpeed(): string;

  getHeading(): string;

  getVerticalSpeed(): string;

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