package flightradarapi

import (
	"fmt"
	"math"
	"reflect"
)

const earthRadiusKM = 6371

func radians(degrees float64) float64 { return degrees * (math.Pi / 180) }

func degrees(radians float64) float64 { return radians * (180 / math.Pi) }

// Positioned is anything with a location, so distances can be measured between
// an [Airport] and a [Flight].
type Positioned interface {
	Position() (latitude, longitude *float64)
}

// Entity is a real entity at some location. Both [Airport] and [Flight] embed it.
type Entity struct {
	// Latitude and Longitude are nil when the feed sent no usable position.
	Latitude  *float64
	Longitude *float64
}

// Position implements [Positioned].
func (e Entity) Position() (*float64, *float64) { return e.Latitude, e.Longitude }

func (e *Entity) setPosition(latitude, longitude *float64) {
	e.Latitude, e.Longitude = latitude, longitude
}

// GetDistanceFrom returns the distance from another entity, in kilometers.
func (e Entity) GetDistanceFrom(other Positioned) (float64, error) {
	// A nil *Flight in a non-nil interface is still nil: calling Position() on
	// it would panic where the caller expects this error.
	if other == nil || isNil(other) {
		return 0, fmt.Errorf("%w: cannot calculate distance: no other entity given", ErrFlightRadar)
	}

	otherLatitude, otherLongitude := other.Position()

	if e.Latitude == nil || e.Longitude == nil || otherLatitude == nil || otherLongitude == nil {
		return 0, fmt.Errorf("%w: cannot calculate distance: one or both entities have no position",
			ErrFlightRadar)
	}

	lat1, lon1 := radians(*e.Latitude), radians(*e.Longitude)
	lat2, lon2 := radians(*otherLatitude), radians(*otherLongitude)

	cosine := math.Sin(lat1)*math.Sin(lat2) + math.Cos(lat1)*math.Cos(lat2)*math.Cos(lon2-lon1)

	// Rounding can push the cosine just outside [-1, 1], where Acos is NaN.
	return math.Acos(math.Min(1, math.Max(-1, cosine))) * earthRadiusKM, nil
}

// isNil reports whether a non-nil interface holds a nil value.
func isNil(value any) bool {
	reflected := reflect.ValueOf(value)

	switch reflected.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Slice, reflect.Func, reflect.Chan:
		return reflected.IsNil()
	default:
		return false
	}
}
