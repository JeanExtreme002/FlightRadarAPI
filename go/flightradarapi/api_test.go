package flightradarapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// One real feed row, trimmed to the positional fields Flight reads.
var flightRow = []any{
	"ABC123", -23.43, -46.47, 90.0, 35000.0, 450.0, "1234", "", "B738", "PR-XYZ",
	1700000000.0, "GRU", "GIG", "G31234", 0.0, 0.0, "GLO1234", 0.0, "GLO",
}

var (
	degradedFeed = map[string]any{
		"full_count": 22684,
		"version":    4,
		"stats":      map[string]any{"total": map[string]any{"ads-b": 18541}},
	}
	healthyFeed = map[string]any{
		"full_count": 24560,
		"version":    4,
		"3f6a31cd":   flightRow,
		"40ae422e":   flightRow,
	}
	idleFeed = map[string]any{"full_count": 0, "version": 4}
)

// testEndpoints points every URL at a local server, keeping the real paths.
func testEndpoints(base string) endpoints {
	return endpoints{
		userLogin:                 base + "/user/login",
		userLogout:                base + "/user/logout",
		searchData:                base + "/v1/search/web/find?query=%s&limit=%d",
		realTimeFlightTrackerData: base + "/zones/fcgi/feed.js",
		flightData:                base + "/clickhandler/?flight=%s",
		historicalData:            base + "/download/?flight=%s&file=%s&trailLimit=0&history=%d",
		apiAirportData:            base + "/common/v1/airport.json",
		airportData:               base + "/airports/traffic-stats/?airport=%s",
		airportsJSON:              base + "/_json/airports.php",
		airportDisruption:         base + "/webapi/v1/airport-disruptions",
		airlinesData:              base + "/data/airlines",
		volcanicEruptionData:      base + "/weather/volcanic",
		mostTracked:               base + "/flights/most-tracked",
		bookmarks:                 base + "/webapi/v1/bookmarks",
		countryFlag:               base + "/static/images/data/flags-small/%s.svg",
		airlineLogo:               base + "/assets/airlines/logotypes/%s_%s.png",
		alternativeAirlineLogo:    base + "/static/images/data/operators/%s_logo0.png",
	}
}

// newTestClient serves handler and returns a client wired to it.
func newTestClient(t *testing.T, handler http.Handler) *Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	endpoints := testEndpoints(server.URL)

	return New(Options{Timeout: 5 * time.Second, endpoints: &endpoints})
}

func writeJSON(t *testing.T, w http.ResponseWriter, payload any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		t.Errorf("could not write the payload: %v", err)
	}
}

// --- airlines, airports, zones ---

func TestGetAirlinesParsesTheListingPage(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/data/airlines", func(w http.ResponseWriter, r *http.Request) {
		if accept := r.Header.Get("Accept"); !strings.Contains(accept, "text/html") {
			t.Errorf("got accept %q, want the html headers", accept)
		}
		w.Header().Set("Content-Type", "text/html")
		w.Write(loadFixture(t, "airlines.html"))
	})

	airlines, err := newTestClient(t, mux).GetAirlines(context.Background())

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(airlines) != 5 {
		t.Errorf("got %d airlines, want 5", len(airlines))
	}
}

func TestGetAirportsFiltersByCountry(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/_json/airports.php", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(loadFixture(t, "airports.json"))
	})

	client := newTestClient(t, mux)
	airports, err := client.GetAirports(context.Background(), []Country{CountryBrazil})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(airports) != 4 {
		t.Errorf("got %d Brazilian airports, want 4", len(airports))
	}

	every, err := client.GetAirports(context.Background(), nil)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(every) != 8 {
		t.Errorf("got %d airports for nil, want all 8", len(every))
	}
}

func TestGetAirportsWithAnEmptyFilterMakesNoRequest(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/_json/airports.php", func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.Write(loadFixture(t, "airports.json"))
	})

	airports, err := newTestClient(t, mux).GetAirports(context.Background(), []Country{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(airports) != 0 || calls.Load() != 0 {
		t.Errorf("got %d airports after %d calls, want neither", len(airports), calls.Load())
	}
}

func TestGetAirportReadsTheDetailsBlock(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/airports/traffic-stats/", func(w http.ResponseWriter, r *http.Request) {
		if code := r.URL.Query().Get("airport"); code != "ATL" {
			t.Errorf("got airport %q, want ATL", code)
		}
		writeJSON(t, w, map[string]any{"details": map[string]any{
			"name":     "Hartsfield Jackson Atlanta International Airport",
			"code":     map[string]any{"iata": "ATL", "icao": "KATL"},
			"position": map[string]any{"latitude": 33.6367, "longitude": -84.428101},
		}})
	})

	airport, err := newTestClient(t, mux).GetAirport(context.Background(), "ATL", false)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if airport.IATA != "ATL" || airport.ICAO != "KATL" {
		t.Errorf("got %q / %q", airport.IATA, airport.ICAO)
	}
}

func TestGetAirportReportsAMissingAirport(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/airports/traffic-stats/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{})
	})

	_, err := newTestClient(t, mux).GetAirport(context.Background(), "XXX", false)

	if !errors.Is(err, ErrAirportNotFound) {
		t.Errorf("got %v, want an airport-not-found error", err)
	}
}

func TestGetAirportRejectsAnInvalidCode(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())

	for _, code := range []string{"", "AB", "TOOLONG"} {
		if _, err := client.GetAirport(context.Background(), code, false); err == nil {
			t.Errorf("%q: expected an error", code)
		}
	}
}

func TestGetAirportDetailsReturnsTheResponseBlock(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()

		if query.Get("code") != "ATL" || query.Get("limit") != "10" || query.Get("page") != "2" {
			t.Errorf("got query %v", query)
		}
		writeJSON(t, w, map[string]any{"result": map[string]any{"response": map[string]any{
			"airport": map[string]any{"pluginData": map[string]any{
				"details": map[string]any{"name": "Atlanta"},
			}},
		}}})
	})

	details, err := newTestClient(t, mux).GetAirportDetails(context.Background(), "ATL", 10, 2)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	airport := getMap(getMap(getMap(details, "airport"), "pluginData"), "details")

	if getString(airport, "name") != "Atlanta" {
		t.Errorf("got %v", details)
	}
}

func TestGetAirportDetailsReportsAFlightLimitOutOfRange(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]any{"errors": map[string]any{
			"errors": map[string]any{"parameters": map[string]any{
				"limit": map[string]any{"notBetween": "limit must be between 1 and 100"},
			}},
		}})
	})

	_, err := newTestClient(t, mux).GetAirportDetails(context.Background(), "ATL", 5000, 1)

	if err == nil || !strings.Contains(err.Error(), "between 1 and 100") {
		t.Errorf("got %v, want the limit message", err)
	}
	if errors.Is(err, ErrAirportNotFound) {
		t.Error("a bad limit is not a missing airport")
	}
}

func TestGetAirportDetailsReportsAnUnknownCode(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]any{"errors": map[string]any{
			"errors": map[string]any{"parameters": map[string]any{
				"code": map[string]any{"notFound": "not found"},
			}},
		}})
	})

	_, err := newTestClient(t, mux).GetAirportDetails(context.Background(), "XXX", 100, 1)

	var notFound *AirportNotFoundError

	if !errors.As(err, &notFound) {
		t.Fatalf("got %v, want an AirportNotFoundError", err)
	}
	if len(notFound.Errors) == 0 {
		t.Error("the validation payload must be carried on the error")
	}
}

func TestGetAirportDetailsRejectsASparsePayload(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"result": map[string]any{"response": map[string]any{
			"airport": map[string]any{"pluginData": map[string]any{
				"schedule": map[string]any{}, "weather": map[string]any{},
			}},
		}}})
	})

	if _, err := newTestClient(t, mux).GetAirportDetails(context.Background(), "XXX", 100, 1); !errors.Is(err, ErrAirportNotFound) {
		t.Errorf("got %v, want an airport-not-found error", err)
	}
}

func TestGetZonesReturnsACopy(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())
	zones := client.GetZones()

	if len(zones) == 0 {
		t.Fatal("no zones returned")
	}

	europe := zones["europe"]

	if europe.TLY == 0 || len(europe.Subzones) == 0 {
		t.Errorf("got %+v, want the bundled europe zone", europe)
	}

	delete(zones, "europe")
	delete(zones["northamerica"].Subzones, "na_n")

	fresh := client.GetZones()

	if _, ok := fresh["europe"]; !ok {
		t.Error("mutating the result must not touch the bundled zones")
	}
	if _, ok := fresh["northamerica"].Subzones["na_n"]; !ok {
		t.Error("mutating a subzone map must not touch the bundled zones")
	}
}

func TestGetBoundsRendersTheZone(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())
	bounds := client.GetBounds(Zone{TLY: 72.57, TLX: -16.96, BRY: 33.57, BRX: 53.05})

	if bounds != "72.57,33.57,-16.96,53.05" {
		t.Errorf("got %q", bounds)
	}
}

func TestGetBoundsByPointSurroundsThePoint(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())
	bounds := client.GetBoundsByPoint(52.567774, 13.282827, 2000)
	parts := strings.Split(bounds, ",")

	if len(parts) != 4 {
		t.Fatalf("got %q, want four values", bounds)
	}

	var north, south, west, east float64

	if _, err := fmt.Sscanf(bounds, "%f,%f,%f,%f", &north, &south, &west, &east); err != nil {
		t.Fatal(err)
	}
	if !(south < 52.567774 && 52.567774 < north) || !(west < 13.282827 && 13.282827 < east) {
		t.Errorf("got %q, want a box around the point", bounds)
	}
	if north-south > 0.1 || east-west > 0.1 {
		t.Errorf("got %q, want a box of about 4 km across", bounds)
	}
}

// --- flights ---

func TestGetFlightsParsesTheFeed(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()

		if query.Get("airline") != "GLO" || query.Get("bounds") != "75,3,-180,-52" {
			t.Errorf("got query %v", query)
		}
		if query.Get("limit") != "5000" || query.Get("maxage") != "14400" {
			t.Errorf("the tracker config must be sent: %v", query)
		}
		writeJSON(t, w, healthyFeed)
	})

	flights, err := newTestClient(t, mux).GetFlights(context.Background(), FlightSearch{
		Airline: "GLO", Bounds: "75,3,-180,-52",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(flights) != 2 {
		t.Fatalf("got %d flights, want 2", len(flights))
	}
	for _, flight := range flights {
		if flight.Registration != "PR-XYZ" || flight.AirlineICAO != "GLO" {
			t.Errorf("got %+v", flight)
		}
	}
}

func TestGetFlightsFetchesDetailsConcurrently(t *testing.T) {
	var detailCalls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, healthyFeed)
	})
	mux.HandleFunc("/clickhandler/", func(w http.ResponseWriter, r *http.Request) {
		detailCalls.Add(1)
		writeJSON(t, w, map[string]any{
			"aircraft": map[string]any{"model": map[string]any{"text": "Boeing 737-800"}},
			"status":   map[string]any{"text": "Landed"},
			"trail":    []any{},
		})
	})

	flights, err := newTestClient(t, mux).GetFlights(context.Background(), FlightSearch{Details: true})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detailCalls.Load() != 2 {
		t.Errorf("got %d detail calls, want 2", detailCalls.Load())
	}
	for _, flight := range flights {
		if flight.Details == nil || flight.Details.AircraftModel != "Boeing 737-800" {
			t.Errorf("details missing on %s", flight.ID)
		}
	}
}

func TestGetFlightsRetriesADegradedFeed(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "AWSALB=sticky; Path=/")
		w.Header().Add("Set-Cookie", "_frPl=login-token; Path=/")

		if calls.Add(1) == 1 {
			writeJSON(t, w, degradedFeed)
			return
		}
		writeJSON(t, w, healthyFeed)
	})

	client := newTestClient(t, mux)
	flights, err := client.GetFlights(context.Background(), FlightSearch{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(flights) != 2 {
		t.Errorf("got %d flights, want 2", len(flights))
	}
	if calls.Load() != 2 {
		t.Errorf("got %d feed calls, want 2", calls.Load())
	}
	// Shedding the stickiness must not log the user out.
	if _, ok := client.client.getCookie("_frPl"); !ok {
		t.Error("the login cookie must survive the retry")
	}
}

func TestGetFlightsGivesUpOnAFeedThatNeverRecovers(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(t, w, degradedFeed)
	})

	flights, err := newTestClient(t, mux).GetFlights(context.Background(), FlightSearch{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(flights) != 0 {
		t.Errorf("got %d flights, want none", len(flights))
	}
	// A permanently degraded upstream must not loop forever.
	if calls.Load() <= 1 || calls.Load() > 6 {
		t.Errorf("got %d feed calls, want between 2 and 6", calls.Load())
	}
}

func TestGetFlightsDoesNotRetryWhenNothingIsTracked(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		writeJSON(t, w, idleFeed)
	})

	flights, err := newTestClient(t, mux).GetFlights(context.Background(), FlightSearch{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(flights) != 0 || calls.Load() != 1 {
		t.Errorf("got %d flights after %d calls, want none after one", len(flights), calls.Load())
	}
}

func TestGetFlightsKeepsFiltersAcrossRetries(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("airline") != "GLO" || r.URL.Query().Get("reg") != "PR-XYZ" {
			t.Errorf("call %d lost its filters: %v", calls.Load()+1, r.URL.Query())
		}
		if calls.Add(1) < 3 {
			writeJSON(t, w, degradedFeed)
			return
		}
		writeJSON(t, w, healthyFeed)
	})

	_, err := newTestClient(t, mux).GetFlights(context.Background(), FlightSearch{
		Airline: "GLO", Registration: "PR-XYZ",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls.Load() != 3 {
		t.Errorf("got %d feed calls, want 3", calls.Load())
	}
}

func TestFlightTrackerConfigRoundTrip(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())

	if err := client.SetFlightTrackerConfig(nil, map[string]string{"limit": "10", "maxage": "600"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	config := client.GetFlightTrackerConfig()

	if config.Limit != "10" || config.MaxAge != "600" || config.FAA != "1" {
		t.Errorf("got %+v", config)
	}

	// The getter must hand back a copy.
	config.Limit = "999"

	if client.GetFlightTrackerConfig().Limit != "10" {
		t.Error("mutating the returned config must not change the client's")
	}
}

func TestSetFlightTrackerConfigRejectsBadInput(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())

	if err := client.SetFlightTrackerConfig(nil, map[string]string{"unknown": "1"}); err == nil {
		t.Error("expected an error for an unknown option")
	}
	if err := client.SetFlightTrackerConfig(nil, map[string]string{"limit": "many"}); err == nil {
		t.Error("expected an error for a non-numeric value")
	}
	if client.GetFlightTrackerConfig().Limit != "5000" {
		t.Error("a rejected update must leave the config untouched")
	}
}

// --- assets ---

func TestGetAirlineLogoFallsBackToTheAlternativeURL(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/assets/airlines/logotypes/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	mux.HandleFunc("/static/images/data/operators/", func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "GLO_logo0.png") {
			t.Errorf("got path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "image/png")
		w.Write([]byte("PNG"))
	})

	logo, err := newTestClient(t, mux).GetAirlineLogo(context.Background(), "g3", "glo")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logo == nil || string(logo.Data) != "PNG" || logo.Extension != "png" {
		t.Errorf("got %+v", logo)
	}
}

func TestGetAirlineLogoReturnsNothingWhenBothURLsFail(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})

	logo, err := newTestClient(t, mux).GetAirlineLogo(context.Background(), "XX", "XXX")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if logo != nil {
		t.Errorf("got %+v, want nothing", logo)
	}
}

func TestGetCountryFlagSlugifiesTheCountry(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/static/images/data/flags-small/", func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/myanmar-burma.svg") {
			t.Errorf("got path %q", r.URL.Path)
		}
		if r.Header.Get("Origin") != "" {
			t.Error("the origin header does not work for this request")
		}
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Write([]byte("<svg/>"))
	})

	flag, err := newTestClient(t, mux).GetCountryFlag(context.Background(), "Myanmar (Burma)")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if flag == nil || flag.Extension != "svg" {
		t.Errorf("got %+v", flag)
	}
}

func TestGetCountryFlagReturnsNothingForAnUnslugifiableName(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
	})

	flag, err := newTestClient(t, mux).GetCountryFlag(context.Background(), "!!!")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if flag != nil || calls.Load() != 0 {
		t.Errorf("got %+v after %d calls", flag, calls.Load())
	}
}

func TestGetCountryFlagReturnsNothingWhenMissing(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/static/images/data/flags-small/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	flag, err := newTestClient(t, mux).GetCountryFlag(context.Background(), "Atlantis")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if flag != nil {
		t.Errorf("got %+v, want nothing", flag)
	}
}

// --- search and plain JSON endpoints ---

func TestSearchGroupsResultsInTheOrderFR24CountsThem(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/search/web/find", func(w http.ResponseWriter, r *http.Request) {
		if query := r.URL.Query().Get("query"); query != "Guarulhos" {
			t.Errorf("got query %q", query)
		}
		if limit := r.URL.Query().Get("limit"); limit != "7" {
			t.Errorf("got limit %q", limit)
		}
		w.Header().Set("Content-Type", "application/json")

		// Written as text: the key order of "count" is what lines the groups up.
		w.Write([]byte(`{"results":["a1","a2","s1","o1","o2","o3"],` +
			`"stats":{"count":{"airport":2,"schedule":1,"operator":3}}}`))
	})

	groups, err := newTestClient(t, mux).Search(context.Background(), "Guarulhos", 7)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups["airport"]) != 2 || groups["airport"][0] != "a1" {
		t.Errorf("got airports %v", groups["airport"])
	}
	if len(groups["schedule"]) != 1 || groups["schedule"][0] != "s1" {
		t.Errorf("got schedules %v", groups["schedule"])
	}
	if len(groups["operator"]) != 3 || groups["operator"][0] != "o1" {
		t.Errorf("got operators %v", groups["operator"])
	}
}

func TestSearchSurvivesCountsPastTheResultList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/search/web/find", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"results":["a1"],"stats":{"count":{"airport":5,"operator":2}}}`))
	})

	groups, err := newTestClient(t, mux).Search(context.Background(), "x", 50)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups["airport"]) != 1 || len(groups["operator"]) != 0 {
		t.Errorf("got %v", groups)
	}
}

func TestPlainJSONEndpoints(t *testing.T) {
	mux := http.NewServeMux()

	for _, path := range []string{
		"/webapi/v1/airport-disruptions", "/flights/most-tracked", "/weather/volcanic",
	} {
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			writeJSON(t, w, map[string]any{"path": r.URL.Path})
		})
	}

	client := newTestClient(t, mux)
	ctx := context.Background()

	calls := map[string]func() (map[string]any, error){
		"/webapi/v1/airport-disruptions": func() (map[string]any, error) { return client.GetAirportDisruptions(ctx) },
		"/flights/most-tracked":          func() (map[string]any, error) { return client.GetMostTracked(ctx) },
		"/weather/volcanic":              func() (map[string]any, error) { return client.GetVolcanicEruptions(ctx) },
	}

	for path, call := range calls {
		content, err := call()

		if err != nil {
			t.Fatalf("%s: unexpected error: %v", path, err)
		}
		if content["path"] != path {
			t.Errorf("got %v, want %s", content, path)
		}
	}
}

// --- account ---

func TestLoginStoresTheAccountData(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("got %s, want POST", r.Method)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.PostForm.Get("email") != "user@example.com" || r.PostForm.Get("type") != "web" {
			t.Errorf("got form %v", r.PostForm)
		}
		w.Header().Add("Set-Cookie", "_frPl=session-token; Path=/")
		writeJSON(t, w, map[string]any{
			"success":  true,
			"userData": map[string]any{"accessToken": "token", "subscriptionKey": "key"},
		})
	})

	client := newTestClient(t, mux)

	if client.IsLoggedIn() {
		t.Error("a fresh client is not logged in")
	}
	if err := client.Login(context.Background(), "user@example.com", "secret"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !client.IsLoggedIn() {
		t.Error("the client must be logged in")
	}

	userData, err := client.GetLoginData()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if userData["accessToken"] != "token" {
		t.Errorf("got %v", userData)
	}

	// The getter must hand back a copy.
	userData["accessToken"] = "changed"
	again, _ := client.GetLoginData()

	if again["accessToken"] != "token" {
		t.Error("mutating the returned data must not change the client's")
	}
}

func TestLoginReportsAFailure(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user/login", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"success": false, "message": "Your email or password is incorrect"})
	})

	client := newTestClient(t, mux)
	err := client.Login(context.Background(), "user@example.com", "wrong")

	if !errors.Is(err, ErrLogin) {
		t.Fatalf("got %v, want a login error", err)
	}
	if !strings.Contains(err.Error(), "incorrect") {
		t.Errorf("got %q, want the server's message", err)
	}
	if client.IsLoggedIn() {
		t.Error("a failed login must not leave a session behind")
	}
}

func TestEndpointsThatNeedAnAccountRefuseWithoutOne(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())
	ctx := context.Background()

	if _, err := client.GetBookmarks(ctx); !errors.Is(err, ErrLogin) {
		t.Errorf("GetBookmarks: got %v, want a login error", err)
	}
	if _, err := client.GetHistoryData(ctx, &Flight{ID: "x"}, "CSV", 0); !errors.Is(err, ErrLogin) {
		t.Errorf("GetHistoryData: got %v, want a login error", err)
	}
	if _, err := client.GetLoginData(); !errors.Is(err, ErrLogin) {
		t.Errorf("GetLoginData: got %v, want a login error", err)
	}
}

func TestLoggedInEndpointsSendTheAccessToken(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "_frPl=session-token; Path=/")
		writeJSON(t, w, map[string]any{
			"success": true, "userData": map[string]any{"accessToken": "token"},
		})
	})
	mux.HandleFunc("/webapi/v1/bookmarks", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("accesstoken") != "token" {
			t.Errorf("got access token %q", r.Header.Get("accesstoken"))
		}
		writeJSON(t, w, map[string]any{"bookmarks": map[string]any{}})
	})
	mux.HandleFunc("/download/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("file") != "csv" || r.URL.Query().Get("flight") != "2e0f1a2" {
			t.Errorf("got query %v", r.URL.Query())
		}
		w.Write([]byte("Timestamp,UTC,Callsign\n"))
	})
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("token") != "session-token" {
			t.Errorf("got token %q, want the session cookie", r.URL.Query().Get("token"))
		}
		writeJSON(t, w, map[string]any{"result": map[string]any{"response": map[string]any{
			"airport": map[string]any{"pluginData": map[string]any{"details": map[string]any{"name": "x"}}},
		}}})
	})

	client := newTestClient(t, mux)
	ctx := context.Background()

	if err := client.Login(ctx, "user@example.com", "secret"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := client.GetBookmarks(ctx); err != nil {
		t.Errorf("GetBookmarks: %v", err)
	}

	history, err := client.GetHistoryData(ctx, &Flight{ID: "2e0f1a2"}, "CSV", 1700000000)

	if err != nil {
		t.Errorf("GetHistoryData: %v", err)
	}
	if !strings.HasPrefix(history, "Timestamp") {
		t.Errorf("got %q", history)
	}
	if _, err := client.GetAirportDetails(ctx, "ATL", 10, 1); err != nil {
		t.Errorf("GetAirportDetails: %v", err)
	}
}

func TestGetHistoryDataRejectsAnUnsupportedFileType(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user/login", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"success": true, "userData": map[string]any{"accessToken": "t"}})
	})

	client := newTestClient(t, mux)

	if err := client.Login(context.Background(), "u", "p"); err != nil {
		t.Fatal(err)
	}

	_, err := client.GetHistoryData(context.Background(), &Flight{ID: "x"}, "PDF", 0)

	if err == nil || !strings.Contains(err.Error(), "PDF") && !strings.Contains(err.Error(), "pdf") {
		t.Errorf("got %v, want an unsupported file type error", err)
	}
}

func TestLogoutClearsTheSession(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "_frPl=session-token; Path=/")
		writeJSON(t, w, map[string]any{"success": true, "userData": map[string]any{"accessToken": "t"}})
	})
	mux.HandleFunc("/user/logout", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"success": true})
	})

	client := newTestClient(t, mux)
	ctx := context.Background()

	if err := client.Login(ctx, "u", "p"); err != nil {
		t.Fatal(err)
	}

	loggedOut, err := client.Logout(ctx)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !loggedOut || client.IsLoggedIn() {
		t.Error("the session must be gone")
	}
	if _, ok := client.client.getCookie("_frPl"); ok {
		t.Error("the session cookie must be cleared")
	}
}

func TestLogoutWithoutASessionIsANoOp(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/user/logout", func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
	})

	loggedOut, err := newTestClient(t, mux).Logout(context.Background())

	if err != nil || !loggedOut || calls.Load() != 0 {
		t.Errorf("got %v / %v after %d calls", loggedOut, err, calls.Load())
	}
}

func TestUnusableOptionsFallBackToTheDefault(t *testing.T) {
	// Construction cannot fail, so a nonsensical value must land somewhere sane
	// rather than being carried into the first request.
	cases := map[string]Options{
		"zero":     {},
		"negative": {Timeout: -time.Second, MaxWorkers: -4},
	}

	for name, options := range cases {
		client := New(options)

		if client.Timeout != DefaultTimeout {
			t.Errorf("%s: got timeout %v, want %v", name, client.Timeout, DefaultTimeout)
		}
		if client.MaxWorkers != defaultMaxWorkers {
			t.Errorf("%s: got %d workers, want %d", name, client.MaxWorkers, defaultMaxWorkers)
		}
	}
}

func TestOptionsAreOptional(t *testing.T) {
	// New() with no arguments reads like the Python and Node.js constructors.
	client := New()

	if client == nil || client.Timeout != DefaultTimeout {
		t.Fatalf("got %+v", client)
	}
	if got := client.GetFlightTrackerConfig(); got.Limit != "5000" {
		t.Errorf("got %+v, want the default tracker config", got)
	}
}

func TestGetAirportWithDetailsUsesTheDetailsEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/airports/traffic-stats/", func(w http.ResponseWriter, r *http.Request) {
		t.Error("the basic endpoint must not be called when details are asked for")
	})
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"result": map[string]any{"response": map[string]any{
			"airport": map[string]any{"pluginData": map[string]any{
				"details": map[string]any{
					"name": "Lukla",
					"code": map[string]any{"iata": "LUA", "icao": "VNLK"},
					"position": map[string]any{
						"latitude": 27.687, "longitude": 86.729, "elevation": 9334.0,
						"country": map[string]any{"name": "Nepal"},
					},
					"timezone": map[string]any{"offset": 20700.0},
				},
				"runways": []any{map[string]any{"name": "06/24"}},
			}},
		}}})
	})

	airport, err := newTestClient(t, mux).GetAirport(context.Background(), "VNLK", true)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if airport.Name != "Lukla" || airport.ICAO != "VNLK" || airport.Country != "Nepal" {
		t.Errorf("got %+v", airport)
	}
	if airport.Altitude == nil || *airport.Altitude != 9334 {
		t.Errorf("got altitude %v", airport.Altitude)
	}
	if len(airport.Runways) != 1 {
		t.Errorf("got runways %v", airport.Runways)
	}
	if airport.TimezoneOffsetHours != "5:00" {
		t.Errorf("got offset hours %q, want 5:00", airport.TimezoneOffsetHours)
	}
}

func TestWithHTTPClientIsUsedForRequests(t *testing.T) {
	var seen atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen.Add(1)
		writeJSON(t, w, map[string]any{"ok": true})
	}))
	t.Cleanup(server.Close)

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DisableCompression = true

	endpoints := testEndpoints(server.URL)
	client := New(Options{HTTPClient: &http.Client{Transport: transport}, endpoints: &endpoints})

	if _, err := client.GetMostTracked(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if seen.Load() != 1 {
		t.Errorf("got %d requests through the given client, want 1", seen.Load())
	}
}

func TestSearchRefusesANonJSONResponse(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/search/web/find", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte("<html>Attention Required</html>"))
	})

	_, err := newTestClient(t, mux).Search(context.Background(), "x", 50)

	if err == nil || !strings.Contains(err.Error(), "expected JSON") {
		t.Errorf("got %v, want the content-type error every other endpoint gives", err)
	}
}

func TestSearchDropsAByteOrderMark(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/search/web/find", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("\xef\xbb\xbf" + `{"results":["a1"],"stats":{"count":{"airport":1}}}`))
	})

	groups, err := newTestClient(t, mux).Search(context.Background(), "x", 50)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups["airport"]) != 1 {
		t.Errorf("got %v", groups)
	}
}

func TestGetFlightsStillFetchesDetailsWithoutWorkers(t *testing.T) {
	// MaxWorkers is public: a zero there must not turn details into a no-op.
	var detailCalls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, healthyFeed)
	})
	mux.HandleFunc("/clickhandler/", func(w http.ResponseWriter, r *http.Request) {
		detailCalls.Add(1)
		writeJSON(t, w, map[string]any{"status": map[string]any{"text": "Landed"}})
	})

	client := newTestClient(t, mux)
	client.MaxWorkers = 0

	flights, err := client.GetFlights(context.Background(), FlightSearch{Details: true})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if detailCalls.Load() != 2 {
		t.Errorf("got %d detail calls, want 2", detailCalls.Load())
	}
	for _, flight := range flights {
		if flight.Details == nil {
			t.Errorf("details missing on %s", flight.ID)
		}
	}
}

func TestGetFlightsReportsAFailedDetailRequest(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, healthyFeed)
	})
	mux.HandleFunc("/clickhandler/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	flights, err := newTestClient(t, mux).GetFlights(context.Background(), FlightSearch{Details: true})

	if err == nil {
		t.Error("expected the detail failure to be reported")
	}
	if len(flights) != 2 {
		t.Errorf("got %d flights, want the feed's flights returned anyway", len(flights))
	}
}

func TestLogoutReportsAServerFailure(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user/login", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"success": true, "userData": map[string]any{"accessToken": "t"}})
	})
	mux.HandleFunc("/user/logout", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	client := newTestClient(t, mux)

	if err := client.Login(context.Background(), "u", "p"); err != nil {
		t.Fatal(err)
	}

	loggedOut, err := client.Logout(context.Background())

	if err == nil {
		t.Error("a failed logout must be reported, not swallowed")
	}
	if loggedOut {
		t.Error("the server never confirmed the logout")
	}
	// The local session is gone either way.
	if client.IsLoggedIn() {
		t.Error("the local session must be cleared")
	}
}

func TestGetFlightsDoesNotRetryAHealthyFirstResponse(t *testing.T) {
	var calls atomic.Int32
	mux := http.NewServeMux()
	mux.HandleFunc("/zones/fcgi/feed.js", func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Add("Set-Cookie", "AWSALB=sticky; Path=/")
		writeJSON(t, w, healthyFeed)
	})

	client := newTestClient(t, mux)
	flights, err := client.GetFlights(context.Background(), FlightSearch{})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(flights) != 2 || calls.Load() != 1 {
		t.Errorf("got %d flights after %d calls, want 2 after one", len(flights), calls.Load())
	}
	// Nothing was degraded, so the stickiness must not have been shed.
	if _, ok := client.client.getCookie("AWSALB"); !ok {
		t.Error("the sticky cookie must survive a healthy response")
	}
}

func TestGetBoundsByPointAgreesWithThePythonPort(t *testing.T) {
	// The values the Python suite pins for the same call. Compared with a
	// tolerance rather than as a string: every intermediate matches bit for bit,
	// but Go's math.Asin and the platform libm differ in the last place, which
	// is ~1e-14 degrees — a nanometre on the ground.
	const tolerance = 1e-9
	expected := []float64{52.58594974202871, 52.54997688140807, 13.253064418048115, 13.3122478541492}

	bounds := newTestClient(t, http.NewServeMux()).GetBoundsByPoint(52.567967, 13.282644, 2000)
	parts := strings.Split(bounds, ",")

	if len(parts) != len(expected) {
		t.Fatalf("got %q, want four values", bounds)
	}

	for index, part := range parts {
		got, err := strconv.ParseFloat(part, 64)

		if err != nil {
			t.Fatalf("could not read %q: %v", part, err)
		}
		if math.Abs(got-expected[index]) > tolerance {
			t.Errorf("value %d: got %v, want %v (within %v)", index, got, expected[index], tolerance)
		}
	}
}

func TestGetBoundsMatchesThePythonPort(t *testing.T) {
	client := newTestClient(t, http.NewServeMux())
	zone := Zone{TLY: 75.78, BRY: -75.78, TLX: -427.56, BRX: 427.56}

	if got := client.GetBounds(zone); got != "75.78,-75.78,-427.56,427.56" {
		t.Errorf("got %q", got)
	}
}

func TestZeroMeansTheDefaultTheOtherPortsDeclare(t *testing.T) {
	var query url.Values
	mux := http.NewServeMux()
	mux.HandleFunc("/common/v1/airport.json", func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query()
		writeJSON(t, w, map[string]any{"result": map[string]any{"response": map[string]any{
			"airport": map[string]any{"pluginData": map[string]any{"details": map[string]any{"name": "x"}}},
		}}})
	})
	mux.HandleFunc("/v1/search/web/find", func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"results":[],"stats":{"count":{}}}`))
	})

	client := newTestClient(t, mux)

	if _, err := client.GetAirportDetails(context.Background(), "ATL", 0, 0); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if query.Get("limit") != "100" || query.Get("page") != "1" {
		t.Errorf("got limit=%q page=%q, want the Python defaults", query.Get("limit"), query.Get("page"))
	}

	if _, err := client.Search(context.Background(), "Guarulhos", 0); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if query.Get("limit") != "50" {
		t.Errorf("got limit=%q, want the Python default of 50", query.Get("limit"))
	}
}

func TestEntityConstructorsMatchTheOtherPorts(t *testing.T) {
	// Airport.from_basic_info / from_info / from_details and Flight(id, info).
	basic := NewAirportFromBasicInfo(map[string]any{
		"name": "Guarulhos", "iata": "GRU", "icao": "SBGR",
		"lat": -23.43, "lon": -46.47, "alt": "2436", "country": "Brazil",
	})

	if basic.IATA != "GRU" || basic.Altitude == nil || *basic.Altitude != 2436 {
		t.Errorf("from basic info: got %+v", basic)
	}

	// One unusable coordinate drops both, as the feed parser does.
	half := NewAirportFromBasicInfo(map[string]any{"lat": "n/a", "lon": -46.47})

	if half.Latitude != nil || half.Longitude != nil {
		t.Errorf("got position (%v, %v), want none", half.Latitude, half.Longitude)
	}

	info := NewAirportFromInfo(map[string]any{
		"name": "Atlanta", "code": map[string]any{"iata": "ATL", "icao": "KATL"},
	})

	if info.IATA != "ATL" || info.ICAO != "KATL" {
		t.Errorf("from info: got %+v", info)
	}

	fromDetails := NewAirportFromDetails(map[string]any{
		"airport": map[string]any{"pluginData": map[string]any{
			"details": map[string]any{"name": "Lukla", "code": map[string]any{"icao": "VNLK"}},
		}},
	})

	if fromDetails.Name != "Lukla" || fromDetails.ICAO != "VNLK" {
		t.Errorf("from details: got %+v", fromDetails)
	}

	flight := NewFlight("2e0f1a2", flightRow)

	if flight.ID != "2e0f1a2" || flight.Registration != "PR-XYZ" {
		t.Errorf("from feed row: got %+v", flight)
	}
}

func TestCallerSuppliedValuesAreEscapedIntoTheURL(t *testing.T) {
	// A code or flight ID carrying "&" would otherwise cut the query short and
	// FR24 would answer about something else entirely.
	var query url.Values
	mux := http.NewServeMux()
	mux.HandleFunc("/airports/traffic-stats/", func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query()
		writeJSON(t, w, map[string]any{"details": map[string]any{"name": "x"}})
	})
	mux.HandleFunc("/clickhandler/", func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query()
		writeJSON(t, w, map[string]any{})
	})

	client := newTestClient(t, mux)

	if _, err := client.GetAirport(context.Background(), "A&B", false); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := query.Get("airport"); got != "A&B" {
		t.Errorf("got airport=%q, want the code to survive whole", got)
	}

	if _, err := client.GetFlightDetails(context.Background(), &Flight{ID: "2e0&evil=1"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := query.Get("flight"); got != "2e0&evil=1" {
		t.Errorf("got flight=%q, want the id to survive whole", got)
	}
	if query.Get("evil") != "" {
		t.Error("a crafted id must not inject a query parameter")
	}
}

func TestAJarOnTheGivenClientIsIgnored(t *testing.T) {
	// Two jars would append two copies of every cookie to the same header.
	var received []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = r.Header.Values("Cookie")
		w.Header().Add("Set-Cookie", "_frPl=token; Path=/")
		writeJSON(t, w, map[string]any{"ok": true})
	}))
	t.Cleanup(server.Close)

	jar, err := cookiejar.New(nil)

	if err != nil {
		t.Fatal(err)
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DisableCompression = true

	endpoints := testEndpoints(server.URL)
	client := New(Options{
		HTTPClient: &http.Client{Transport: transport, Jar: jar},
		endpoints:  &endpoints,
	})

	ctx := context.Background()

	for range 2 {
		if _, err := client.GetMostTracked(ctx); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}

	if len(received) > 1 || strings.Count(strings.Join(received, "; "), "_frPl=") > 1 {
		t.Errorf("got %v, want the cookie sent exactly once", received)
	}
}
