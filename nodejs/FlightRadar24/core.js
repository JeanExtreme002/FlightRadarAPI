class Core {
    constructor() {
        this.apiFlightradarBaseUrl = "https://api.flightradar24.com/common/v1";
        this.cdnFlightradarBaseUrl = "https://cdn.flightradar24.com";
        this.flightRadarBaseUrl = "https://www.flightradar24.com";
        this.dataLiveBaseUrl = "https://data-live.flightradar24.com";
        this.dataCloudBaseUrl = "https://data-cloud.flightradar24.com";

        // User login URL.
        this.userLoginUrl = this.flightRadarBaseUrl + "/user/login";
        this.userLogoutUrl = this.flightRadarBaseUrl + "/user/logout";

        // Most tracked data URL
        this.mostTrackedUrl = this.flightRadarBaseUrl + "/flights/most-tracked";

        // Search data URL
        this.searchDataUrl = this.flightRadarBaseUrl + "/v1/search/web/find?query={}&limit=50";

        // Flights data URLs.
        this.realTimeFlightTrackerDataUrl = this.dataCloudBaseUrl + "/zones/fcgi/feed.js";
        this.flightDataUrl = this.dataLiveBaseUrl + "/clickhandler/?flight={}";

        // Airports data URLs.
        this.apiAirportDataUrl = this.apiFlightradarBaseUrl + "/airport.json";
        this.airportDataUrl = this.flightRadarBaseUrl + "/airports/traffic-stats/?airport={}";
        this.airportsDataUrl = this.flightRadarBaseUrl + "/_json/airports.php";

        // Airlines data URL.
        this.airlinesDataUrl = this.flightRadarBaseUrl + "/_json/airlines.php";

        // Zones data URL.
        this.zonesDataUrl = this.flightRadarBaseUrl + "/js/zones.js.php";

        // Country flag image URL.
        this.countryFlagUrl = this.flightRadarBaseUrl + "/static/images/data/flags-small/{}.svg";

        // Airline logo image URL.
        this.airlineLogoUrl = this.cdnFlightradarBaseUrl + "/assets/airlines/logotypes/{}_{}.png";
        this.alternativeAirlineLogoUrl = this.flightRadarBaseUrl + "/static/images/data/operators/{}_logo0.png";

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

        this.jsonHeaders = {accept: "application/json", ...this.headers};

        this.imageHeaders = {accept: "image/gif, image/jpg, image/jpeg, image/png", ...this.headers};
    }
}

module.exports = new Core();
