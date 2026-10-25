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

/** Fictional women's given names; surnames retain the same country pools. */
export const FEMALE_FIRST_NAMES: Record<string, string[]> = {
  india: ['Aditi', 'Ananya', 'Kavya', 'Meera', 'Nandini', 'Ishita', 'Priya', 'Riya', 'Sana', 'Tara', 'Vidya', 'Diya'],
  australia: ['Amelia', 'Chloe', 'Ella', 'Grace', 'Isla', 'Jade', 'Lily', 'Mia', 'Ruby', 'Sienna', 'Zoe', 'Matilda'],
  england: ['Alice', 'Beatrice', 'Charlotte', 'Daisy', 'Eleanor', 'Florence', 'Georgia', 'Harriet', 'Imogen', 'Lucy', 'Phoebe', 'Sophie'],
  pakistan: ['Amina', 'Ayesha', 'Farah', 'Hina', 'Iqra', 'Mahira', 'Nadia', 'Rabia', 'Sadia', 'Saira', 'Sana', 'Zara'],
  south_africa: ['Amara', 'Anika', 'Buhle', 'Elna', 'Lerato', 'Lindiwe', 'Naledi', 'Nandi', 'Nomsa', 'Petra', 'Thandi', 'Zanele'],
  new_zealand: ['Aria', 'Aroha', 'Charlotte', 'Hana', 'Isla', 'Kaia', 'Maia', 'Mila', 'Moana', 'Paige', 'Piper', 'Willow'],
  sri_lanka: ['Amaya', 'Anjali', 'Dilini', 'Hiruni', 'Imesha', 'Kavindi', 'Malsha', 'Nadeesha', 'Nimali', 'Sanduni', 'Tharushi', 'Yashoda'],
  west_indies: ['Aaliyah', 'Aisha', 'Brianna', 'Camille', 'Danielle', 'Janelle', 'Keisha', 'Latoya', 'Monique', 'Nia', 'Shanice', 'Tiana'],
  bangladesh: ['Afsana', 'Anika', 'Farzana', 'Ishrat', 'Jannat', 'Lamisa', 'Maliha', 'Nabila', 'Nusrat', 'Raisa', 'Samira', 'Tasnim'],
  afghanistan: ['Ariana', 'Bahara', 'Darya', 'Fariba', 'Freshta', 'Laila', 'Mariam', 'Nargis', 'Parisa', 'Roya', 'Shabnam', 'Zohra'],
  zimbabwe: ['Anesu', 'Chiedza', 'Danai', 'Fadzai', 'Kudzai', 'Makanaka', 'Nyasha', 'Rudo', 'Rufaro', 'Tariro', 'Tendai', 'Vimbai'],
  ireland: ['Aoife', 'Caoimhe', 'Ciara', 'Clodagh', 'Eimear', 'Fiadh', 'Maeve', 'Niamh', 'Orla', 'Roisin', 'Saoirse', 'Siobhan'],
};

export function namePoolFor(countryId: string, sex: 'male' | 'female' = 'male'): NamePool {
  const pool = NAME_POOLS[countryId] ?? FALLBACK;
  return sex === 'female' ? { first: FEMALE_FIRST_NAMES[countryId] ?? FALLBACK.first, last: pool.last } : pool;
}
