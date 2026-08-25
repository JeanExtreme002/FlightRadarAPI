package flightradarapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Some FR24 live-feed backends answer 200 with a well-formed envelope but no
// flight entries, indistinguishable from a legitimately empty result. The
// AWSALB cookie then pins the session to that backend, so dropping it is what
// makes the load balancer re-roll on retry.
var feedStickyCookies = []string{"AWSALB", "AWSALBCORS"}

const feedEmptyRetries = 4

// Defaults the other ports declare in their signatures, which Go cannot.
const (
	defaultFlightLimit = 100
	defaultSearchLimit = 50
)

// Client is the main entry point of the package, the counterpart of the
// FlightRadar24API class in the Python and Node.js SDKs. Build one with [New].
type Client struct {
	client              *apiClient
	endpoints           endpoints
	flightTrackerConfig FlightTrackerConfig

	mu        sync.Mutex
	loginData map[string]any

	// Timeout bounds a single request, and MaxWorkers the concurrent detail
	// requests GetFlights makes. Set them through [New], or directly before the
	// first call: they are read from the worker goroutines GetFlights spawns, so
	// changing one while a request is in flight is a data race.
	Timeout    time.Duration
	MaxWorkers int
}

// Options configures a [Client]. Every field's zero value means the default, so
// Options{MaxWorkers: 4} changes only that one.
type Options struct {
	// Timeout bounds a single request. Zero or less means [DefaultTimeout]; for
	// a deadline of your own, cancel the context you pass to the call.
	Timeout time.Duration

	// MaxWorkers bounds the concurrent detail requests [Client.GetFlights]
	// makes. Zero or less means 8.
	MaxWorkers int

	// Retry retries transient failures, including Cloudflare blocks. Nil means
	// no retry. Build one with [NewRetryPolicy], which reports an unusable
	// policy the way the Python and Node.js ports do.
	Retry *RetryPolicy

	// TLSProfile overrides the TLS handshake the client presents. Use it when
	// FR24 updates its Cloudflare bot mitigation faster than this library
	// releases. Nil means [Chrome136Profile].
	TLSProfile *TLSProfile

	// HTTPClient replaces the whole HTTP client, which is how a real TLS
	// impersonation library (utls, tls-client) is plugged in. Set
	// Transport.DisableCompression so this package owns content decoding and its
	// size budget stays enforceable. Leave CheckRedirect unset, or the cookies
	// FR24 hands out on a redirect hop are not banked. Any Jar is ignored: this
	// package renders the Cookie header itself.
	HTTPClient *http.Client

	// endpoints points the client at another host, for tests.
	endpoints *endpoints
}

const defaultMaxWorkers = 8

// New returns a client, taking at most one [Options]; anything past the first is
// ignored. Call [Client.Login] for the endpoints that need an account.
//
// Construction cannot fail, so there is no error to handle: an unusable value
// falls back to the documented default.
func New(options ...Options) *Client {
	config := Options{}

	if len(options) > 0 {
		config = options[0]
	}

	if config.Timeout <= 0 {
		config.Timeout = DefaultTimeout
	}
	if config.MaxWorkers <= 0 {
		config.MaxWorkers = defaultMaxWorkers
	}

	httpClient := config.HTTPClient

	if httpClient == nil {
		profile := Chrome136Profile()

		if config.TLSProfile != nil {
			profile = *config.TLSProfile
		}
		httpClient = newHTTPClient(profile)
	}

	resolved := defaultEndpoints()

	if config.endpoints != nil {
		resolved = *config.endpoints
	}

	return &Client{
		client:              newAPIClient(httpClient, config.Retry),
		endpoints:           resolved,
		flightTrackerConfig: NewFlightTrackerConfig(),
		Timeout:             config.Timeout,
		MaxWorkers:          config.MaxWorkers,
	}
}

// Image is a downloaded asset and the extension of the URL it came from.
type Image struct {
	Data      []byte
	Extension string
}

// GetAirlines returns every airline.
func (c *Client) GetAirlines(ctx context.Context) ([]Airline, error) {
	response, err := c.client.request(ctx, c.endpoints.airlinesData, requestOptions{
		headers: htmlHeaders,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}
	return parseAirlinesHTML(response.Body), nil
}

// GetAirlineLogo downloads the logo of an airline, or returns nil when FR24 has
// none.
func (c *Client) GetAirlineLogo(ctx context.Context, iata, icao string) (*Image, error) {
	iata, icao = strings.ToUpper(iata), strings.ToUpper(icao)
	notFound := []int{403, 404}

	for _, logoURL := range []string{
		c.endpoints.airlineLogoURL(iata, icao),
		c.endpoints.alternativeAirlineLogoURL(icao),
	} {
		response, err := c.client.request(ctx, logoURL, requestOptions{
			headers:           imageHeaders,
			allowedErrorCodes: notFound,
			timeout:           c.Timeout,
		})

		if err != nil {
			return nil, err
		}
		if response.StatusCode < 400 || response.StatusCode >= 500 {
			return &Image{Data: response.Body, Extension: extensionOf(logoURL)}, nil
		}
	}
	return nil, nil
}

// GetAirport returns basic information about an airport. With details, it makes
// the extra call [Client.GetAirportDetails] does.
func (c *Client) GetAirport(ctx context.Context, code string, details bool) (*Airport, error) {
	if len(code) < 3 || len(code) > 4 {
		return nil, fmt.Errorf("%w: the code %q is invalid. It must be the IATA or ICAO of the airport",
			ErrFlightRadar, code)
	}

	if details {
		airportDetails, err := c.GetAirportDetails(ctx, code, defaultFlightLimit, 1)

		if err != nil {
			return nil, err
		}
		airport := NewAirport()
		airport.SetAirportDetails(airportDetails)
		return airport, nil
	}

	response, err := c.client.request(ctx, c.endpoints.airportDataURL(code), requestOptions{
		headers: jsonHeaders,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}

	content, err := response.JSON()

	if err != nil {
		return nil, err
	}

	info, ok := content["details"].(map[string]any)

	if !ok || len(info) == 0 {
		return nil, &AirportNotFoundError{Code: code}
	}
	return newAirportFromInfo(info), nil
}

// GetAirportDetails returns the full airport payload, with up to flightLimit
// flights from the given page of results. Zero means what the Python and
// Node.js ports default to: 100 flights, first page. Any other value is sent as
// given, so FR24 rejects a nonsensical one rather than this package hiding it.
func (c *Client) GetAirportDetails(ctx context.Context, code string, flightLimit, page int) (map[string]any, error) {
	if flightLimit == 0 {
		flightLimit = defaultFlightLimit
	}
	if page == 0 {
		page = 1
	}
	if len(code) < 3 || len(code) > 4 {
		return nil, fmt.Errorf("%w: the code %q is invalid. It must be the IATA or ICAO of the airport",
			ErrFlightRadar, code)
	}

	params := url.Values{}
	params.Set("format", "json")

	if c.IsLoggedIn() {
		if token, ok := c.client.getCookie("_frPl"); ok {
			params.Set("token", token)
		}
	}

	params.Set("code", code)
	params.Set("limit", fmt.Sprint(flightLimit))
	params.Set("page", fmt.Sprint(page))

	response, err := c.client.request(ctx, c.endpoints.apiAirportData, requestOptions{
		params:            params,
		headers:           jsonHeaders,
		allowedErrorCodes: []int{400},
		timeout:           c.Timeout,
	})

	if err != nil {
		return nil, err
	}

	content, err := response.JSON()

	if err != nil {
		return nil, err
	}

	if response.StatusCode == 400 && content["errors"] != nil {
		parameters := getMap(getMap(getMap(content, "errors"), "errors"), "parameters")

		if limit := getMap(parameters, "limit"); len(limit) > 0 {
			return nil, fmt.Errorf("%w: %s", ErrFlightRadar, getString(limit, "notBetween"))
		}
		return nil, &AirportNotFoundError{Code: code, Errors: parameters}
	}

	result := getMap(getMap(content, "result"), "response")
	data := getMap(getMap(result, "airport"), "pluginData")

	if _, ok := data["details"]; !ok && len(getSlice(data, "runways")) == 0 && len(data) <= 3 {
		return nil, &AirportNotFoundError{Code: code}
	}
	return result, nil
}

// GetAirportDisruptions returns the current airport disruptions.
func (c *Client) GetAirportDisruptions(ctx context.Context) (map[string]any, error) {
	return c.jsonRequest(ctx, c.endpoints.airportDisruption)
}

// GetAirports returns every airport, or only those of the given countries. Pass
// nil for every airport; an empty non-nil slice selects none.
func (c *Client) GetAirports(ctx context.Context, countries []Country) ([]*Airport, error) {
	if countries != nil && len(countries) == 0 {
		return []*Airport{}, nil
	}

	response, err := c.client.request(ctx, c.endpoints.airportsJSON, requestOptions{
		headers: jsonHeaders,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}

	// The raw body, not JSON(): an HTML body reaches the parser's guard, and a
	// malformed JSON body still returns empty rather than failing the call.
	return parseAirportsJSON(response.Body, countries), nil
}

// GetBookmarks returns the bookmarks of the logged-in account.
func (c *Client) GetBookmarks(ctx context.Context) (map[string]any, error) {
	headers, err := c.authHeaders()

	if err != nil {
		return nil, err
	}

	response, err := c.client.request(ctx, c.endpoints.bookmarks, requestOptions{
		headers: headers,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}
	return response.JSON()
}

// GetBounds renders a zone as the "y1,y2,x1,x2" string the feed expects.
func (c *Client) GetBounds(zone Zone) string {
	return fmt.Sprintf("%v,%v,%v,%v", zone.TLY, zone.BRY, zone.TLX, zone.BRX)
}

// GetBoundsByPoint renders the square of the given radius (in meters) around a
// point as the "y1,y2,x1,x2" string the feed expects.
func (c *Client) GetBoundsByPoint(latitude, longitude, radius float64) string {
	halfSideInKm := math.Abs(radius) / 1000

	lat := radians(latitude)
	lon := radians(longitude)

	const approxEarthRadius = 6371

	// Distance from the centre to a corner of the bounding square.
	hypotenuse := math.Sqrt(2 * math.Pow(halfSideInKm, 2))

	// The diagonal bearings: 225° for the south-west corner (min lat/lon), 45°
	// for the north-east one (max lat/lon).
	corner := func(bearing float64) (float64, float64) {
		angular := hypotenuse / approxEarthRadius

		cornerLat := math.Asin(math.Sin(lat)*math.Cos(angular) +
			math.Cos(lat)*math.Sin(angular)*math.Cos(bearing))
		cornerLon := lon + math.Atan2(
			math.Sin(bearing)*math.Sin(angular)*math.Cos(lat),
			math.Cos(angular)-math.Sin(lat)*math.Sin(cornerLat))

		return cornerLat, cornerLon
	}

	latMin, lonMin := corner(radians(225))
	latMax, lonMax := corner(radians(45))

	return c.GetBounds(Zone{
		TLY: degrees(latMax),
		BRY: degrees(latMin),
		TLX: degrees(lonMin),
		BRX: degrees(lonMax),
	})
}

// GetCountryFlag downloads the flag of a country, or returns nil when FR24 has
// none.
func (c *Client) GetCountryFlag(ctx context.Context, country string) (*Image, error) {
	// The same slugifier as the feed, which spells some names "Myanmar (Burma)".
	slug := countryToSlug(country)

	if slug == "" {
		return nil, nil
	}

	flagURL := c.endpoints.countryFlagURL(slug)
	headers := maps.Clone(imageHeaders)

	delete(headers, "origin") // Does not work for this request.

	response, err := c.client.request(ctx, flagURL, requestOptions{
		headers:           headers,
		allowedErrorCodes: []int{403, 404},
		timeout:           c.Timeout,
	})

	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 400 && response.StatusCode < 500 {
		return nil, nil
	}
	return &Image{Data: response.Body, Extension: extensionOf(flagURL)}, nil
}

// GetFlightDetails returns the details payload of a flight.
func (c *Client) GetFlightDetails(ctx context.Context, flight *Flight) (map[string]any, error) {
	if flight == nil {
		return nil, fmt.Errorf("%w: no flight given", ErrFlightRadar)
	}

	response, err := c.client.requestStandalone(ctx, c.endpoints.flightDataURL(flight.ID), requestOptions{
		headers: jsonHeaders,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}
	return response.JSON()
}

// FlightSearch narrows the flights [Client.GetFlights] returns. See
// [Client.SetFlightTrackerConfig] for the rest of the options.
type FlightSearch struct {
	// Airline is an airline ICAO, e.g. "DAL".
	Airline string
	// Bounds is a "y1,y2,x1,x2" string, e.g. "75.78,-75.78,-427.56,427.56".
	Bounds string
	// Registration is an aircraft registration.
	Registration string
	// AircraftType is an aircraft model code, e.g. "B737".
	AircraftType string
	// Details fetches the details of every flight found, MaxWorkers at a time.
	Details bool
}

// GetFlights returns the flights the live feed reports for the given search.
func (c *Client) GetFlights(ctx context.Context, search FlightSearch) ([]*Flight, error) {
	params := c.GetFlightTrackerConfig().Values()

	if c.IsLoggedIn() {
		if token, ok := c.client.getCookie("_frPl"); ok {
			params.Set("enc", token)
		}
	}

	if search.Airline != "" {
		params.Set("airline", search.Airline)
	}
	if search.Bounds != "" {
		params.Set("bounds", search.Bounds)
	}
	if search.Registration != "" {
		params.Set("reg", search.Registration)
	}
	if search.AircraftType != "" {
		params.Set("type", search.AircraftType)
	}

	var flights []*Flight

	for range feedEmptyRetries + 1 {
		response, err := c.client.request(ctx, c.endpoints.realTimeFlightTrackerData, requestOptions{
			params:  params,
			headers: jsonHeaders,
			timeout: c.Timeout,
		})

		if err != nil {
			return nil, err
		}

		content, err := response.JSON()

		if err != nil {
			return nil, err
		}
		flights = flightsFromFeed(content, feedKeyOrder(response.Body))

		// "full_count": 0 means the feed really has nothing to report.
		fullCount := toNumber(content["full_count"])

		if len(flights) > 0 || fullCount == nil || *fullCount == 0 {
			break
		}

		for _, name := range feedStickyCookies {
			c.client.deleteCookie(name)
		}
	}

	if search.Details {
		if err := c.fetchDetails(ctx, flights); err != nil {
			return flights, err
		}
	}
	return flights, nil
}

// flightsFromFeed keeps the feed entries that are flights, skipping the
// envelope's own keys, in the order the feed listed them.
func flightsFromFeed(content map[string]any, order []string) []*Flight {
	flights := make([]*Flight, 0, len(content))

	// Falls back to the map's own order only if the body could not be scanned,
	// which cannot happen for a body that already parsed.
	if len(order) == 0 {
		order = make([]string, 0, len(content))

		for flightID := range content {
			order = append(order, flightID)
		}
	}

	for _, flightID := range order {
		if flightID == "" || flightID[0] < '0' || flightID[0] > '9' {
			continue
		}
		if row, ok := content[flightID].([]any); ok {
			flights = append(flights, newFlight(flightID, row))
		}
	}
	return flights
}

// feedKeyOrder reads the keys of a JSON object in the order they arrived. A Go
// map does not keep that order, and both sibling ports hand flights back in the
// order the feed listed them.
func feedKeyOrder(body []byte) []string {
	decoder := json.NewDecoder(bytes.NewReader(bytes.TrimPrefix(body, []byte("\xef\xbb\xbf"))))
	token, err := decoder.Token()

	if err != nil || token != json.Delim('{') {
		return nil
	}

	var keys []string

	for decoder.More() {
		token, err := decoder.Token()

		if err != nil {
			return keys
		}

		name, _ := token.(string)
		var value json.RawMessage

		// Decoded rather than tokenised, so nested objects are skipped whole.
		if err := decoder.Decode(&value); err != nil {
			return keys
		}
		keys = append(keys, name)
	}
	return keys
}

// fetchDetails fills in every flight's details, MaxWorkers at a time.
func (c *Client) fetchDetails(ctx context.Context, flights []*Flight) error {
	if len(flights) == 0 {
		return nil
	}

	// Clamped rather than skipped: MaxWorkers is public, and a zero there must
	// not turn "with details" into a silent no-op.
	workers := min(max(c.MaxWorkers, 1), len(flights))

	queue := make(chan *Flight)
	var group sync.WaitGroup
	var once sync.Once
	var firstErr error

	for range workers {
		group.Add(1)

		go func() {
			defer group.Done()

			for flight := range queue {
				details, err := c.GetFlightDetails(ctx, flight)

				if err != nil {
					once.Do(func() { firstErr = err })
					continue
				}
				flight.SetFlightDetails(details)
			}
		}()
	}

	for _, flight := range flights {
		queue <- flight
	}
	close(queue)
	group.Wait()

	return firstErr
}

// GetFlightTrackerConfig returns a copy of the current Real Time Flight Tracker
// config, used by [Client.GetFlights].
func (c *Client) GetFlightTrackerConfig() FlightTrackerConfig {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.flightTrackerConfig
}

// SetFlightTrackerConfig replaces the config, then applies values on top of it.
// Either argument may be nil.
func (c *Client) SetFlightTrackerConfig(config *FlightTrackerConfig, values map[string]string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	updated := c.flightTrackerConfig

	if config != nil {
		updated = *config
	}
	if err := updated.update(values); err != nil {
		return err
	}
	c.flightTrackerConfig = updated
	return nil
}

// GetHistoryData downloads the historical data of a flight. fileType must be
// "CSV" or "KML". Requires a premium account.
func (c *Client) GetHistoryData(ctx context.Context, flight *Flight, fileType string, timestamp int64) (string, error) {
	if flight == nil {
		return "", fmt.Errorf("%w: no flight given", ErrFlightRadar)
	}

	headers, err := c.authHeaders()

	if err != nil {
		return "", err
	}

	fileType = strings.ToLower(fileType)

	if fileType != "csv" && fileType != "kml" {
		return "", fmt.Errorf("%w: file type %q is not supported. Only CSV and KML are supported",
			ErrFlightRadar, fileType)
	}

	response, err := c.client.request(ctx, c.endpoints.historicalDataURL(flight.ID, fileType, timestamp),
		requestOptions{headers: headers, timeout: c.Timeout})

	if err != nil {
		return "", err
	}
	return string(response.Body), nil
}

// GetLoginData returns the data of the logged-in account.
func (c *Client) GetLoginData() (map[string]any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.loginData == nil {
		return nil, &LoginError{Message: "you must log in to your account"}
	}
	return maps.Clone(getMap(c.loginData, "userData")), nil
}

// GetMostTracked returns the most tracked flights.
func (c *Client) GetMostTracked(ctx context.Context) (map[string]any, error) {
	return c.jsonRequest(ctx, c.endpoints.mostTracked)
}

// GetVolcanicEruptions returns the boundaries of volcanic eruptions and ash
// clouds impacting aviation.
func (c *Client) GetVolcanicEruptions(ctx context.Context) (map[string]any, error) {
	return c.jsonRequest(ctx, c.endpoints.volcanicEruptionData)
}

// GetZones returns every major zone on the globe.
func (c *Client) GetZones() map[string]Zone {
	zones := make(map[string]Zone, len(staticZones))

	for name, zone := range staticZones {
		zones[name] = cloneZone(zone)
	}
	return zones
}

func cloneZone(zone Zone) Zone {
	if zone.Subzones == nil {
		return zone
	}

	clone := zone
	clone.Subzones = make(map[string]Zone, len(zone.Subzones))

	for name, subzone := range zone.Subzones {
		clone.Subzones[name] = cloneZone(subzone)
	}
	return clone
}

// Search returns the search results, grouped as FR24 counts them. A limit of
// zero means the 50 the Python and Node.js ports default to; any other value is
// sent as given.
func (c *Client) Search(ctx context.Context, query string, limit int) (map[string][]any, error) {
	if limit == 0 {
		limit = defaultSearchLimit
	}

	response, err := c.client.request(ctx, c.endpoints.searchDataURL(query, limit), requestOptions{
		headers: jsonHeaders,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}

	if !response.IsJSON() {
		return nil, fmt.Errorf("%w: expected JSON response from %s, got %q",
			ErrFlightRadar, response.URL, response.Header.Get("Content-Type"))
	}

	var payload struct {
		Results []any `json:"results"`
		Stats   struct {
			Count json.RawMessage `json:"count"`
		} `json:"stats"`
	}

	if err := json.Unmarshal([]byte(response.Text()), &payload); err != nil {
		return nil, fmt.Errorf("%w: could not parse the search response: %w", ErrFlightRadar, err)
	}

	// The counts slice `results` in the order FR24 lists them, so the object's
	// key order is what makes the groups line up.
	counts, err := orderedCounts(payload.Stats.Count)

	if err != nil {
		return nil, err
	}

	groups := make(map[string][]any, len(counts))
	index := 0

	for _, entry := range counts {
		end := min(index+entry.count, len(payload.Results))

		if end < index {
			end = index
		}
		groups[entry.name] = payload.Results[index:end]
		index = end
	}
	return groups, nil
}

type namedCount struct {
	name  string
	count int
}

// orderedCounts reads a JSON object of counts, keeping its key order.
func orderedCounts(raw json.RawMessage) ([]namedCount, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	token, err := decoder.Token()

	if err != nil {
		return nil, fmt.Errorf("%w: could not parse the search counts: %w", ErrFlightRadar, err)
	}
	if delimiter, ok := token.(json.Delim); !ok || delimiter != '{' {
		return nil, nil
	}

	var counts []namedCount

	for decoder.More() {
		key, err := decoder.Token()

		if err != nil {
			return nil, fmt.Errorf("%w: could not parse the search counts: %w", ErrFlightRadar, err)
		}

		var count float64

		if err := decoder.Decode(&count); err != nil {
			return nil, fmt.Errorf("%w: could not parse the search counts: %w", ErrFlightRadar, err)
		}

		name, _ := key.(string)
		counts = append(counts, namedCount{name: name, count: int(count)})
	}
	return counts, nil
}

// IsLoggedIn reports whether the client holds a FlightRadar24 session.
func (c *Client) IsLoggedIn() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.loginData != nil
}

// Login logs in to a FlightRadar24 account.
func (c *Client) Login(ctx context.Context, user, password string) error {
	c.mu.Lock()
	c.loginData = nil
	c.mu.Unlock()
	c.client.clearCookies()

	data := url.Values{}
	data.Set("email", user)
	data.Set("password", password)
	data.Set("remember", "true")
	data.Set("type", "web")

	response, err := c.client.request(ctx, c.endpoints.userLogin, requestOptions{
		headers: jsonHeaders,
		data:    data,
		timeout: c.Timeout,
	})

	if err != nil {
		return err
	}

	content, err := response.JSON()

	if err != nil {
		return err
	}

	success, _ := content["success"].(bool)

	if !success {
		message := getString(content, "message")

		if message == "" {
			message = "your email or password is incorrect"
		}
		return &LoginError{Message: message}
	}

	c.mu.Lock()
	c.loginData = map[string]any{"userData": getMap(content, "userData")}
	c.mu.Unlock()

	return nil
}

// Logout ends the FlightRadar24 session, reporting whether the server confirmed
// it.
func (c *Client) Logout(ctx context.Context) (bool, error) {
	if !c.IsLoggedIn() {
		return true, nil
	}

	c.mu.Lock()
	c.loginData = nil
	c.mu.Unlock()

	defer c.client.clearCookies()

	response, err := c.client.request(ctx, c.endpoints.userLogout, requestOptions{
		headers: jsonHeaders,
		timeout: c.Timeout,
	})

	// The local session is gone either way; the error says the server never
	// confirmed it, which a caller may want to retry or log.
	if err != nil {
		return false, err
	}
	return response.StatusCode >= 200 && response.StatusCode < 300, nil
}

// jsonRequest is the shape of the endpoints that just return a JSON object.
func (c *Client) jsonRequest(ctx context.Context, target string) (map[string]any, error) {
	response, err := c.client.request(ctx, target, requestOptions{
		headers: jsonHeaders,
		timeout: c.Timeout,
	})

	if err != nil {
		return nil, err
	}
	return response.JSON()
}

// authHeaders are the JSON headers plus the access token of the logged-in
// account.
func (c *Client) authHeaders() (map[string]string, error) {
	userData, err := c.GetLoginData()

	if err != nil {
		return nil, err
	}
	return withHeaders(jsonHeaders, map[string]string{
		"accesstoken": getString(userData, "accessToken"),
	}), nil
}

// extensionOf returns the extension a URL's file carries.
func extensionOf(target string) string {
	parts := strings.Split(target, ".")
	return parts[len(parts)-1]
}
