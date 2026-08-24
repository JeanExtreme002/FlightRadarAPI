package flightradarapi

import (
	"fmt"
	"reflect"
	"strings"
	"sync"
	"unicode"
)

// Indices of the live feed's flight array. 7 and 17 are unused.
const (
	fieldICAO24Bit = iota
	fieldLatitude
	fieldLongitude
	fieldHeading
	fieldAltitude
	fieldGroundSpeed
	fieldSquawk
	_
	fieldAircraftCode
	fieldRegistration
	fieldTime
	fieldOriginIATA
	fieldDestinationIATA
	fieldFlightNumber
	fieldOnGround
	fieldVerticalSpeed
	fieldCallsign
	_
	fieldAirlineICAO
)

// Flight is a flight from the Real Time Flight Tracker. Details holds the extra
// information [Client.GetFlightDetails] returns, once SetFlightDetails is called.
type Flight struct {
	Entity

	ID        string
	ICAO24Bit string
	// Heading, Altitude, GroundSpeed and VerticalSpeed are nil when the feed
	// sent no value.
	Heading                *float64
	Altitude               *float64
	GroundSpeed            *float64
	Squawk                 string
	AircraftCode           string
	Registration           string
	Time                   *int64
	OriginAirportIATA      string
	DestinationAirportIATA string
	Number                 string
	AirlineIATA            string
	// OnGround is 1 while the aircraft is on the ground.
	OnGround      *float64
	VerticalSpeed *float64
	Callsign      string
	AirlineICAO   string

	Details *FlightDetails
}

// FlightDetails is the extra information carried by a flight details payload.
type FlightDetails struct {
	AircraftAge       string
	AircraftCountryID *float64
	AircraftHistory   []any
	AircraftImages    any
	AircraftModel     string

	AirlineName      string
	AirlineShortName string

	DestinationAirportAltitude            *float64
	DestinationAirportCountryCode         string
	DestinationAirportCountryName         string
	DestinationAirportLatitude            *float64
	DestinationAirportLongitude           *float64
	DestinationAirportICAO                string
	DestinationAirportBaggage             string
	DestinationAirportGate                string
	DestinationAirportName                string
	DestinationAirportTerminal            string
	DestinationAirportVisible             *bool
	DestinationAirportWebsite             string
	DestinationAirportTimezoneAbbr        string
	DestinationAirportTimezoneAbbrName    string
	DestinationAirportTimezoneName        string
	DestinationAirportTimezoneOffset      *float64
	DestinationAirportTimezoneOffsetHours string

	OriginAirportAltitude            *float64
	OriginAirportCountryCode         string
	OriginAirportCountryName         string
	OriginAirportLatitude            *float64
	OriginAirportLongitude           *float64
	OriginAirportICAO                string
	OriginAirportBaggage             string
	OriginAirportGate                string
	OriginAirportName                string
	OriginAirportTerminal            string
	OriginAirportVisible             *bool
	OriginAirportWebsite             string
	OriginAirportTimezoneAbbr        string
	OriginAirportTimezoneAbbrName    string
	OriginAirportTimezoneName        string
	OriginAirportTimezoneOffset      *float64
	OriginAirportTimezoneOffsetHours string

	StatusIcon string
	StatusText string

	TimeDetails map[string]any
	Trail       []any

	// Raw is the payload these fields came from.
	Raw map[string]any
}

// NewFlight builds a flight from one entry of the live feed, the counterpart of
// the Flight(flight_id, info) constructor in the Python and Node.js ports.
func NewFlight(flightID string, info []any) *Flight {
	return newFlight(flightID, info)
}

// newFlight builds a flight from one entry of the live feed.
func newFlight(flightID string, info []any) *Flight {
	at := func(index int) any {
		if index < len(info) {
			return info[index]
		}
		return nil
	}
	text := func(index int) string {
		if value, ok := at(index).(string); ok && value != DefaultText {
			return value
		}
		return ""
	}
	number := func(index int) *float64 {
		if value := at(index); !missing(value) {
			return toNumber(value)
		}
		return nil
	}

	flight := &Flight{
		ID:                     flightID,
		ICAO24Bit:              text(fieldICAO24Bit),
		Heading:                number(fieldHeading),
		Altitude:               number(fieldAltitude),
		GroundSpeed:            number(fieldGroundSpeed),
		Squawk:                 text(fieldSquawk),
		AircraftCode:           text(fieldAircraftCode),
		Registration:           text(fieldRegistration),
		OriginAirportIATA:      text(fieldOriginIATA),
		DestinationAirportIATA: text(fieldDestinationIATA),
		Number:                 text(fieldFlightNumber),
		OnGround:               number(fieldOnGround),
		VerticalSpeed:          number(fieldVerticalSpeed),
		Callsign:               text(fieldCallsign),
		AirlineICAO:            text(fieldAirlineICAO),
	}

	if timestamp := number(fieldTime); timestamp != nil {
		seconds := int64(*timestamp)
		flight.Time = &seconds
	}
	if len(flight.Number) >= 2 {
		flight.AirlineIATA = flight.Number[:2]
	}
	flight.setPosition(number(fieldLatitude), number(fieldLongitude))

	return flight
}

func (f *Flight) String() string {
	return fmt.Sprintf("<(%s) %s - Altitude: %s - Ground Speed: %s - Heading: %s>",
		f.AircraftCode, f.Registration, formatOptional(f.Altitude),
		formatOptional(f.GroundSpeed), formatOptional(f.Heading))
}

// GetAltitude returns the formatted altitude, with its unit.
func (f *Flight) GetAltitude() string {
	if f.Altitude == nil {
		return DefaultText
	}
	return formatNumber(*f.Altitude) + " ft"
}

// GetFlightLevel returns the formatted flight level, with its unit.
func (f *Flight) GetFlightLevel() string {
	if f.Altitude == nil {
		return DefaultText
	}
	if *f.Altitude >= 10000 {
		return formatNumber(*f.Altitude)[:3] + " FL"
	}
	return f.GetAltitude()
}

// GetGroundSpeed returns the formatted ground speed, with its unit.
func (f *Flight) GetGroundSpeed() string {
	if f.GroundSpeed == nil {
		return DefaultText
	}
	unit := " kt"

	if *f.GroundSpeed > 1 {
		unit = " kts"
	}
	return formatNumber(*f.GroundSpeed) + unit
}

// GetHeading returns the formatted heading, with its unit.
func (f *Flight) GetHeading() string {
	if f.Heading == nil {
		return DefaultText
	}
	return formatNumber(*f.Heading) + "°"
}

// GetVerticalSpeed returns the formatted vertical speed, with its unit.
func (f *Flight) GetVerticalSpeed() string {
	if f.VerticalSpeed == nil {
		return DefaultText
	}
	return formatNumber(*f.VerticalSpeed) + " fpm"
}

// detailFieldsByName maps the snake_case names the other ports expose to the
// FlightDetails fields holding them, so a criterion written against Python's
// attributes keeps working here. Built once: the shape never changes.
var detailFieldsByName = sync.OnceValue(func() map[string]int {
	byName := make(map[string]int)
	structType := reflect.TypeFor[FlightDetails]()

	for index := range structType.NumField() {
		name := structType.Field(index).Name

		// Raw has no counterpart in the other ports.
		if name == "Raw" {
			continue
		}
		byName[snakeCase(name)] = index
	}
	return byName
})

// snakeCase renders a Go field name the way the other ports spell it, keeping
// acronyms in one piece: DestinationAirportICAO is destination_airport_icao.
func snakeCase(name string) string {
	var out strings.Builder
	runes := []rune(name)

	for index, char := range runes {
		if !unicode.IsUpper(char) {
			out.WriteRune(char)
			continue
		}

		followsLower := index > 0 && !unicode.IsUpper(runes[index-1])
		startsWord := index+1 < len(runes) && !unicode.IsUpper(runes[index+1])

		if index > 0 && (followsLower || startsWord) {
			out.WriteByte('_')
		}
		out.WriteRune(unicode.ToLower(char))
	}
	return out.String()
}

// fields exposes the flight's values under the names the other ports use, so
// CheckInfo criteria read the same in every language. The detail values join in
// once SetFlightDetails has run, which is when Python's own __dict__ carries
// them.
func (f *Flight) fields() map[string]any {
	value := func(number *float64) any {
		if number == nil {
			return nil
		}
		return *number
	}
	timestamp := any(nil)

	if f.Time != nil {
		timestamp = float64(*f.Time)
	}

	fields := map[string]any{
		"id":                       f.ID,
		"icao_24bit":               f.ICAO24Bit,
		"latitude":                 value(f.Latitude),
		"longitude":                value(f.Longitude),
		"heading":                  value(f.Heading),
		"altitude":                 value(f.Altitude),
		"ground_speed":             value(f.GroundSpeed),
		"squawk":                   f.Squawk,
		"aircraft_code":            f.AircraftCode,
		"registration":             f.Registration,
		"time":                     timestamp,
		"origin_airport_iata":      f.OriginAirportIATA,
		"destination_airport_iata": f.DestinationAirportIATA,
		"number":                   f.Number,
		"airline_iata":             f.AirlineIATA,
		"on_ground":                value(f.OnGround),
		"vertical_speed":           value(f.VerticalSpeed),
		"callsign":                 f.Callsign,
		"airline_icao":             f.AirlineICAO,
	}

	if f.Details != nil {
		details := reflect.ValueOf(*f.Details)

		for name, index := range detailFieldsByName() {
			fields[name] = detailValue(details.Field(index))
		}
	}
	return fields
}

// detailValue unwraps an optional detail so a numeric comparison can read it.
func detailValue(field reflect.Value) any {
	if field.Kind() != reflect.Pointer {
		return field.Interface()
	}
	if field.IsNil() {
		return nil
	}
	return field.Elem().Interface()
}

// CheckInfo checks one or more flight values. A key may carry a "min_" or
// "max_" prefix to compare numerically instead of for equality:
//
//	flight.CheckInfo(map[string]any{"min_altitude": 6700, "airline_icao": "THY"})
//
// Detail names such as "airline_name" work once SetFlightDetails has run. A name
// that exists nowhere is an error, where the Python and Node.js ports ignore it
// and report a match the caller never asked for.
func (f *Flight) CheckInfo(criteria map[string]any) (bool, error) {
	fields := f.fields()

	for key, wanted := range criteria {
		name, prefix := key, ""

		if strings.HasPrefix(key, "min_") || strings.HasPrefix(key, "max_") {
			name, prefix = key[4:], key[:3]
		}

		actual, known := fields[name]

		if !known {
			return false, fmt.Errorf("%w: unknown flight field %q", ErrFlightRadar, key)
		}

		if prefix == "" {
			if !equalValues(wanted, actual) {
				return false, nil
			}
			continue
		}

		wantedNumber, actualNumber := toNumber(wanted), toNumber(actual)

		if wantedNumber == nil {
			return false, fmt.Errorf("%w: %q needs a numeric value, got %v", ErrFlightRadar, key, wanted)
		}
		if actualNumber == nil {
			return false, nil
		}
		if prefix == "min" && *actualNumber < *wantedNumber {
			return false, nil
		}
		if prefix == "max" && *actualNumber > *wantedNumber {
			return false, nil
		}
	}
	return true, nil
}

// equalValues compares a criterion with a flight value, treating every numeric
// type as one — but only real numbers. Text that merely looks numeric is
// compared as text, so a squawk of "0417" does not match "417", the way it does
// not in the Python and Node.js ports either.
func equalValues(wanted, actual any) bool {
	if wanted == nil || actual == nil {
		return wanted == nil && actual == nil
	}

	wantedNumber, wantedIsNumber := plainNumber(wanted)
	actualNumber, actualIsNumber := plainNumber(actual)

	if wantedIsNumber && actualIsNumber {
		return wantedNumber == actualNumber
	}

	// DeepEqual, not ==: a detail value can be a slice or a map, which == would
	// panic on rather than report unequal.
	return reflect.DeepEqual(wanted, actual)
}

// plainNumber reads a numeric value, refusing the numeric-looking string that
// the min_/max_ comparisons do accept.
func plainNumber(value any) (float64, bool) {
	if _, isText := value.(string); isText {
		return 0, false
	}

	number := toNumber(value)

	if number == nil {
		return 0, false
	}
	return *number, true
}

// SetFlightDetails fills Details in from a [Client.GetFlightDetails] payload.
func (f *Flight) SetFlightDetails(flightDetails map[string]any) {
	aircraft := getMap(flightDetails, "aircraft")
	airline := getMap(flightDetails, "airline")
	airport := getMap(flightDetails, "airport")

	destination := getMap(airport, "destination")
	destinationCode := getMap(destination, "code")
	destinationInfo := getMap(destination, "info")
	destinationPosition := getMap(destination, "position")
	destinationCountry := getMap(destinationPosition, "country")
	destinationTimezone := getMap(destination, "timezone")

	origin := getMap(airport, "origin")
	originCode := getMap(origin, "code")
	originInfo := getMap(origin, "info")
	originPosition := getMap(origin, "position")
	originCountry := getMap(originPosition, "country")
	originTimezone := getMap(origin, "timezone")

	history := getMap(flightDetails, "flightHistory")
	status := getMap(flightDetails, "status")

	f.Details = &FlightDetails{
		AircraftAge:       getString(aircraft, "age"),
		AircraftCountryID: getNumber(aircraft, "countryId"),
		AircraftHistory:   getSlice(history, "aircraft"),
		AircraftImages:    aircraft["images"],
		AircraftModel:     getString(getMap(aircraft, "model"), "text"),

		AirlineName:      getString(airline, "name"),
		AirlineShortName: getString(airline, "short"),

		DestinationAirportAltitude:            getNumber(destinationPosition, "altitude"),
		DestinationAirportCountryCode:         getString(destinationCountry, "code"),
		DestinationAirportCountryName:         getString(destinationCountry, "name"),
		DestinationAirportLatitude:            getNumber(destinationPosition, "latitude"),
		DestinationAirportLongitude:           getNumber(destinationPosition, "longitude"),
		DestinationAirportICAO:                getString(destinationCode, "icao"),
		DestinationAirportBaggage:             getString(destinationInfo, "baggage"),
		DestinationAirportGate:                getString(destinationInfo, "gate"),
		DestinationAirportName:                getString(destination, "name"),
		DestinationAirportTerminal:            getString(destinationInfo, "terminal"),
		DestinationAirportVisible:             getBool(destination, "visible"),
		DestinationAirportWebsite:             getString(destination, "website"),
		DestinationAirportTimezoneAbbr:        getString(destinationTimezone, "abbr"),
		DestinationAirportTimezoneAbbrName:    getString(destinationTimezone, "abbrName"),
		DestinationAirportTimezoneName:        getString(destinationTimezone, "name"),
		DestinationAirportTimezoneOffset:      getNumber(destinationTimezone, "offset"),
		DestinationAirportTimezoneOffsetHours: getString(destinationTimezone, "offsetHours"),

		OriginAirportAltitude:            getNumber(originPosition, "altitude"),
		OriginAirportCountryCode:         getString(originCountry, "code"),
		OriginAirportCountryName:         getString(originCountry, "name"),
		OriginAirportLatitude:            getNumber(originPosition, "latitude"),
		OriginAirportLongitude:           getNumber(originPosition, "longitude"),
		OriginAirportICAO:                getString(originCode, "icao"),
		OriginAirportBaggage:             getString(originInfo, "baggage"),
		OriginAirportGate:                getString(originInfo, "gate"),
		OriginAirportName:                getString(origin, "name"),
		OriginAirportTerminal:            getString(originInfo, "terminal"),
		OriginAirportVisible:             getBool(origin, "visible"),
		OriginAirportWebsite:             getString(origin, "website"),
		OriginAirportTimezoneAbbr:        getString(originTimezone, "abbr"),
		OriginAirportTimezoneAbbrName:    getString(originTimezone, "abbrName"),
		OriginAirportTimezoneName:        getString(originTimezone, "name"),
		OriginAirportTimezoneOffset:      getNumber(originTimezone, "offset"),
		OriginAirportTimezoneOffsetHours: getString(originTimezone, "offsetHours"),

		StatusIcon: getString(status, "icon"),
		StatusText: getString(status, "text"),

		TimeDetails: getMap(flightDetails, "time"),
		Trail:       getSlice(flightDetails, "trail"),

		Raw: flightDetails,
	}
}
