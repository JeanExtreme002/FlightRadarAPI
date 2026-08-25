// Code generated from python/FlightRadarAPI/zones.py. DO NOT EDIT.
//
// TestStaticZonesMatchThePythonSource fails when the Python source moves ahead
// of this file, which is the signal to regenerate it.

package flightradarapi

// Zone is a rectangular region of the globe, as FlightRadar24 defines it.
type Zone struct {
	TLY      float64         `json:"tl_y"`
	TLX      float64         `json:"tl_x"`
	BRY      float64         `json:"br_y"`
	BRX      float64         `json:"br_x"`
	Subzones map[string]Zone `json:"subzones,omitempty"`
}

// staticZones mirrors the payload of Core.zones_data_url, bundled so
// GetZones needs no request.
var staticZones = map[string]Zone{
	"europe": {
		TLY: 72.57,
		TLX: -16.96,
		BRY: 33.57,
		BRX: 53.05,
		Subzones: map[string]Zone{
			"poland": {
				TLY: 56.86,
				TLX: 11.06,
				BRY: 48.22,
				BRX: 28.26,
			},
			"germany": {
				TLY: 57.92,
				TLX: 1.81,
				BRY: 45.81,
				BRX: 16.83,
			},
			"uk": {
				TLY: 62.61,
				TLX: -13.07,
				BRY: 49.71,
				BRX: 3.46,
				Subzones: map[string]Zone{
					"london": {
						TLY: 53.06,
						TLX: -2.87,
						BRY: 50.07,
						BRX: 3.26,
					},
					"ireland": {
						TLY: 56.22,
						TLX: -11.71,
						BRY: 50.91,
						BRX: -4.4,
					},
				},
			},
			"spain": {
				TLY: 44.36,
				TLX: -11.06,
				BRY: 35.76,
				BRX: 4.04,
			},
			"france": {
				TLY: 51.07,
				TLX: -5.18,
				BRY: 42.17,
				BRX: 8.9,
			},
			"ceur": {
				TLY: 51.39,
				TLX: 11.25,
				BRY: 39.72,
				BRX: 32.55,
			},
			"scandinavia": {
				TLY: 72.12,
				TLX: -0.73,
				BRY: 53.82,
				BRX: 40.67,
			},
			"italy": {
				TLY: 47.67,
				TLX: 5.26,
				BRY: 36.27,
				BRX: 20.64,
			},
		},
	},
	"northamerica": {
		TLY: 75.0,
		TLX: -180.0,
		BRY: 3.0,
		BRX: -52.0,
		Subzones: map[string]Zone{
			"na_n": {
				TLY: 72.82,
				TLX: -177.97,
				BRY: 41.92,
				BRX: -52.48,
			},
			"na_c": {
				TLY: 54.66,
				TLX: -134.68,
				BRY: 22.16,
				BRX: -56.91,
				Subzones: map[string]Zone{
					"na_cny": {
						TLY: 45.06,
						TLX: -83.69,
						BRY: 35.96,
						BRX: -64.29,
					},
					"na_cla": {
						TLY: 37.91,
						TLX: -126.12,
						BRY: 30.21,
						BRX: -110.02,
					},
					"na_cat": {
						TLY: 35.86,
						TLX: -92.61,
						BRY: 22.56,
						BRX: -71.19,
					},
					"na_cse": {
						TLY: 49.12,
						TLX: -126.15,
						BRY: 42.97,
						BRX: -111.92,
					},
					"na_nw": {
						TLY: 54.12,
						TLX: -134.13,
						BRY: 38.32,
						BRX: -96.75,
					},
					"na_ne": {
						TLY: 53.72,
						TLX: -98.76,
						BRY: 38.22,
						BRX: -57.36,
					},
					"na_sw": {
						TLY: 38.92,
						TLX: -133.98,
						BRY: 22.62,
						BRX: -96.75,
					},
					"na_se": {
						TLY: 38.52,
						TLX: -98.62,
						BRY: 22.52,
						BRX: -57.36,
					},
					"na_cc": {
						TLY: 45.92,
						TLX: -116.88,
						BRY: 27.62,
						BRX: -75.91,
					},
				},
			},
			"na_s": {
				TLY: 41.92,
				TLX: -177.83,
				BRY: 3.82,
				BRX: -52.48,
			},
		},
	},
	"southamerica": {
		TLY: 16.0,
		TLX: -96.0,
		BRY: -57.0,
		BRX: -31.0,
	},
	"oceania": {
		TLY: 19.62,
		TLX: 88.4,
		BRY: -55.08,
		BRX: 180.0,
	},
	"asia": {
		TLY: 79.98,
		TLX: 40.91,
		BRY: 12.48,
		BRX: 179.77,
		Subzones: map[string]Zone{
			"japan": {
				TLY: 60.38,
				TLX: 113.5,
				BRY: 22.58,
				BRX: 176.47,
			},
		},
	},
	"africa": {
		TLY: 39.0,
		TLX: -29.0,
		BRY: -39.0,
		BRX: 55.0,
	},
	"atlantic": {
		TLY: 52.62,
		TLX: -50.9,
		BRY: 15.62,
		BRX: -4.75,
	},
	"maldives": {
		TLY: 10.72,
		TLX: 63.1,
		BRY: -6.08,
		BRX: 86.53,
	},
	"northatlantic": {
		TLY: 82.62,
		TLX: -84.53,
		BRY: 59.02,
		BRX: 4.45,
	},
}
