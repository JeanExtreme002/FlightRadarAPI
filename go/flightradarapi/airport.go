package flightradarapi

import "fmt"

// basicAirportInfo is one row of the airports feed.
type basicAirportInfo struct {
	Name      string
	ICAO      string
	IATA      string
	Latitude  *float64
	Longitude *float64
	Altitude  *float64
	Country   string
}

// Airport is an airport, with whatever detail the call that produced it carried.
// Fields past Country are filled in by [Client.GetAirport] with details, or by
// SetAirportDetails.
type Airport struct {
	Entity

	Name     string
	ICAO     string
	IATA     string
	Altitude *float64
	Country  string

	CountryCode string
	CountryID   *float64
	City        string

	TimezoneName        string
	TimezoneOffset      *float64
	TimezoneOffsetHours string
	TimezoneAbbr        string
	TimezoneAbbrName    string

	Visible   *bool
	Website   string
	Wikipedia string

	ReviewsURL    string
	Reviews       *float64
	Evaluation    *float64
	AverageRating *float64
	TotalRating   *float64

	Weather map[string]any
	Runways []any

	AircraftOnGround        *float64
	AircraftVisibleOnGround *float64

	Arrivals   map[string]any
	Departures map[string]any
	Images     map[string]any

	// RawDetails is the payload the details came from, for fields this struct
	// does not name.
	RawDetails map[string]any
}

// NewAirport returns an empty airport, to be filled in with SetAirportDetails.
func NewAirport() *Airport { return &Airport{} }

// NewAirportFromBasicInfo builds an airport from one row of the airports feed,
// the counterpart of Airport.from_basic_info in the Python and Node.js ports.
// A row with only one usable coordinate carries no position at all.
func NewAirportFromBasicInfo(basicInfo map[string]any) *Airport {
	latitude, longitude := toNumber(basicInfo["lat"]), toNumber(basicInfo["lon"])

	if latitude == nil || longitude == nil {
		latitude, longitude = nil, nil
	}

	return newAirportFromBasicInfo(basicAirportInfo{
		Name:      toText(basicInfo["name"]),
		ICAO:      toText(basicInfo["icao"]),
		IATA:      toText(basicInfo["iata"]),
		Latitude:  latitude,
		Longitude: longitude,
		Altitude:  toNumber(basicInfo["alt"]),
		Country:   toText(basicInfo["country"]),
	})
}

// NewAirportFromInfo builds an airport from the traffic-stats "details" block,
// the counterpart of Airport.from_info.
func NewAirportFromInfo(info map[string]any) *Airport {
	return newAirportFromInfo(info)
}

// NewAirportFromDetails builds an airport from a full [Client.GetAirportDetails]
// payload, the counterpart of Airport.from_details.
func NewAirportFromDetails(airportDetails map[string]any) *Airport {
	airport := NewAirport()
	airport.SetAirportDetails(airportDetails)
	return airport
}

func newAirportFromBasicInfo(info basicAirportInfo) *Airport {
	airport := &Airport{
		Name:     info.Name,
		ICAO:     info.ICAO,
		IATA:     info.IATA,
		Altitude: info.Altitude,
		Country:  info.Country,
	}
	airport.setPosition(info.Latitude, info.Longitude)
	return airport
}

// newAirportFromInfo builds an airport from the traffic-stats "details" block.
func newAirportFromInfo(info map[string]any) *Airport {
	position := getMap(info, "position")
	code := getMap(info, "code")
	country := getMap(position, "country")
	region := getMap(position, "region")
	timezone := getMap(info, "timezone")

	airport := &Airport{
		Name:     getString(info, "name"),
		ICAO:     getString(code, "icao"),
		IATA:     getString(code, "iata"),
		Altitude: getNumber(position, "altitude"),

		Country:     getString(country, "name"),
		CountryCode: getString(country, "code"),
		City:        getString(region, "city"),

		TimezoneName:        getString(timezone, "name"),
		TimezoneOffset:      getNumber(timezone, "offset"),
		TimezoneOffsetHours: getString(timezone, "offsetHours"),
		TimezoneAbbr:        getString(timezone, "abbr"),
		TimezoneAbbrName:    getString(timezone, "abbrName"),

		Visible: getBool(info, "visible"),
		Website: getString(info, "website"),

		RawDetails: info,
	}
	airport.setPosition(getNumber(position, "latitude"), getNumber(position, "longitude"))
	return airport
}

func (a *Airport) String() string {
	return fmt.Sprintf("<(%s) %s - Altitude: %s - Latitude: %s - Longitude: %s>",
		a.ICAO, a.Name, formatOptional(a.Altitude), formatOptional(a.Latitude),
		formatOptional(a.Longitude))
}

// SetAirportDetails fills the airport in from a [Client.GetAirportDetails]
// payload.
func (a *Airport) SetAirportDetails(airportDetails map[string]any) {
	airport := getMap(getMap(airportDetails, "airport"), "pluginData")
	details := getMap(airport, "details")

	position := getMap(details, "position")
	code := getMap(details, "code")
	country := getMap(position, "country")
	region := getMap(position, "region")

	flightDiary := getMap(airport, "flightdiary")
	ratings := getMap(flightDiary, "ratings")
	schedule := getMap(airport, "schedule")
	timezone := getMap(details, "timezone")
	aircraftOnGround := getMap(getMap(airport, "aircraftCount"), "onGround")
	urls := getMap(details, "url")

	a.RawDetails = airportDetails

	a.Name = getString(details, "name")
	a.IATA = getString(code, "iata")
	a.ICAO = getString(code, "icao")
	a.Altitude = getNumber(position, "elevation")
	a.setPosition(getNumber(position, "latitude"), getNumber(position, "longitude"))

	a.Country = getString(country, "name")
	a.CountryCode = getString(country, "code")
	a.CountryID = getNumber(country, "id")
	a.City = getString(region, "city")

	a.TimezoneAbbr = getString(timezone, "abbr")
	a.TimezoneAbbrName = getString(timezone, "abbrName")
	a.TimezoneName = getString(timezone, "name")
	a.TimezoneOffset = getNumber(timezone, "offset")
	a.TimezoneOffsetHours = ""

	if a.TimezoneOffset != nil {
		a.TimezoneOffsetHours = fmt.Sprintf("%d:00", int(*a.TimezoneOffset)/60/60)
	}

	a.ReviewsURL = ""

	if path := getString(flightDiary, "url"); path != "" {
		a.ReviewsURL = flightRadarBaseURL + path
	}

	a.Reviews = getNumber(flightDiary, "reviews")
	a.Evaluation = getNumber(flightDiary, "evaluation")
	a.AverageRating = getNumber(ratings, "avg")
	a.TotalRating = getNumber(ratings, "total")

	a.Weather = getMap(airport, "weather")
	a.Runways = getSlice(airport, "runways")

	a.AircraftOnGround = getNumber(aircraftOnGround, "total")
	a.AircraftVisibleOnGround = getNumber(aircraftOnGround, "visible")

	a.Arrivals = getMap(schedule, "arrivals")
	a.Departures = getMap(schedule, "departures")

	a.Website = getString(urls, "homepage")
	a.Wikipedia = getString(urls, "wikipedia")

	a.Visible = getBool(details, "visible")
	a.Images = getMap(details, "airportImages")
}

// formatOptional renders a number, or DefaultText when there is none.
func formatOptional(value *float64) string {
	if value == nil {
		return DefaultText
	}
	return formatNumber(*value)
}
