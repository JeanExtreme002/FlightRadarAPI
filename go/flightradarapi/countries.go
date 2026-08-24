// Code generated from python/FlightRadarAPI/core.py. DO NOT EDIT.
//
// TestCountryConstantsMatchThePythonEnum fails when the Python enum moves ahead
// of this file, which is the signal to regenerate it.

package flightradarapi

import "slices"

// Country is a FlightRadar24 country slug, accepted by [Client.GetAirports], and
// the counterpart of the Countries enum in the Python and Node.js SDKs: what
// they spell Countries.BRAZIL is CountryBrazil here.
//
// Any spelling works: values are slugified before matching, so
// Country("Myanmar (Burma)") is the same filter as CountryMyanmarBurma.
type Country string

// Country slugs, as FlightRadar24 spells them in its data page URLs.
const (
	CountryAfghanistan                      Country = "afghanistan"
	CountryAlbania                          Country = "albania"
	CountryAlgeria                          Country = "algeria"
	CountryAmericanSamoa                    Country = "american-samoa"
	CountryAngola                           Country = "angola"
	CountryAnguilla                         Country = "anguilla"
	CountryAntarctica                       Country = "antarctica"
	CountryAntiguaAndBarbuda                Country = "antigua-and-barbuda"
	CountryArgentina                        Country = "argentina"
	CountryArmenia                          Country = "armenia"
	CountryAruba                            Country = "aruba"
	CountryAustralia                        Country = "australia"
	CountryAustria                          Country = "austria"
	CountryAzerbaijan                       Country = "azerbaijan"
	CountryBahamas                          Country = "bahamas"
	CountryBahrain                          Country = "bahrain"
	CountryBangladesh                       Country = "bangladesh"
	CountryBarbados                         Country = "barbados"
	CountryBelarus                          Country = "belarus"
	CountryBelgium                          Country = "belgium"
	CountryBelize                           Country = "belize"
	CountryBenin                            Country = "benin"
	CountryBermuda                          Country = "bermuda"
	CountryBhutan                           Country = "bhutan"
	CountryBolivia                          Country = "bolivia"
	CountryBosniaAndHerzegovina             Country = "bosnia-and-herzegovina"
	CountryBotswana                         Country = "botswana"
	CountryBrazil                           Country = "brazil"
	CountryBrunei                           Country = "brunei"
	CountryBulgaria                         Country = "bulgaria"
	CountryBurkinaFaso                      Country = "burkina-faso"
	CountryBurundi                          Country = "burundi"
	CountryCambodia                         Country = "cambodia"
	CountryCameroon                         Country = "cameroon"
	CountryCanada                           Country = "canada"
	CountryCapeVerde                        Country = "cape-verde"
	CountryCaymanIslands                    Country = "cayman-islands"
	CountryCentralAfricanRepublic           Country = "central-african-republic"
	CountryChad                             Country = "chad"
	CountryChile                            Country = "chile"
	CountryChina                            Country = "china"
	CountryCocosKeelingIslands              Country = "cocos-keeling-islands"
	CountryColombia                         Country = "colombia"
	CountryComoros                          Country = "comoros"
	CountryCongo                            Country = "congo"
	CountryCookIslands                      Country = "cook-islands"
	CountryCostaRica                        Country = "costa-rica"
	CountryCroatia                          Country = "croatia"
	CountryCuba                             Country = "cuba"
	CountryCuracao                          Country = "curacao"
	CountryCyprus                           Country = "cyprus"
	CountryCzechia                          Country = "czechia"
	CountryDemocraticRepublicOfTheCongo     Country = "democratic-republic-of-the-congo"
	CountryDenmark                          Country = "denmark"
	CountryDjibouti                         Country = "djibouti"
	CountryDominica                         Country = "dominica"
	CountryDominicanRepublic                Country = "dominican-republic"
	CountryEcuador                          Country = "ecuador"
	CountryEgypt                            Country = "egypt"
	CountryElSalvador                       Country = "el-salvador"
	CountryEquatorialGuinea                 Country = "equatorial-guinea"
	CountryEritrea                          Country = "eritrea"
	CountryEstonia                          Country = "estonia"
	CountryEswatini                         Country = "eswatini"
	CountryEthiopia                         Country = "ethiopia"
	CountryFalklandIslandsMalvinas          Country = "falkland-islands-malvinas"
	CountryFaroeIslands                     Country = "faroe-islands"
	CountryFiji                             Country = "fiji"
	CountryFinland                          Country = "finland"
	CountryFrance                           Country = "france"
	CountryFrenchGuiana                     Country = "french-guiana"
	CountryFrenchPolynesia                  Country = "french-polynesia"
	CountryGabon                            Country = "gabon"
	CountryGambia                           Country = "gambia"
	CountryGeorgia                          Country = "georgia"
	CountryGermany                          Country = "germany"
	CountryGhana                            Country = "ghana"
	CountryGibraltar                        Country = "gibraltar"
	CountryGreece                           Country = "greece"
	CountryGreenland                        Country = "greenland"
	CountryGrenada                          Country = "grenada"
	CountryGuadeloupe                       Country = "guadeloupe"
	CountryGuam                             Country = "guam"
	CountryGuatemala                        Country = "guatemala"
	CountryGuernsey                         Country = "guernsey"
	CountryGuinea                           Country = "guinea"
	CountryGuineaBissau                     Country = "guinea-bissau"
	CountryGuyana                           Country = "guyana"
	CountryHaiti                            Country = "haiti"
	CountryHonduras                         Country = "honduras"
	CountryHongKong                         Country = "hong-kong"
	CountryHungary                          Country = "hungary"
	CountryIceland                          Country = "iceland"
	CountryIndia                            Country = "india"
	CountryIndonesia                        Country = "indonesia"
	CountryIran                             Country = "iran"
	CountryIraq                             Country = "iraq"
	CountryIreland                          Country = "ireland"
	CountryIsleOfMan                        Country = "isle-of-man"
	CountryIsrael                           Country = "israel"
	CountryItaly                            Country = "italy"
	CountryIvoryCoast                       Country = "ivory-coast"
	CountryJamaica                          Country = "jamaica"
	CountryJapan                            Country = "japan"
	CountryJersey                           Country = "jersey"
	CountryJordan                           Country = "jordan"
	CountryKazakhstan                       Country = "kazakhstan"
	CountryKenya                            Country = "kenya"
	CountryKiribati                         Country = "kiribati"
	CountryKosovo                           Country = "kosovo"
	CountryKuwait                           Country = "kuwait"
	CountryKyrgyzstan                       Country = "kyrgyzstan"
	CountryLaos                             Country = "laos"
	CountryLatvia                           Country = "latvia"
	CountryLebanon                          Country = "lebanon"
	CountryLesotho                          Country = "lesotho"
	CountryLiberia                          Country = "liberia"
	CountryLibya                            Country = "libya"
	CountryLithuania                        Country = "lithuania"
	CountryLuxembourg                       Country = "luxembourg"
	CountryMacao                            Country = "macao"
	CountryMadagascar                       Country = "madagascar"
	CountryMalawi                           Country = "malawi"
	CountryMalaysia                         Country = "malaysia"
	CountryMaldives                         Country = "maldives"
	CountryMali                             Country = "mali"
	CountryMalta                            Country = "malta"
	CountryMarshallIslands                  Country = "marshall-islands"
	CountryMartinique                       Country = "martinique"
	CountryMauritania                       Country = "mauritania"
	CountryMauritius                        Country = "mauritius"
	CountryMayotte                          Country = "mayotte"
	CountryMexico                           Country = "mexico"
	CountryMicronesia                       Country = "micronesia"
	CountryMoldova                          Country = "moldova"
	CountryMonaco                           Country = "monaco"
	CountryMongolia                         Country = "mongolia"
	CountryMontenegro                       Country = "montenegro"
	CountryMontserrat                       Country = "montserrat"
	CountryMorocco                          Country = "morocco"
	CountryMozambique                       Country = "mozambique"
	CountryMyanmarBurma                     Country = "myanmar-burma"
	CountryNamibia                          Country = "namibia"
	CountryNauru                            Country = "nauru"
	CountryNepal                            Country = "nepal"
	CountryNetherlands                      Country = "netherlands"
	CountryNewCaledonia                     Country = "new-caledonia"
	CountryNewZealand                       Country = "new-zealand"
	CountryNicaragua                        Country = "nicaragua"
	CountryNiger                            Country = "niger"
	CountryNigeria                          Country = "nigeria"
	CountryNorthKorea                       Country = "north-korea"
	CountryNorthMacedonia                   Country = "north-macedonia"
	CountryNorthernMarianaIslands           Country = "northern-mariana-islands"
	CountryNorway                           Country = "norway"
	CountryOman                             Country = "oman"
	CountryPakistan                         Country = "pakistan"
	CountryPalau                            Country = "palau"
	CountryPanama                           Country = "panama"
	CountryPapuaNewGuinea                   Country = "papua-new-guinea"
	CountryParaguay                         Country = "paraguay"
	CountryPeru                             Country = "peru"
	CountryPhilippines                      Country = "philippines"
	CountryPoland                           Country = "poland"
	CountryPortugal                         Country = "portugal"
	CountryPuertoRico                       Country = "puerto-rico"
	CountryQatar                            Country = "qatar"
	CountryReunion                          Country = "reunion"
	CountryRomania                          Country = "romania"
	CountryRussia                           Country = "russia"
	CountryRwanda                           Country = "rwanda"
	CountrySaintHelena                      Country = "saint-helena"
	CountrySaintKittsAndNevis               Country = "saint-kitts-and-nevis"
	CountrySaintLucia                       Country = "saint-lucia"
	CountrySaintPierreAndMiquelon           Country = "saint-pierre-and-miquelon"
	CountrySaintVincentAndTheGrenadines     Country = "saint-vincent-and-the-grenadines"
	CountrySamoa                            Country = "samoa"
	CountrySaoTomeAndPrincipe               Country = "sao-tome-and-principe"
	CountrySaudiArabia                      Country = "saudi-arabia"
	CountrySenegal                          Country = "senegal"
	CountrySerbia                           Country = "serbia"
	CountrySeychelles                       Country = "seychelles"
	CountrySierraLeone                      Country = "sierra-leone"
	CountrySingapore                        Country = "singapore"
	CountrySlovakia                         Country = "slovakia"
	CountrySlovenia                         Country = "slovenia"
	CountrySolomonIslands                   Country = "solomon-islands"
	CountrySomalia                          Country = "somalia"
	CountrySouthAfrica                      Country = "south-africa"
	CountrySouthKorea                       Country = "south-korea"
	CountrySouthSudan                       Country = "south-sudan"
	CountrySpain                            Country = "spain"
	CountrySriLanka                         Country = "sri-lanka"
	CountrySudan                            Country = "sudan"
	CountrySuriname                         Country = "suriname"
	CountrySweden                           Country = "sweden"
	CountrySwitzerland                      Country = "switzerland"
	CountrySyria                            Country = "syria"
	CountryTaiwan                           Country = "taiwan"
	CountryTajikistan                       Country = "tajikistan"
	CountryTanzania                         Country = "tanzania"
	CountryThailand                         Country = "thailand"
	CountryTimorLesteEastTimor              Country = "timor-leste-east-timor"
	CountryTogo                             Country = "togo"
	CountryTonga                            Country = "tonga"
	CountryTrinidadAndTobago                Country = "trinidad-and-tobago"
	CountryTunisia                          Country = "tunisia"
	CountryTurkey                           Country = "turkey"
	CountryTurkmenistan                     Country = "turkmenistan"
	CountryTurksAndCaicosIslands            Country = "turks-and-caicos-islands"
	CountryTuvalu                           Country = "tuvalu"
	CountryUganda                           Country = "uganda"
	CountryUkraine                          Country = "ukraine"
	CountryUnitedArabEmirates               Country = "united-arab-emirates"
	CountryUnitedKingdom                    Country = "united-kingdom"
	CountryUnitedStates                     Country = "united-states"
	CountryUnitedStatesMinorOutlyingIslands Country = "united-states-minor-outlying-islands"
	CountryUruguay                          Country = "uruguay"
	CountryUzbekistan                       Country = "uzbekistan"
	CountryVanuatu                          Country = "vanuatu"
	CountryVenezuela                        Country = "venezuela"
	CountryVietnam                          Country = "vietnam"
	CountryVirginIslandsBritish             Country = "virgin-islands-british"
	CountryVirginIslandsUs                  Country = "virgin-islands-us"
	CountryWallisAndFutuna                  Country = "wallis-and-futuna"
	CountryYemen                            Country = "yemen"
	CountryZambia                           Country = "zambia"
	CountryZimbabwe                         Country = "zimbabwe"
)

// AllCountries returns every country above, in the order FR24 declares them —
// what list(Countries) gives in the Python port. The slice is a fresh copy, so
// a caller sorting or filtering it cannot corrupt the package's own data.
func AllCountries() []Country { return slices.Clone(allCountries) }

var allCountries = []Country{
	CountryAfghanistan,
	CountryAlbania,
	CountryAlgeria,
	CountryAmericanSamoa,
	CountryAngola,
	CountryAnguilla,
	CountryAntarctica,
	CountryAntiguaAndBarbuda,
	CountryArgentina,
	CountryArmenia,
	CountryAruba,
	CountryAustralia,
	CountryAustria,
	CountryAzerbaijan,
	CountryBahamas,
	CountryBahrain,
	CountryBangladesh,
	CountryBarbados,
	CountryBelarus,
	CountryBelgium,
	CountryBelize,
	CountryBenin,
	CountryBermuda,
	CountryBhutan,
	CountryBolivia,
	CountryBosniaAndHerzegovina,
	CountryBotswana,
	CountryBrazil,
	CountryBrunei,
	CountryBulgaria,
	CountryBurkinaFaso,
	CountryBurundi,
	CountryCambodia,
	CountryCameroon,
	CountryCanada,
	CountryCapeVerde,
	CountryCaymanIslands,
	CountryCentralAfricanRepublic,
	CountryChad,
	CountryChile,
	CountryChina,
	CountryCocosKeelingIslands,
	CountryColombia,
	CountryComoros,
	CountryCongo,
	CountryCookIslands,
	CountryCostaRica,
	CountryCroatia,
	CountryCuba,
	CountryCuracao,
	CountryCyprus,
	CountryCzechia,
	CountryDemocraticRepublicOfTheCongo,
	CountryDenmark,
	CountryDjibouti,
	CountryDominica,
	CountryDominicanRepublic,
	CountryEcuador,
	CountryEgypt,
	CountryElSalvador,
	CountryEquatorialGuinea,
	CountryEritrea,
	CountryEstonia,
	CountryEswatini,
	CountryEthiopia,
	CountryFalklandIslandsMalvinas,
	CountryFaroeIslands,
	CountryFiji,
	CountryFinland,
	CountryFrance,
	CountryFrenchGuiana,
	CountryFrenchPolynesia,
	CountryGabon,
	CountryGambia,
	CountryGeorgia,
	CountryGermany,
	CountryGhana,
	CountryGibraltar,
	CountryGreece,
	CountryGreenland,
	CountryGrenada,
	CountryGuadeloupe,
	CountryGuam,
	CountryGuatemala,
	CountryGuernsey,
	CountryGuinea,
	CountryGuineaBissau,
	CountryGuyana,
	CountryHaiti,
	CountryHonduras,
	CountryHongKong,
	CountryHungary,
	CountryIceland,
	CountryIndia,
	CountryIndonesia,
	CountryIran,
	CountryIraq,
	CountryIreland,
	CountryIsleOfMan,
	CountryIsrael,
	CountryItaly,
	CountryIvoryCoast,
	CountryJamaica,
	CountryJapan,
	CountryJersey,
	CountryJordan,
	CountryKazakhstan,
	CountryKenya,
	CountryKiribati,
	CountryKosovo,
	CountryKuwait,
	CountryKyrgyzstan,
	CountryLaos,
	CountryLatvia,
	CountryLebanon,
	CountryLesotho,
	CountryLiberia,
	CountryLibya,
	CountryLithuania,
	CountryLuxembourg,
	CountryMacao,
	CountryMadagascar,
	CountryMalawi,
	CountryMalaysia,
	CountryMaldives,
	CountryMali,
	CountryMalta,
	CountryMarshallIslands,
	CountryMartinique,
	CountryMauritania,
	CountryMauritius,
	CountryMayotte,
	CountryMexico,
	CountryMicronesia,
	CountryMoldova,
	CountryMonaco,
	CountryMongolia,
	CountryMontenegro,
	CountryMontserrat,
	CountryMorocco,
	CountryMozambique,
	CountryMyanmarBurma,
	CountryNamibia,
	CountryNauru,
	CountryNepal,
	CountryNetherlands,
	CountryNewCaledonia,
	CountryNewZealand,
	CountryNicaragua,
	CountryNiger,
	CountryNigeria,
	CountryNorthKorea,
	CountryNorthMacedonia,
	CountryNorthernMarianaIslands,
	CountryNorway,
	CountryOman,
	CountryPakistan,
	CountryPalau,
	CountryPanama,
	CountryPapuaNewGuinea,
	CountryParaguay,
	CountryPeru,
	CountryPhilippines,
	CountryPoland,
	CountryPortugal,
	CountryPuertoRico,
	CountryQatar,
	CountryReunion,
	CountryRomania,
	CountryRussia,
	CountryRwanda,
	CountrySaintHelena,
	CountrySaintKittsAndNevis,
	CountrySaintLucia,
	CountrySaintPierreAndMiquelon,
	CountrySaintVincentAndTheGrenadines,
	CountrySamoa,
	CountrySaoTomeAndPrincipe,
	CountrySaudiArabia,
	CountrySenegal,
	CountrySerbia,
	CountrySeychelles,
	CountrySierraLeone,
	CountrySingapore,
	CountrySlovakia,
	CountrySlovenia,
	CountrySolomonIslands,
	CountrySomalia,
	CountrySouthAfrica,
	CountrySouthKorea,
	CountrySouthSudan,
	CountrySpain,
	CountrySriLanka,
	CountrySudan,
	CountrySuriname,
	CountrySweden,
	CountrySwitzerland,
	CountrySyria,
	CountryTaiwan,
	CountryTajikistan,
	CountryTanzania,
	CountryThailand,
	CountryTimorLesteEastTimor,
	CountryTogo,
	CountryTonga,
	CountryTrinidadAndTobago,
	CountryTunisia,
	CountryTurkey,
	CountryTurkmenistan,
	CountryTurksAndCaicosIslands,
	CountryTuvalu,
	CountryUganda,
	CountryUkraine,
	CountryUnitedArabEmirates,
	CountryUnitedKingdom,
	CountryUnitedStates,
	CountryUnitedStatesMinorOutlyingIslands,
	CountryUruguay,
	CountryUzbekistan,
	CountryVanuatu,
	CountryVenezuela,
	CountryVietnam,
	CountryVirginIslandsBritish,
	CountryVirginIslandsUs,
	CountryWallisAndFutuna,
	CountryYemen,
	CountryZambia,
	CountryZimbabwe,
}
