class Core {
    constructor() {
        this.api_flightradar_base_url = "https://api.flightradar24.com/common/v1";
        this.cdn_flightradar_base_url = "https://cdn.flightradar24.com";
        this.flightradar_base_url = "https://www.flightradar24.com";
        this.data_live_base_url = "https://data-live.flightradar24.com";
        this.data_cloud_base_url = "https://data-cloud.flightradar24.com";

        // User login URL.
        this.user_login_url = this.flightradar_base_url + "/user/login";
        this.user_logout_url = this.flightradar_base_url + "/user/logout";

        // Most tracked data URL
        this.most_tracked_url = this.flightradar_base_url + "/flights/most-tracked";

        // Search data URL
        this.search_data_url = this.flightradar_base_url + "/v1/search/web/find?query={}&limit=50";

        // Flights data URLs.
        this.real_time_flight_tracker_data_url = this.data_cloud_base_url + "/zones/fcgi/feed.js";
        this.flight_data_url = this.data_live_base_url + "/clickhandler/?flight={}";

        // Airports data URLs.
        this.api_airport_data_url = this.api_flightradar_base_url + "/airport.json";
        this.airport_data_url = this.flightradar_base_url + "/airports/traffic-stats/?airport={}";
        this.airports_data_url = this.flightradar_base_url + "/_json/airports.php";

        // Airlines data URL.
        this.airlines_data_url = this.flightradar_base_url + "/_json/airlines.php";

        // Zones data URL.
        this.zones_data_url = this.flightradar_base_url + "/js/zones.js.php";

        // Country flag image URL.
        this.country_flag_url = this.flightradar_base_url + "/static/images/data/flags-small/{}.svg";

        // Airline logo image URL.
        this.airline_logo_url = this.cdn_flightradar_base_url + "/assets/airlines/logotypes/{}_{}.png";
        this.alternative_airline_logo_url = this.flightradar_base_url + "/static/images/data/operators/{}_logo0.png";

        this.headers = {
            "accept-encoding": "gzip, br",
            "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "max-age=0",
            "origin": "https://www.flightradar24.com",
            "referer": "https://www.flightradar24.com/",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "user-agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
        };

        this.json_headers = {accept: "application/json", ...this.headers};

        this.image_headers = {accept: "image/gif, image/jpg, image/jpeg, image/png", ...this.headers};
    }
}

module.exports = new Core();
