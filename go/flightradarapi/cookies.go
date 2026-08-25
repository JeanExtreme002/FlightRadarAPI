package flightradarapi

import (
	"cmp"
	"math"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// storedCookie is one cookie in the jar, with the scope FR24 gave it.
type storedCookie struct {
	name     string
	value    string
	domain   string
	path     string
	secure   bool
	hostOnly bool
	expires  time.Time
	storedAt uint64
}

func (c *storedCookie) expired(now time.Time) bool {
	return !c.expires.IsZero() && !c.expires.After(now)
}

// cookieJar honours the scope FR24 sets on each cookie: one stored by
// www.flightradar24.com is not replayed to cdn./api./data-live., and Path,
// Secure and expiry are respected. Keyed by name/domain/path so same-named
// cookies from different hosts stay apart.
type cookieJar struct {
	mu       sync.Mutex
	cookies  map[string]*storedCookie
	sequence uint64
	now      func() time.Time
}

func newCookieJar() *cookieJar {
	return &cookieJar{cookies: make(map[string]*storedCookie), now: time.Now}
}

func (j *cookieJar) clock() time.Time {
	if j.now != nil {
		return j.now()
	}
	return time.Now()
}

// get returns the value of a stored cookie by name, ignoring scope.
func (j *cookieJar) get(name string) (string, bool) {
	j.mu.Lock()
	defer j.mu.Unlock()

	now := j.clock()
	var match *storedCookie

	for _, cookie := range j.cookies {
		if cookie.name != name || cookie.expired(now) {
			continue
		}
		// Newest wins: a re-issued token supersedes the one it replaces.
		if match == nil || cookie.storedAt > match.storedAt {
			match = cookie
		}
	}

	if match == nil {
		return "", false
	}
	return match.value, true
}

// clear drops every stored cookie.
func (j *cookieJar) clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.cookies = make(map[string]*storedCookie)
}

// delete drops every cookie with this name, leaving the rest of the jar intact.
func (j *cookieJar) delete(name string) {
	j.mu.Lock()
	defer j.mu.Unlock()

	for key, cookie := range j.cookies {
		if cookie.name == name {
			delete(j.cookies, key)
		}
	}
}

// store banks the Set-Cookie headers a response arrived with.
func (j *cookieJar) store(target *url.URL, headers []string) {
	if target == nil {
		return
	}

	j.mu.Lock()
	defer j.mu.Unlock()

	now := j.clock()

	for _, header := range headers {
		cookie := parseSetCookie(header, target, now)

		if cookie == nil {
			continue
		}
		if cookie.secure && target.Scheme != "https" {
			continue
		}

		j.sequence++
		cookie.storedAt = j.sequence
		key := cookie.name + ";" + cookie.domain + ";" + cookie.path

		// An expiry in the past is a deletion instruction, not a value.
		if cookie.expired(now) {
			delete(j.cookies, key)
		} else {
			j.cookies[key] = cookie
		}
	}
}

// header renders the stored cookies that are in scope for a URL.
func (j *cookieJar) header(target *url.URL) string {
	selected := j.matching(target)

	if len(selected) == 0 {
		return ""
	}

	pairs := make([]string, 0, len(selected))
	for _, cookie := range selected {
		pairs = append(pairs, cookie.name+"="+cookie.value)
	}
	return strings.Join(pairs, "; ")
}

// matching returns the in-scope cookies, oldest first, one per name.
func (j *cookieJar) matching(target *url.URL) []*storedCookie {
	if target == nil {
		return nil
	}

	j.mu.Lock()
	defer j.mu.Unlock()

	now := j.clock()
	secure := target.Scheme == "https"
	host := strings.ToLower(target.Hostname())
	requestPath := target.Path

	if requestPath == "" {
		requestPath = "/"
	}

	var matches []*storedCookie

	for key, cookie := range j.cookies {
		if cookie.expired(now) {
			delete(j.cookies, key)
			continue
		}
		if cookie.secure && !secure {
			continue
		}
		if !pathMatches(requestPath, cookie.path) {
			continue
		}

		inScope := host == cookie.domain
		if !cookie.hostOnly {
			inScope = domainMatches(host, cookie.domain)
		}
		if inScope {
			matches = append(matches, cookie)
		}
	}

	// RFC 6265 5.4: every cookie whose path matches goes out, the longest path
	// first, and among equal paths the one stored earliest. Keeping only one
	// per name would hand the server the root cookie where it scoped a
	// different value to this path.
	slices.SortFunc(matches, func(a, b *storedCookie) int {
		if byPath := cmp.Compare(len(b.path), len(a.path)); byPath != 0 {
			return byPath
		}
		return cmp.Compare(a.storedAt, b.storedAt)
	})

	return matches
}

// parseSetCookie parses one Set-Cookie header into a cookie record, or nil when
// it is unusable. Hand-rolled rather than delegated to net/http, which widens a
// relative Path to "/" and accepts a Domain the response host does not cover.
//
// now is the jar's clock, so "Max-Age=0" resolves to an expiry the caller reads
// as the deletion it is.
func parseSetCookie(header string, target *url.URL, now time.Time) *storedCookie {
	parts := strings.Split(header, ";")
	pair := parts[0]
	separator := strings.Index(pair, "=")

	// Split on the first "=" only: session tokens are routinely base64 and end
	// in "=" padding, which a greedy split truncates.
	if separator < 1 {
		return nil
	}

	name := strings.TrimSpace(pair[:separator])

	if name == "" {
		return nil
	}

	host := strings.ToLower(target.Hostname())
	cookie := &storedCookie{
		name:     name,
		value:    strings.TrimSpace(pair[separator+1:]),
		domain:   host,
		path:     defaultPath(target.Path),
		hostOnly: true,
	}

	for _, part := range parts[1:] {
		index := strings.Index(part, "=")
		key := part
		value := ""

		if index >= 0 {
			key, value = part[:index], strings.TrimSpace(part[index+1:])
		}
		key = strings.ToLower(strings.TrimSpace(key))

		switch key {
		case "secure":
			cookie.secure = true
		case "path":
			if strings.HasPrefix(value, "/") {
				cookie.path = value
			}
		case "expires":
			if cookie.expires.IsZero() {
				if parsed, err := parseCookieTime(value); err == nil {
					cookie.expires = parsed
				}
			}
		case "max-age":
			// Max-Age wins over Expires, and <= 0 means "delete now". A
			// malformed value must be ignored, not read as 0.
			if seconds, err := strconv.ParseInt(value, 10, 64); err == nil {
				cookie.expires = now.Add(secondsToDuration(seconds))
			}
		case "domain":
			if value == "" {
				continue
			}
			domain := strings.ToLower(strings.TrimPrefix(value, "."))

			// A dotless domain is a TLD: Domain=com would scope the cookie to
			// every .com host requested later.
			if strings.Contains(domain, ".") && domainMatches(host, domain) {
				cookie.domain = domain
				cookie.hostOnly = false
			} else {
				// RFC 6265 5.3.6: a Domain the host is not under discards the
				// cookie rather than narrowing it back to the host.
				return nil
			}
		}
	}
	return cookie
}

// maxCookieSeconds is the longest Max-Age a Duration can carry, about 292 years.
const maxCookieSeconds = int64(math.MaxInt64) / int64(time.Second)

// secondsToDuration converts a Max-Age, clamping instead of overflowing: the
// wrap-around turns a very long-lived cookie into an expiry in the past, which
// the jar would read as an instruction to delete it.
func secondsToDuration(seconds int64) time.Duration {
	return time.Duration(min(max(seconds, -maxCookieSeconds), maxCookieSeconds)) * time.Second
}

// parseCookieTime accepts the date formats a cookie Expires arrives in.
func parseCookieTime(value string) (time.Time, error) {
	if parsed, err := http.ParseTime(value); err == nil {
		return parsed, nil
	}

	layouts := []string{
		"Mon, 02-Jan-2006 15:04:05 MST",
		"Mon, 02 Jan 2006 15:04:05 -0700",
		"Mon Jan 02 2006 15:04:05 MST",
	}
	var err error

	for _, layout := range layouts {
		var parsed time.Time
		if parsed, err = time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, err
}

// defaultPath is the RFC 6265 default-path: the request path up to, but not
// including, the rightmost "/".
func defaultPath(pathname string) string {
	if !strings.HasPrefix(pathname, "/") {
		return "/"
	}
	lastSlash := strings.LastIndex(pathname, "/")

	if lastSlash < 1 {
		return "/"
	}
	return pathname[:lastSlash]
}

// domainMatches reports whether a cookie domain covers a host.
func domainMatches(host, domain string) bool {
	return host == domain || strings.HasSuffix(host, "."+domain)
}

// pathMatches reports whether a cookie path covers a request path.
func pathMatches(requestPath, cookiePath string) bool {
	if requestPath == cookiePath {
		return true
	}
	if !strings.HasPrefix(requestPath, cookiePath) {
		return false
	}
	return strings.HasSuffix(cookiePath, "/") || requestPath[len(cookiePath)] == '/'
}
