export interface City {
  id: string;
  name: string;
}

export interface Country {
  id: string;
  name: string;
  flag: string;
  /** Relative strength of the domestic system — used later for progression difficulty. */
  strength: number; // 1..5
  cities: City[];
}

const city = (id: string, name: string): City => ({ id, name });

/**
 * Major cricketing nations a player can start their career in.
 * (No real modern player names anywhere in the game, per design.)
 */
export const COUNTRIES: Country[] = [
  {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    strength: 5,
    cities: [
      city('mumbai', 'Mumbai'),
      city('delhi', 'Delhi'),
      city('chennai', 'Chennai'),
      city('kolkata', 'Kolkata'),
      city('bengaluru', 'Bengaluru'),
      city('hyderabad', 'Hyderabad'),
    ],
  },
  {
    id: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    strength: 5,
    cities: [
      city('sydney', 'Sydney'),
      city('melbourne', 'Melbourne'),
      city('brisbane', 'Brisbane'),
      city('perth', 'Perth'),
      city('adelaide', 'Adelaide'),
    ],
  },
  {
    id: 'england',
    name: 'England',
    flag: 'ENG',
    strength: 5,
    cities: [
      city('london', 'London'),
      city('manchester', 'Manchester'),
      city('birmingham', 'Birmingham'),
      city('leeds', 'Leeds'),
      city('nottingham', 'Nottingham'),
    ],
  },
  {
    id: 'pakistan',
    name: 'Pakistan',
    flag: '🇵🇰',
    strength: 4,
    cities: [
      city('karachi', 'Karachi'),
      city('lahore', 'Lahore'),
      city('islamabad', 'Islamabad'),
      city('faisalabad', 'Faisalabad'),
      city('multan', 'Multan'),
    ],
  },
  {
    id: 'south_africa',
    name: 'South Africa',
    flag: '🇿🇦',
    strength: 4,
    cities: [
      city('johannesburg', 'Johannesburg'),
      city('cape_town', 'Cape Town'),
      city('durban', 'Durban'),
      city('pretoria', 'Pretoria'),
    ],
  },
  {
    id: 'new_zealand',
    name: 'New Zealand',
    flag: '🇳🇿',
    strength: 4,
    cities: [
      city('auckland', 'Auckland'),
      city('wellington', 'Wellington'),
      city('christchurch', 'Christchurch'),
      city('hamilton', 'Hamilton'),
    ],
  },
  {
    id: 'sri_lanka',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    strength: 3,
    cities: [city('colombo', 'Colombo'), city('kandy', 'Kandy'), city('galle', 'Galle')],
  },
  {
    id: 'west_indies',
    name: 'West Indies',
    flag: '🏝️',
    strength: 3,
    cities: [
      city('bridgetown', 'Bridgetown'),
      city('kingston', 'Kingston'),
      city('port_of_spain', 'Port of Spain'),
      city('georgetown', 'Georgetown'),
    ],
  },
  {
    id: 'bangladesh',
    name: 'Bangladesh',
    flag: '🇧🇩',
    strength: 3,
    cities: [city('dhaka', 'Dhaka'), city('chattogram', 'Chattogram'), city('khulna', 'Khulna')],
  },
  {
    id: 'afghanistan',
    name: 'Afghanistan',
    flag: '🇦🇫',
    strength: 2,
    cities: [city('kabul', 'Kabul'), city('kandahar', 'Kandahar')],
  },
  {
    id: 'zimbabwe',
    name: 'Zimbabwe',
    flag: '🇿🇼',
    strength: 2,
    cities: [city('harare', 'Harare'), city('bulawayo', 'Bulawayo')],
  },
  {
    id: 'ireland',
    name: 'Ireland',
    flag: '🇮🇪',
    strength: 2,
    cities: [city('dublin', 'Dublin'), city('belfast', 'Belfast')],
  },
  {
    id: 'scotland',
    name: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    strength: 2,
    cities: [city('edinburgh', 'Edinburgh'), city('glasgow', 'Glasgow'), city('aberdeen', 'Aberdeen')],
  },
  {
    id: 'netherlands',
    name: 'Netherlands',
    flag: '🇳🇱',
    strength: 2,
    cities: [city('amsterdam', 'Amsterdam'), city('rotterdam', 'Rotterdam'), city('the_hague', 'The Hague')],
  },
  {
    id: 'uae',
    name: 'UAE',
    flag: '🇦🇪',
    strength: 2,
    cities: [city('dubai', 'Dubai'), city('abu_dhabi', 'Abu Dhabi'), city('sharjah', 'Sharjah')],
  },
  {
    id: 'usa',
    name: 'USA',
    flag: '🇺🇸',
    strength: 2,
    cities: [city('new_york', 'New York'), city('los_angeles', 'Los Angeles'), city('dallas', 'Dallas'), city('houston', 'Houston')],
  },
  {
    id: 'namibia',
    name: 'Namibia',
    flag: '🇳🇦',
    strength: 1,
    cities: [city('windhoek', 'Windhoek'), city('walvis_bay', 'Walvis Bay')],
  },
  {
    id: 'png',
    name: 'Papua New Guinea',
    flag: '🇵🇬',
    strength: 1,
    cities: [city('port_moresby', 'Port Moresby'), city('lae', 'Lae')],
  },
];

export const COUNTRIES_BY_ID: Record<string, Country> = COUNTRIES.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {} as Record<string, Country>);

export function getCountry(id: string): Country | undefined {
  return COUNTRIES_BY_ID[id];
}

export function getCity(countryId: string, cityId: string): City | undefined {
  return getCountry(countryId)?.cities.find((c) => c.id === cityId);
}
