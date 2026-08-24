package flightradarapi

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(raw)

	if err != nil {
		t.Fatalf("could not parse %q: %v", raw, err)
	}
	return parsed
}

func TestJarKeepsCookiesInTheScopeFR24SetThem(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/user/login"), []string{"_frPl=token; Path=/"})

	if header := jar.header(mustURL(t, "https://www.flightradar24.com/data/airlines")); header != "_frPl=token" {
		t.Errorf("got %q, want the cookie to be sent to its own host", header)
	}
	if header := jar.header(mustURL(t, "https://cdn.flightradar24.com/assets/x.png")); header != "" {
		t.Errorf("got %q, want no cookie for another host", header)
	}
}

func TestJarHonoursADomainAttribute(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"),
		[]string{"shared=1; Domain=.flightradar24.com; Path=/"})

	for _, target := range []string{
		"https://cdn.flightradar24.com/x", "https://data-live.flightradar24.com/y",
	} {
		if header := jar.header(mustURL(t, target)); header != "shared=1" {
			t.Errorf("%s: got %q, want shared=1", target, header)
		}
	}
}

func TestJarRejectsADomainTheHostIsNotUnder(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{
		"evil=1; Domain=example.com",
		// A dotless domain is a TLD: it would leak to every .com host.
		"tld=1; Domain=com",
	})

	if header := jar.header(mustURL(t, "https://www.flightradar24.com/")); header != "" {
		t.Errorf("got %q, want the cookies to be discarded", header)
	}
}

func TestJarKeepsTheDefaultPathOfTheRequest(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/webapi/v1/bookmarks"), []string{"scoped=1"})

	if header := jar.header(mustURL(t, "https://www.flightradar24.com/webapi/v1/other")); header != "scoped=1" {
		t.Errorf("got %q, want the cookie inside its default path", header)
	}
	if header := jar.header(mustURL(t, "https://www.flightradar24.com/data/airlines")); header != "" {
		t.Errorf("got %q, want no cookie outside its default path", header)
	}
}

func TestJarKeepsBase64PaddingInAValue(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"token=YWJjZA==; Path=/"})

	if value, _ := jar.get("token"); value != "YWJjZA==" {
		t.Errorf("got %q, want YWJjZA==", value)
	}
}

func TestJarTreatsAnExpiryInThePastAsADeletion(t *testing.T) {
	jar := newCookieJar()
	target := mustURL(t, "https://www.flightradar24.com/")

	jar.store(target, []string{"session=1; Path=/"})
	jar.store(target, []string{"session=1; Path=/; Max-Age=-1"})

	if _, ok := jar.get("session"); ok {
		t.Error("a negative Max-Age must delete the cookie")
	}
}

func TestJarIgnoresAMalformedMaxAge(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"session=1; Path=/; Max-Age=soon"})

	if _, ok := jar.get("session"); !ok {
		t.Error("a malformed Max-Age must be ignored, not read as an expiry")
	}
}

func TestJarDropsAnExpiredCookieOnRead(t *testing.T) {
	now := time.Now()
	jar := newCookieJar()
	jar.now = func() time.Time { return now }
	jar.store(mustURL(t, "https://www.flightradar24.com/"),
		[]string{"session=1; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT"})

	if _, ok := jar.get("session"); ok {
		t.Error("an expired cookie must not be stored")
	}
}

func TestJarSkipsASecureCookieOverPlainHTTP(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"secure=1; Path=/; Secure"})

	if header := jar.header(mustURL(t, "http://www.flightradar24.com/")); header != "" {
		t.Errorf("got %q, want no secure cookie over http", header)
	}
}

func TestJarNewestValueOfANameWins(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/data/airlines"), []string{"token=old"})
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"token=new; Path=/"})

	if value, _ := jar.get("token"); value != "new" {
		t.Errorf("got %q, want new", value)
	}
	if header := jar.header(mustURL(t, "https://www.flightradar24.com/data/airlines")); header != "token=new" {
		t.Errorf("got %q, want token=new", header)
	}
}

func TestJarDeleteDropsEveryScopeOfAName(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/zones/fcgi"), []string{"AWSALB=sticky"})
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"AWSALB=sticky2; Path=/", "_frPl=token; Path=/"})

	jar.delete("AWSALB")

	if _, ok := jar.get("AWSALB"); ok {
		t.Error("delete must drop every scope of the name")
	}
	if _, ok := jar.get("_frPl"); !ok {
		t.Error("delete must leave the rest of the jar intact")
	}
}

func TestJarClearDropsEverything(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"a=1; Path=/", "b=2; Path=/"})
	jar.clear()

	if header := jar.header(mustURL(t, "https://www.flightradar24.com/")); header != "" {
		t.Errorf("got %q, want an empty jar", header)
	}
}

func TestJarIgnoresAnUnparsableHeader(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"", "=value", "novalue", "; Path=/"})

	if header := jar.header(mustURL(t, "https://www.flightradar24.com/")); header != "" {
		t.Errorf("got %q, want nothing stored", header)
	}
}

func TestPathMatchesFollowsRFC6265(t *testing.T) {
	cases := []struct {
		requestPath string
		cookiePath  string
		expected    bool
	}{
		{"/webapi/v1", "/webapi/v1", true},
		{"/webapi/v1/bookmarks", "/webapi/v1", true},
		{"/webapi/v12", "/webapi/v1", false},
		{"/webapi", "/webapi/v1", false},
		{"/anything", "/", true},
	}

	for _, testCase := range cases {
		if got := pathMatches(testCase.requestPath, testCase.cookiePath); got != testCase.expected {
			t.Errorf("pathMatches(%q, %q) = %v, want %v",
				testCase.requestPath, testCase.cookiePath, got, testCase.expected)
		}
	}
}

func TestJarTreatsMaxAgeZeroAsADeletion(t *testing.T) {
	now := time.Now()
	jar := newCookieJar()
	jar.now = func() time.Time { return now }
	target := mustURL(t, "https://www.flightradar24.com/")

	jar.store(target, []string{"session=1; Path=/"})
	jar.store(target, []string{"session=1; Path=/; Max-Age=0"})

	if _, ok := jar.get("session"); ok {
		t.Error("Max-Age=0 must delete the cookie")
	}
	if len(jar.cookies) != 0 {
		t.Errorf("got %d stored cookies, want the entry dropped", len(jar.cookies))
	}
}

func TestJarMaxAgeUsesTheInjectedClock(t *testing.T) {
	frozen := time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)
	jar := newCookieJar()
	jar.now = func() time.Time { return frozen }
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"session=1; Path=/; Max-Age=60"})

	stored := jar.cookies["session;www.flightradar24.com;/"]

	if stored == nil {
		t.Fatal("the cookie was not stored")
	}
	if !stored.expires.Equal(frozen.Add(time.Minute)) {
		t.Errorf("got expiry %v, want it measured from the jar's clock", stored.expires)
	}
}

func TestJarDeleteOfAnAbsentCookieIsANoOp(t *testing.T) {
	jar := newCookieJar()
	jar.store(mustURL(t, "https://www.flightradar24.com/"), []string{"_frPl=token; Path=/"})

	jar.delete("AWSALB")

	if _, ok := jar.get("_frPl"); !ok {
		t.Error("deleting an absent cookie must leave the jar intact")
	}
}

func TestJarClampsAnEnormousMaxAge(t *testing.T) {
	// The nanosecond conversion used to wrap, turning a very long-lived cookie
	// into an expiry in the past — read as a deletion.
	now := time.Now()

	for _, maxAge := range []string{"9300000000", "99999999999999", "-99999999999999"} {
		jar := newCookieJar()
		jar.now = func() time.Time { return now }
		jar.store(mustURL(t, "https://www.flightradar24.com/"),
			[]string{"session=1; Path=/; Max-Age=" + maxAge})

		_, stored := jar.get("session")
		wantStored := !strings.HasPrefix(maxAge, "-")

		if stored != wantStored {
			t.Errorf("Max-Age=%s: stored=%v, want %v", maxAge, stored, wantStored)
		}
	}
}
