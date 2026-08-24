package flightradarapi

import "strconv"

// DefaultText is the placeholder the Get* formatters return for a value the
// feed did not send.
const DefaultText = "N/A"

// missing reports whether a feed value carries no information. FR24 sends the
// literal "N/A" as often as it sends null.
func missing(value any) bool {
	if value == nil {
		return true
	}
	text, ok := value.(string)
	return ok && text == DefaultText
}

func asMap(value any) map[string]any {
	if nested, ok := value.(map[string]any); ok {
		return nested
	}
	return map[string]any{}
}

func asSlice(value any) []any {
	if items, ok := value.([]any); ok {
		return items
	}
	return []any{}
}

func getMap(source map[string]any, key string) map[string]any {
	return asMap(source[key])
}

func getSlice(source map[string]any, key string) []any {
	return asSlice(source[key])
}

// getString returns a text field, or "" when the feed sent nothing usable.
func getString(source map[string]any, key string) string {
	value := source[key]

	if missing(value) {
		return ""
	}

	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return formatNumber(typed)
	case bool:
		return strconv.FormatBool(typed)
	default:
		return ""
	}
}

func getNumber(source map[string]any, key string) *float64 {
	if value := source[key]; !missing(value) {
		return toNumber(value)
	}
	return nil
}

func getBool(source map[string]any, key string) *bool {
	value := source[key]

	if missing(value) {
		return nil
	}
	if typed, ok := value.(bool); ok {
		return &typed
	}
	return nil
}

// formatNumber renders a number the way both other ports do: 2436, not 2436.0.
func formatNumber(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}
