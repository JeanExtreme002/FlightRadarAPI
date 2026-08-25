package flightradarapi

import (
	"math"
	"testing"
)

func TestGetDistanceFromMeasuresBetweenEntities(t *testing.T) {
	gru := newAirportFromBasicInfo(basicAirportInfo{
		Name: "Guarulhos", IATA: "GRU", ICAO: "SBGR",
		Latitude: float64Ptr(-23.429991), Longitude: float64Ptr(-46.4674),
	})
	gig := newAirportFromBasicInfo(basicAirportInfo{
		Name: "Galeao", IATA: "GIG", ICAO: "SBGL",
		Latitude: float64Ptr(-22.805696), Longitude: float64Ptr(-43.25523),
	})

	distance, err := gru.GetDistanceFrom(gig)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Roughly 340 km between the two airports.
	if math.Abs(distance-340) > 10 {
		t.Errorf("got %.1f km, want about 340 km", distance)
	}
}

func TestGetDistanceFromIsZeroForTheSamePoint(t *testing.T) {
	airport := newAirportFromBasicInfo(basicAirportInfo{
		Latitude: float64Ptr(10), Longitude: float64Ptr(20),
	})
	distance, err := airport.GetDistanceFrom(airport)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if distance != 0 {
		t.Errorf("got %v km, want 0", distance)
	}
}

func TestGetDistanceFromRefusesAnEntityWithNoPosition(t *testing.T) {
	positioned := newAirportFromBasicInfo(basicAirportInfo{
		Latitude: float64Ptr(10), Longitude: float64Ptr(20),
	})
	unpositioned := newAirportFromBasicInfo(basicAirportInfo{})

	if _, err := positioned.GetDistanceFrom(unpositioned); err == nil {
		t.Error("expected an error for an entity with no position")
	}
	if _, err := unpositioned.GetDistanceFrom(positioned); err == nil {
		t.Error("expected an error for an entity with no position")
	}
}

func TestAirportStringShowsCodeNameAndPosition(t *testing.T) {
	airport := newAirportFromBasicInfo(basicAirportInfo{
		Name: "Guarulhos", ICAO: "SBGR", Altitude: float64Ptr(2436),
		Latitude: float64Ptr(-23.43), Longitude: float64Ptr(-46.47),
	})
	want := "<(SBGR) Guarulhos - Altitude: 2436 - Latitude: -23.43 - Longitude: -46.47>"

	if got := airport.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestNewAirportFromInfoReadsTheDetailsBlock(t *testing.T) {
	airport := newAirportFromInfo(map[string]any{
		"name": "Hartsfield Jackson Atlanta International Airport",
		"code": map[string]any{"iata": "ATL", "icao": "KATL"},
		"position": map[string]any{
			"latitude": 33.6367, "longitude": -84.428101, "altitude": 1026.0,
			"country": map[string]any{"name": "United States", "code": "US"},
			"region":  map[string]any{"city": "Atlanta"},
		},
		"timezone": map[string]any{
			"name": "America/New_York", "offset": -14400.0, "offsetHours": "-4:00",
			"abbr": "EDT", "abbrName": "Eastern Daylight Time",
		},
		"visible": true,
		"website": "http://www.atlanta-airport.com",
	})

	if airport.Name == "" || airport.IATA != "ATL" || airport.ICAO != "KATL" {
		t.Errorf("got %q / %q / %q", airport.Name, airport.IATA, airport.ICAO)
	}
	if airport.Latitude == nil || *airport.Latitude != 33.6367 {
		t.Errorf("got latitude %v", airport.Latitude)
	}
	if airport.Country != "United States" || airport.CountryCode != "US" || airport.City != "Atlanta" {
		t.Errorf("got %q / %q / %q", airport.Country, airport.CountryCode, airport.City)
	}
	if airport.TimezoneName != "America/New_York" || airport.TimezoneAbbr != "EDT" {
		t.Errorf("got %q / %q", airport.TimezoneName, airport.TimezoneAbbr)
	}
	if airport.Visible == nil || !*airport.Visible {
		t.Errorf("got visible %v", airport.Visible)
	}
}

func TestSetAirportDetailsFillsTheAirportIn(t *testing.T) {
	airport := NewAirport()
	airport.SetAirportDetails(map[string]any{
		"airport": map[string]any{"pluginData": map[string]any{
			"details": map[string]any{
				"name": "Guarulhos",
				"code": map[string]any{"iata": "GRU", "icao": "SBGR"},
				"position": map[string]any{
					"latitude": -23.43, "longitude": -46.47, "elevation": 2436.0,
					"country": map[string]any{"name": "Brazil", "code": "BR", "id": 30.0},
					"region":  map[string]any{"city": "Sao Paulo"},
				},
				"timezone": map[string]any{"offset": -10800.0, "name": "America/Sao_Paulo"},
				"url":      map[string]any{"homepage": "https://gru.com.br", "wikipedia": "https://wiki"},
				"visible":  true,
			},
			"flightdiary": map[string]any{
				"url": "/airports/reviews/gru", "reviews": 12.0, "evaluation": 80.0,
				"ratings": map[string]any{"avg": 4.5, "total": 30.0},
			},
			"schedule":      map[string]any{"arrivals": map[string]any{"total": 10.0}},
			"aircraftCount": map[string]any{"onGround": map[string]any{"total": 40.0, "visible": 35.0}},
			"runways":       []any{map[string]any{"name": "09R/27L"}},
			"weather":       map[string]any{"temp": map[string]any{"celsius": 21.0}},
		}},
	})

	if airport.Name != "Guarulhos" || airport.IATA != "GRU" || airport.ICAO != "SBGR" {
		t.Errorf("got %q / %q / %q", airport.Name, airport.IATA, airport.ICAO)
	}
	if airport.Altitude == nil || *airport.Altitude != 2436 {
		t.Errorf("got altitude %v", airport.Altitude)
	}
	if airport.TimezoneOffsetHours != "-3:00" {
		t.Errorf("got offset hours %q, want -3:00", airport.TimezoneOffsetHours)
	}
	if airport.ReviewsURL != "https://www.flightradar24.com/airports/reviews/gru" {
		t.Errorf("got reviews URL %q", airport.ReviewsURL)
	}
	if airport.AverageRating == nil || *airport.AverageRating != 4.5 {
		t.Errorf("got average rating %v", airport.AverageRating)
	}
	if airport.AircraftOnGround == nil || *airport.AircraftOnGround != 40 {
		t.Errorf("got aircraft on ground %v", airport.AircraftOnGround)
	}
	if len(airport.Runways) != 1 || len(airport.Arrivals) != 1 || len(airport.Weather) != 1 {
		t.Errorf("got runways %v arrivals %v weather %v",
			airport.Runways, airport.Arrivals, airport.Weather)
	}
	if airport.Wikipedia != "https://wiki" || airport.Website != "https://gru.com.br" {
		t.Errorf("got %q / %q", airport.Wikipedia, airport.Website)
	}
}

func TestSetAirportDetailsSurvivesAnEmptyPayload(t *testing.T) {
	airport := NewAirport()
	airport.SetAirportDetails(map[string]any{})

	if airport.Name != "" || airport.Latitude != nil || airport.TimezoneOffsetHours != "" {
		t.Errorf("got %q / %v / %q", airport.Name, airport.Latitude, airport.TimezoneOffsetHours)
	}
}

// feedRow is a live-feed flight entry, in the order the feed sends its fields.
func feedRow() []any {
	return []any{
		"2D6E1C7", 43.1234, -8.4567, 270.0, 36000.0, 480.0, "1234", nil,
		"B738", "PR-GUP", 1.7e9, "GRU", "GIG", "G31234", 0.0, -64.0, "GLO1234", nil, "GLO",
	}
}

func TestNewFlightReadsTheFeedRow(t *testing.T) {
	flight := newFlight("2e0f1a2", feedRow())

	if flight.ID != "2e0f1a2" || flight.ICAO24Bit != "2D6E1C7" {
		t.Errorf("got %q / %q", flight.ID, flight.ICAO24Bit)
	}
	if flight.Latitude == nil || *flight.Latitude != 43.1234 {
		t.Errorf("got latitude %v", flight.Latitude)
	}
	if flight.AircraftCode != "B738" || flight.Registration != "PR-GUP" {
		t.Errorf("got %q / %q", flight.AircraftCode, flight.Registration)
	}
	if flight.Number != "G31234" || flight.AirlineIATA != "G3" || flight.AirlineICAO != "GLO" {
		t.Errorf("got %q / %q / %q", flight.Number, flight.AirlineIATA, flight.AirlineICAO)
	}
	if flight.Time == nil || *flight.Time != 1700000000 {
		t.Errorf("got time %v", flight.Time)
	}
	if flight.Callsign != "GLO1234" || flight.Squawk != "1234" {
		t.Errorf("got %q / %q", flight.Callsign, flight.Squawk)
	}
}

func TestNewFlightSurvivesAShortRow(t *testing.T) {
	flight := newFlight("abc", []any{"2D6E1C7", 10.0})

	if flight.Latitude == nil || *flight.Latitude != 10 {
		t.Errorf("got latitude %v", flight.Latitude)
	}
	if flight.Longitude != nil || flight.Altitude != nil || flight.Number != "" {
		t.Errorf("got %v / %v / %q", flight.Longitude, flight.Altitude, flight.Number)
	}
}

func TestFlightFormatters(t *testing.T) {
	flight := newFlight("x", feedRow())

	cases := map[string]struct{ got, want string }{
		"altitude":       {flight.GetAltitude(), "36000 ft"},
		"flight level":   {flight.GetFlightLevel(), "360 FL"},
		"ground speed":   {flight.GetGroundSpeed(), "480 kts"},
		"heading":        {flight.GetHeading(), "270°"},
		"vertical speed": {flight.GetVerticalSpeed(), "-64 fpm"},
	}

	for name, testCase := range cases {
		if testCase.got != testCase.want {
			t.Errorf("%s: got %q, want %q", name, testCase.got, testCase.want)
		}
	}
}

func TestFlightFormattersFallBackToTheDefaultText(t *testing.T) {
	flight := newFlight("x", []any{"2D6E1C7"})

	for name, got := range map[string]string{
		"altitude":       flight.GetAltitude(),
		"flight level":   flight.GetFlightLevel(),
		"ground speed":   flight.GetGroundSpeed(),
		"heading":        flight.GetHeading(),
		"vertical speed": flight.GetVerticalSpeed(),
	} {
		if got != DefaultText {
			t.Errorf("%s: got %q, want %q", name, got, DefaultText)
		}
	}
}

func TestFlightLevelBelowTenThousandFeetIsTheAltitude(t *testing.T) {
	row := feedRow()
	row[fieldAltitude] = 9000.0

	if got := newFlight("x", row).GetFlightLevel(); got != "9000 ft" {
		t.Errorf("got %q, want 9000 ft", got)
	}
}

func TestGroundSpeedIsSingularAtOneKnot(t *testing.T) {
	row := feedRow()
	row[fieldGroundSpeed] = 1.0

	if got := newFlight("x", row).GetGroundSpeed(); got != "1 kt" {
		t.Errorf("got %q, want 1 kt", got)
	}
}

func TestCheckInfoComparesEqualityAndBounds(t *testing.T) {
	flight := newFlight("x", feedRow())

	cases := []struct {
		name     string
		criteria map[string]any
		expected bool
	}{
		{"equal string", map[string]any{"airline_icao": "GLO"}, true},
		{"different string", map[string]any{"airline_icao": "THY"}, false},
		{"equal number", map[string]any{"altitude": 36000}, true},
		{"min met", map[string]any{"min_altitude": 6700}, true},
		{"min not met", map[string]any{"min_altitude": 40000}, false},
		{"max met", map[string]any{"max_altitude": 40000}, true},
		{"max not met", map[string]any{"max_altitude": 10000}, false},
		{"range met", map[string]any{"min_altitude": 6700, "max_altitude": 40000}, true},
		{"several criteria", map[string]any{"min_altitude": 6700, "airline_icao": "GLO"}, true},
		{"one criterion fails", map[string]any{"min_altitude": 6700, "airline_icao": "THY"}, false},
		{"bound at the value", map[string]any{"min_altitude": 36000, "max_altitude": 36000}, true},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			matched, err := flight.CheckInfo(testCase.criteria)

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if matched != testCase.expected {
				t.Errorf("got %v, want %v", matched, testCase.expected)
			}
		})
	}
}

func TestCheckInfoRejectsAnUnknownField(t *testing.T) {
	flight := newFlight("x", feedRow())

	if _, err := flight.CheckInfo(map[string]any{"min_speed": 100}); err == nil {
		t.Error("expected an error for an unknown field")
	}
}

func TestCheckInfoDoesNotMatchAMissingValue(t *testing.T) {
	flight := newFlight("x", []any{"2D6E1C7"})
	matched, err := flight.CheckInfo(map[string]any{"min_altitude": 100})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if matched {
		t.Error("a flight with no altitude must not match min_altitude")
	}
}

func TestSetFlightDetailsFillsDetailsIn(t *testing.T) {
	flight := newFlight("x", feedRow())
	flight.SetFlightDetails(map[string]any{
		"aircraft": map[string]any{
			"age": "10 years", "countryId": 30.0,
			"model":  map[string]any{"text": "Boeing 737-800"},
			"images": map[string]any{"thumbnails": []any{}},
		},
		"airline": map[string]any{"name": "Gol Linhas Aereas", "short": "Gol"},
		"airport": map[string]any{
			"origin": map[string]any{
				"name": "Guarulhos", "website": "https://gru.com.br", "visible": true,
				"code": map[string]any{"icao": "SBGR"},
				"info": map[string]any{"gate": "12", "terminal": "2", "baggage": "5"},
				"position": map[string]any{"latitude": -23.43, "longitude": -46.47, "altitude": 2436.0,
					"country": map[string]any{"name": "Brazil", "code": "BR"}},
				"timezone": map[string]any{"abbr": "BRT", "name": "America/Sao_Paulo", "offset": -10800.0},
			},
			"destination": map[string]any{
				"name": "Galeao",
				"code": map[string]any{"icao": "SBGL"},
				"info": map[string]any{"gate": nil, "terminal": "N/A"},
			},
		},
		"flightHistory": map[string]any{"aircraft": []any{map[string]any{"flight": "G31233"}}},
		"status":        map[string]any{"icon": "green", "text": "Estimated 12:00"},
		"time":          map[string]any{"scheduled": map[string]any{"departure": 1.7e9}},
		"trail":         []any{map[string]any{"lat": -23.4, "lng": -46.4}},
	})

	details := flight.Details

	if details == nil {
		t.Fatal("details were not set")
	}
	if details.AircraftModel != "Boeing 737-800" || details.AircraftAge != "10 years" {
		t.Errorf("got %q / %q", details.AircraftModel, details.AircraftAge)
	}
	if details.AirlineName != "Gol Linhas Aereas" || details.AirlineShortName != "Gol" {
		t.Errorf("got %q / %q", details.AirlineName, details.AirlineShortName)
	}
	if details.OriginAirportICAO != "SBGR" || details.OriginAirportGate != "12" {
		t.Errorf("got %q / %q", details.OriginAirportICAO, details.OriginAirportGate)
	}
	if details.OriginAirportCountryName != "Brazil" || details.OriginAirportTimezoneAbbr != "BRT" {
		t.Errorf("got %q / %q", details.OriginAirportCountryName, details.OriginAirportTimezoneAbbr)
	}
	if details.DestinationAirportICAO != "SBGL" || details.DestinationAirportName != "Galeao" {
		t.Errorf("got %q / %q", details.DestinationAirportICAO, details.DestinationAirportName)
	}

	// Both a null and the literal "N/A" mean the feed sent nothing.
	if details.DestinationAirportGate != "" || details.DestinationAirportTerminal != "" {
		t.Errorf("got %q / %q, want empty strings",
			details.DestinationAirportGate, details.DestinationAirportTerminal)
	}
	if details.StatusText != "Estimated 12:00" || details.StatusIcon != "green" {
		t.Errorf("got %q / %q", details.StatusText, details.StatusIcon)
	}
	if len(details.Trail) != 1 || len(details.AircraftHistory) != 1 || len(details.TimeDetails) != 1 {
		t.Errorf("got trail %v history %v time %v",
			details.Trail, details.AircraftHistory, details.TimeDetails)
	}
	if details.OriginAirportVisible == nil || !*details.OriginAirportVisible {
		t.Errorf("got visible %v", details.OriginAirportVisible)
	}
}

func TestFlightStringShowsTheKeyValues(t *testing.T) {
	flight := newFlight("x", feedRow())
	want := "<(B738) PR-GUP - Altitude: 36000 - Ground Speed: 480 - Heading: 270>"

	if got := flight.String(); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestGetDistanceFromRefusesATypedNilEntity(t *testing.T) {
	// A nil *Flight in a non-nil interface used to panic here.
	airport := newAirportFromBasicInfo(basicAirportInfo{
		Latitude: float64Ptr(1), Longitude: float64Ptr(2),
	})

	for name, other := range map[string]Positioned{
		"nil interface": nil,
		"nil flight":    (*Flight)(nil),
		"nil airport":   (*Airport)(nil),
	} {
		if _, err := airport.GetDistanceFrom(other); err == nil {
			t.Errorf("%s: expected an error, got none", name)
		}
	}
}

func TestCheckInfoReachesTheDetailFields(t *testing.T) {
	// The Python and Node.js ports match against the flight's own attributes,
	// which include everything set_flight_details wrote.
	flight := newFlight("x", feedRow())
	flight.SetFlightDetails(map[string]any{
		"airline": map[string]any{"name": "Gol Linhas Aereas"},
		"airport": map[string]any{
			"origin": map[string]any{
				"name":     "Guarulhos",
				"position": map[string]any{"altitude": 2436.0},
			},
		},
		"status": map[string]any{"text": "Landed"},
	})

	cases := []struct {
		name     string
		criteria map[string]any
		expected bool
	}{
		{"detail string match", map[string]any{"airline_name": "Gol Linhas Aereas"}, true},
		{"detail string mismatch", map[string]any{"airline_name": "Turkish Airlines"}, false},
		{"detail number bound", map[string]any{"min_origin_airport_altitude": 1000}, true},
		{"detail number bound not met", map[string]any{"max_origin_airport_altitude": 1000}, false},
		{"detail and feed together", map[string]any{
			"status_text": "Landed", "airline_icao": "GLO", "min_altitude": 1000,
		}, true},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			matched, err := flight.CheckInfo(testCase.criteria)

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if matched != testCase.expected {
				t.Errorf("got %v, want %v", matched, testCase.expected)
			}
		})
	}
}

func TestCheckInfoOnlyReachesDetailsOnceTheyAreSet(t *testing.T) {
	flight := newFlight("x", feedRow())

	if _, err := flight.CheckInfo(map[string]any{"airline_name": "Gol"}); err == nil {
		t.Error("expected an error before SetFlightDetails")
	}

	flight.SetFlightDetails(map[string]any{})

	if _, err := flight.CheckInfo(map[string]any{"airline_name": "Gol"}); err != nil {
		t.Errorf("unexpected error after SetFlightDetails: %v", err)
	}
}

func TestCheckInfoDoesNotPanicOnAnUncomparableValue(t *testing.T) {
	// A detail value can be a slice, which "==" panics on.
	flight := newFlight("x", feedRow())
	flight.SetFlightDetails(map[string]any{"trail": []any{map[string]any{"lat": 1.0}}})

	matched, err := flight.CheckInfo(map[string]any{"trail": []any{}})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if matched {
		t.Error("an empty trail does not equal a trail with one point")
	}

	if matched, err = flight.CheckInfo(map[string]any{
		"trail": []any{map[string]any{"lat": 1.0}},
	}); err != nil || !matched {
		t.Errorf("got %v / %v, want an equal trail to match", matched, err)
	}
}

func TestSnakeCaseKeepsAcronymsWhole(t *testing.T) {
	cases := map[string]string{
		"AircraftAge":                      "aircraft_age",
		"AircraftCountryID":                "aircraft_country_id",
		"DestinationAirportICAO":           "destination_airport_icao",
		"OriginAirportTimezoneOffsetHours": "origin_airport_timezone_offset_hours",
		"StatusText":                       "status_text",
		"Trail":                            "trail",
	}

	for field, expected := range cases {
		if got := snakeCase(field); got != expected {
			t.Errorf("%s: got %q, want %q", field, got, expected)
		}
	}
}

func TestCheckInfoComparesTextAsText(t *testing.T) {
	// The Python and Node.js ports compare with != and !==, so a squawk of
	// "0417" is not the squawk "417".
	flight := newFlight("x", feedRow())
	flight.Squawk = "0417"

	cases := map[string]struct {
		criteria map[string]any
		expected bool
	}{
		"same text":            {map[string]any{"squawk": "0417"}, true},
		"same number as text":  {map[string]any{"squawk": "417"}, false},
		"registration is text": {map[string]any{"registration": "PR-GUP"}, true},
	}

	for name, testCase := range cases {
		matched, err := flight.CheckInfo(testCase.criteria)

		if err != nil {
			t.Fatalf("%s: unexpected error: %v", name, err)
		}
		if matched != testCase.expected {
			t.Errorf("%s: got %v, want %v", name, matched, testCase.expected)
		}
	}
}

func TestCheckInfoAcceptsGoNumericTypes(t *testing.T) {
	flight := newFlight("x", feedRow())

	for name, criteria := range map[string]map[string]any{
		"int":     {"altitude": 36000},
		"int64":   {"altitude": int64(36000)},
		"float32": {"altitude": float32(36000)},
		"float64": {"altitude": 36000.0},
		"bounds":  {"min_altitude": 6700, "max_altitude": int64(40000)},
	} {
		matched, err := flight.CheckInfo(criteria)

		if err != nil || !matched {
			t.Errorf("%s: got %v (err=%v), want a match", name, matched, err)
		}
	}
}

func TestConstructorsReadGoNumericTypes(t *testing.T) {
	// The exported constructors take a hand-built map, which carries Go's own
	// numeric types rather than the float64 a JSON decoder produces.
	airport := NewAirportFromBasicInfo(map[string]any{
		"name": "X", "iata": "XXX", "lat": 40, "lon": -73, "alt": int64(100),
	})

	if airport.Latitude == nil || *airport.Latitude != 40 {
		t.Errorf("got latitude %v, want 40", airport.Latitude)
	}
	if airport.Longitude == nil || *airport.Longitude != -73 {
		t.Errorf("got longitude %v, want -73", airport.Longitude)
	}
	if airport.Altitude == nil || *airport.Altitude != 100 {
		t.Errorf("got altitude %v, want 100", airport.Altitude)
	}

	// A bool is not a number, in any of the three ports.
	if number := toNumber(true); number != nil {
		t.Errorf("got %v for a bool, want nil", *number)
	}
}

func TestCheckInfoReportsAnUnknownFieldWhateverTheOrder(t *testing.T) {
	// Map iteration is randomised: reporting as it went raised this error only
	// when the unknown key happened to come before a criterion that fails.
	flight := newFlight("x", feedRow())

	for range 200 {
		matched, err := flight.CheckInfo(map[string]any{
			"airline_icao": "NOPE", "campo_inexistente": 1,
		})

		if err == nil {
			t.Fatal("an unknown field must be reported every time, not sometimes")
		}
		if matched {
			t.Fatal("a rejected criteria set must not report a match")
		}
	}
}

func TestCheckInfoReportsANonNumericBoundWhateverTheOrder(t *testing.T) {
	flight := newFlight("x", feedRow())

	for range 200 {
		if _, err := flight.CheckInfo(map[string]any{
			"airline_icao": "NOPE", "min_altitude": "muito alto",
		}); err == nil {
			t.Fatal("a non-numeric bound must be reported every time")
		}
	}
}

func TestSetFlightDetailsDefaultsAircraftImagesToAList(t *testing.T) {
	// The Python port does aircraft.get("images", []), and the field is `any`:
	// a nil compares differently in CheckInfo and marshals as null.
	flight := newFlight("x", feedRow())
	flight.SetFlightDetails(map[string]any{"aircraft": map[string]any{}})

	images, ok := flight.Details.AircraftImages.([]any)

	if !ok || len(images) != 0 {
		t.Errorf("got %#v, want an empty list", flight.Details.AircraftImages)
	}

	// A payload that carries images keeps its own shape.
	flight.SetFlightDetails(map[string]any{
		"aircraft": map[string]any{"images": map[string]any{"large": []any{"a"}}},
	})

	if _, ok := flight.Details.AircraftImages.(map[string]any); !ok {
		t.Errorf("got %#v, want the payload preserved", flight.Details.AircraftImages)
	}
}

func TestCheckInfoAcceptsDefinedNumericTypes(t *testing.T) {
	// A defined type over float64 reaches the reflection path, where the
	// float64 kind was missing while int64 and float32 worked.
	type feet float64
	type knots int64
	type ratio float32

	flight := newFlight("x", feedRow())

	for name, criteria := range map[string]map[string]any{
		"float64 underlying": {"min_altitude": feet(6700)},
		"int64 underlying":   {"min_altitude": knots(6700)},
		"float32 underlying": {"min_altitude": ratio(6700)},
	} {
		matched, err := flight.CheckInfo(criteria)

		if err != nil || !matched {
			t.Errorf("%s: got %v (err=%v), want a match", name, matched, err)
		}
	}
}
