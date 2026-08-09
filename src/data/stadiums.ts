/**
 * Fictional venues with playing characteristics. No real stadium names are used.
 *
 * The three biases are small multipliers centred on 1.0 (roughly 0.9..1.15) that
 * describe how a venue nudges the match engine:
 *   - paceBias    > 1  → more pace-bowling threat (seam/bounce/swing help).
 *   - spinBias    > 1  → more spin-bowling threat (turn/grip, dusty surfaces).
 *   - scoringBias > 1  → higher-scoring in general (true bounce, quick outfield,
 *                        shorter boundaries); < 1 → a bowler-friendly, low-scoring ground.
 *
 * `country` holds the country id from data/countries.ts (e.g. 'india').
 */
export interface Stadium {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  paceBias: number;
  spinBias: number;
  scoringBias: number;
}

export const STADIUMS: Stadium[] = [
  // India — a coastal batting belter and an inland dustbowl.
  {
    id: 'ind_mumbai_marine_oval',
    name: 'Marine Drive Oval',
    city: 'Mumbai',
    country: 'india',
    capacity: 33000,
    paceBias: 1.02,
    spinBias: 0.95,
    scoringBias: 1.12,
  },
  {
    id: 'ind_chennai_furnace',
    name: 'The Furnace',
    city: 'Chennai',
    country: 'india',
    capacity: 38000,
    paceBias: 0.9,
    spinBias: 1.15,
    scoringBias: 0.93,
  },

  // Australia — raw pace-and-bounce and a cavernous big-boundary ground.
  {
    id: 'aus_perth_speedbowl',
    name: 'Westland Speedbowl',
    city: 'Perth',
    country: 'australia',
    capacity: 24000,
    paceBias: 1.15,
    spinBias: 0.9,
    scoringBias: 1.05,
  },
  {
    id: 'aus_melbourne_colosseum',
    name: 'Southern Colosseum',
    city: 'Melbourne',
    country: 'australia',
    capacity: 98000,
    paceBias: 1.05,
    spinBias: 0.98,
    scoringBias: 0.95,
  },

  // England — a swinging green seamer and a true, flat metropolitan strip.
  {
    id: 'eng_manchester_greenpark',
    name: 'Greenmoss Park',
    city: 'Manchester',
    country: 'england',
    capacity: 26000,
    paceBias: 1.13,
    spinBias: 0.92,
    scoringBias: 0.9,
  },
  {
    id: 'eng_london_kingsmeadow',
    name: 'Kingsmeadow Ground',
    city: 'London',
    country: 'england',
    capacity: 30000,
    paceBias: 1.0,
    spinBias: 0.98,
    scoringBias: 1.05,
  },

  // Pakistan — a flat run-fest and a dry, reverse-swinging turner.
  {
    id: 'pak_karachi_seaside',
    name: 'Seaside Arena',
    city: 'Karachi',
    country: 'pakistan',
    capacity: 34000,
    paceBias: 0.98,
    spinBias: 1.0,
    scoringBias: 1.14,
  },
  {
    id: 'pak_multan_dustbowl',
    name: 'Sandstorm Ground',
    city: 'Multan',
    country: 'pakistan',
    capacity: 22000,
    paceBias: 1.02,
    spinBias: 1.12,
    scoringBias: 0.96,
  },

  // South Africa — high-altitude ball-flies and a scenic pace-and-bounce venue.
  {
    id: 'rsa_johannesburg_highveld',
    name: 'Highveld Amphitheatre',
    city: 'Johannesburg',
    country: 'south_africa',
    capacity: 34000,
    paceBias: 1.12,
    spinBias: 0.9,
    scoringBias: 1.1,
  },
  {
    id: 'rsa_capetown_capeground',
    name: 'Cape Point Ground',
    city: 'Cape Town',
    country: 'south_africa',
    capacity: 25000,
    paceBias: 1.08,
    spinBias: 0.95,
    scoringBias: 1.0,
  },

  // New Zealand — a windy swing bowler's paradise and a small batting ground.
  {
    id: 'nzl_wellington_windgarden',
    name: 'Windward Garden',
    city: 'Wellington',
    country: 'new_zealand',
    capacity: 34000,
    paceBias: 1.12,
    spinBias: 0.9,
    scoringBias: 0.92,
  },
  {
    id: 'nzl_hamilton_meadow',
    name: 'Rivermeadow Park',
    city: 'Hamilton',
    country: 'new_zealand',
    capacity: 12000,
    paceBias: 1.0,
    spinBias: 0.97,
    scoringBias: 1.08,
  },

  // Sri Lanka — a fabled dusty turner and a humid, true batting strip.
  {
    id: 'lka_galle_fortress',
    name: 'Old Fort Ground',
    city: 'Galle',
    country: 'sri_lanka',
    capacity: 15000,
    paceBias: 0.92,
    spinBias: 1.15,
    scoringBias: 0.94,
  },
  {
    id: 'lka_colombo_lagoon',
    name: 'Lagoonside Stadium',
    city: 'Colombo',
    country: 'sri_lanka',
    capacity: 30000,
    paceBias: 0.97,
    spinBias: 1.05,
    scoringBias: 1.03,
  },

  // West Indies — a breezy bouncer's deck and a calypso run-fest.
  {
    id: 'wi_bridgetown_tradewinds',
    name: 'Tradewinds Oval',
    city: 'Bridgetown',
    country: 'west_indies',
    capacity: 28000,
    paceBias: 1.1,
    spinBias: 0.93,
    scoringBias: 1.02,
  },
  {
    id: 'wi_kingston_carnival',
    name: 'Carnival Grounds',
    city: 'Kingston',
    country: 'west_indies',
    capacity: 20000,
    paceBias: 1.03,
    spinBias: 0.95,
    scoringBias: 1.12,
  },

  // Bangladesh — a low, slow, gripping turner.
  {
    id: 'ban_dhaka_delta',
    name: 'Delta Bowl',
    city: 'Dhaka',
    country: 'bangladesh',
    capacity: 26000,
    paceBias: 0.9,
    spinBias: 1.13,
    scoringBias: 0.9,
  },

  // Afghanistan — a dry, dusty high-altitude turner.
  {
    id: 'afg_kabul_highland',
    name: 'Highland Arena',
    city: 'Kabul',
    country: 'afghanistan',
    capacity: 14000,
    paceBias: 0.95,
    spinBias: 1.14,
    scoringBias: 0.98,
  },

  // Zimbabwe — a flat, fair, true-bouncing ground.
  {
    id: 'zim_harare_sunflower',
    name: 'Sunflower Park',
    city: 'Harare',
    country: 'zimbabwe',
    capacity: 10000,
    paceBias: 1.0,
    spinBias: 1.02,
    scoringBias: 1.0,
  },
  {
    id: 'zim_bulawayo_queens',
    name: "Queen's Meadow",
    city: 'Bulawayo',
    country: 'zimbabwe',
    capacity: 8500,
    paceBias: 1.04,
    spinBias: 0.98,
    scoringBias: 1.06,
  },

  // Ireland — a cold, green, seam-and-swing bowler's ground.
  {
    id: 'ire_dublin_emerald',
    name: 'Emerald Field',
    city: 'Dublin',
    country: 'ireland',
    capacity: 11000,
    paceBias: 1.12,
    spinBias: 0.9,
    scoringBias: 0.9,
  },
  {
    id: 'ire_belfast_titanic',
    name: 'Titanic Arena',
    city: 'Belfast',
    country: 'ireland',
    capacity: 9000,
    paceBias: 1.1,
    spinBias: 0.92,
    scoringBias: 0.88,
  },

  // India — additional venues
  {
    id: 'ind_kolkata_eastern',
    name: 'Eastern Fortress',
    city: 'Kolkata',
    country: 'india',
    capacity: 66000,
    paceBias: 0.97,
    spinBias: 1.08,
    scoringBias: 1.02,
  },
  {
    id: 'ind_delhi_capital',
    name: 'Capital Bowl',
    city: 'Delhi',
    country: 'india',
    capacity: 41000,
    paceBias: 1.0,
    spinBias: 1.05,
    scoringBias: 1.04,
  },
  {
    id: 'ind_bengaluru_garden',
    name: 'Garden City Ground',
    city: 'Bengaluru',
    country: 'india',
    capacity: 36000,
    paceBias: 1.01,
    spinBias: 1.03,
    scoringBias: 1.08,
  },
  {
    id: 'ind_hyderabad_diamond',
    name: 'Diamond Park',
    city: 'Hyderabad',
    country: 'india',
    capacity: 35000,
    paceBias: 0.98,
    spinBias: 1.06,
    scoringBias: 1.1,
  },

  // Australia — additional venues
  {
    id: 'aus_sydney_harbour',
    name: 'Harbour City Ground',
    city: 'Sydney',
    country: 'australia',
    capacity: 46000,
    paceBias: 1.06,
    spinBias: 0.96,
    scoringBias: 1.07,
  },
  {
    id: 'aus_brisbane_canyon',
    name: 'River Canyon Oval',
    city: 'Brisbane',
    country: 'australia',
    capacity: 42000,
    paceBias: 1.12,
    spinBias: 0.91,
    scoringBias: 1.04,
  },
  {
    id: 'aus_adelaide_oval',
    name: 'Riverbank Stadium',
    city: 'Adelaide',
    country: 'australia',
    capacity: 50000,
    paceBias: 1.04,
    spinBias: 1.0,
    scoringBias: 1.09,
  },

  // England — additional venues
  {
    id: 'eng_birmingham_edgbaston',
    name: 'Edgewood Fortress',
    city: 'Birmingham',
    country: 'england',
    capacity: 25000,
    paceBias: 1.08,
    spinBias: 0.95,
    scoringBias: 0.94,
  },
  {
    id: 'eng_leeds_headingley',
    name: 'Headrow Ground',
    city: 'Leeds',
    country: 'england',
    capacity: 18000,
    paceBias: 1.1,
    spinBias: 0.93,
    scoringBias: 0.92,
  },
  {
    id: 'eng_nottingham_forest',
    name: 'Sherwood Oval',
    city: 'Nottingham',
    country: 'england',
    capacity: 17000,
    paceBias: 1.07,
    spinBias: 0.96,
    scoringBias: 1.0,
  },

  // Pakistan — additional venues
  {
    id: 'pak_lahore_gaddafi',
    name: 'Liberty Stadium',
    city: 'Lahore',
    country: 'pakistan',
    capacity: 28000,
    paceBias: 1.0,
    spinBias: 1.04,
    scoringBias: 1.08,
  },
  {
    id: 'pak_islamabad_capital',
    name: 'Capital Cricket Ground',
    city: 'Islamabad',
    country: 'pakistan',
    capacity: 18000,
    paceBias: 1.03,
    spinBias: 1.0,
    scoringBias: 1.05,
  },

  // South Africa — additional venues
  {
    id: 'rsa_durban_coast',
    name: 'Beachfront Arena',
    city: 'Durban',
    country: 'south_africa',
    capacity: 25000,
    paceBias: 1.05,
    spinBias: 0.97,
    scoringBias: 1.08,
  },
  {
    id: 'rsa_pretoria_centurion',
    name: 'Jacaranda Ground',
    city: 'Pretoria',
    country: 'south_africa',
    capacity: 22000,
    paceBias: 1.09,
    spinBias: 0.93,
    scoringBias: 1.05,
  },

  // New Zealand — additional venues
  {
    id: 'nzl_auckland_eden',
    name: 'Volcano Park',
    city: 'Auckland',
    country: 'new_zealand',
    capacity: 25000,
    paceBias: 1.04,
    spinBias: 0.96,
    scoringBias: 1.06,
  },
  {
    id: 'nzl_christchurch_hagley',
    name: 'Cathedral Oval',
    city: 'Christchurch',
    country: 'new_zealand',
    capacity: 18000,
    paceBias: 1.08,
    spinBias: 0.94,
    scoringBias: 1.01,
  },

  // Sri Lanka — additional venue
  {
    id: 'lka_kandy_highlands',
    name: 'Highlands International',
    city: 'Kandy',
    country: 'sri_lanka',
    capacity: 20000,
    paceBias: 0.94,
    spinBias: 1.12,
    scoringBias: 0.96,
  },

  // West Indies — additional venues
  {
    id: 'wi_port_of_spain_queens',
    name: "Queen's Oval",
    city: 'Port of Spain',
    country: 'west_indies',
    capacity: 22000,
    paceBias: 1.05,
    spinBias: 0.97,
    scoringBias: 1.06,
  },
  {
    id: 'wi_georgetown_providence',
    name: 'Providence Park',
    city: 'Georgetown',
    country: 'west_indies',
    capacity: 15000,
    paceBias: 1.02,
    spinBias: 1.0,
    scoringBias: 1.09,
  },

  // Bangladesh — additional venue
  {
    id: 'ban_chattogram_mar_amatola',
    name: 'Port City Arena',
    city: 'Chattogram',
    country: 'bangladesh',
    capacity: 20000,
    paceBias: 0.92,
    spinBias: 1.1,
    scoringBias: 0.94,
  },

  // Afghanistan — additional venue
  {
    id: 'afg_kandahar_south',
    name: 'Southside Plateau',
    city: 'Kandahar',
    country: 'afghanistan',
    capacity: 10000,
    paceBias: 0.97,
    spinBias: 1.12,
    scoringBias: 0.99,
  },

  // Scotland — new
  {
    id: 'sco_edinburgh_castle',
    name: 'Castle Ridge Ground',
    city: 'Edinburgh',
    country: 'scotland',
    capacity: 8000,
    paceBias: 1.13,
    spinBias: 0.88,
    scoringBias: 0.87,
  },
  {
    id: 'sco_glasgow_clyde',
    name: 'Clyde Valley Oval',
    city: 'Glasgow',
    country: 'scotland',
    capacity: 7000,
    paceBias: 1.11,
    spinBias: 0.9,
    scoringBias: 0.89,
  },

  // Netherlands — new
  {
    id: 'ned_amsterdam_windmill',
    name: 'Windmill Park',
    city: 'Amsterdam',
    country: 'netherlands',
    capacity: 10000,
    paceBias: 1.06,
    spinBias: 0.94,
    scoringBias: 0.96,
  },
  {
    id: 'ned_rotterdam_harbor',
    name: 'Harbor Bowl',
    city: 'Rotterdam',
    country: 'netherlands',
    capacity: 8500,
    paceBias: 1.05,
    spinBias: 0.95,
    scoringBias: 0.98,
  },

  // UAE — new
  {
    id: 'uae_dubai_desert',
    name: 'Desert International Stadium',
    city: 'Dubai',
    country: 'uae',
    capacity: 25000,
    paceBias: 1.0,
    spinBias: 1.08,
    scoringBias: 1.1,
  },
  {
    id: 'uae_sharjah_cricket',
    name: 'Sharjah Arena',
    city: 'Sharjah',
    country: 'uae',
    capacity: 16000,
    paceBias: 0.97,
    spinBias: 1.1,
    scoringBias: 1.12,
  },
  {
    id: 'uae_abu_dhabi_zayed',
    name: 'Zayed Oval',
    city: 'Abu Dhabi',
    country: 'uae',
    capacity: 20000,
    paceBias: 0.99,
    spinBias: 1.06,
    scoringBias: 1.08,
  },

  // USA — new
  {
    id: 'usa_new_york_nassau',
    name: 'Nassau County Arena',
    city: 'New York',
    country: 'usa',
    capacity: 34000,
    paceBias: 1.08,
    spinBias: 0.94,
    scoringBias: 1.05,
  },
  {
    id: 'usa_dallas_lone_star',
    name: 'Lone Star Cricket Ground',
    city: 'Dallas',
    country: 'usa',
    capacity: 18000,
    paceBias: 1.04,
    spinBias: 0.96,
    scoringBias: 1.08,
  },
  {
    id: 'usa_los_angeles_pacific',
    name: 'Pacific Oval',
    city: 'Los Angeles',
    country: 'usa',
    capacity: 15000,
    paceBias: 1.02,
    spinBias: 0.97,
    scoringBias: 1.1,
  },

  // Namibia — new
  {
    id: 'nam_windhoek_oryx',
    name: 'Oryx Ground',
    city: 'Windhoek',
    country: 'namibia',
    capacity: 6000,
    paceBias: 1.06,
    spinBias: 1.0,
    scoringBias: 1.02,
  },

  // Papua New Guinea — new
  {
    id: 'png_port_moresby_amini',
    name: 'Amini Park',
    city: 'Port Moresby',
    country: 'png',
    capacity: 8000,
    paceBias: 1.0,
    spinBias: 1.04,
    scoringBias: 1.05,
  },
];

/** All venues in a country. Matches the `country` id (case-insensitive). */
export function stadiumsForCountry(country: string): Stadium[] {
  const key = country.toLowerCase();
  return STADIUMS.filter((s) => s.country.toLowerCase() === key);
}

/**
 * Pick a venue for a match: prefer one in the given (home) country, otherwise
 * fall back to any venue. Deterministic — all randomness comes from `rng`.
 */
export function pickStadium(country: string, rng: () => number): Stadium {
  const home = stadiumsForCountry(country);
  const pool = home.length > 0 ? home : STADIUMS;
  return pool[Math.floor(rng() * pool.length)];
}
