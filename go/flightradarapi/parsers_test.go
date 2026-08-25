package flightradarapi

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"testing"
)

// Offline parser tests against the bundled fixtures, mirroring
// python/tests/test_parsers_offline.py and nodejs/tests/testParsersOffline.js.
// When FR24 changes a page or feed, update the fixtures: the assertions here
// guard the parser's invariants, not byte-for-byte equality with production.

func loadFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))

	if err != nil {
		t.Fatalf("could not read fixture %s: %v", name, err)
	}
	return data
}

func airlinesByName(t *testing.T) map[string]Airline {
	t.Helper()
	byName := map[string]Airline{}

	for _, airline := range parseAirlinesHTML(loadFixture(t, "airlines.html")) {
		byName[airline.Name] = airline
	}
	return byName
}

func airportsByIATA(t *testing.T, airports []*Airport) map[string]*Airport {
	t.Helper()
	byIATA := map[string]*Airport{}

	for _, airport := range airports {
		byIATA[airport.IATA] = airport
	}
	return byIATA
}

// airportsFromRow parses a one-row feed built from a raw JSON literal, the way
// both other ports do it.
func airportsFromRow(t *testing.T, row string) []*Airport {
	t.Helper()
	airports := parseAirportsJSON([]byte(`{"rows":[`+row+`]}`), nil)

	if len(airports) != 1 {
		t.Fatalf("got %d airports for row %s, want 1", len(airports), row)
	}
	return airports
}

// --- parseAirlinesHTML ---

func TestParseAirlinesHTMLExtractsKnownRows(t *testing.T) {
	byName := airlinesByName(t)

	for _, name := range []string{"LATAM Airlines", "Gol", "Delta Air Lines"} {
		if _, ok := byName[name]; !ok {
			t.Errorf("missing airline %q", name)
		}
	}
}

func TestParseAirlinesHTMLSplitsIATAAndICAO(t *testing.T) {
	byName := airlinesByName(t)

	for _, expected := range []struct{ name, iata, icao string }{
		{"LATAM Airlines", "LA", "LAN"},
		{"Gol", "G3", "GLO"},
	} {
		airline := byName[expected.name]

		if airline.IATA != expected.iata || airline.ICAO != expected.icao {
			t.Errorf("%s: got IATA %q / ICAO %q, want %q / %q",
				expected.name, airline.IATA, airline.ICAO, expected.iata, expected.icao)
		}
	}
}

func TestParseAirlinesHTMLHandlesIATAOrICAOOnly(t *testing.T) {
	byName := airlinesByName(t)

	if byName["Sky2"].IATA != "SK" || byName["Sky2"].ICAO != "" {
		t.Errorf("Sky2: got IATA %q / ICAO %q", byName["Sky2"].IATA, byName["Sky2"].ICAO)
	}
	if byName["SkyTeam"].ICAO != "SKT" || byName["SkyTeam"].IATA != "" {
		t.Errorf("SkyTeam: got IATA %q / ICAO %q", byName["SkyTeam"].IATA, byName["SkyTeam"].ICAO)
	}
}

func TestParseAirlinesHTMLParsesAircraftCount(t *testing.T) {
	byName := airlinesByName(t)

	for _, expected := range []struct {
		name  string
		count int
	}{{"LATAM Airlines", 340}, {"Gol", 140}} {
		count := byName[expected.name].NumAircrafts

		if count == nil || *count != expected.count {
			t.Errorf("%s: got %v aircraft, want %d", expected.name, count, expected.count)
		}
	}
}

func TestParseAirlinesHTMLSkipsInvalidRows(t *testing.T) {
	airlines := parseAirlinesHTML(loadFixture(t, "airlines.html"))

	// 5 valid rows; 2 invalid (no notranslate, wrong href) must be skipped.
	if len(airlines) != 5 {
		t.Errorf("got %d airlines, want 5", len(airlines))
	}
}

func TestParseAirlinesHTMLEmptyInputReturnsEmptyList(t *testing.T) {
	for _, page := range []string{"", "<html><body><p>no tbody here</p></body></html>"} {
		if airlines := parseAirlinesHTML([]byte(page)); len(airlines) != 0 {
			t.Errorf("got %d airlines for %q, want 0", len(airlines), page)
		}
	}
}

// --- parseAirportsJSON ---

func TestParseAirportsJSONExtractsBasicFields(t *testing.T) {
	byIATA := airportsByIATA(t, parseAirportsJSON(loadFixture(t, "airports.json"), nil))

	for _, code := range []string{"GRU", "GIG"} {
		if _, ok := byIATA[code]; !ok {
			t.Fatalf("missing airport %q", code)
		}
	}

	gru := byIATA["GRU"]

	if gru.ICAO != "SBGR" || gru.Country != "Brazil" {
		t.Errorf("GRU: got ICAO %q country %q", gru.ICAO, gru.Country)
	}
	if gru.Latitude == nil || math.Abs(*gru.Latitude-(-23.429991)) > 1e-6 {
		t.Errorf("GRU latitude: got %v", gru.Latitude)
	}
	if gru.Longitude == nil || math.Abs(*gru.Longitude-(-46.4674)) > 1e-6 {
		t.Errorf("GRU longitude: got %v", gru.Longitude)
	}
	if gru.Altitude == nil || *gru.Altitude != 2436 {
		t.Errorf("GRU altitude: got %v, want 2436", gru.Altitude)
	}
}

func TestParseAirportsJSONFormatsAltitudeWithoutDecimals(t *testing.T) {
	// Both other ports report 2436, never 2436.0.
	byIATA := airportsByIATA(t, parseAirportsJSON(loadFixture(t, "airports.json"), nil))

	if got := formatNumber(*byIATA["GRU"].Altitude); got != "2436" {
		t.Errorf("got altitude %q, want \"2436\"", got)
	}
}

func TestParseAirportsJSONKeepsEveryCountryWithoutFilter(t *testing.T) {
	countries := map[string]bool{}

	for _, airport := range parseAirportsJSON(loadFixture(t, "airports.json"), nil) {
		countries[airport.Country] = true
	}

	for _, country := range []string{"Brazil", "United States", "Spain"} {
		if !countries[country] {
			t.Errorf("missing country %q", country)
		}
	}
}

func TestParseAirportsJSONFiltersByCountrySlug(t *testing.T) {
	airports := parseAirportsJSON(loadFixture(t, "airports.json"), []Country{"united-states"})

	if len(airports) == 0 {
		t.Fatal("no airports returned")
	}
	for _, airport := range airports {
		if airport.Country != "United States" {
			t.Errorf("got country %q, want United States", airport.Country)
		}
	}
}

func TestParseAirportsJSONAcceptsSeveralCountries(t *testing.T) {
	airports := parseAirportsJSON(loadFixture(t, "airports.json"), []Country{"brazil", "spain"})
	countries := map[string]bool{}

	for _, airport := range airports {
		countries[airport.Country] = true
	}
	if len(countries) != 2 || !countries["Brazil"] || !countries["Spain"] {
		t.Errorf("got countries %v, want Brazil and Spain", countries)
	}
}

func TestParseAirportsJSONInvalidCoordinatesBecomeNil(t *testing.T) {
	// Regression: invalid coords used to be coerced to (0, 0), placing the
	// airport in the Gulf of Guinea.
	byIATA := airportsByIATA(t, parseAirportsJSON(loadFixture(t, "airports.json"), nil))
	bad := byIATA["BAD"]

	if bad == nil {
		t.Fatal("missing airport BAD")
	}
	if bad.Latitude != nil || bad.Longitude != nil {
		t.Errorf("got position (%v, %v), want no position", bad.Latitude, bad.Longitude)
	}
}

func TestParseAirportsJSONRejectsNumericLookingJunk(t *testing.T) {
	payload, err := json.Marshal(map[string]any{"rows": []any{map[string]any{
		"name": "Junk Airport", "iata": "JNK", "icao": "JJNK",
		"lat": "43.30 N", "lon": -8.37725, "country": "Spain", "alt": "-1",
	}}})

	if err != nil {
		t.Fatal(err)
	}

	airport := parseAirportsJSON(payload, nil)[0]

	// One bad coordinate drops both; altitude is independent and survives.
	if airport.Latitude != nil || airport.Longitude != nil {
		t.Errorf("got position (%v, %v), want no position", airport.Latitude, airport.Longitude)
	}
	if airport.Altitude == nil || *airport.Altitude != -1 {
		t.Errorf("got altitude %v, want -1", airport.Altitude)
	}
}

func TestParseAirportsJSONAgreesWithOtherPortsOnUnicode(t *testing.T) {
	cases := []struct {
		name     string
		value    string
		expected *float64
	}{
		// Arabic-Indic digits, which a Unicode-aware \d matched before.
		{"arabic-indic digits", "٤٣", nil},
		// U+FEFF, which JavaScript's trim() drops and Python's strip() keeps.
		{"leading byte-order mark", "\ufeff43", nil},
		// U+001C, which Python's strip() drops and JavaScript's trim() keeps.
		{"leading file separator", "\u001c43", nil},
		{"plain spaces are trimmed", "  43  ", float64Ptr(43)},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			row, err := json.Marshal(map[string]any{
				"name": "X", "iata": "XXX", "icao": "XXXX", "country": "Spain",
				"lat": testCase.value, "lon": testCase.value, "alt": testCase.value,
			})

			if err != nil {
				t.Fatal(err)
			}

			airport := airportsFromRow(t, string(row))[0]

			if !equalOptional(airport.Altitude, testCase.expected) {
				t.Errorf("got altitude %v, want %v", airport.Altitude, testCase.expected)
			}
		})
	}
}

func TestParseAirportsJSONNumericCoercion(t *testing.T) {
	// Keep in step with the same list in the Python and Node.js suites.
	cases := []struct {
		name     string
		literal  string
		expected *float64
	}{
		{"whitespace", `" "`, nil},
		{"an array holding a number", `[43]`, nil},
		{"a coordinate with a hemisphere suffix", `"43.30 N"`, nil},
		{"an exponent overflowing a double", `"1e999"`, nil},
		{"400 plain digits", `"` + repeat("1", 400) + `"`, nil},
		{"a whole number as a string", `"2436"`, float64Ptr(2436)},
		{"a negative decimal", `-23.4`, float64Ptr(-23.4)},
		{"a genuine zero", `0`, float64Ptr(0)},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			row := fmt.Sprintf(
				`{"name":"X","iata":"XXX","icao":"XXXX","country":"Spain","lat":%s,"lon":%s,"alt":%s}`,
				testCase.literal, testCase.literal, testCase.literal)
			airport := airportsFromRow(t, row)[0]

			for label, got := range map[string]*float64{
				"latitude":  airport.Latitude,
				"longitude": airport.Longitude,
				"altitude":  airport.Altitude,
			} {
				if !equalOptional(got, testCase.expected) {
					t.Errorf("%s: got %v, want %v", label, got, testCase.expected)
				}
			}
		})
	}
}

func TestParseAirportsJSONSurvivesRawNumbersNoDoubleCanHold(t *testing.T) {
	for _, literal := range []string{repeat("1", 400), "9007199254740993", "-" + repeat("1", 400)} {
		row := fmt.Sprintf(
			`{"name":"X","iata":"XXX","icao":"XXXX","country":"Spain","lat":%s,"lon":1,"alt":2}`, literal)
		latitude := airportsFromRow(t, row)[0].Latitude

		if latitude != nil && (math.IsInf(*latitude, 0) || math.IsNaN(*latitude)) {
			t.Errorf("%s: got %v, want nil or a finite number", literal, *latitude)
		}
	}
}

func TestParseAirportsJSONKeepsTextFieldsAsStrings(t *testing.T) {
	// Anything else breaks GetCountryFlag(airport.Country).
	for _, literal := range []string{"null", "0", "false", "true", "[]", "{}", "123"} {
		row := fmt.Sprintf(
			`{"name":%s,"iata":%s,"icao":%s,"country":%s,"lat":1,"lon":2,"alt":3}`,
			literal, literal, literal, literal)
		airport := airportsFromRow(t, row)[0]

		if airport.Name != "" || airport.IATA != "" || airport.ICAO != "" || airport.Country != "" {
			t.Errorf("%s: got %q/%q/%q/%q, want empty strings",
				literal, airport.Name, airport.IATA, airport.ICAO, airport.Country)
		}
	}
}

func TestParseAirportsJSONCountrySpellingAndSlugRoundTrip(t *testing.T) {
	byIATA := airportsByIATA(t, parseAirportsJSON(loadFixture(t, "airports.json"), nil))
	ann := byIATA["VBA"]

	if ann == nil {
		t.Fatal("missing airport VBA")
	}
	if ann.Country != "Myanmar (Burma)" {
		t.Errorf("got country %q", ann.Country)
	}
	if slug := countryToSlug(ann.Country); slug != "myanmar-burma" {
		t.Errorf("got slug %q, want myanmar-burma", slug)
	}
	if ann.Altitude == nil || *ann.Altitude != 43 {
		t.Errorf("got altitude %v, want 43", ann.Altitude)
	}
}

func TestParseAirportsJSONFilterAcceptsEitherCountrySpelling(t *testing.T) {
	for _, spelling := range []Country{"myanmar-burma", "Myanmar (Burma)", CountryMyanmarBurma} {
		airports := parseAirportsJSON(loadFixture(t, "airports.json"), []Country{spelling})

		if len(airports) != 1 {
			t.Errorf("%q: got %d airports, want 1", spelling, len(airports))
		}
	}
}

func TestParseAirportsJSONSkipsRowsThatAreNotObjects(t *testing.T) {
	payload := []byte(`{"rows":[[1,2,3],"x",7,null,` +
		`{"name":"Real","iata":"RRR","icao":"RRRR","country":"Spain","lat":1,"lon":2,"alt":3}]}`)
	airports := parseAirportsJSON(payload, nil)

	if len(airports) != 1 || airports[0].IATA != "RRR" {
		t.Errorf("got %d airports, want only RRR", len(airports))
	}
}

func TestParseAirportsJSONUnknownCountryReturnsEmptyList(t *testing.T) {
	if airports := parseAirportsJSON(loadFixture(t, "airports.json"), []Country{"atlantis"}); len(airports) != 0 {
		t.Errorf("got %d airports, want 0", len(airports))
	}
}

func TestParseAirportsJSONInvalidPayloadReturnsEmptyList(t *testing.T) {
	for _, payload := range []string{"", "{}", "<html>not json</html>"} {
		if airports := parseAirportsJSON([]byte(payload), nil); len(airports) != 0 {
			t.Errorf("%q: got %d airports, want 0", payload, len(airports))
		}
	}
}

// --- countryToSlug ---

func TestCountryToSlugMatchesCountryConstants(t *testing.T) {
	cases := map[string]string{
		"United States":                    "united-states",
		"Democratic Republic Of The Congo": "democratic-republic-of-the-congo",
		"Curacao":                          "curacao",
		"Curaçao":                          "curacao",
		"":                                 "",
	}

	for country, expected := range cases {
		if slug := countryToSlug(country); slug != expected {
			t.Errorf("%q: got %q, want %q", country, slug, expected)
		}
	}
}

func TestCountryToSlugStripsParenthesesForFlagURLs(t *testing.T) {
	// These 404'd while the slug was a plain space-to-hyphen replacement.
	cases := map[string]string{
		"Myanmar (Burma)":             "myanmar-burma",
		"Cocos (Keeling) Islands":     "cocos-keeling-islands",
		"Falkland Islands (Malvinas)": "falkland-islands-malvinas",
		"Timor-Leste (East Timor)":    "timor-leste-east-timor",
	}

	for country, expected := range cases {
		if slug := countryToSlug(country); slug != expected {
			t.Errorf("%q: got %q, want %q", country, slug, expected)
		}
	}
}

func TestCountryConstantsRoundTripThroughTheSlugifier(t *testing.T) {
	for _, country := range []Country{CountryBrazil, CountryMyanmarBurma, CountryUnitedStates} {
		if slug := countryToSlug(string(country)); slug != string(country) {
			t.Errorf("%q: got %q", country, slug)
		}
	}
}

func equalOptional(got, want *float64) bool {
	if got == nil || want == nil {
		return got == nil && want == nil
	}
	return *got == *want
}

// float64Ptr is the shorthand the table-driven tests need for optional numbers.
func float64Ptr(value float64) *float64 { return &value }

func repeat(text string, times int) string {
	result := make([]byte, 0, len(text)*times)

	for range times {
		result = append(result, text...)
	}
	return string(result)
}

func TestParseAirportsJSONRejectsDataPastTheJSONBody(t *testing.T) {
	// Decode reads the first value only, so a spliced body used to pass.
	payload := []byte(`{"rows":[{"name":"X","iata":"XXX","icao":"XXXX","country":"Spain",` +
		`"lat":1,"lon":2,"alt":3}]}trailing garbage`)

	if airports := parseAirportsJSON(payload, nil); len(airports) != 0 {
		t.Errorf("got %d airports, want the body rejected", len(airports))
	}

	// Trailing whitespace is not garbage.
	clean := []byte(`{"rows":[{"name":"X","iata":"XXX","icao":"XXXX","country":"Spain",` +
		`"lat":1,"lon":2,"alt":3}]}` + "\n\n  ")

	if airports := parseAirportsJSON(clean, nil); len(airports) != 1 {
		t.Errorf("got %d airports, want the body accepted", len(airports))
	}
}
