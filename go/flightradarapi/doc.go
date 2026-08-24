// Package flightradarapi is an unofficial SDK for FlightRadar24.
//
// It provides the flight and airport data available to the public on the
// FlightRadar24 website. Start with [New], then call the methods of [Client].
//
// See more information at:
//
//	https://www.flightradar24.com/premium/
//	https://www.flightradar24.com/terms-and-conditions
//
// # Porting from the Python and Node.js SDKs
//
// The three SDKs carry the same features; the names differ only where Go's
// conventions do. The package name is part of every identifier here, so the
// client is [Client] rather than FlightRadar24API, the way it is http.Client and
// not http.HTTPClient.
//
//	Python / Node.js            This package
//	------------------------    --------------------------------------------
//	FlightRadar24API()          New(), returning a *Client
//	FlightRadar24API({...})     New(Options{...})
//	FlightRadarError            ErrFlightRadar, wrapped by every error here
//	Countries.BRAZIL            CountryBrazil, with AllCountries() to enumerate
//	get_flights(airline, ...)   Client.GetFlights(ctx, FlightSearch{...})
//	check_info(min_altitude=x)  Flight.CheckInfo(map[string]any{"min_altitude": x})
//	Airport.from_details(x)     NewAirportFromDetails(x)
//	(bytes, extension) tuple    *Image
//	airline["n_aircrafts"]      Airline.NumAircrafts
//	flight.destination_...      flight.Details.Destination...
//
// Every method of FlightRadar24API has a counterpart here with the same
// parameters, and a test reads the Python source to keep it that way.
package flightradarapi

// Version of this package.
const Version = "1.6.0"

// Author of this package.
const Author = "Jean Loui Bernard Silva de Jesus"
