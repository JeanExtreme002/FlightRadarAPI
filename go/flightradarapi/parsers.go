package flightradarapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/net/html"
	"golang.org/x/text/unicode/norm"
)

// numericPattern is ASCII only: a Unicode-aware \d would match digits such as "٤٣".
var numericPattern = regexp.MustCompile(`^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$`)

// surroundingSpace is the whitespace trimmed from a numeric field. Pinned to one
// set because Python's str.strip() and JavaScript's trim() disagree on
// U+001C-U+001F and U+FEFF.
const surroundingSpace = " \t\n\r\f\v"

// airlineCodePattern is an airline code badge: a two-letter IATA code or a
// three-letter ICAO code. ASCII only, so a stray Unicode letter does not pass
// for a code.
var airlineCodePattern = regexp.MustCompile(`^[A-Z0-9]{2,3}$`)

// aircraftCountPattern is a fleet size as the page prints it: "340" or "3,878".
var aircraftCountPattern = regexp.MustCompile(`^[0-9]{1,3}(?:[,.][0-9]{3})*$|^[0-9]+$`)

const airlinesPathPrefix = "/data/airlines/"

// Airline is one row of the airlines listing. The JSON tags match the keys the
// Python and Node.js ports use, so NumAircrafts serialises as "n_aircrafts".
type Airline struct {
	Name         string `json:"Name"`
	ICAO         string `json:"ICAO"`
	IATA         string `json:"IATA"`
	NumAircrafts *int   `json:"n_aircrafts"`
}

// parseAirlinesHTML parses the airlines listing page into airline records.
//
// Every airline is a link to its data page, with the IATA and ICAO codes as
// badges next to the name. The "Largest fleets" section repeats a few airlines
// with their aircraft count; an airline the page lists twice becomes one entry
// carrying everything the page said about it.
func parseAirlinesHTML(page []byte) []Airline {
	document, err := html.Parse(bytes.NewReader(page))

	if err != nil {
		log().Warn("parseAirlinesHTML: could not parse the response as HTML")
		return []Airline{}
	}

	links := findElements(document, func(node *html.Node) bool {
		return node.Data == "a" && strings.HasPrefix(attr(node, "href"), airlinesPathPrefix)
	})

	if len(links) == 0 {
		log().Warn("parseAirlinesHTML: no airline links in response — FR24 page layout may have changed")
		return []Airline{}
	}

	airlines := []Airline{}
	indexByHref := map[string]int{}

	for _, link := range links {
		name := airlineName(link)

		if len(name) < 2 {
			continue
		}

		var iata, icao string

		for _, text := range leafTexts(link, "span") {
			switch {
			case !airlineCodePattern.MatchString(text):
			case len(text) == 2 && iata == "":
				iata = text
			case len(text) == 3 && icao == "":
				icao = text
			}
		}

		// Section links ("All") point under /data/airlines/ too; a code tells
		// an airline apart from them.
		if iata == "" && icao == "" {
			continue
		}

		var numAircrafts *int

		for _, text := range leafTexts(link, "strong") {
			if aircraftCountPattern.MatchString(text) {
				digits := strings.Map(func(char rune) rune {
					if char >= '0' && char <= '9' {
						return char
					}
					return -1
				}, text)

				if count, err := strconv.Atoi(digits); err == nil {
					numAircrafts = &count
					break
				}
			}
		}

		href := attr(link, "href")
		index, seen := indexByHref[href]

		if !seen {
			index = len(airlines)
			indexByHref[href] = index
			airlines = append(airlines, Airline{Name: name})
		}

		airline := &airlines[index]

		if airline.ICAO == "" {
			airline.ICAO = icao
		}
		if airline.IATA == "" {
			airline.IATA = iata
		}
		if airline.NumAircrafts == nil {
			airline.NumAircrafts = numAircrafts
		}
	}
	return airlines
}

// airlineName is the airline name of a listing entry. The name sits in the
// element titled with it, with the logo's aria-label as a fallback; the anchor
// text also carries the codes and the fleet size.
func airlineName(link *html.Node) string {
	for _, attribute := range []string{"title", "aria-label"} {
		element := findElement(link, func(node *html.Node) bool { return hasAttr(node, attribute) })

		if element != nil {
			return strings.TrimSpace(attr(element, attribute))
		}
	}
	return textContent(link)
}

// leafTexts is the text of the `tag` elements under root that hold no other
// element. The name element is left out by its title attribute: an airline
// called "TAP" would otherwise read as an ICAO code.
func leafTexts(root *html.Node, tag string) []string {
	var texts []string

	for _, element := range findElements(root, func(node *html.Node) bool { return node.Data == tag }) {
		if hasAttr(element, "title") || findElement(element, func(*html.Node) bool { return true }) != nil {
			continue
		}
		texts = append(texts, textContent(element))
	}
	return texts
}

// countryToSlug slugifies a country name the way FR24 spells it in its data page
// URLs, so feed rows can be matched against the Country constants.
func countryToSlug(country string) string {
	// Diacritics are stripped so a future "Curaçao" still matches "curacao".
	decomposed := norm.NFKD.String(country)
	var ascii strings.Builder

	for _, char := range decomposed {
		if !unicode.Is(unicode.Mn, char) {
			ascii.WriteRune(char)
		}
	}

	var slug strings.Builder
	previousHyphen := false

	// Punctuation becomes a hyphen rather than being deleted: FR24's own assets
	// are named that way, e.g. flags-small/cote-d-ivoire.svg.
	for _, char := range strings.ToLower(ascii.String()) {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			slug.WriteRune(char)
			previousHyphen = false
			continue
		}
		if !previousHyphen {
			slug.WriteRune('-')
			previousHyphen = true
		}
	}
	return strings.Trim(slug.String(), "-")
}

// toText keeps a text field as a string, or "" when the feed sends anything
// else: get_country_flag(airport.Country) would otherwise slugify a map.
func toText(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

// toNumber coerces a numeric feed field into a number, or nil when it is
// unusable. An unusable coordinate must not become 0: that would place the
// airport in the Gulf of Guinea instead of marking its position as unknown.
func toNumber(value any) *float64 {
	switch typed := value.(type) {
	case json.Number:
		return parseNumber(string(typed))
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) {
			return nil
		}
		return &typed
	case string:
		trimmed := strings.Trim(typed, surroundingSpace)

		if !numericPattern.MatchString(trimmed) {
			return nil
		}
		return parseNumber(trimmed)
	default:
		return nativeNumber(value)
	}
}

// nativeNumber reads Go's own numeric types, which the JSON decoder never
// produces but a caller building a map by hand does. Booleans stay out: the
// other ports reject them too.
func nativeNumber(value any) *float64 {
	reflected := reflect.ValueOf(value)
	var number float64

	switch reflected.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		number = float64(reflected.Int())
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		number = float64(reflected.Uint())
	case reflect.Float32, reflect.Float64:
		number = reflected.Float()
	default:
		return nil
	}

	if math.IsNaN(number) || math.IsInf(number, 0) {
		return nil
	}
	return &number
}

// parseNumber converts numeric text, rejecting anything a float64 cannot hold.
func parseNumber(text string) *float64 {
	number, err := strconv.ParseFloat(text, 64)

	if err != nil {
		// Underflow keeps its value (Python's float("1e-999") is 0.0); overflow
		// has none.
		if !errors.Is(err, strconv.ErrRange) || math.IsInf(number, 0) {
			return nil
		}
	}
	if math.IsNaN(number) || math.IsInf(number, 0) {
		return nil
	}
	return &number
}

// parseInertiaPage returns the Inertia page object (component, props, version)
// of a FR24 data page, or false when the payload carries none.
//
// Served as HTML, the page keeps it JSON-encoded in the data-page attribute of
// its root element; asked with inertiaHeaders, FR24 sends it as the body, which
// the caller has already decoded into a map. Both shapes are accepted, so a
// test can feed the parser a decoded fixture the way the other ports do.
func parseInertiaPage(payload any) (map[string]any, bool) {
	var page any

	switch typed := payload.(type) {
	case map[string]any:
		page = typed
	case string:
		return parseInertiaPage([]byte(typed))
	case []byte:
		document, err := html.Parse(bytes.NewReader(typed))

		if err != nil {
			log().Warn("parseInertiaPage: could not parse the response as HTML")
			return nil, false
		}

		root := findElement(document, func(node *html.Node) bool { return hasAttr(node, "data-page") })

		if root == nil {
			log().Warn("parseInertiaPage: no data-page attribute in response — FR24 page layout may have changed")
			return nil, false
		}
		if err := json.Unmarshal([]byte(attr(root, "data-page")), &page); err != nil {
			log().Warn("parseInertiaPage: data-page is not valid JSON — FR24 page layout may have changed")
			return nil, false
		}
	default:
		page = payload
	}

	object, ok := page.(map[string]any)

	if !ok {
		log().Warn("parseInertiaPage: no page props in response — FR24 page layout may have changed")
		return nil, false
	}
	if _, ok := object["props"].(map[string]any); !ok {
		log().Warn("parseInertiaPage: no page props in response — FR24 page layout may have changed")
		return nil, false
	}
	return object, true
}

// airportsCountry is one entry of the airports index: the country name as FR24
// prints it ("UNITED STATES") and the slug of its listing page, which is also
// its Country constant.
type airportsCountry struct {
	Name string
	Slug string
}

// parseAirportsIndex parses the airports index (endpoints.airportsData) into
// its countries. The payload is the page HTML, or its decoded page object.
func parseAirportsIndex(payload any) []airportsCountry {
	page, ok := parseInertiaPage(payload)
	var rows []any

	if ok {
		rows, _ = page["props"].(map[string]any)["airportsByCountry"].([]any)
	}
	if rows == nil {
		log().Warn(`parseAirportsIndex: no "airportsByCountry" list in response — FR24 page layout may have changed`)
		return []airportsCountry{}
	}

	countries := []airportsCountry{}

	for _, entry := range rows {
		row, ok := entry.(map[string]any)

		if !ok {
			continue
		}

		name := toText(row["name"])
		slug := countryToSlug(name)

		if slug != "" {
			countries = append(countries, airportsCountry{Name: name, Slug: slug})
		}
	}
	return countries
}

// parseAirportsPage parses a country or state airports page into its airports
// and the paths of its state pages. The payload is the page HTML, or its
// decoded page object.
//
// A country with many airports lists its states instead, each with the path of
// its own page; those paths come back for the caller to fetch. The listing has
// no coordinates or altitude: [Client.GetAirport] has them for one airport.
func parseAirportsPage(payload any) (airports []*Airport, statePaths []string) {
	airports, statePaths = []*Airport{}, []string{}
	page, ok := parseInertiaPage(payload)

	if !ok {
		return airports, statePaths
	}

	props := page["props"].(map[string]any)
	country, _ := props["country"].(map[string]any)
	countryName := toText(country["name"])

	rows, _ := props["airports"].([]any)
	states, _ := props["states"].([]any)

	for _, entry := range rows {
		row, ok := entry.(map[string]any)

		if !ok {
			continue
		}
		airports = append(airports, newAirportFromBasicInfo(basicAirportInfo{
			Name:    toText(row["name"]),
			ICAO:    toText(row["icao"]),
			IATA:    toText(row["iata"]),
			Country: countryName,
		}))
	}

	for _, entry := range states {
		state, ok := entry.(map[string]any)

		if !ok {
			continue
		}
		if path := toText(state["url"]); path != "" {
			statePaths = append(statePaths, path)
		}
	}
	return airports, statePaths
}

// --- HTML helpers ---

func findElement(root *html.Node, match func(*html.Node) bool) *html.Node {
	for node := range root.Descendants() {
		if node.Type == html.ElementNode && match(node) {
			return node
		}
	}
	return nil
}

func findElements(root *html.Node, match func(*html.Node) bool) []*html.Node {
	var found []*html.Node

	for node := range root.Descendants() {
		if node.Type == html.ElementNode && match(node) {
			found = append(found, node)
		}
	}
	return found
}

func attr(node *html.Node, name string) string {
	for _, attribute := range node.Attr {
		if attribute.Key == name {
			return attribute.Val
		}
	}
	return ""
}

// hasAttr reports whether the element carries the attribute at all, which
// attr cannot tell from an empty value.
func hasAttr(node *html.Node, name string) bool {
	for _, attribute := range node.Attr {
		if attribute.Key == name {
			return true
		}
	}
	return false
}

// textContent concatenates the node's text, trimming each piece, as
// BeautifulSoup's get_text(strip=True) does.
func textContent(root *html.Node) string {
	var text strings.Builder

	for node := range root.Descendants() {
		if node.Type == html.TextNode {
			text.WriteString(strings.TrimSpace(node.Data))
		}
	}
	return text.String()
}
