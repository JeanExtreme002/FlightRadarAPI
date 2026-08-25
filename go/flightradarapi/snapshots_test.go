//go:build integration

// Live FR24 tests. Run with: go test -tags integration ./...
//
// Kept behind a build tag so the offline suite can gate PRs without depending
// on FR24 being reachable or its payloads being stable.
package flightradarapi

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"regexp"
	"slices"
	"testing"
	"time"
)

const liveTimeout = 30 * time.Second

// liveClient retries Cloudflare blocks, which are the usual reason a live run
// fails for reasons unrelated to the code under test.
func liveClient(t *testing.T) *Client {
	t.Helper()
	retry, err := NewRetryPolicy(3)

	if err != nil {
		t.Fatal(err)
	}

	return New(Options{Retry: retry, Timeout: liveTimeout})
}

// retryLive runs check until it passes, pausing in between. FR24 answers a
// hammered session with an empty feed, so a whole-suite run makes the
// count-sensitive assertions flaky on their own. This is the counterpart of the
// Python suite's repeat_test decorator.
func retryLive(t *testing.T, check func() error) {
	t.Helper()

	const attempts = 3
	const pause = 5 * time.Second

	var err error

	for attempt := range attempts {
		if err = check(); err == nil {
			return
		}
		if errors.Is(err, ErrCloudflare) {
			t.Skipf("blocked by Cloudflare: %v", err)
		}
		if attempt < attempts-1 {
			t.Logf("attempt %d: %v — retrying in %v", attempt+1, err, pause)
			time.Sleep(pause)
		}
	}
	t.Fatal(err)
}

// skipIfBlocked ends the test when Cloudflare, not the code, is the problem.
func skipIfBlocked(t *testing.T, err error) {
	t.Helper()

	if errors.Is(err, ErrCloudflare) {
		t.Skipf("blocked by Cloudflare: %v", err)
	}
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func liveFlights(t *testing.T, client *Client) []*Flight {
	t.Helper()
	var flights []*Flight

	retryLive(t, func() error {
		var err error
		flights, err = client.GetFlights(context.Background(), FlightSearch{})

		if err != nil {
			return err
		}
		if len(flights) == 0 {
			return errors.New("GetFlights returned no flights — the tests below would be meaningless")
		}
		return nil
	})
	return flights
}

func TestLiveGetFlightsShape(t *testing.T) {
	client := liveClient(t)

	retryLive(t, func() error {
		flights, err := client.GetFlights(context.Background(), FlightSearch{})

		if err != nil {
			return err
		}
		if len(flights) < 100 {
			return fmt.Errorf("got %d flights, want at least 100 from the unfiltered feed", len(flights))
		}

		flight := flights[0]

		if flight.ID == "" {
			return errors.New("a flight must carry an ID")
		}
		if flight.Latitude == nil || flight.Longitude == nil {
			return errors.New("a flight must carry a position")
		}
		return nil
	})
}

func TestLiveGetFlightsByAirlineShape(t *testing.T) {
	client := liveClient(t)
	airlines := []string{"SWA", "GLO", "AZU", "UAL", "THY"}

	retryLive(t, func() error {
		answered := 0

		for _, airline := range airlines {
			flights, err := client.GetFlights(context.Background(), FlightSearch{Airline: airline})

			if err != nil {
				return err
			}
			for _, flight := range flights {
				if flight.AirlineICAO != airline {
					return fmt.Errorf("asked for %s, got %s", airline, flight.AirlineICAO)
				}
			}
			if len(flights) > 0 {
				answered++
			}
		}
		if answered < 3 {
			return fmt.Errorf("only %d of %d airlines had flights in the air", answered, len(airlines))
		}
		return nil
	})
}

func TestLiveGetFlightsByBoundsShape(t *testing.T) {
	client := liveClient(t)
	zones := client.GetZones()

	for _, name := range []string{"northamerica", "southamerica"} {
		zone := zones[name]

		retryLive(t, func() error {
			flights, err := client.GetFlights(context.Background(), FlightSearch{
				Bounds: client.GetBounds(zone),
			})

			if err != nil {
				return err
			}
			if len(flights) < 30 {
				return fmt.Errorf("%s: got %d flights, want at least 30", name, len(flights))
			}

			for _, flight := range flights {
				if flight.Latitude == nil || flight.Longitude == nil {
					continue
				}
				if *flight.Latitude > zone.TLY || *flight.Latitude < zone.BRY {
					return fmt.Errorf("%s: latitude %v outside the zone", name, *flight.Latitude)
				}
				if *flight.Longitude < zone.TLX || *flight.Longitude > zone.BRX {
					return fmt.Errorf("%s: longitude %v outside the zone", name, *flight.Longitude)
				}
			}
			return nil
		})
	}
}

func TestLiveGetFlightDetailsShape(t *testing.T) {
	client := liveClient(t)
	flights := liveFlights(t, client)
	flight := flights[len(flights)/2]

	details, err := client.GetFlightDetails(context.Background(), flight)
	skipIfBlocked(t, err)

	for _, key := range []string{"aircraft", "airline", "airport", "status", "time", "trail"} {
		if _, ok := details[key]; !ok {
			t.Errorf("missing key %q in the flight details", key)
		}
	}

	flight.SetFlightDetails(details)

	if flight.Details == nil {
		t.Fatal("details were not set on the flight")
	}
	if flight.Details.Raw == nil {
		t.Error("the raw payload must be kept")
	}
}

func TestLiveGetAirportShape(t *testing.T) {
	client := liveClient(t)

	for _, code := range []string{"ATL", "LAX", "DXB", "DFW"} {
		airport, err := client.GetAirport(context.Background(), code, false)
		skipIfBlocked(t, err)

		if airport.IATA != code {
			t.Errorf("%s: got IATA %q", code, airport.IATA)
		}
		if airport.Name == "" || airport.ICAO == "" {
			t.Errorf("%s: got %+v", code, airport)
		}
		if airport.Latitude == nil || airport.Longitude == nil {
			t.Errorf("%s: an airport must carry a position", code)
		}
	}
}

func TestLiveGetAirportDetailsShape(t *testing.T) {
	client := liveClient(t)

	for _, code := range []string{"ATL", "LAX", "DXB", "DFW"} {
		details, err := client.GetAirportDetails(context.Background(), code, 1, 1)
		skipIfBlocked(t, err)

		for _, key := range []string{"airport", "airlines", "aircraftImages"} {
			if _, ok := details[key]; !ok {
				t.Errorf("%s: missing key %q", code, key)
			}
		}

		airport := getMap(getMap(getMap(details, "airport"), "pluginData"), "details")
		position := getMap(airport, "position")
		airportCode := getMap(airport, "code")

		if getString(airportCode, "iata") == "" || getString(airportCode, "icao") == "" {
			t.Errorf("%s: got code %v", code, airportCode)
		}
		if getNumber(position, "latitude") == nil || getNumber(position, "longitude") == nil {
			t.Errorf("%s: got position %v", code, position)
		}
		if getString(getMap(airport, "timezone"), "name") == "" {
			t.Errorf("%s: missing the timezone name", code)
		}
	}
}

func TestLiveGetAirlinesShape(t *testing.T) {
	airlines, err := liveClient(t).GetAirlines(context.Background())
	skipIfBlocked(t, err)

	// Thresholds mirror the Python suite: a page that parsed into three rows is
	// a broken parser, not a quiet day.
	if len(airlines) < 100 {
		t.Fatalf("got %d airlines, want at least 100", len(airlines))
	}
	if airlines[0].Name == "" {
		t.Errorf("got %+v", airlines[0])
	}

	wanted := map[string]bool{"LAN": true, "GLO": true, "DAL": true, "AZU": true, "UAE": true}

	for _, airline := range airlines {
		delete(wanted, airline.ICAO)
	}
	if len(wanted) > 0 {
		t.Errorf("missing well-known airlines: %v", slices.Sorted(maps.Keys(wanted)))
	}
}

func TestLiveGetAirportsShape(t *testing.T) {
	client := liveClient(t)
	airports, err := client.GetAirports(context.Background(),
		[]Country{CountryBrazil, CountryUnitedStates})
	skipIfBlocked(t, err)

	if len(airports) < 1800 {
		t.Fatalf("got %d airports for BR+US, want at least 1800", len(airports))
	}
	for _, airport := range airports {
		if airport.Country != "Brazil" && airport.Country != "United States" {
			t.Fatalf("got country %q, want only the two asked for", airport.Country)
		}
	}
}

func TestLiveGetAirportsWithoutCountriesShape(t *testing.T) {
	client := liveClient(t)
	airports, err := client.GetAirports(context.Background(), nil)
	skipIfBlocked(t, err)

	if len(airports) < 1800 {
		t.Fatalf("got %d airports, want at least 1800", len(airports))
	}

	countries := map[string]bool{}

	for _, airport := range airports {
		countries[airport.Country] = true
	}
	if len(countries) <= 2 {
		t.Fatalf("got %d countries, want the whole feed", len(countries))
	}

	// Discovered, not hard-coded: FR24 spells some names "Myanmar (Burma)", and
	// the flag URL needs the slug of that spelling.
	punctuated := []string{}

	for country := range countries {
		if regexp.MustCompile(`[^a-zA-Z ]`).MatchString(country) {
			punctuated = append(punctuated, country)
		}
	}
	slices.Sort(punctuated)
	tricky := airports[0].Country

	if len(punctuated) > 0 {
		tricky = punctuated[0]
	}

	flag, err := client.GetCountryFlag(context.Background(), tricky)
	skipIfBlocked(t, err)

	if flag == nil {
		t.Errorf("no flag for %q", tricky)
	}

	// The Country constants and the feed's display names are two FR24
	// vocabularies; a rename silently empties that country's filter. The reverse
	// is not asserted: a country FR24 adds is a gap in the constants, not a
	// regression.
	slugs := map[Country]bool{}

	for country := range countries {
		slugs[Country(countryToSlug(country))] = true
	}

	var absent []string

	for _, country := range AllCountries() {
		if !slugs[country] {
			absent = append(absent, string(country))
		}
	}
	if len(absent) > 0 {
		slices.Sort(absent)
		t.Errorf("Country constants absent from the feed: %v", absent)
	}
}

func TestLiveGetZonesShape(t *testing.T) {
	zones := liveClient(t).GetZones()

	if len(zones) == 0 {
		t.Fatal("no zones returned")
	}
	for name, zone := range zones {
		if zone.TLY == 0 || zone.TLX == 0 || zone.BRY == 0 || zone.BRX == 0 {
			t.Errorf("%s: got %+v", name, zone)
		}
	}
}

func TestLiveGetAirlineLogoShape(t *testing.T) {
	client := liveClient(t)
	airlines := [][2]string{{"WN", "SWA"}, {"G3", "GLO"}, {"AD", "AZU"}, {"AA", "AAL"}, {"TK", "THY"}}
	found := 0

	for _, airline := range airlines {
		logo, err := client.GetAirlineLogo(context.Background(), airline[0], airline[1])
		skipIfBlocked(t, err)

		if logo == nil {
			continue
		}
		if logo.Extension == "" {
			t.Errorf("%v: got no extension", airline)
		}

		// A real image, not an error page FR24 served with a 200.
		if len(logo.Data) > 512 {
			found++
		}
	}

	// Same 80% floor the Python suite uses: FR24 does drop the odd logo.
	if wanted := len(airlines) * 4 / 5; found < wanted {
		t.Errorf("got %d logos, want at least %d", found, wanted)
	}
}

func TestLiveGetCountryFlagShape(t *testing.T) {
	client := liveClient(t)
	countries := []string{"United States", "Brazil", "Egypt", "Japan", "South Korea", "Canada"}
	found := 0

	for _, country := range countries {
		flag, err := client.GetCountryFlag(context.Background(), country)
		skipIfBlocked(t, err)

		if flag == nil {
			continue
		}
		if flag.Extension == "" {
			t.Errorf("%s: got no extension", country)
		}
		if len(flag.Data) > 512 {
			found++
		}
	}

	if wanted := len(countries) * 4 / 5; found < wanted {
		t.Errorf("got %d flags, want at least %d", found, wanted)
	}
}

func TestLivePlainJSONEndpointsShape(t *testing.T) {
	client := liveClient(t)
	ctx := context.Background()

	calls := map[string]func() (map[string]any, error){
		"most tracked":        func() (map[string]any, error) { return client.GetMostTracked(ctx) },
		"airport disruptions": func() (map[string]any, error) { return client.GetAirportDisruptions(ctx) },
		"volcanic eruptions":  func() (map[string]any, error) { return client.GetVolcanicEruptions(ctx) },
	}

	for name, call := range calls {
		t.Run(name, func(t *testing.T) {
			content, err := call()
			skipIfBlocked(t, err)

			if content == nil {
				t.Error("got no content")
			}
		})
	}
}

func TestLiveSearchShape(t *testing.T) {
	groups, err := liveClient(t).Search(context.Background(), "Guarulhos", 50)
	skipIfBlocked(t, err)

	if len(groups) == 0 {
		t.Error("got no groups")
	}
}
