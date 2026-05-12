import {expectType, expectError} from "tsd";
import {
    FlightRadar24API,
    Flight,
    Airport,
    FlightTrackerConfig,
    Zone,
} from "../FlightRadarAPI/index";

const api = new FlightRadar24API();
expectType<FlightRadar24API>(new FlightRadar24API({timeout: 5000, maxWorkers: 4}));

// getFlights
expectType<Promise<Flight[]>>(api.getFlights());
expectType<Promise<Flight[]>>(api.getFlights("DAL"));
expectType<Promise<Flight[]>>(api.getFlights(null, null, null, null, true));

// getFlightDetails
declare const flight: Flight;
expectType<Promise<object>>(api.getFlightDetails(flight));

// getAirport / getAirportDetails
expectType<Promise<Airport>>(api.getAirport("ATL"));
expectType<Promise<Airport>>(api.getAirport("ATL", true));
expectType<Promise<object>>(api.getAirportDetails("ATL", 10, 1));

// getAirports
expectType<Promise<Airport[]>>(api.getAirports(["Brazil"]));

// getAirlines
expectType<Promise<Array<object>>>(api.getAirlines());

// getBounds / getBoundsByPoint
const zone: Zone = {tl_y: 1, br_y: 0, tl_x: 0, br_x: 1};
expectType<string>(api.getBounds(zone));
expectType<string>(api.getBoundsByPoint(0, 0, 1000));

// getZones
expectType<object>(api.getZones());

// search
expectType<Promise<Record<string, object[]>>>(api.search("TAM"));

// isLoggedIn / login / logout
expectType<boolean>(api.isLoggedIn());
expectType<Promise<void>>(api.login("user@email.com", "password"));
expectType<Promise<boolean>>(api.logout());

// FlightTrackerConfig
expectType<FlightTrackerConfig>(api.getFlightTrackerConfig());

// Flight properties
expectType<string>(flight.id);
expectType<number>(flight.altitude);
expectType<number>(flight.groundSpeed);
expectType<string>(flight.registration);

// Flight methods
expectType<string>(flight.getAltitude());
expectType<string>(flight.getFlightLevel());
expectType<string>(flight.getGroundSpeed());
expectType<string>(flight.getHeading());
expectType<string>(flight.getVerticalSpeed());
expectType<boolean>(flight.checkInfo({airlineIcao: "TAM"}));

// Wrong types should error
expectError(api.getFlights(123));
expectError(api.getBounds({tl_y: 1}));
expectError(new FlightRadar24API({timeout: "5000"}));
