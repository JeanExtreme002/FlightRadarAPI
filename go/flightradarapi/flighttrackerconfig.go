package flightradarapi

import (
	"fmt"
	"net/url"
)

// FlightTrackerConfig holds the settings of the Real Time Flight Tracker, used
// by [Client.GetFlights]. Every value is the string FR24 expects in the query.
type FlightTrackerConfig struct {
	FAA       string `json:"faa"`
	Satellite string `json:"satellite"`
	MLAT      string `json:"mlat"`
	FLARM     string `json:"flarm"`
	ADSB      string `json:"adsb"`
	GND       string `json:"gnd"`
	Air       string `json:"air"`
	Vehicles  string `json:"vehicles"`
	Estimated string `json:"estimated"`
	MaxAge    string `json:"maxage"`
	Gliders   string `json:"gliders"`
	Stats     string `json:"stats"`
	Limit     string `json:"limit"`
}

// NewFlightTrackerConfig returns the config FR24's own web player sends.
func NewFlightTrackerConfig() FlightTrackerConfig {
	return FlightTrackerConfig{
		FAA:       "1",
		Satellite: "1",
		MLAT:      "1",
		FLARM:     "1",
		ADSB:      "1",
		GND:       "1",
		Air:       "1",
		Vehicles:  "1",
		Estimated: "1",
		MaxAge:    "14400",
		Gliders:   "1",
		Stats:     "1",
		Limit:     "5000",
	}
}

// fields maps each FR24 query name to the field holding it, so validation and
// query building never drift apart.
func (c *FlightTrackerConfig) fields() map[string]*string {
	return map[string]*string{
		"faa":       &c.FAA,
		"satellite": &c.Satellite,
		"mlat":      &c.MLAT,
		"flarm":     &c.FLARM,
		"adsb":      &c.ADSB,
		"gnd":       &c.GND,
		"air":       &c.Air,
		"vehicles":  &c.Vehicles,
		"estimated": &c.Estimated,
		"maxage":    &c.MaxAge,
		"gliders":   &c.Gliders,
		"stats":     &c.Stats,
		"limit":     &c.Limit,
	}
}

// Values renders the config as the query FR24's feed expects.
func (c FlightTrackerConfig) Values() url.Values {
	values := url.Values{}
	for name, field := range c.fields() {
		values.Set(name, *field)
	}
	return values
}

// fillDefaults replaces the fields a struct literal left empty. Go's zero value
// is the empty string where the Python dataclass carries a default, so
// FlightTrackerConfig{Limit: "10"} means the same there as here.
func (c *FlightTrackerConfig) fillDefaults() {
	defaults := NewFlightTrackerConfig()
	fields, defaulted := c.fields(), defaults.fields()

	for name, field := range fields {
		if *field == "" {
			*field = *defaulted[name]
		}
	}
}

// validate refuses a value the feed cannot read, wherever it came from: the
// same empty string is rejected through the values map.
func (c *FlightTrackerConfig) validate() error {
	for name, field := range c.fields() {
		if !isDecimal(*field) {
			return fmt.Errorf("%w: value must be a number, got %q for key %q", ErrFlightRadar, *field, name)
		}
	}
	return nil
}

// update applies name/value pairs, rejecting unknown options and
// non-numeric values the way the feed does.
func (c *FlightTrackerConfig) update(values map[string]string) error {
	fields := c.fields()

	for name, value := range values {
		field, ok := fields[name]

		if !ok {
			return fmt.Errorf("%w: unknown option %q", ErrFlightRadar, name)
		}
		if !isDecimal(value) {
			return fmt.Errorf("%w: value must be a number, got %q for key %q", ErrFlightRadar, value, name)
		}
		*field = value
	}
	return nil
}

// isDecimal reports whether text is a non-empty run of ASCII digits.
func isDecimal(text string) bool {
	if text == "" {
		return false
	}
	for _, char := range text {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}
