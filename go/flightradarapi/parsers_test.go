package flightradarapi

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
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
	}{
		{"LATAM Airlines", 340},
		{"Gol", 140},
		// Thousands separator, as the page prints large fleets.
		{"Delta Air Lines", 1900},
	} {
		count := byName[expected.name].NumAircrafts

		if count == nil || *count != expected.count {
			t.Errorf("%s: got %v aircraft, want %d", expected.name, count, expected.count)
		}
	}

	// Only the "Largest fleets" section carries a count.
	if count := byName["Sky2"].NumAircrafts; count != nil {
		t.Errorf("Sky2: got %d aircraft, want none", *count)
	}
}

func TestParseAirlinesHTMLMergesAnAirlineListedInTwoSections(t *testing.T) {
	// Delta and Gol appear under "Largest fleets" and again under "All airlines".
	seen := map[string]int{}

	for _, airline := range parseAirlinesHTML(loadFixture(t, "airlines.html")) {
		seen[airline.Name]++
	}
	for _, name := range []string{"Delta Air Lines", "Gol"} {
		if seen[name] != 1 {
			t.Errorf("%s: listed %d times, want once", name, seen[name])
		}
	}
}

func TestParseAirlinesHTMLKeepsACodeShapedName(t *testing.T) {
	tap := airlinesByName(t)["TAP"]

	if tap.Name != "TAP" || tap.ICAO != "TAP" || tap.IATA != "TP" || tap.NumAircrafts != nil {
		t.Errorf("got %+v, want TAP / TAP / TP with no count", tap)
	}
}

func TestParseAirlinesHTMLSkipsInvalidRows(t *testing.T) {
	airlines := parseAirlinesHTML(loadFixture(t, "airlines.html"))

	// 6 airlines; the section link, the entry with no link, the wrong href and
	// the one-letter name must be skipped.
	if len(airlines) != 6 {
		t.Errorf("got %d airlines, want 6", len(airlines))
	}
	for _, airline := range airlines {
		if airline.Name == "All" {
			t.Errorf("the section link was read as an airline: %+v", airline)
		}
	}
}

func TestParseAirlinesHTMLKeepsTheOrderOfThePage(t *testing.T) {
	var names []string

	for _, airline := range parseAirlinesHTML(loadFixture(t, "airlines.html")) {
		names = append(names, airline.Name)
	}

	want := []string{"Delta Air Lines", "LATAM Airlines", "Gol", "Sky2", "SkyTeam", "TAP"}

	if !slices.Equal(names, want) {
		t.Errorf("got %v, want %v", names, want)
	}
}

func TestParseAirlinesHTMLEmptyInputReturnsEmptyList(t *testing.T) {
	for _, page := range []string{"", "<html><body><p>no airlines here</p></body></html>"} {
		if airlines := parseAirlinesHTML([]byte(page)); len(airlines) != 0 {
			t.Errorf("got %d airlines for %q, want 0", len(airlines), page)
		}
	}
}

// --- parseInertiaPage ---

func decodeFixture(t *testing.T, name string) map[string]any {
	t.Helper()
	var page map[string]any

	if err := json.Unmarshal(loadFixture(t, name), &page); err != nil {
		t.Fatalf("could not decode fixture %s: %v", name, err)
	}
	return page
}

func TestParseInertiaPageReadsTheDataPageAttribute(t *testing.T) {
	page, ok := parseInertiaPage(loadFixture(t, "airports_index.html"))

	if !ok {
		t.Fatal("no page object found")
	}
	if page["component"] != "Data/Airports" || page["version"] != "919b94d2a33f365a34f99828f6eeec6a" {
		t.Errorf("got component %v version %v", page["component"], page["version"])
	}
	if _, ok := page["props"].(map[string]any)["airportsByCountry"]; !ok {
		t.Errorf("got props %v, want airportsByCountry among them", page["props"])
	}
}

func TestParseInertiaPageAcceptsADecodedJSONBody(t *testing.T) {
	body := decodeFixture(t, "airports_country.json")
	page, ok := parseInertiaPage(body)

	if !ok || page["component"] != body["component"] {
		t.Errorf("got %v, want the body handed back", page)
	}
}

func TestParseInertiaPageAcceptsAString(t *testing.T) {
	if _, ok := parseInertiaPage(string(loadFixture(t, "airports_index.html"))); !ok {
		t.Error("the HTML as a string was not read")
	}
}

func TestParseInertiaPageRejectsUnrecognisedPayloads(t *testing.T) {
	for _, payload := range []any{
		[]byte(""),
		[]byte(`<html><body><div id="app"></div></body></html>`),
		[]byte(`<div data-page="not json"></div>`),
		[]byte(`<div data-page="[1, 2]"></div>`),
		map[string]any{"component": "Data/Airports"},
		map[string]any{"props": "not an object"},
		[]any{1, 2},
		nil,
		42,
	} {
		if page, ok := parseInertiaPage(payload); ok || page != nil {
			t.Errorf("%v: got %v, want nothing", payload, page)
		}
	}
}

// --- parseAirportsIndex ---

func TestParseAirportsIndexListsEveryCountryWithItsSlug(t *testing.T) {
	countries := parseAirportsIndex(loadFixture(t, "airports_index.html"))
	var slugs []string

	for _, country := range countries {
		slugs = append(slugs, country.Slug)
	}
	if want := []string{"brazil", "myanmar-burma", "uruguay"}; !slices.Equal(slugs, want) {
		t.Fatalf("got %v, want %v", slugs, want)
	}
	if countries[1].Name != "MYANMAR (BURMA)" {
		t.Errorf("got name %q, want it as FR24 prints it", countries[1].Name)
	}
}

func TestParseAirportsIndexSlugsMatchTheCountryConstants(t *testing.T) {
	known := map[Country]bool{}

	for _, country := range AllCountries() {
		known[country] = true
	}
	for _, country := range parseAirportsIndex(loadFixture(t, "airports_index.html")) {
		if !known[Country(country.Slug)] {
			t.Errorf("%q is not a Country constant", country.Slug)
		}
	}
}

func TestParseAirportsIndexInvalidPayloadReturnsEmptyList(t *testing.T) {
	for _, payload := range []any{
		[]byte(""),
		map[string]any{"props": map[string]any{}},
		map[string]any{"props": map[string]any{"airportsByCountry": "x"}},
		map[string]any{"props": map[string]any{"airportsByCountry": []any{1, "x", map[string]any{"name": nil}}}},
	} {
		if countries := parseAirportsIndex(payload); len(countries) != 0 {
			t.Errorf("%v: got %v, want none", payload, countries)
		}
	}
}

// --- parseAirportsPage ---

func iatas(airports []*Airport) []string {
	codes := make([]string, 0, len(airports))

	for _, airport := range airports {
		codes = append(codes, airport.IATA)
	}
	return codes
}

func TestParseAirportsPageExtractsTheAirportsOfACountry(t *testing.T) {
	airports, statePaths := parseAirportsPage(decodeFixture(t, "airports_country.json"))

	if len(statePaths) != 0 {
		t.Errorf("got state paths %v, want none", statePaths)
	}
	if got := iatas(airports); !slices.Equal(got, []string{"CYR", "MVD"}) {
		t.Fatalf("got %v, want CYR and MVD", got)
	}

	mvd := airports[1]

	if mvd.Name != "Montevideo Carrasco International Airport" || mvd.ICAO != "SUMU" || mvd.Country != "Uruguay" {
		t.Errorf("got %q / %q / %q", mvd.Name, mvd.ICAO, mvd.Country)
	}
}

func TestParseAirportsPageListingCarriesNoPosition(t *testing.T) {
	airports, _ := parseAirportsPage(decodeFixture(t, "airports_country.json"))

	for _, airport := range airports {
		if airport.Latitude != nil || airport.Longitude != nil || airport.Altitude != nil {
			t.Errorf("%s: got position (%v, %v) altitude %v, want none",
				airport.IATA, airport.Latitude, airport.Longitude, airport.Altitude)
		}
	}
}

func TestParseAirportsPageReturnsTheStatePagesOfASplitCountry(t *testing.T) {
	airports, statePaths := parseAirportsPage(decodeFixture(t, "airports_country_states.json"))

	if len(airports) != 0 {
		t.Errorf("got %d airports, want none", len(airports))
	}
	if want := []string{"/data/airports/brazil/rj", "/data/airports/brazil/sp"}; !slices.Equal(statePaths, want) {
		t.Errorf("got %v, want %v", statePaths, want)
	}
}

func TestParseAirportsPageStatePageKeepsTheCountryName(t *testing.T) {
	airports, statePaths := parseAirportsPage(decodeFixture(t, "airports_state_sp.json"))

	if len(statePaths) != 0 {
		t.Errorf("got state paths %v, want none", statePaths)
	}
	if got := iatas(airports); !slices.Equal(got, []string{"GRU", "CGH"}) {
		t.Errorf("got %v, want GRU and CGH", got)
	}
	for _, airport := range airports {
		if airport.Country != "Brazil" {
			t.Errorf("%s: got country %q, want Brazil", airport.IATA, airport.Country)
		}
	}
}

func TestParseAirportsPageReadsAnHTMLPage(t *testing.T) {
	airports, _ := parseAirportsPage(loadFixture(t, "airports_country.html"))

	if got := iatas(airports); !slices.Equal(got, []string{"RGN"}) {
		t.Fatalf("got %v, want RGN", got)
	}
	// FR24 spells it "Myanmar (Burma)" on the page and "myanmar-burma" in URLs.
	if airports[0].Country != "Myanmar (Burma)" {
		t.Errorf("got country %q", airports[0].Country)
	}
	if slug := countryToSlug(airports[0].Country); slug != string(CountryMyanmarBurma) {
		t.Errorf("got slug %q, want %q", slug, CountryMyanmarBurma)
	}
}

func TestParseAirportsPageSkipsRowsThatAreNotObjects(t *testing.T) {
	payload := map[string]any{"props": map[string]any{
		"country":  map[string]any{"name": "Nowhere"},
		"airports": []any{1, "x", nil, map[string]any{"iata": "RRR"}},
	}}
	airports, _ := parseAirportsPage(payload)

	if got := iatas(airports); !slices.Equal(got, []string{"RRR"}) {
		t.Errorf("got %v, want only RRR", got)
	}
}

func TestParseAirportsPageKeepsTextFieldsAsStrings(t *testing.T) {
	// Anything else breaks GetCountryFlag(airport.Country).
	payload := map[string]any{"props": map[string]any{
		"country":  map[string]any{"name": []any{"Brazil"}},
		"airports": []any{map[string]any{"name": 42.0, "iata": nil, "icao": map[string]any{"x": 1.0}}},
	}}
	airports, _ := parseAirportsPage(payload)

	if len(airports) != 1 {
		t.Fatalf("got %d airports, want 1", len(airports))
	}

	airport := airports[0]

	if airport.Name != "" || airport.IATA != "" || airport.ICAO != "" || airport.Country != "" {
		t.Errorf("got %q/%q/%q/%q, want empty strings", airport.Name, airport.IATA, airport.ICAO, airport.Country)
	}
}

func TestParseAirportsPageIgnoresMalformedStates(t *testing.T) {
	payload := map[string]any{"props": map[string]any{"states": []any{
		map[string]any{"url": "/data/airports/x/a"},
		map[string]any{"url": ""},
		map[string]any{"code": "B"},
		"junk",
		map[string]any{"url": 3.0},
	}}}
	airports, statePaths := parseAirportsPage(payload)

	if len(airports) != 0 || !slices.Equal(statePaths, []string{"/data/airports/x/a"}) {
		t.Errorf("got %d airports and state paths %v, want only /data/airports/x/a", len(airports), statePaths)
	}
}

func TestParseAirportsPageInvalidPayloadReturnsNothing(t *testing.T) {
	for _, payload := range []any{
		[]byte(""),
		[]byte("<html>not a data page</html>"),
		map[string]any{"props": map[string]any{}},
		map[string]any{"props": map[string]any{"country": "Brazil", "airports": "none", "states": 7.0}},
	} {
		airports, statePaths := parseAirportsPage(payload)

		if airports == nil || statePaths == nil {
			t.Errorf("%v: got nil slices, want empty ones", payload)
		}
		if len(airports) != 0 || len(statePaths) != 0 {
			t.Errorf("%v: got %d airports and %v, want nothing", payload, len(airports), statePaths)
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

// float64Ptr is the shorthand the table-driven tests need for optional numbers.
func float64Ptr(value float64) *float64 { return &value }

func TestTextFieldsReadAPayloadDecodedWithUseNumber(t *testing.T) {
	// The exported constructors take a map the caller may have decoded with
	// UseNumber, and must read a number there as text.
	decoder := json.NewDecoder(strings.NewReader(`{"age": 12, "name": "Lukla"}`))
	decoder.UseNumber()

	var payload map[string]any

	if err := decoder.Decode(&payload); err != nil {
		t.Fatal(err)
	}

	if got := getString(payload, "age"); got != "12" {
		t.Errorf("got %q, want the number rendered as text", got)
	}
	if got := getString(payload, "name"); got != "Lukla" {
		t.Errorf("got %q, want Lukla", got)
	}
}
