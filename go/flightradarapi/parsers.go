package flightradarapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"regexp"
	"slices"
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

// Airline is one row of the airlines listing. The JSON tags match the keys the
// Python and Node.js ports use, so NumAircrafts serialises as "n_aircrafts".
type Airline struct {
	Name         string `json:"Name"`
	ICAO         string `json:"ICAO"`
	IATA         string `json:"IATA"`
	NumAircrafts *int   `json:"n_aircrafts"`
}

// parseAirlinesHTML parses the airlines listing page into airline records.
func parseAirlinesHTML(page []byte) []Airline {
	document, err := html.Parse(bytes.NewReader(page))

	if err != nil {
		log().Warn("parseAirlinesHTML: could not parse the response as HTML")
		return []Airline{}
	}

	tbody := findElement(document, func(node *html.Node) bool { return node.Data == "tbody" })

	if tbody == nil {
		log().Warn("parseAirlinesHTML: no <tbody> in response — FR24 page layout may have changed")
		return []Airline{}
	}

	airlines := []Airline{}

	for _, row := range findElements(tbody, func(node *html.Node) bool { return node.Data == "tr" }) {
		cells := findElements(row, func(node *html.Node) bool { return node.Data == "td" })
		notranslate := findElement(row, func(node *html.Node) bool {
			return node.Data == "td" && hasClass(node, "notranslate")
		})

		if notranslate == nil {
			continue
		}

		link := findElement(notranslate, func(node *html.Node) bool {
			return node.Data == "a" && strings.HasPrefix(attr(node, "href"), "/data/airlines")
		})

		if link == nil {
			continue
		}

		name := textContent(link)

		if len(name) < 2 {
			continue
		}

		airline := Airline{Name: name}

		if len(cells) >= 4 {
			codes := textContent(cells[3])

			switch {
			case strings.Contains(codes, " / "):
				if parts := strings.Split(codes, " / "); len(parts) == 2 {
					airline.IATA = strings.TrimSpace(parts[0])
					airline.ICAO = strings.TrimSpace(parts[1])
				}
			case len(codes) == 2:
				airline.IATA = codes
			case len(codes) == 3:
				airline.ICAO = codes
			}
		}

		if len(cells) >= 5 {
			if text := textContent(cells[4]); text != "" {
				field := strings.TrimSpace(strings.SplitN(text, " ", 2)[0])

				if count, err := strconv.Atoi(field); err == nil {
					airline.NumAircrafts = &count
				}
			}
		}
		airlines = append(airlines, airline)
	}
	return airlines
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
	case reflect.Float32:
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

// parseAirportsJSON parses the airports JSON feed into airports, keeping only
// the wanted countries when any are given.
func parseAirportsJSON(payload []byte, countries []Country) []*Airport {
	decoder := json.NewDecoder(bytes.NewReader(bytes.TrimPrefix(payload, []byte("\xef\xbb\xbf"))))

	// Numbers stay as text, so a literal no float64 can hold is rejected
	// instead of silently becoming an infinity.
	decoder.UseNumber()

	var data map[string]any

	if err := decoder.Decode(&data); err != nil {
		log().Warn("parseAirportsJSON: response is not valid JSON — FR24 feed may have changed")
		return []*Airport{}
	}

	rows, ok := data["rows"].([]any)

	if !ok {
		log().Warn(`parseAirportsJSON: no "rows" array in response — FR24 feed may have changed`)
		return []*Airport{}
	}

	var wanted map[string]bool

	if countries != nil {
		wanted = make(map[string]bool, len(countries))

		for _, country := range countries {
			wanted[countryToSlug(string(country))] = true
		}
	}

	matched := make(map[string]bool, len(wanted))
	var unpositioned []string
	airports := []*Airport{}

	for _, entry := range rows {
		row, ok := entry.(map[string]any)

		if !ok {
			continue
		}

		// Slugified only when filtering: this loop runs over every airport in
		// the feed.
		if wanted != nil {
			slug := countryToSlug(toText(row["country"]))

			if !wanted[slug] {
				continue
			}
			matched[slug] = true
		}

		latitude := toNumber(row["lat"])
		longitude := toNumber(row["lon"])

		// One bad coordinate drops both: half a position reads as located.
		if latitude == nil || longitude == nil {
			latitude, longitude = nil, nil
			unpositioned = append(unpositioned, toText(row["name"]))
		}

		airports = append(airports, newAirportFromBasicInfo(basicAirportInfo{
			Name:      toText(row["name"]),
			ICAO:      toText(row["icao"]),
			IATA:      toText(row["iata"]),
			Latitude:  latitude,
			Longitude: longitude,
			Altitude:  toNumber(row["alt"]),
			Country:   toText(row["country"]),
		}))
	}

	// One line, not one per row: the feed carries every airport.
	if len(unpositioned) > 0 {
		log().Warn("parseAirportsJSON: airports with unusable coordinates carry no position",
			"count", len(unpositioned), "examples", unpositioned[:min(3, len(unpositioned))])
	}

	if wanted != nil {
		var missing []string

		for slug := range wanted {
			if !matched[slug] {
				missing = append(missing, slug)
			}
		}
		if len(missing) > 0 {
			slices.Sort(missing)
			log().Warn("parseAirportsJSON: no airports found for some countries — check the Country constants",
				"countries", strings.Join(missing, ", "))
		}
	}
	return airports
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

func hasClass(node *html.Node, name string) bool {
	return slices.Contains(strings.Fields(attr(node, "class")), name)
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
