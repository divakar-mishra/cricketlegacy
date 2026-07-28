/**
 * Fictional name pools keyed by country id (see data/countries.ts).
 * Deliberately generic given/surnames — combined procedurally so no real
 * modern player is represented.
 */
interface NamePool {
  first: string[];
  last: string[];
}

export const NAME_POOLS: Record<string, NamePool> = {
  india: {
    first: ['Arjun', 'Rohan', 'Vikram', 'Sanjay', 'Aakash', 'Nikhil', 'Devang', 'Manish', 'Pranav', 'Karthik', 'Ishaan', 'Tejas'],
    last: ['Nair', 'Menon', 'Rao', 'Iyer', 'Chauhan', 'Reddy', 'Bose', 'Deshmukh', 'Pillai', 'Sethi', 'Grewal', 'Kulkarni'],
  },
  australia: {
    first: ['Jack', 'Cooper', 'Lachlan', 'Hayden', 'Riley', 'Brodie', 'Angus', 'Declan', 'Fletcher', 'Cormac', 'Darcy', 'Beau'],
    last: ['Whitmore', 'Callahan', 'Radcliffe', 'Hensley', 'Prescott', 'Kingsley', 'Marsden', 'Ashcroft', 'Barlow', 'Trentham', 'Vaughn', 'Kessler'],
  },
  england: {
    first: ['Oliver', 'Harry', 'Freddie', 'George', 'Charlie', 'Alfie', 'Rupert', 'Miles', 'Edmund', 'Sebastian', 'Toby', 'Reuben'],
    last: ['Ashworth', 'Pemberton', 'Fairfax', 'Holloway', 'Winterbourne', 'Radley', 'Halstead', 'Cavendish', 'Loxley', 'Thorne', 'Merrick', 'Barrington'],
  },
  pakistan: {
    first: ['Bilal', 'Hamza', 'Zohaib', 'Faraz', 'Junaid', 'Adnan', 'Rehan', 'Saad', 'Tariq', 'Usama', 'Waqas', 'Kashif'],
    last: ['Qureshi', 'Farooqi', 'Baig', 'Chaudhry', 'Durrani', 'Gilani', 'Rasheed', 'Suleman', 'Nawaz', 'Yousuf', 'Zaman', 'Mirza'],
  },
  south_africa: {
    first: ['Ruan', 'Pieter', 'Dewald', 'Marnus', 'Wynand', 'Hendrik', 'Stefan', 'Barend', 'Jaco', 'Riaan', 'Kobus', 'Anton'],
    last: ['van Zyl', 'Coetzee', 'Botha', 'Steyn', 'Pretorius', 'Nortje', 'du Toit', 'Venter', 'Swanepoel', 'Marais', 'Lombard', 'Erasmus'],
  },
  new_zealand: {
    first: ['Liam', 'Cody', 'Tane', 'Blake', 'Reuben', 'Jarrod', 'Kane', 'Ellis', 'Nathaniel', 'Corbin', 'Flynn', 'Marcus'],
    last: ['Harrow', 'Whittaker', 'Sinclair', 'Kingi', 'Ferns', 'Marlowe', 'Ngata', 'Boyle', 'Hargreave', 'Tipene', 'Ford', 'Blackwell'],
  },
  sri_lanka: {
    first: ['Dinuka', 'Sahan', 'Chamith', 'Lahiru', 'Nuwan', 'Ishara', 'Kavindu', 'Tharindu', 'Sanjula', 'Praveen', 'Ravindu', 'Sadeep'],
    last: ['Perera', 'Fernando', 'Bandara', 'Jayasuriya', 'Rathnayake', 'Wickrama', 'Gunaratne', 'Herath', 'Senanayake', 'Dias', 'Weerasinghe', 'Alahakoon'],
  },
  west_indies: {
    first: ['Kemar', 'Andre', 'Shamar', 'Devon', 'Roston', 'Nkrumah', 'Akeem', 'Jaden', 'Romario', 'Tevin', 'Kadeem', 'Shaquan'],
    last: ['Boucher', 'Grantley', 'Wharton', 'Sealy', 'Roachford', 'Blackman', 'Prescod', 'Alleyne', 'Greaves', 'Padmore', 'Layne', 'Beckles'],
  },
  bangladesh: {
    first: ['Rakib', 'Shanto', 'Nayeem', 'Tanvir', 'Sabbir', 'Jubair', 'Mahin', 'Rifat', 'Sohan', 'Ashiq', 'Naim', 'Fahim'],
    last: ['Hasan', 'Rahman', 'Islam', 'Chowdhury', 'Sarkar', 'Bhuiyan', 'Talukder', 'Mridha', 'Sikder', 'Molla', 'Howlader', 'Bepari'],
  },
  afghanistan: {
    first: ['Naveed', 'Sami', 'Zubair', 'Farhan', 'Idrees', 'Wali', 'Ajmal', 'Hashmat', 'Nasir', 'Yamin', 'Sharaf', 'Dawlat'],
    last: ['Stanikzai', 'Popalzai', 'Ahmadi', 'Noori', 'Safi', 'Wardak', 'Ludin', 'Barakzai', 'Hotak', 'Kakar', 'Zadran', 'Achakzai'],
  },
  zimbabwe: {
    first: ['Tinashe', 'Farai', 'Blessing', 'Tafara', 'Munashe', 'Kudzai', 'Tapiwa', 'Nkosi', 'Simba', 'Tanaka', 'Ropafadzo', 'Panashe'],
    last: ['Moyo', 'Ncube', 'Sibanda', 'Chikwanha', 'Mutasa', 'Dube', 'Marufu', 'Zvavamwe', 'Chigumba', 'Nyathi', 'Madziva', 'Gwara'],
  },
  ireland: {
    first: ['Cian', 'Fergal', 'Ronan', 'Padraig', 'Declan', 'Oisin', 'Eoin', 'Cormac', 'Niall', 'Barry', 'Killian', 'Lorcan'],
    last: ['Doherty', 'Callaghan', 'Brennan', 'Kavanagh', 'Sheridan', 'Mulligan', 'Fitzgerald', 'Donnelly', 'Hegarty', 'Boyle', 'Rafferty', 'Nolan'],
  },
};

const FALLBACK: NamePool = {
  first: ['Alex', 'Sam', 'Chris', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Jamie'],
  last: ['Stone', 'Rivers', 'Cross', 'Hale', 'Marsh', 'Frost', 'Vale', 'Reed'],
};

export function namePoolFor(countryId: string): NamePool {
  return NAME_POOLS[countryId] ?? FALLBACK;
}
