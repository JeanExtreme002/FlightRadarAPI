package flightradarapi

import (
	"fmt"
	"maps"
	"net/url"
)

// Base URLs of the FlightRadar24 services this package talks to.
const (
	apiFlightRadarBaseURL = "https://api.flightradar24.com/common/v1"
	cdnFlightRadarBaseURL = "https://cdn.flightradar24.com"
	flightRadarBaseURL    = "https://www.flightradar24.com"
	dataLiveBaseURL       = "https://data-live.flightradar24.com"
	dataCloudBaseURL      = "https://data-cloud.flightradar24.com"
)

// endpoints holds every URL the client requests. Grouped in a struct so tests
// can point the whole surface at a local server.
type endpoints struct {
	userLogin  string
	userLogout string

	searchData string

	realTimeFlightTrackerData string
	flightData                string

	historicalData string

	apiAirportData    string
	airportData       string
	airportsJSON      string
	airportDisruption string

	airlinesData string

	volcanicEruptionData string
	mostTracked          string
	bookmarks            string

	countryFlag            string
	airlineLogo            string
	alternativeAirlineLogo string
}

func defaultEndpoints() endpoints {
	return endpoints{
		userLogin:  flightRadarBaseURL + "/user/login",
		userLogout: flightRadarBaseURL + "/user/logout",

		searchData: flightRadarBaseURL + "/v1/search/web/find?query=%s&limit=%d",

		realTimeFlightTrackerData: dataCloudBaseURL + "/zones/fcgi/feed.js",
		flightData:                dataLiveBaseURL + "/clickhandler/?flight=%s",

		historicalData: flightRadarBaseURL + "/download/?flight=%s&file=%s&trailLimit=0&history=%d",

		apiAirportData:    apiFlightRadarBaseURL + "/airport.json",
		airportData:       flightRadarBaseURL + "/airports/traffic-stats/?airport=%s",
		airportsJSON:      flightRadarBaseURL + "/_json/airports.php",
		airportDisruption: flightRadarBaseURL + "/webapi/v1/airport-disruptions",

		airlinesData: flightRadarBaseURL + "/data/airlines",

		volcanicEruptionData: flightRadarBaseURL + "/weather/volcanic",
		mostTracked:          flightRadarBaseURL + "/flights/most-tracked",
		bookmarks:            flightRadarBaseURL + "/webapi/v1/bookmarks",

		countryFlag:            flightRadarBaseURL + "/static/images/data/flags-small/%s.svg",
		airlineLogo:            cdnFlightRadarBaseURL + "/assets/airlines/logotypes/%s_%s.png",
		alternativeAirlineLogo: flightRadarBaseURL + "/static/images/data/operators/%s_logo0.png",
	}
}

func (e endpoints) searchDataURL(query string, limit int) string {
	return fmt.Sprintf(e.searchData, url.QueryEscape(query), limit)
}

// Every caller-supplied value is escaped for the position it lands in: an
// airport code or flight ID carrying "&" would otherwise cut the query short and
// FR24 would answer about something else entirely.
func (e endpoints) flightDataURL(flightID string) string {
	return fmt.Sprintf(e.flightData, url.QueryEscape(flightID))
}

func (e endpoints) historicalDataURL(flightID, fileType string, timestamp int64) string {
	return fmt.Sprintf(e.historicalData, url.QueryEscape(flightID), url.QueryEscape(fileType), timestamp)
}

func (e endpoints) airportDataURL(code string) string {
	return fmt.Sprintf(e.airportData, url.QueryEscape(code))
}

// The slug is already reduced to [a-z0-9-], so this escape is belt and braces.
func (e endpoints) countryFlagURL(slug string) string {
	return fmt.Sprintf(e.countryFlag, url.PathEscape(slug))
}

func (e endpoints) airlineLogoURL(iata, icao string) string {
	return fmt.Sprintf(e.airlineLogo, url.PathEscape(iata), url.PathEscape(icao))
}

func (e endpoints) alternativeAirlineLogoURL(icao string) string {
	return fmt.Sprintf(e.alternativeAirlineLogo, url.PathEscape(icao))
}

const chromeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" +
	" (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"

// baseHeaders are the browser-shaped headers sent on every API request.
var baseHeaders = map[string]string{
	"accept-language":    "en-US,en;q=0.9",
	"cache-control":      "max-age=0",
	"origin":             flightRadarBaseURL,
	"referer":            flightRadarBaseURL + "/",
	"sec-ch-ua":          `"Google Chrome";v="136", "Chromium";v="136", "Not-A.Brand";v="24"`,
	"sec-ch-ua-mobile":   "?0",
	"sec-ch-ua-platform": `"Windows"`,
	"sec-fetch-dest":     "empty",
	"sec-fetch-mode":     "cors",
	"sec-fetch-site":     "same-site",
	"user-agent":         chromeUserAgent,
}

// jsonHeaders, imageHeaders and htmlHeaders mirror what Chrome sends for each
// kind of resource.
var (
	jsonHeaders  = withHeaders(baseHeaders, map[string]string{"accept": "application/json"})
	imageHeaders = withHeaders(baseHeaders, map[string]string{
		"accept": "image/gif, image/jpg, image/jpeg, image/png",
	})
	htmlHeaders = map[string]string{
		"accept": "text/html,application/xhtml+xml,application/xml;q=0.9," +
			"image/avif,image/webp,image/apng,*/*;q=0.8," +
			"application/signed-exchange;v=b3;q=0.7",
		"accept-language":           "en-US,en;q=0.9",
		"cache-control":             "max-age=0",
		"referer":                   flightRadarBaseURL + "/",
		"sec-ch-ua":                 `"Google Chrome";v="136", "Chromium";v="136", "Not-A.Brand";v="24"`,
		"sec-ch-ua-mobile":          "?0",
		"sec-ch-ua-platform":        `"Windows"`,
		"sec-fetch-dest":            "document",
		"sec-fetch-mode":            "navigate",
		"sec-fetch-site":            "same-origin",
		"sec-fetch-user":            "?1",
		"upgrade-insecure-requests": "1",
		"user-agent":                chromeUserAgent,
	}
)

// withHeaders returns base merged with extra, leaving both untouched.
func withHeaders(base, extra map[string]string) map[string]string {
	merged := make(map[string]string, len(base)+len(extra))
	maps.Copy(merged, base)
	maps.Copy(merged, extra)
	return merged
}
