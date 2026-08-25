// This file is compiled as an outside consumer of the package, so it also keeps
// the public surface honest: anything an example needs has to be exported.
package flightradarapi_test

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/JeanExtreme002/FlightRadarAPI/go/flightradarapi"
)

// The examples that reach FlightRadar24 carry no "Output" comment, so `go test`
// compiles them without running them.

func Example() {
	client := flightradarapi.New()

	flights, err := client.GetFlights(context.Background(), flightradarapi.FlightSearch{})

	if err != nil {
		log.Fatal(err)
	}

	for _, flight := range flights[:min(5, len(flights))] {
		fmt.Println(flight.Callsign, flight.GetFlightLevel(), flight.GetGroundSpeed())
	}
}

func ExampleClient_GetFlights_abovePosition() {
	client := flightradarapi.New()

	// Your point is 52°34'04.7"N 13°16'57.5"E from Google Maps, and a radius of
	// 2 km around it.
	bounds := client.GetBoundsByPoint(52.567774, 13.282827, 2000)

	flights, err := client.GetFlights(context.Background(), flightradarapi.FlightSearch{
		Bounds: bounds,
	})

	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(flights), "flights overhead")
}

func ExampleClient_GetFlights_withDetails() {
	client := flightradarapi.New(flightradarapi.Options{MaxWorkers: 4})

	// One extra request per flight, four at a time.
	flights, err := client.GetFlights(context.Background(), flightradarapi.FlightSearch{
		Airline: "GLO",
		Details: true,
	})

	if err != nil {
		log.Fatal(err)
	}

	for _, flight := range flights {
		fmt.Println(flight.Callsign, "→", flight.Details.DestinationAirportName)
	}
}

func ExampleClient_GetAirports() {
	client := flightradarapi.New()

	// Pass nil for every airport in the feed.
	airports, err := client.GetAirports(context.Background(), []flightradarapi.Country{
		flightradarapi.CountryBrazil,
		flightradarapi.CountryUnitedStates,
	})

	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(airports), "airports")
}

func ExampleClient_GetAirport_details() {
	client := flightradarapi.New(flightradarapi.Options{Timeout: 10 * time.Second})

	airport, err := client.GetAirport(context.Background(), "VNLK", true)

	if errors.Is(err, flightradarapi.ErrAirportNotFound) {
		fmt.Println("no such airport")
		return
	}
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(airport.Name, airport.TimezoneName, len(airport.Runways))
}

func ExampleClient_Login() {
	client := flightradarapi.New()

	if err := client.Login(context.Background(), "email", "password"); err != nil {
		log.Fatal(err)
	}
	defer client.Logout(context.Background())

	// Downloading history data needs a premium account.
	data, err := client.GetHistoryData(context.Background(), &flightradarapi.Flight{ID: "2e0f1a2"},
		"CSV", time.Now().Unix())

	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(len(data), "bytes of history")
}

func ExampleNewRetryPolicy() {
	// Three attempts, with exponential backoff between them.
	retry, err := flightradarapi.NewRetryPolicy(3)

	if err != nil {
		log.Fatal(err)
	}

	client := flightradarapi.New(flightradarapi.Options{Retry: retry})

	_, err = client.GetMostTracked(context.Background())

	// Every error of this package wraps a sentinel.
	if errors.Is(err, flightradarapi.ErrCloudflare) {
		fmt.Println("still blocked after three attempts")
	}
}

func ExampleClient_GetBounds() {
	client := flightradarapi.New()

	// The zones are bundled, so this needs no request.
	fmt.Println(client.GetBounds(client.GetZones()["europe"]))
	// Output: 72.57,33.57,-16.96,53.05
}

func ExampleFlight_CheckInfo() {
	altitude, groundSpeed := 12000.0, 430.0
	flight := &flightradarapi.Flight{
		Callsign:    "THY1",
		AirlineICAO: "THY",
		Altitude:    &altitude,
		GroundSpeed: &groundSpeed,
	}

	// "min_" and "max_" compare numerically; anything else compares for equality.
	matched, err := flight.CheckInfo(map[string]any{
		"min_altitude": 6700,
		"max_altitude": 13000,
		"airline_icao": "THY",
	})

	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(matched, flight.GetFlightLevel())
	// Output: true 120 FL
}

func ExampleEntity_GetDistanceFrom() {
	latitude, longitude := -23.43, -46.47
	airport := &flightradarapi.Airport{
		IATA:   "GRU",
		Entity: flightradarapi.Entity{Latitude: &latitude, Longitude: &longitude},
	}

	flightLatitude, flightLongitude := -22.81, -43.25
	flight := &flightradarapi.Flight{
		Entity: flightradarapi.Entity{Latitude: &flightLatitude, Longitude: &flightLongitude},
	}

	distance, err := airport.GetDistanceFrom(flight)

	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%.0f km\n", distance)
	// Output: 336 km
}
