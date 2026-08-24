package flightradarapi

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

// countries.go and zones.go are generated from the Python port, which is the
// source of truth for both. These tests turn "keep the ports in sync" from a
// promise in CONTRIBUTING.md into a failing build: when the Python data moves
// ahead, they say exactly which entries drifted.

// pythonSource reads a file of the Python port, skipping the test when this
// module was vendored without the rest of the repository.
func pythonSource(t *testing.T, name string) string {
	t.Helper()
	path := filepath.Join("..", "..", "python", "FlightRadarAPI", name)
	source, err := os.ReadFile(path)

	if errors.Is(err, fs.ErrNotExist) {
		t.Skipf("%s is not present: nothing to compare against", path)
	}
	if err != nil {
		t.Fatalf("could not read %s: %v", path, err)
	}
	return string(source)
}

var pythonEnumMember = regexp.MustCompile(`(?m)^    [A-Z_]+ = "([a-z0-9-]+)"$`)

func TestCountryConstantsMatchThePythonEnum(t *testing.T) {
	source := pythonSource(t, "core.py")
	var wanted []Country

	for _, match := range pythonEnumMember.FindAllStringSubmatch(source, -1) {
		wanted = append(wanted, Country(match[1]))
	}

	if len(wanted) == 0 {
		t.Fatal("no country members found in core.py — has the enum moved?")
	}
	countries := AllCountries()

	if reflect.DeepEqual(wanted, countries) {
		return
	}

	inGo := make(map[Country]bool, len(countries))

	for _, country := range countries {
		inGo[country] = true
	}

	inPython := make(map[Country]bool, len(wanted))

	for _, country := range wanted {
		inPython[country] = true

		if !inGo[country] {
			t.Errorf("missing from countries.go: %q — regenerate it from core.py", country)
		}
	}

	for _, country := range countries {
		if !inPython[country] {
			t.Errorf("not in the Python enum: %q — regenerate countries.go from core.py", country)
		}
	}

	// Same members, different order: the constants are still usable, but the
	// generated file no longer reflects its source.
	if len(wanted) == len(countries) && !t.Failed() {
		t.Error("countries.go lists the same countries in a different order than core.py")
	}
}

func TestStaticZonesMatchThePythonSource(t *testing.T) {
	source := pythonSource(t, "zones.py")
	_, literal, found := strings.Cut(source, "static_zones = ")

	if !found {
		t.Fatal(`no "static_zones" assignment in zones.py — has the source moved?`)
	}

	// The Python literal is valid JSON, and Zone carries the feed's own field
	// names, so it decodes straight into the type under test.
	var wanted map[string]Zone

	if err := json.Unmarshal([]byte(strings.TrimSpace(literal)), &wanted); err != nil {
		t.Fatalf("could not read the zones of the Python port: %v", err)
	}
	if len(wanted) == 0 {
		t.Fatal("no zones found in zones.py")
	}

	for name, zone := range wanted {
		got, ok := staticZones[name]

		if !ok {
			t.Errorf("missing from zones.go: %q — regenerate it from zones.py", name)
			continue
		}
		compareZone(t, name, got, zone)
	}

	for name := range staticZones {
		if _, ok := wanted[name]; !ok {
			t.Errorf("not in the Python source: %q — regenerate zones.go from zones.py", name)
		}
	}
}

// compareZone reports the differing field rather than dumping both trees, which
// for a zone with subzones runs to several screens.
func compareZone(t *testing.T, path string, got, want Zone) {
	t.Helper()

	for field, pair := range map[string][2]float64{
		"tl_y": {got.TLY, want.TLY},
		"tl_x": {got.TLX, want.TLX},
		"br_y": {got.BRY, want.BRY},
		"br_x": {got.BRX, want.BRX},
	} {
		if pair[0] != pair[1] {
			t.Errorf("zone %s.%s: got %v, want %v from zones.py", path, field, pair[0], pair[1])
		}
	}

	for name, subzone := range want.Subzones {
		sub, ok := got.Subzones[name]

		if !ok {
			t.Errorf("subzone %s.%s is missing from zones.go", path, name)
			continue
		}
		compareZone(t, path+"."+name, sub, subzone)
	}

	for name := range got.Subzones {
		if _, ok := want.Subzones[name]; !ok {
			t.Errorf("subzone %s.%s is not in zones.py", path, name)
		}
	}
}

func TestFlightTrackerConfigMatchesThePythonDataclass(t *testing.T) {
	source := pythonSource(t, "flight_tracker_config.py")
	fields := regexp.MustCompile(`(?m)^    ([a-z]+): str = "([0-9]+)"$`).FindAllStringSubmatch(source, -1)

	if len(fields) == 0 {
		t.Fatal("no fields found in flight_tracker_config.py — has the dataclass moved?")
	}

	values := NewFlightTrackerConfig().Values()

	for _, field := range fields {
		name, wanted := field[1], field[2]

		if got := values.Get(name); got != wanted {
			t.Errorf("option %q: got %q, want %q from the Python dataclass", name, got, wanted)
		}
	}
	if len(values) != len(fields) {
		t.Errorf("got %d options, want the %d of the Python dataclass", len(values), len(fields))
	}
}

func TestFlightFieldsMatchThePythonAttributes(t *testing.T) {
	// CheckInfo criteria are written against these names, so a Python filter
	// ported over must keep working.
	source := pythonSource(t, filepath.Join("entities", "flight.py"))
	assigned := regexp.MustCompile(`(?m)^\s+self\.([a-z_0-9]+) =`).FindAllStringSubmatch(source, -1)

	if len(assigned) == 0 {
		t.Fatal("no attributes found in flight.py — has the class moved?")
	}

	flight := newFlight("x", feedRow())
	flight.SetFlightDetails(map[string]any{})
	fields := flight.fields()

	for _, match := range assigned {
		if _, ok := fields[match[1]]; !ok {
			t.Errorf("CheckInfo cannot reach %q, which the Python port exposes", match[1])
		}
	}

	// Set by Entity._set_position in Python, so the regex above cannot see them.
	for _, name := range []string{"latitude", "longitude"} {
		if _, ok := fields[name]; !ok {
			t.Errorf("CheckInfo cannot reach %q", name)
		}
	}
}

// pascalCase renders a Python method name the way this port spells it:
// get_bounds_by_point becomes GetBoundsByPoint.
func pascalCase(name string) string {
	var out strings.Builder

	for _, part := range strings.Split(name, "_") {
		if part == "" {
			continue
		}
		out.WriteString(strings.ToUpper(part[:1]) + part[1:])
	}
	return out.String()
}

var pythonMethod = regexp.MustCompile(`(?m)^    def ([a-z_][a-z_0-9]*)\(`)

// publicMethods lists the methods a Python class exposes, skipping the private
// and dunder ones.
func publicMethods(t *testing.T, source string) []string {
	t.Helper()
	var names []string

	for _, match := range pythonMethod.FindAllStringSubmatch(source, -1) {
		if !strings.HasPrefix(match[1], "_") {
			names = append(names, match[1])
		}
	}
	if len(names) == 0 {
		t.Fatal("no public methods found — has the Python source moved?")
	}
	return names
}

func TestClientMethodsMatchThePythonAPI(t *testing.T) {
	client := reflect.TypeFor[*Client]()

	for _, name := range publicMethods(t, pythonSource(t, "api.py")) {
		if _, ok := client.MethodByName(pascalCase(name)); !ok {
			t.Errorf("FlightRadar24API.%s has no Client.%s in this port", name, pascalCase(name))
		}
	}
}

func TestEntityMethodsMatchThePythonAPI(t *testing.T) {
	cases := []struct {
		file   string
		goType reflect.Type
	}{
		{"entity.py", reflect.TypeFor[*Flight]()}, // inherited by both entities
		{"airport.py", reflect.TypeFor[*Airport]()},
		{"flight.py", reflect.TypeFor[*Flight]()},
	}

	// Python exposes these as classmethods, which this port spells as package
	// functions. Named here so a new one upstream fails the test.
	constructors := map[string]any{
		"from_basic_info": NewAirportFromBasicInfo,
		"from_info":       NewAirportFromInfo,
		"from_details":    NewAirportFromDetails,
	}

	for _, testCase := range cases {
		source := pythonSource(t, filepath.Join("entities", testCase.file))

		for _, name := range publicMethods(t, source) {
			if constructor, isFactory := constructors[name]; isFactory {
				if constructor == nil {
					t.Errorf("%s.%s has no constructor in this port", testCase.file, name)
				}
				continue
			}
			if _, ok := testCase.goType.MethodByName(pascalCase(name)); !ok {
				t.Errorf("%s.%s has no %s.%s in this port",
					testCase.file, name, testCase.goType, pascalCase(name))
			}
		}
	}
}

func TestAllCountriesHandsBackACopy(t *testing.T) {
	countries := AllCountries()

	if len(countries) == 0 {
		t.Fatal("no countries returned")
	}

	first := countries[0]
	countries[0] = "mutated"

	if AllCountries()[0] != first {
		t.Error("mutating the result must not touch the package's own data")
	}
}
