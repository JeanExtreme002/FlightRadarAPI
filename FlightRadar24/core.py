# -*- coding: utf-8 -*-

class Core(object):

    # Base URLs.
    cdn_flightradar_base_url = "https://cdn.flightradar24.com"
    flightradar_base_url = "https://www.flightradar24.com"
    data_live_base_url = "https://data-live.flightradar24.com"

    # Flights data URLs.
    real_time_flight_tracker_data_url = data_live_base_url + "/zones/fcgi/feed.js"
    flight_data_url = data_live_base_url + "/clickhandler/?flight={}"

    # Airports data URLs.
    airport_data_url = flightradar_base_url + "/airports/traffic-stats/?airport={}"
    airports_data_url = flightradar_base_url + "/_json/airports.php"

    # Airlines data URL.
    airlines_data_url = flightradar_base_url + "/_json/airlines.php"

    # Zones data URL.
    zones_data_url = flightradar_base_url + "/js/zones.js.php"

    # Country flag image URL.
    country_flag_url = flightradar_base_url + "/static/images/data/flags-small/{}.gif"

    # Airline logo image URL.
    airline_logo_url = cdn_flightradar_base_url + "/assets/airlines/logotypes/{}_{}.png"
    alternative_airline_logo_url = flightradar_base_url + "/static/images/data/operators/{}_logo0.png"

    headers = {
        "accept-encoding": "gzip, br",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "max-age=0",
        "origin": "https://www.flightradar24.com",
        "referer": "https://www.flightradar24.com/",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36"
    }

    json_headers = headers.copy()
    json_headers["accept"] = "application/json"

    image_headers = headers.copy()
    image_headers["accept"] = "image/gif, image/jpg, image/jpeg, image/png"
