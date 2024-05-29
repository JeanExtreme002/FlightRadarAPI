export class FlightRadar24API {
  private __flightTrackerConfig: FlightTrackerConfig;
  private __loginData: {userData: any; cookies: any;} | null;
  
  constructor();
  
  getAirlines(): Promise<object>;
  
  getAirlineLogo(
    iata: string,
    icao: string,
  ): Promise<[object, string] | undefined>;
  
  getAirport(code: string, details?: boolean): Promise<Airport>;
  
  getAirportDetails(
    code: string,
    flightLimit?: number,
    page?: number,
  ): Promise<object>;
  
  getAirportDisruptions(): Promise<object>;
  
  getAirports(): Promise<Airport[]>;
  
  getBookmarks(): Promise<object>;
  
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
  
  getCountryFlag(country: string): Promise<[object, string] | undefined>;
  
  getFlightDetails(flight: Flight): Promise<object>;
  
  getFlights(
    airline?: string | null,
    bounds?: string | null,
    registration?: string | null,
    aircraftType?: string | null,
    details?: boolean,
  ): Promise<Flight[]>;
  
  getFlightTrackerConfig(): FlightTrackerConfig;
  
  getHistoryData(
    flight: Flight,
    fileType: string,
    timestamp: number,
  ): Promise<any>;
  
  getLoginData(): object;
  
  getMostTracked(): Promise<object>;
  
  getVolcanicEruptions(): Promise<object>;
  
  getZones(): Promise<object>;
  
  search(query: string, limit?: number): Promise<object>;
  
  isLoggedIn(): boolean;
  
  login(user: string, password: string): Promise<void>;
  
  logout(): Promise<boolean>;
  
  setFlightTrackerConfig(
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
  
  constructor(basicInfo?: object, info?: object);
  
  private __initializeWithBasicInfo(basicInfo: object): void;
  
  private __initializeWithInfo(info: object): void;
  
  setAirportDetails(airportDetails: object): void;
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