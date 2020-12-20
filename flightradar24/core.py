# -*- coding: utf-8 -*-

class Core(object):

    base_url = "https://www.flightradar24.com"
    data_live_url = "https://data-live.flightradar24.com/zones/fcgi/feed.js"

    meta_data_endpoints = {
        "airports": "/_json/airports.php",
        "airlines": "/_json/airlines.php",
        "zones": "/js/zones.js.php"
        }

    headers = {
        "accept": "application/json, text/javascript, */*; q=0.01",
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
