# Countries

The [airports listing](airports.md#airports-of-a-country) is narrowed by
country. Each SDK names the countries FlightRadar24 lists, 228 in all, so
you do not have to spell them.

::::{tab-set}
:sync-group: lang

:::{tab-item} Python
:sync: python

`Countries` is an `Enum`. The value of each member is the slug of the country.

```python
from FlightRadarAPI import Countries

Countries.BRAZIL.value          # "brazil"

airports = fr_api.get_airports([Countries.BRAZIL, Countries.UNITED_STATES])

for country in Countries:       # every country
    print(country.name, country.value)
```
:::

:::{tab-item} Node.js
:sync: node

`Countries` is a frozen object. Each property holds the slug of the country.

```javascript
const { Countries } = require("flightradarapi");

Countries.BRAZIL;               // "brazil"

const airports = await frApi.getAirports([Countries.BRAZIL, Countries.UNITED_STATES]);

for (const [name, slug] of Object.entries(Countries)) {   // every country
    console.log(name, slug);
}
```
:::

:::{tab-item} Go
:sync: go

`Country` is a string type, with one constant per country. Each constant holds
the slug of the country.

```go
flightradarapi.CountryBrazil    // "brazil"

airports, err := client.GetAirports(ctx, []flightradarapi.Country{
    flightradarapi.CountryBrazil,
    flightradarapi.CountryUnitedStates,
})

for _, country := range flightradarapi.AllCountries() {   // every country
    fmt.Println(country)
}
```
:::
::::

## Names and slugs

A slug is the name of a country the way FlightRadar24 spells it in its URLs:
lower case, with hyphens. The constants are a convenience, not a requirement.
Wherever a country is expected, a slug or a plain name works too, and is
normalized the same way: `"United States"`, `"united-states"` and
`Countries.UNITED_STATES` select the same country.

This also means a country FlightRadar24 adds before the SDK names it can be
reached by its name.

## All countries

The Python and Node.js names are the same.

| Python and Node.js | Go | Slug |
|---|---|---|
| `AFGHANISTAN` | `CountryAfghanistan` | `"afghanistan"` |
| `ALBANIA` | `CountryAlbania` | `"albania"` |
| `ALGERIA` | `CountryAlgeria` | `"algeria"` |
| `AMERICAN_SAMOA` | `CountryAmericanSamoa` | `"american-samoa"` |
| `ANGOLA` | `CountryAngola` | `"angola"` |
| `ANGUILLA` | `CountryAnguilla` | `"anguilla"` |
| `ANTARCTICA` | `CountryAntarctica` | `"antarctica"` |
| `ANTIGUA_AND_BARBUDA` | `CountryAntiguaAndBarbuda` | `"antigua-and-barbuda"` |
| `ARGENTINA` | `CountryArgentina` | `"argentina"` |
| `ARMENIA` | `CountryArmenia` | `"armenia"` |
| `ARUBA` | `CountryAruba` | `"aruba"` |
| `AUSTRALIA` | `CountryAustralia` | `"australia"` |
| `AUSTRIA` | `CountryAustria` | `"austria"` |
| `AZERBAIJAN` | `CountryAzerbaijan` | `"azerbaijan"` |
| `BAHAMAS` | `CountryBahamas` | `"bahamas"` |
| `BAHRAIN` | `CountryBahrain` | `"bahrain"` |
| `BANGLADESH` | `CountryBangladesh` | `"bangladesh"` |
| `BARBADOS` | `CountryBarbados` | `"barbados"` |
| `BELARUS` | `CountryBelarus` | `"belarus"` |
| `BELGIUM` | `CountryBelgium` | `"belgium"` |
| `BELIZE` | `CountryBelize` | `"belize"` |
| `BENIN` | `CountryBenin` | `"benin"` |
| `BERMUDA` | `CountryBermuda` | `"bermuda"` |
| `BHUTAN` | `CountryBhutan` | `"bhutan"` |
| `BOLIVIA` | `CountryBolivia` | `"bolivia"` |
| `BOSNIA_AND_HERZEGOVINA` | `CountryBosniaAndHerzegovina` | `"bosnia-and-herzegovina"` |
| `BOTSWANA` | `CountryBotswana` | `"botswana"` |
| `BRAZIL` | `CountryBrazil` | `"brazil"` |
| `BRUNEI` | `CountryBrunei` | `"brunei"` |
| `BULGARIA` | `CountryBulgaria` | `"bulgaria"` |
| `BURKINA_FASO` | `CountryBurkinaFaso` | `"burkina-faso"` |
| `BURUNDI` | `CountryBurundi` | `"burundi"` |
| `CAMBODIA` | `CountryCambodia` | `"cambodia"` |
| `CAMEROON` | `CountryCameroon` | `"cameroon"` |
| `CANADA` | `CountryCanada` | `"canada"` |
| `CAPE_VERDE` | `CountryCapeVerde` | `"cape-verde"` |
| `CAYMAN_ISLANDS` | `CountryCaymanIslands` | `"cayman-islands"` |
| `CENTRAL_AFRICAN_REPUBLIC` | `CountryCentralAfricanRepublic` | `"central-african-republic"` |
| `CHAD` | `CountryChad` | `"chad"` |
| `CHILE` | `CountryChile` | `"chile"` |
| `CHINA` | `CountryChina` | `"china"` |
| `COCOS_KEELING_ISLANDS` | `CountryCocosKeelingIslands` | `"cocos-keeling-islands"` |
| `COLOMBIA` | `CountryColombia` | `"colombia"` |
| `COMOROS` | `CountryComoros` | `"comoros"` |
| `CONGO` | `CountryCongo` | `"congo"` |
| `COOK_ISLANDS` | `CountryCookIslands` | `"cook-islands"` |
| `COSTA_RICA` | `CountryCostaRica` | `"costa-rica"` |
| `CROATIA` | `CountryCroatia` | `"croatia"` |
| `CUBA` | `CountryCuba` | `"cuba"` |
| `CURACAO` | `CountryCuracao` | `"curacao"` |
| `CYPRUS` | `CountryCyprus` | `"cyprus"` |
| `CZECHIA` | `CountryCzechia` | `"czechia"` |
| `DEMOCRATIC_REPUBLIC_OF_THE_CONGO` | `CountryDemocraticRepublicOfTheCongo` | `"democratic-republic-of-the-congo"` |
| `DENMARK` | `CountryDenmark` | `"denmark"` |
| `DJIBOUTI` | `CountryDjibouti` | `"djibouti"` |
| `DOMINICA` | `CountryDominica` | `"dominica"` |
| `DOMINICAN_REPUBLIC` | `CountryDominicanRepublic` | `"dominican-republic"` |
| `ECUADOR` | `CountryEcuador` | `"ecuador"` |
| `EGYPT` | `CountryEgypt` | `"egypt"` |
| `EL_SALVADOR` | `CountryElSalvador` | `"el-salvador"` |
| `EQUATORIAL_GUINEA` | `CountryEquatorialGuinea` | `"equatorial-guinea"` |
| `ERITREA` | `CountryEritrea` | `"eritrea"` |
| `ESTONIA` | `CountryEstonia` | `"estonia"` |
| `ESWATINI` | `CountryEswatini` | `"eswatini"` |
| `ETHIOPIA` | `CountryEthiopia` | `"ethiopia"` |
| `FALKLAND_ISLANDS_MALVINAS` | `CountryFalklandIslandsMalvinas` | `"falkland-islands-malvinas"` |
| `FAROE_ISLANDS` | `CountryFaroeIslands` | `"faroe-islands"` |
| `FIJI` | `CountryFiji` | `"fiji"` |
| `FINLAND` | `CountryFinland` | `"finland"` |
| `FRANCE` | `CountryFrance` | `"france"` |
| `FRENCH_GUIANA` | `CountryFrenchGuiana` | `"french-guiana"` |
| `FRENCH_POLYNESIA` | `CountryFrenchPolynesia` | `"french-polynesia"` |
| `GABON` | `CountryGabon` | `"gabon"` |
| `GAMBIA` | `CountryGambia` | `"gambia"` |
| `GEORGIA` | `CountryGeorgia` | `"georgia"` |
| `GERMANY` | `CountryGermany` | `"germany"` |
| `GHANA` | `CountryGhana` | `"ghana"` |
| `GIBRALTAR` | `CountryGibraltar` | `"gibraltar"` |
| `GREECE` | `CountryGreece` | `"greece"` |
| `GREENLAND` | `CountryGreenland` | `"greenland"` |
| `GRENADA` | `CountryGrenada` | `"grenada"` |
| `GUADELOUPE` | `CountryGuadeloupe` | `"guadeloupe"` |
| `GUAM` | `CountryGuam` | `"guam"` |
| `GUATEMALA` | `CountryGuatemala` | `"guatemala"` |
| `GUERNSEY` | `CountryGuernsey` | `"guernsey"` |
| `GUINEA` | `CountryGuinea` | `"guinea"` |
| `GUINEA_BISSAU` | `CountryGuineaBissau` | `"guinea-bissau"` |
| `GUYANA` | `CountryGuyana` | `"guyana"` |
| `HAITI` | `CountryHaiti` | `"haiti"` |
| `HONDURAS` | `CountryHonduras` | `"honduras"` |
| `HONG_KONG` | `CountryHongKong` | `"hong-kong"` |
| `HUNGARY` | `CountryHungary` | `"hungary"` |
| `ICELAND` | `CountryIceland` | `"iceland"` |
| `INDIA` | `CountryIndia` | `"india"` |
| `INDONESIA` | `CountryIndonesia` | `"indonesia"` |
| `IRAN` | `CountryIran` | `"iran"` |
| `IRAQ` | `CountryIraq` | `"iraq"` |
| `IRELAND` | `CountryIreland` | `"ireland"` |
| `ISLE_OF_MAN` | `CountryIsleOfMan` | `"isle-of-man"` |
| `ISRAEL` | `CountryIsrael` | `"israel"` |
| `ITALY` | `CountryItaly` | `"italy"` |
| `IVORY_COAST` | `CountryIvoryCoast` | `"ivory-coast"` |
| `JAMAICA` | `CountryJamaica` | `"jamaica"` |
| `JAPAN` | `CountryJapan` | `"japan"` |
| `JERSEY` | `CountryJersey` | `"jersey"` |
| `JORDAN` | `CountryJordan` | `"jordan"` |
| `KAZAKHSTAN` | `CountryKazakhstan` | `"kazakhstan"` |
| `KENYA` | `CountryKenya` | `"kenya"` |
| `KIRIBATI` | `CountryKiribati` | `"kiribati"` |
| `KOSOVO` | `CountryKosovo` | `"kosovo"` |
| `KUWAIT` | `CountryKuwait` | `"kuwait"` |
| `KYRGYZSTAN` | `CountryKyrgyzstan` | `"kyrgyzstan"` |
| `LAOS` | `CountryLaos` | `"laos"` |
| `LATVIA` | `CountryLatvia` | `"latvia"` |
| `LEBANON` | `CountryLebanon` | `"lebanon"` |
| `LESOTHO` | `CountryLesotho` | `"lesotho"` |
| `LIBERIA` | `CountryLiberia` | `"liberia"` |
| `LIBYA` | `CountryLibya` | `"libya"` |
| `LITHUANIA` | `CountryLithuania` | `"lithuania"` |
| `LUXEMBOURG` | `CountryLuxembourg` | `"luxembourg"` |
| `MACAO` | `CountryMacao` | `"macao"` |
| `MADAGASCAR` | `CountryMadagascar` | `"madagascar"` |
| `MALAWI` | `CountryMalawi` | `"malawi"` |
| `MALAYSIA` | `CountryMalaysia` | `"malaysia"` |
| `MALDIVES` | `CountryMaldives` | `"maldives"` |
| `MALI` | `CountryMali` | `"mali"` |
| `MALTA` | `CountryMalta` | `"malta"` |
| `MARSHALL_ISLANDS` | `CountryMarshallIslands` | `"marshall-islands"` |
| `MARTINIQUE` | `CountryMartinique` | `"martinique"` |
| `MAURITANIA` | `CountryMauritania` | `"mauritania"` |
| `MAURITIUS` | `CountryMauritius` | `"mauritius"` |
| `MAYOTTE` | `CountryMayotte` | `"mayotte"` |
| `MEXICO` | `CountryMexico` | `"mexico"` |
| `MICRONESIA` | `CountryMicronesia` | `"micronesia"` |
| `MOLDOVA` | `CountryMoldova` | `"moldova"` |
| `MONACO` | `CountryMonaco` | `"monaco"` |
| `MONGOLIA` | `CountryMongolia` | `"mongolia"` |
| `MONTENEGRO` | `CountryMontenegro` | `"montenegro"` |
| `MONTSERRAT` | `CountryMontserrat` | `"montserrat"` |
| `MOROCCO` | `CountryMorocco` | `"morocco"` |
| `MOZAMBIQUE` | `CountryMozambique` | `"mozambique"` |
| `MYANMAR_BURMA` | `CountryMyanmarBurma` | `"myanmar-burma"` |
| `NAMIBIA` | `CountryNamibia` | `"namibia"` |
| `NAURU` | `CountryNauru` | `"nauru"` |
| `NEPAL` | `CountryNepal` | `"nepal"` |
| `NETHERLANDS` | `CountryNetherlands` | `"netherlands"` |
| `NEW_CALEDONIA` | `CountryNewCaledonia` | `"new-caledonia"` |
| `NEW_ZEALAND` | `CountryNewZealand` | `"new-zealand"` |
| `NICARAGUA` | `CountryNicaragua` | `"nicaragua"` |
| `NIGER` | `CountryNiger` | `"niger"` |
| `NIGERIA` | `CountryNigeria` | `"nigeria"` |
| `NORTH_KOREA` | `CountryNorthKorea` | `"north-korea"` |
| `NORTH_MACEDONIA` | `CountryNorthMacedonia` | `"north-macedonia"` |
| `NORTHERN_MARIANA_ISLANDS` | `CountryNorthernMarianaIslands` | `"northern-mariana-islands"` |
| `NORWAY` | `CountryNorway` | `"norway"` |
| `OMAN` | `CountryOman` | `"oman"` |
| `PAKISTAN` | `CountryPakistan` | `"pakistan"` |
| `PALAU` | `CountryPalau` | `"palau"` |
| `PANAMA` | `CountryPanama` | `"panama"` |
| `PAPUA_NEW_GUINEA` | `CountryPapuaNewGuinea` | `"papua-new-guinea"` |
| `PARAGUAY` | `CountryParaguay` | `"paraguay"` |
| `PERU` | `CountryPeru` | `"peru"` |
| `PHILIPPINES` | `CountryPhilippines` | `"philippines"` |
| `POLAND` | `CountryPoland` | `"poland"` |
| `PORTUGAL` | `CountryPortugal` | `"portugal"` |
| `PUERTO_RICO` | `CountryPuertoRico` | `"puerto-rico"` |
| `QATAR` | `CountryQatar` | `"qatar"` |
| `REUNION` | `CountryReunion` | `"reunion"` |
| `ROMANIA` | `CountryRomania` | `"romania"` |
| `RUSSIA` | `CountryRussia` | `"russia"` |
| `RWANDA` | `CountryRwanda` | `"rwanda"` |
| `SAINT_HELENA` | `CountrySaintHelena` | `"saint-helena"` |
| `SAINT_KITTS_AND_NEVIS` | `CountrySaintKittsAndNevis` | `"saint-kitts-and-nevis"` |
| `SAINT_LUCIA` | `CountrySaintLucia` | `"saint-lucia"` |
| `SAINT_PIERRE_AND_MIQUELON` | `CountrySaintPierreAndMiquelon` | `"saint-pierre-and-miquelon"` |
| `SAINT_VINCENT_AND_THE_GRENADINES` | `CountrySaintVincentAndTheGrenadines` | `"saint-vincent-and-the-grenadines"` |
| `SAMOA` | `CountrySamoa` | `"samoa"` |
| `SAO_TOME_AND_PRINCIPE` | `CountrySaoTomeAndPrincipe` | `"sao-tome-and-principe"` |
| `SAUDI_ARABIA` | `CountrySaudiArabia` | `"saudi-arabia"` |
| `SENEGAL` | `CountrySenegal` | `"senegal"` |
| `SERBIA` | `CountrySerbia` | `"serbia"` |
| `SEYCHELLES` | `CountrySeychelles` | `"seychelles"` |
| `SIERRA_LEONE` | `CountrySierraLeone` | `"sierra-leone"` |
| `SINGAPORE` | `CountrySingapore` | `"singapore"` |
| `SLOVAKIA` | `CountrySlovakia` | `"slovakia"` |
| `SLOVENIA` | `CountrySlovenia` | `"slovenia"` |
| `SOLOMON_ISLANDS` | `CountrySolomonIslands` | `"solomon-islands"` |
| `SOMALIA` | `CountrySomalia` | `"somalia"` |
| `SOUTH_AFRICA` | `CountrySouthAfrica` | `"south-africa"` |
| `SOUTH_KOREA` | `CountrySouthKorea` | `"south-korea"` |
| `SOUTH_SUDAN` | `CountrySouthSudan` | `"south-sudan"` |
| `SPAIN` | `CountrySpain` | `"spain"` |
| `SRI_LANKA` | `CountrySriLanka` | `"sri-lanka"` |
| `SUDAN` | `CountrySudan` | `"sudan"` |
| `SURINAME` | `CountrySuriname` | `"suriname"` |
| `SWEDEN` | `CountrySweden` | `"sweden"` |
| `SWITZERLAND` | `CountrySwitzerland` | `"switzerland"` |
| `SYRIA` | `CountrySyria` | `"syria"` |
| `TAIWAN` | `CountryTaiwan` | `"taiwan"` |
| `TAJIKISTAN` | `CountryTajikistan` | `"tajikistan"` |
| `TANZANIA` | `CountryTanzania` | `"tanzania"` |
| `THAILAND` | `CountryThailand` | `"thailand"` |
| `TIMOR_LESTE_EAST_TIMOR` | `CountryTimorLesteEastTimor` | `"timor-leste-east-timor"` |
| `TOGO` | `CountryTogo` | `"togo"` |
| `TONGA` | `CountryTonga` | `"tonga"` |
| `TRINIDAD_AND_TOBAGO` | `CountryTrinidadAndTobago` | `"trinidad-and-tobago"` |
| `TUNISIA` | `CountryTunisia` | `"tunisia"` |
| `TURKEY` | `CountryTurkey` | `"turkey"` |
| `TURKMENISTAN` | `CountryTurkmenistan` | `"turkmenistan"` |
| `TURKS_AND_CAICOS_ISLANDS` | `CountryTurksAndCaicosIslands` | `"turks-and-caicos-islands"` |
| `TUVALU` | `CountryTuvalu` | `"tuvalu"` |
| `UGANDA` | `CountryUganda` | `"uganda"` |
| `UKRAINE` | `CountryUkraine` | `"ukraine"` |
| `UNITED_ARAB_EMIRATES` | `CountryUnitedArabEmirates` | `"united-arab-emirates"` |
| `UNITED_KINGDOM` | `CountryUnitedKingdom` | `"united-kingdom"` |
| `UNITED_STATES` | `CountryUnitedStates` | `"united-states"` |
| `UNITED_STATES_MINOR_OUTLYING_ISLANDS` | `CountryUnitedStatesMinorOutlyingIslands` | `"united-states-minor-outlying-islands"` |
| `URUGUAY` | `CountryUruguay` | `"uruguay"` |
| `UZBEKISTAN` | `CountryUzbekistan` | `"uzbekistan"` |
| `VANUATU` | `CountryVanuatu` | `"vanuatu"` |
| `VENEZUELA` | `CountryVenezuela` | `"venezuela"` |
| `VIETNAM` | `CountryVietnam` | `"vietnam"` |
| `VIRGIN_ISLANDS_BRITISH` | `CountryVirginIslandsBritish` | `"virgin-islands-british"` |
| `VIRGIN_ISLANDS_US` | `CountryVirginIslandsUs` | `"virgin-islands-us"` |
| `WALLIS_AND_FUTUNA` | `CountryWallisAndFutuna` | `"wallis-and-futuna"` |
| `YEMEN` | `CountryYemen` | `"yemen"` |
| `ZAMBIA` | `CountryZambia` | `"zambia"` |
| `ZIMBABWE` | `CountryZimbabwe` | `"zimbabwe"` |
