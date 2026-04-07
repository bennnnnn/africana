export type SubdivisionLabel =
  | 'State' | 'Region' | 'Province' | 'County' | 'Governorate'
  | 'District' | 'Prefecture' | 'Wilaya' | 'Department' | 'Division'
  | 'Island' | 'Canton' | 'Territory' | 'Emirate';

export interface Subdivision {
  name: string;
  cities: string[];
}

export interface CountryData {
  code: string;
  name: string;
  subdivisionLabel: SubdivisionLabel;
  subdivisions: Subdivision[];
}

export interface CountryGroup {
  id: string;
  label: string;
  emoji: string;
  countries: CountryData[];
}

// ─────────────────────────────────────────────
// EAST AFRICA
// ─────────────────────────────────────────────
const Ethiopia: CountryData = {
  code: 'ET', name: 'Ethiopia', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Addis Ababa', cities: ['Addis Ababa'] },
    { name: 'Afar', cities: ['Semera', 'Asaita', 'Logia', 'Dubti'] },
    { name: 'Amhara', cities: ['Bahir Dar', 'Gondar', 'Dessie', 'Kombolcha', 'Debre Markos', 'Debre Birhan'] },
    { name: 'Benishangul-Gumuz', cities: ['Assosa', 'Metekel', 'Bambasi'] },
    { name: 'Dire Dawa', cities: ['Dire Dawa'] },
    { name: 'Gambela', cities: ['Gambela', 'Itang'] },
    { name: 'Harari', cities: ['Harar'] },
    { name: 'Oromia', cities: ['Adama', 'Jimma', 'Bishoftu', 'Shashamane', 'Nekemte', 'Arsi Negele', 'Asella'] },
    { name: 'Sidama', cities: ['Hawassa'] },
    { name: 'SNNPR', cities: ['Awassa', 'Arba Minch', 'Hosaena', 'Wolkite'] },
    { name: 'Somali', cities: ['Jigjiga', 'Gode', 'Kebri Dahar'] },
    { name: 'South West', cities: ['Bonga', 'Mizan Teferi', 'Tepi'] },
    { name: 'Tigray', cities: ['Mekelle', 'Aksum', 'Adwa', 'Adigrat', 'Shire'] },
  ],
};

const Kenya: CountryData = {
  code: 'KE', name: 'Kenya', subdivisionLabel: 'County',
  subdivisions: [
    { name: 'Nairobi', cities: ['Nairobi', 'Westlands', 'Kasarani', 'Embakasi'] },
    { name: 'Mombasa', cities: ['Mombasa', 'Nyali', 'Likoni'] },
    { name: 'Kisumu', cities: ['Kisumu', 'Ahero', 'Maseno'] },
    { name: 'Nakuru', cities: ['Nakuru', 'Naivasha', 'Gilgil'] },
    { name: 'Eldoret (Uasin Gishu)', cities: ['Eldoret', 'Turbo', 'Moiben'] },
    { name: 'Kiambu', cities: ['Thika', 'Kiambu', 'Ruiru', 'Limuru'] },
    { name: 'Machakos', cities: ['Machakos', 'Athi River', 'Kitui Road'] },
    { name: 'Nyeri', cities: ['Nyeri', 'Karatina', 'Othaya'] },
    { name: 'Meru', cities: ['Meru', 'Nkubu', 'Timau'] },
    { name: 'Kakamega', cities: ['Kakamega', 'Mumias', 'Butere'] },
    { name: 'Kilifi', cities: ['Kilifi', 'Malindi', 'Watamu'] },
    { name: 'Kisii', cities: ['Kisii', 'Ogembo', 'Keroka'] },
    { name: 'Garissa', cities: ['Garissa', 'Dadaab'] },
    { name: 'Turkana', cities: ['Lodwar', 'Kalokol'] },
    { name: 'Bungoma', cities: ['Bungoma', 'Webuye', 'Kimilili'] },
  ],
};

const Tanzania: CountryData = {
  code: 'TZ', name: 'Tanzania', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Dar es Salaam', cities: ['Dar es Salaam', 'Kinondoni', 'Ilala', 'Temeke'] },
    { name: 'Mwanza', cities: ['Mwanza', 'Ilemela', 'Nyamagana'] },
    { name: 'Arusha', cities: ['Arusha', 'Moshi'] },
    { name: 'Dodoma', cities: ['Dodoma', 'Kondoa'] },
    { name: 'Mbeya', cities: ['Mbeya', 'Tukuyu', 'Vwawa'] },
    { name: 'Morogoro', cities: ['Morogoro', 'Kilosa', 'Ifakara'] },
    { name: 'Tanga', cities: ['Tanga', 'Muheza', 'Pangani'] },
    { name: 'Zanzibar', cities: ['Zanzibar City', 'Wete', 'Chake Chake'] },
    { name: 'Kagera', cities: ['Bukoba', 'Biharamulo'] },
    { name: 'Kilimanjaro', cities: ['Moshi', 'Himo', 'Hai'] },
  ],
};

const Uganda: CountryData = {
  code: 'UG', name: 'Uganda', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Central', cities: ['Kampala', 'Entebbe', 'Jinja', 'Mukono', 'Wakiso'] },
    { name: 'Eastern', cities: ['Mbale', 'Tororo', 'Soroti', 'Jinja', 'Iganga'] },
    { name: 'Northern', cities: ['Gulu', 'Lira', 'Arua', 'Kitgum'] },
    { name: 'Western', cities: ['Mbarara', 'Fort Portal', 'Kasese', 'Kabale', 'Masindi'] },
  ],
};

const Rwanda: CountryData = {
  code: 'RW', name: 'Rwanda', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Kigali City', cities: ['Kigali', 'Nyarugenge', 'Gasabo', 'Kicukiro'] },
    { name: 'Eastern', cities: ['Rwamagana', 'Kayonza', 'Kirehe', 'Ngoma'] },
    { name: 'Northern', cities: ['Musanze', 'Gicumbi', 'Rulindo', 'Burera'] },
    { name: 'Southern', cities: ['Huye', 'Ruhango', 'Nyanza', 'Kamonyi'] },
    { name: 'Western', cities: ['Rubavu', 'Rusizi', 'Nyamasheke', 'Karongi'] },
  ],
};

const Somalia: CountryData = {
  code: 'SO', name: 'Somalia', subdivisionLabel: 'State',
  subdivisions: [
    { name: 'Banadir', cities: ['Mogadishu'] },
    { name: 'Puntland', cities: ['Garowe', 'Bosaso', 'Galkayo'] },
    { name: 'Jubaland', cities: ['Kismayo', 'Baidoa'] },
    { name: 'South West', cities: ['Baidoa', 'Baraawe'] },
    { name: 'Hirshabelle', cities: ['Jowhar', 'Beledweyne'] },
    { name: 'Galmudug', cities: ['Dhusamareb', 'Galkayo'] },
    { name: 'Somaliland', cities: ['Hargeisa', 'Berbera', 'Burao'] },
  ],
};

const Eritrea: CountryData = {
  code: 'ER', name: 'Eritrea', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Central', cities: ['Asmara', 'Keren'] },
    { name: 'Southern', cities: ['Mendefera', 'Adi Keyh', 'Dekemhare'] },
    { name: 'Northern Red Sea', cities: ['Massawa', 'Nakfa'] },
    { name: 'Southern Red Sea', cities: ['Assab', 'Edd'] },
    { name: 'Anseba', cities: ['Keren', 'Hagaz'] },
    { name: 'Gash-Barka', cities: ['Barentu', 'Tessenei', 'Agordat'] },
  ],
};

const Burundi: CountryData = {
  code: 'BI', name: 'Burundi', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Bujumbura Mairie', cities: ['Bujumbura'] },
    { name: 'Gitega', cities: ['Gitega'] },
    { name: 'Ngozi', cities: ['Ngozi', 'Kirundo'] },
    { name: 'Muyinga', cities: ['Muyinga', 'Cankuzo'] },
    { name: 'Bubanza', cities: ['Bubanza'] },
  ],
};

const Djibouti: CountryData = {
  code: 'DJ', name: 'Djibouti', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Djibouti', cities: ['Djibouti City'] },
    { name: 'Ali Sabieh', cities: ['Ali Sabieh', 'Holhol'] },
    { name: 'Dikhil', cities: ['Dikhil', 'As Eyla'] },
    { name: 'Obock', cities: ['Obock', 'Tadjourah'] },
    { name: 'Tadjourah', cities: ['Tadjourah'] },
  ],
};

const Madagascar: CountryData = {
  code: 'MG', name: 'Madagascar', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Antananarivo', cities: ['Antananarivo', 'Antsirabe', 'Tsiroanomandidy'] },
    { name: 'Antsiranana', cities: ['Antsiranana (Diego Suarez)', 'Ambilobe', 'Sambava'] },
    { name: 'Fianarantsoa', cities: ['Fianarantsoa', 'Manakara', 'Farafangana'] },
    { name: 'Mahajanga', cities: ['Mahajanga', 'Marovoay', 'Mampikony'] },
    { name: 'Toamasina', cities: ['Toamasina', 'Fenerive East', 'Tamatave'] },
    { name: 'Toliara', cities: ['Toliara', 'Morondava', 'Morombe'] },
  ],
};

// ─────────────────────────────────────────────
// WEST AFRICA
// ─────────────────────────────────────────────
const Nigeria: CountryData = {
  code: 'NG', name: 'Nigeria', subdivisionLabel: 'State',
  subdivisions: [
    { name: 'Abia', cities: ['Umuahia', 'Aba', 'Ohafia'] },
    { name: 'Adamawa', cities: ['Yola', 'Mubi', 'Numan', 'Jimeta'] },
    { name: 'Akwa Ibom', cities: ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron'] },
    { name: 'Anambra', cities: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia'] },
    { name: 'Bauchi', cities: ['Bauchi', 'Azare', 'Misau', 'Katagum'] },
    { name: 'Bayelsa', cities: ['Yenagoa', 'Ogbia', 'Brass'] },
    { name: 'Benue', cities: ['Makurdi', 'Otukpo', 'Gboko', 'Katsina-Ala'] },
    { name: 'Borno', cities: ['Maiduguri', 'Biu', 'Damboa', 'Gwoza'] },
    { name: 'Cross River', cities: ['Calabar', 'Ogoja', 'Ikom', 'Obubra'] },
    { name: 'Delta', cities: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor'] },
    { name: 'Ebonyi', cities: ['Abakaliki', 'Afikpo', 'Onueke'] },
    { name: 'Edo', cities: ['Benin City', 'Auchi', 'Uromi', 'Igarra'] },
    { name: 'Ekiti', cities: ['Ado Ekiti', 'Ikere', 'Ijero', 'Emure'] },
    { name: 'Enugu', cities: ['Enugu', 'Nsukka', 'Oji River', 'Awgu'] },
    { name: 'FCT (Abuja)', cities: ['Abuja', 'Gwagwalada', 'Kuje', 'Bwari'] },
    { name: 'Gombe', cities: ['Gombe', 'Bajoga', 'Deba', 'Kumo'] },
    { name: 'Imo', cities: ['Owerri', 'Orlu', 'Okigwe', 'Oguta'] },
    { name: 'Jigawa', cities: ['Dutse', 'Hadejia', 'Gumel', 'Birnin Kudu'] },
    { name: 'Kaduna', cities: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro'] },
    { name: 'Kano', cities: ['Kano', 'Wudil', 'Bichi', 'Rano'] },
    { name: 'Katsina', cities: ['Katsina', 'Daura', 'Funtua', 'Malumfashi'] },
    { name: 'Kebbi', cities: ['Birnin Kebbi', 'Argungu', 'Yelwa', 'Zuru'] },
    { name: 'Kogi', cities: ['Lokoja', 'Okene', 'Kabba', 'Idah'] },
    { name: 'Kwara', cities: ['Ilorin', 'Offa', 'Omu-Aran', 'Erin-Ile'] },
    { name: 'Lagos', cities: ['Lagos', 'Ikeja', 'Victoria Island', 'Lekki', 'Surulere', 'Badagry', 'Ikorodu', 'Eti-Osa'] },
    { name: 'Nasarawa', cities: ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa'] },
    { name: 'Niger', cities: ['Minna', 'Suleja', 'Bida', 'Kontagora'] },
    { name: 'Ogun', cities: ['Abeokuta', 'Ijebu Ode', 'Sagamu', 'Ota'] },
    { name: 'Ondo', cities: ['Akure', 'Ondo City', 'Owo', 'Okitipupa'] },
    { name: 'Osun', cities: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede'] },
    { name: 'Oyo', cities: ['Ibadan', 'Ogbomosho', 'Oyo', 'Iseyin'] },
    { name: 'Plateau', cities: ['Jos', 'Bukuru', 'Shendam', 'Pankshin'] },
    { name: 'Rivers', cities: ['Port Harcourt', 'Obio-Akpor', 'Bonny', 'Eleme'] },
    { name: 'Sokoto', cities: ['Sokoto', 'Tambuwal', 'Wurno', 'Isa'] },
    { name: 'Taraba', cities: ['Jalingo', 'Wukari', 'Bali', 'Takum'] },
    { name: 'Yobe', cities: ['Damaturu', 'Potiskum', 'Nguru', 'Gashua'] },
    { name: 'Zamfara', cities: ['Gusau', 'Kaura Namoda', 'Talata-Mafara', 'Anka'] },
  ],
};

const Ghana: CountryData = {
  code: 'GH', name: 'Ghana', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Greater Accra', cities: ['Accra', 'Tema', 'Ga South', 'Madina', 'Ashaiman'] },
    { name: 'Ashanti', cities: ['Kumasi', 'Obuasi', 'Ejisu', 'Mampong'] },
    { name: 'Western', cities: ['Takoradi', 'Sekondi', 'Tarkwa', 'Axim'] },
    { name: 'Central', cities: ['Cape Coast', 'Kasoa', 'Winneba', 'Assin Fosu'] },
    { name: 'Eastern', cities: ['Koforidua', 'Nkawkaw', 'Akim Oda', 'Begoro'] },
    { name: 'Northern', cities: ['Tamale', 'Yendi', 'Savelugu', 'Bimbilla'] },
    { name: 'Upper East', cities: ['Bolgatanga', 'Bawku', 'Navrongo', 'Zebilla'] },
    { name: 'Upper West', cities: ['Wa', 'Jirapa', 'Lawra', 'Nadowli'] },
    { name: 'Volta', cities: ['Ho', 'Keta', 'Hohoe', 'Aflao'] },
    { name: 'Oti', cities: ['Dambai', 'Jasikan', 'Nkwanta'] },
    { name: 'Savannah', cities: ['Damongo', 'Bole', 'Salaga'] },
    { name: 'North East', cities: ['Nalerigu', 'Gambaga', 'Walewale'] },
    { name: 'Ahafo', cities: ['Goaso', 'Kenyase', 'Bechem'] },
    { name: 'Bono', cities: ['Sunyani', 'Techiman', 'Berekum'] },
    { name: 'Bono East', cities: ['Techiman', 'Atebubu', 'Kintampo'] },
    { name: 'Western North', cities: ['Sefwi Wiawso', 'Bibiani', 'Enchi'] },
  ],
};

const Senegal: CountryData = {
  code: 'SN', name: 'Senegal', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Dakar', cities: ['Dakar', 'Pikine', 'Guédiawaye', 'Rufisque'] },
    { name: 'Diourbel', cities: ['Diourbel', 'Touba', 'Bambey', 'Mbacké'] },
    { name: 'Fatick', cities: ['Fatick', 'Kaolack', 'Gossas'] },
    { name: 'Kaffrine', cities: ['Kaffrine', 'Koungheul', 'Birkelane'] },
    { name: 'Kaolack', cities: ['Kaolack', 'Nioro du Rip', 'Guinguinéo'] },
    { name: 'Kédougou', cities: ['Kédougou', 'Saraya', 'Salémata'] },
    { name: 'Kolda', cities: ['Kolda', 'Vélingara', 'Médina Yoro Foula'] },
    { name: 'Louga', cities: ['Louga', 'Linguère', 'Kébémer'] },
    { name: 'Matam', cities: ['Matam', 'Kanel', 'Ranérou'] },
    { name: 'Saint-Louis', cities: ['Saint-Louis', 'Richard-Toll', 'Dagana', 'Podor'] },
    { name: 'Sédhiou', cities: ['Sédhiou', 'Bounkiling', 'Goudomp'] },
    { name: 'Tambacounda', cities: ['Tambacounda', 'Bakel', 'Goudiry'] },
    { name: 'Thiès', cities: ['Thiès', 'Mbour', 'Tivaouane', 'Joal-Fadiouth'] },
    { name: 'Ziguinchor', cities: ['Ziguinchor', 'Bignona', 'Oussouye'] },
  ],
};

const CoteDIvoire: CountryData = {
  code: 'CI', name: "Côte d'Ivoire", subdivisionLabel: 'District',
  subdivisions: [
    { name: 'Abidjan', cities: ['Abidjan', 'Cocody', 'Yopougon', 'Abobo', 'Marcory'] },
    { name: 'Bas-Sassandra', cities: ['San-Pédro', 'Sassandra', 'Tabou'] },
    { name: 'Comoé', cities: ['Abengourou', 'Aboisso', 'Agnibilékrou'] },
    { name: 'Gôh-Djiboua', cities: ['Gagnoa', 'Divo', 'Lakota'] },
    { name: 'Lacs', cities: ['Dimbokro', 'Bongouanou', 'Daoukro'] },
    { name: 'Lagunes', cities: ['Dabou', 'Grand-Lahou', 'Jacqueville'] },
    { name: 'Montagnes', cities: ['Man', 'Daloa', 'Danané'] },
    { name: 'Sassandra-Marahoué', cities: ['Daloa', 'Issia', 'Zoukougbeu'] },
    { name: 'Savanes', cities: ['Korhogo', 'Boundiali', 'Ferkessédougou'] },
    { name: 'Vallée du Bandama', cities: ['Bouaké', 'Sakassou', 'Botro'] },
    { name: 'Woroba', cities: ['Séguéla', 'Worodougou', 'Mankono'] },
    { name: "Yamoussoukro (District autonome)", cities: ['Yamoussoukro'] },
    { name: 'Zanzan', cities: ['Bondoukou', 'Bouna', 'Téhini'] },
  ],
};

const SierraLeone: CountryData = {
  code: 'SL', name: 'Sierra Leone', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Western Area', cities: ['Freetown', 'Waterloo', 'Lungi'] },
    { name: 'Northern', cities: ['Makeni', 'Kabala', 'Port Loko', 'Kambia'] },
    { name: 'North West', cities: ['Kambia', 'Bombali', 'Tonkolili'] },
    { name: 'Eastern', cities: ['Kenema', 'Kono', 'Koidu', 'Segbwema'] },
    { name: 'Southern', cities: ['Bo', 'Bonthe', 'Moyamba', 'Pujehun'] },
  ],
};

const Liberia: CountryData = {
  code: 'LR', name: 'Liberia', subdivisionLabel: 'County',
  subdivisions: [
    { name: 'Montserrado', cities: ['Monrovia', 'Paynesville', 'Gardnerville'] },
    { name: 'Margibi', cities: ['Kakata', 'Marshall'] },
    { name: 'Bong', cities: ['Gbarnga', 'Gbanga'] },
    { name: 'Nimba', cities: ['Sanniquellie', 'Ganta', 'Yekepa'] },
    { name: 'Lofa', cities: ['Voinjama', 'Foya', 'Kolahun'] },
    { name: 'Grand Bassa', cities: ['Buchanan'] },
    { name: 'Grand Cape Mount', cities: ['Robertsport'] },
    { name: 'Sinoe', cities: ['Greenville'] },
    { name: 'Maryland', cities: ['Harper', 'Pleebo'] },
    { name: 'River Cess', cities: ['Cestos City'] },
  ],
};

const Cameroon: CountryData = {
  code: 'CM', name: 'Cameroon', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Centre', cities: ['Yaoundé', 'Mbalmayo', 'Obala'] },
    { name: 'Littoral', cities: ['Douala', 'Nkongsamba', 'Loum', 'Edéa'] },
    { name: 'West', cities: ['Bafoussam', 'Dschang', 'Foumban', 'Mbouda'] },
    { name: 'North West', cities: ['Bamenda', 'Wum', 'Kumbo', 'Nkambe'] },
    { name: 'South West', cities: ['Buea', 'Limbe', 'Kumba', 'Mamfe'] },
    { name: 'North', cities: ['Garoua', 'Guider', 'Pitoa', 'Poli'] },
    { name: 'Adamawa', cities: ['Ngaoundéré', 'Meiganga', 'Tibati'] },
    { name: 'Far North', cities: ['Maroua', 'Kousséri', 'Mokolo', 'Mora'] },
    { name: 'South', cities: ['Ebolowa', 'Kribi', 'Sangmélima'] },
    { name: 'East', cities: ['Bertoua', 'Abong-Mbang', 'Yokadouma'] },
  ],
};

const GuineaConakry: CountryData = {
  code: 'GN', name: 'Guinea', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Conakry', cities: ['Conakry', 'Ratoma', 'Matoto', 'Kaloum'] },
    { name: 'Kindia', cities: ['Kindia', 'Coyah', 'Forécariah', 'Télimélé'] },
    { name: 'Mamou', cities: ['Mamou', 'Dalaba', 'Pita'] },
    { name: 'Labé', cities: ['Labé', 'Koubia', 'Tougué', 'Mali'] },
    { name: 'Boké', cities: ['Boké', 'Kamsar', 'Télimélé', 'Fria'] },
    { name: 'Faranah', cities: ['Faranah', 'Kissidougou', 'Guékédou'] },
    { name: 'Kankan', cities: ['Kankan', 'Siguiri', 'Mandiana', 'Kouroussa'] },
    { name: 'Nzérékoré', cities: ['Nzérékoré', 'Macenta', 'Yomou', 'Lola'] },
  ],
};

const Mali: CountryData = {
  code: 'ML', name: 'Mali', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Bamako', cities: ['Bamako'] },
    { name: 'Kayes', cities: ['Kayes', 'Kita', 'Bafoulabé'] },
    { name: 'Koulikoro', cities: ['Koulikoro', 'Kati', 'Kolokani'] },
    { name: 'Sikasso', cities: ['Sikasso', 'Bougouni', 'Kadiolo'] },
    { name: 'Ségou', cities: ['Ségou', 'Markala', 'San', 'Bla'] },
    { name: 'Mopti', cities: ['Mopti', 'Bandiagara', 'Djenné', 'Koro'] },
    { name: 'Tombouctou', cities: ['Tombouctou', 'Goundam', 'Niafounké'] },
    { name: 'Gao', cities: ['Gao', 'Ansongo', 'Bourem'] },
    { name: 'Kidal', cities: ['Kidal', 'Tessalit', 'Tin-Essako'] },
  ],
};

const BurkinaFaso: CountryData = {
  code: 'BF', name: 'Burkina Faso', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Centre', cities: ['Ouagadougou', 'Ziniaré', 'Loumbila'] },
    { name: 'Hauts-Bassins', cities: ['Bobo-Dioulasso', 'Houndé', 'Dédougou'] },
    { name: 'Cascades', cities: ['Banfora', 'Sindou', 'Orodara'] },
    { name: 'Centre-Est', cities: ['Tenkodogo', 'Koupéla', 'Bittou'] },
    { name: 'Centre-Nord', cities: ['Kaya', 'Kongoussi', 'Tougouri'] },
    { name: 'Centre-Ouest', cities: ['Koudougou', 'Réo', 'Sabou'] },
    { name: 'Centre-Sud', cities: ['Manga', 'Pô', 'Kombissiri'] },
    { name: 'Est', cities: ['Fada N\'Gourma', 'Diapaga', 'Bogandé'] },
    { name: 'Nord', cities: ['Ouahigouya', 'Titao', 'Yako'] },
    { name: 'Plateau-Central', cities: ['Ziniaré', 'Zorgho', 'Boussé'] },
    { name: 'Sahel', cities: ['Dori', 'Djibo', 'Gorom-Gorom'] },
    { name: 'Sud-Ouest', cities: ['Diébougou', 'Gaoua', 'Batié'] },
    { name: 'Boucle du Mouhoun', cities: ['Dédougou', 'Nouna', 'Solenzo'] },
  ],
};

// ─────────────────────────────────────────────
// NORTH AFRICA
// ─────────────────────────────────────────────
const Egypt: CountryData = {
  code: 'EG', name: 'Egypt', subdivisionLabel: 'Governorate',
  subdivisions: [
    { name: 'Cairo', cities: ['Cairo', 'New Cairo', 'Heliopolis', 'Nasr City', 'Maadi'] },
    { name: 'Giza', cities: ['Giza', '6th of October City', 'Shubra al-Khayma'] },
    { name: 'Alexandria', cities: ['Alexandria', 'Borg El Arab', 'Abu Qir'] },
    { name: 'Luxor', cities: ['Luxor', 'Karnak', 'Armant'] },
    { name: 'Aswan', cities: ['Aswan', 'Kom Ombo', 'Edfu'] },
    { name: 'Asyut', cities: ['Asyut', 'Manfalut', 'Dayrut'] },
    { name: 'Beheira', cities: ['Damanhur', 'Kafr el-Dawwar', 'Abu Hummus'] },
    { name: 'Beni Suef', cities: ['Beni Suef', 'Fashn', 'Beba'] },
    { name: 'Dakahlia', cities: ['Mansoura', 'Talkha', 'Mit Ghamr', 'Belqas'] },
    { name: 'Damietta', cities: ['Damietta', 'New Damietta', 'Faraskur'] },
    { name: 'Faiyum', cities: ['Faiyum', 'Ibshaway', 'Sinnuris'] },
    { name: 'Gharbia', cities: ['Tanta', 'Mahalla al-Kubra', 'Kafr el-Zayat'] },
    { name: 'Ismailia', cities: ['Ismailia', 'Fayed', 'Abu Suwir'] },
    { name: 'Kafr el-Sheikh', cities: ['Kafr el-Sheikh', 'Desouk', 'Baltim'] },
    { name: 'Matrouh', cities: ['Mersa Matruh', 'Sidi Barrani'] },
    { name: 'Minya', cities: ['Minya', 'Abu Qurqas', 'Beni Mazar'] },
    { name: 'Monufia', cities: ['Shibin el-Kom', 'Menouf', 'Sadat City'] },
    { name: 'New Valley', cities: ['Kharga', 'Dakhla', 'Farafra'] },
    { name: 'North Sinai', cities: ['Arish', 'Sheikh Zuweid', 'Rafah'] },
    { name: 'Port Said', cities: ['Port Said'] },
    { name: 'Qalyubia', cities: ['Banha', 'Qalyub', 'Khanka', 'Obour'] },
    { name: 'Qena', cities: ['Qena', 'Nag Hammadi', 'Dishna'] },
    { name: 'Red Sea', cities: ['Hurghada', 'Safaga', 'El Gouna'] },
    { name: 'Sharqia', cities: ['Zagazig', '10th of Ramadan City', 'Abu Hammad'] },
    { name: 'Sohag', cities: ['Sohag', 'Akhmim', 'Girga'] },
    { name: 'South Sinai', cities: ['Sharm el-Sheikh', 'Dahab', 'Taba'] },
    { name: 'Suez', cities: ['Suez'] },
  ],
};

const Morocco: CountryData = {
  code: 'MA', name: 'Morocco', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Casablanca-Settat', cities: ['Casablanca', 'Settat', 'Mohammedia', 'El Jadida'] },
    { name: 'Rabat-Salé-Kénitra', cities: ['Rabat', 'Salé', 'Kénitra', 'Témara'] },
    { name: 'Fès-Meknès', cities: ['Fès', 'Meknès', 'Sefrou', 'Ifrane'] },
    { name: 'Marrakech-Safi', cities: ['Marrakech', 'Safi', 'Essaouira', 'Kelaat Sraghna'] },
    { name: 'Souss-Massa', cities: ['Agadir', 'Tiznit', 'Taroudant', 'Chtouka Ait Baha'] },
    { name: 'Oriental', cities: ['Oujda', 'Nador', 'Taourirt', 'Berkane'] },
    { name: 'Tanger-Tétouan-Al Hoceïma', cities: ['Tangier', 'Tétouan', 'Al Hoceïma', 'Chefchaouen'] },
    { name: 'Béni Mellal-Khénifra', cities: ['Béni Mellal', 'Khénifra', 'Azilal', 'Kasba Tadla'] },
    { name: 'Drâa-Tafilalet', cities: ['Errachidia', 'Ouarzazate', 'Tinghir', 'Zagora'] },
    { name: 'Guelmim-Oued Noun', cities: ['Guelmim', 'Sidi Ifni', 'Tan-Tan'] },
    { name: 'Laâyoune-Sakia El Hamra', cities: ['Laâyoune', 'Boujdour', 'Smara'] },
    { name: 'Dakhla-Oued Ed-Dahab', cities: ['Dakhla', 'Aousserd'] },
  ],
};

const Algeria: CountryData = {
  code: 'DZ', name: 'Algeria', subdivisionLabel: 'Wilaya',
  subdivisions: [
    { name: 'Alger', cities: ['Algiers', 'Bab El Oued', 'El Harrach', 'Hussein Dey'] },
    { name: 'Oran', cities: ['Oran', 'Arzew', 'Es Senia', 'Bir El Djir'] },
    { name: 'Constantine', cities: ['Constantine', 'El Khroub', 'Hamma Bouziane'] },
    { name: 'Annaba', cities: ['Annaba', 'El Bouni', 'Berrahal'] },
    { name: 'Blida', cities: ['Blida', 'Boufarik', 'Larbaa'] },
    { name: 'Tizi Ouzou', cities: ['Tizi Ouzou', 'Azzefoun', 'Azazga'] },
    { name: 'Sétif', cities: ['Sétif', 'El Eulma', 'Ain Oulmene'] },
    { name: 'Batna', cities: ['Batna', 'Merouana', 'Timgad'] },
    { name: 'Béjaïa', cities: ['Béjaïa', 'Akbou', 'Kherrata'] },
    { name: 'Boumerdes', cities: ['Boumerdès', 'Thenia', 'Bordj Menaiel'] },
    { name: 'Médéa', cities: ['Médéa', 'Berrouaghia', 'Ksar el Boukhari'] },
    { name: 'Tlemcen', cities: ['Tlemcen', 'Chetouane', 'Ghazaouet'] },
    { name: 'Skikda', cities: ['Skikda', 'Azzaba', 'Collo'] },
    { name: 'Biskra', cities: ['Biskra', 'Tolga', 'El Kantara'] },
    { name: 'Ouargla', cities: ['Ouargla', 'Touggourt', 'Hassi Messaoud'] },
    { name: 'Adrar', cities: ['Adrar', 'Reggane', 'Timimoun'] },
    { name: 'Tamanrasset', cities: ['Tamanrasset', 'In Salah', 'In Guezzam'] },
    { name: 'Ghardaïa', cities: ['Ghardaïa', 'Metlili', 'El Guerrara'] },
  ],
};

const Tunisia: CountryData = {
  code: 'TN', name: 'Tunisia', subdivisionLabel: 'Governorate',
  subdivisions: [
    { name: 'Tunis', cities: ['Tunis', 'La Marsa', 'Carthage', 'Ariana'] },
    { name: 'Ariana', cities: ['Ariana', 'Raoued', 'Soukra'] },
    { name: 'Ben Arous', cities: ['Ben Arous', 'Hammam Lif', 'Hammam Chatt'] },
    { name: 'Manouba', cities: ['Manouba', 'Denden', 'Mornaguia'] },
    { name: 'Nabeul', cities: ['Nabeul', 'Hammamet', 'Kélibia'] },
    { name: 'Zaghouan', cities: ['Zaghouan', 'Zriba', 'Bir Mcherga'] },
    { name: 'Bizerte', cities: ['Bizerte', 'Mateur', 'Menzel Bourguiba'] },
    { name: 'Béja', cities: ['Béja', 'Testour', 'Nefza'] },
    { name: 'Jendouba', cities: ['Jendouba', 'Bou Salem', 'Tabarka'] },
    { name: 'Le Kef', cities: ['Le Kef', 'Dahmani', 'Tajerouine'] },
    { name: 'Siliana', cities: ['Siliana', 'Makthar', 'Rouhia'] },
    { name: 'Sousse', cities: ['Sousse', 'Kalaa Kebira', 'Msaken'] },
    { name: 'Monastir', cities: ['Monastir', 'Moknine', 'Ksar Hellal'] },
    { name: 'Mahdia', cities: ['Mahdia', 'El Jem', 'Ksour Essef'] },
    { name: 'Sfax', cities: ['Sfax', 'Sakiet Ezzit', 'El Ain'] },
    { name: 'Kairouan', cities: ['Kairouan', 'Sbikha', 'El Alaa'] },
    { name: 'Kasserine', cities: ['Kasserine', 'Sbeitla', 'Fériana'] },
    { name: 'Sidi Bouzid', cities: ['Sidi Bouzid', 'Regueb', 'Jelma'] },
    { name: 'Gabès', cities: ['Gabès', 'El Hamma', 'Mareth'] },
    { name: 'Médenine', cities: ['Médenine', 'Houmt Souk', 'Zarzis'] },
    { name: 'Tataouine', cities: ['Tataouine', 'Ghomrassen', 'Remada'] },
    { name: 'Gafsa', cities: ['Gafsa', 'Metlaoui', 'Redeyef'] },
    { name: 'Tozeur', cities: ['Tozeur', 'Nefta', 'Degache'] },
    { name: 'Kébili', cities: ['Kébili', 'Douz', 'Souk Lahad'] },
  ],
};

// ─────────────────────────────────────────────
// CENTRAL AFRICA
// ─────────────────────────────────────────────
const DRCongo: CountryData = {
  code: 'CD', name: 'DR Congo', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Kinshasa', cities: ['Kinshasa', 'Gombe', 'Limete', 'Masina'] },
    { name: 'Kongo Central', cities: ['Matadi', 'Boma', 'Mbanza-Ngungu'] },
    { name: 'Kwango', cities: ['Kenge', 'Kasongo-Lunda'] },
    { name: 'Kwilu', cities: ['Bandundu', 'Kikwit', 'Bulungu'] },
    { name: 'Nord-Kivu', cities: ['Goma', 'Butembo', 'Beni', 'Lubero'] },
    { name: 'Sud-Kivu', cities: ['Bukavu', 'Uvira', 'Baraka'] },
    { name: 'Ituri', cities: ['Bunia', 'Aru', 'Irumu'] },
    { name: 'Haut-Katanga', cities: ['Lubumbashi', 'Likasi', 'Kipushi'] },
    { name: 'Lualaba', cities: ['Kolwezi', 'Dilolo', 'Mutshatsha'] },
    { name: 'Kasaï', cities: ['Tshikapa', 'Ilebo', 'Mweka'] },
    { name: 'Kasaï Oriental', cities: ['Mbuji-Mayi', 'Lodja', 'Gandajika'] },
    { name: 'Maniema', cities: ['Kindu', 'Kalima', 'Punia'] },
    { name: 'Orientale / Tshopo', cities: ['Kisangani', 'Isiro', 'Buta'] },
    { name: 'Équateur', cities: ['Mbandaka', 'Bikoro', 'Ingende'] },
  ],
};

// ─────────────────────────────────────────────
// SOUTHERN AFRICA
// ─────────────────────────────────────────────
const SouthAfrica: CountryData = {
  code: 'ZA', name: 'South Africa', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Gauteng', cities: ['Johannesburg', 'Pretoria', 'Soweto', 'Sandton', 'Randburg', 'Centurion', 'Midrand'] },
    { name: 'Western Cape', cities: ['Cape Town', 'Stellenbosch', 'George', 'Paarl', 'Worcester'] },
    { name: 'KwaZulu-Natal', cities: ['Durban', 'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Pinetown'] },
    { name: 'Eastern Cape', cities: ['East London', 'Port Elizabeth', 'Grahamstown', 'Queenstown'] },
    { name: 'Limpopo', cities: ['Polokwane', 'Tzaneen', 'Thohoyandou', 'Mokopane'] },
    { name: 'Mpumalanga', cities: ['Nelspruit', 'Witbank', 'Secunda', 'Middelburg'] },
    { name: 'North West', cities: ['Rustenburg', 'Mafikeng', 'Klerksdorp', 'Potchefstroom'] },
    { name: 'Free State', cities: ['Bloemfontein', 'Welkom', 'Bethlehem', 'Phuthaditjhaba'] },
    { name: 'Northern Cape', cities: ['Kimberley', 'Upington', 'Springbok', 'De Aar'] },
  ],
};

const Zimbabwe: CountryData = {
  code: 'ZW', name: 'Zimbabwe', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Harare', cities: ['Harare', 'Chitungwiza', 'Epworth'] },
    { name: 'Bulawayo', cities: ['Bulawayo'] },
    { name: 'Manicaland', cities: ['Mutare', 'Chipinge', 'Rusape'] },
    { name: 'Mashonaland Central', cities: ['Bindura', 'Guruve', 'Mount Darwin'] },
    { name: 'Mashonaland East', cities: ['Marondera', 'Mutoko', 'Murewa'] },
    { name: 'Mashonaland West', cities: ['Chinhoyi', 'Kadoma', 'Chegutu'] },
    { name: 'Masvingo', cities: ['Masvingo', 'Chiredzi', 'Triangle'] },
    { name: 'Matabeleland North', cities: ['Hwange', 'Victoria Falls', 'Lupane'] },
    { name: 'Matabeleland South', cities: ['Gwanda', 'Beitbridge', 'Plumtree'] },
    { name: 'Midlands', cities: ['Gweru', 'Kwekwe', 'Zvishavane', 'Shurugwi'] },
  ],
};

const Zambia: CountryData = {
  code: 'ZM', name: 'Zambia', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Lusaka', cities: ['Lusaka', 'Kafue', 'Chongwe'] },
    { name: 'Copperbelt', cities: ['Ndola', 'Kitwe', 'Mufulira', 'Chingola', 'Luanshya'] },
    { name: 'Central', cities: ['Kabwe', 'Kapiri Mposhi', 'Mkushi'] },
    { name: 'Eastern', cities: ['Chipata', 'Petauke', 'Lundazi'] },
    { name: 'Northern', cities: ['Kasama', 'Mbala', 'Mpika'] },
    { name: 'Luapula', cities: ['Mansa', 'Nchelenge', 'Kawambwa'] },
    { name: 'Muchinga', cities: ['Chinsali', 'Mpika', 'Nakonde'] },
    { name: 'North-Western', cities: ['Solwezi', 'Kabompo', 'Zambezi'] },
    { name: 'Southern', cities: ['Livingstone', 'Choma', 'Monze'] },
    { name: 'Western', cities: ['Mongu', 'Senanga', 'Kaoma'] },
  ],
};

const Mozambique: CountryData = {
  code: 'MZ', name: 'Mozambique', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Maputo City', cities: ['Maputo', 'Matola'] },
    { name: 'Maputo', cities: ['Matola', 'Marracuene', 'Boane'] },
    { name: 'Gaza', cities: ['Xai-Xai', 'Chokwé', 'Bilene'] },
    { name: 'Inhambane', cities: ['Inhambane', 'Vilankulo', 'Maxixe'] },
    { name: 'Sofala', cities: ['Beira', 'Dondo', 'Nova Sofala'] },
    { name: 'Manica', cities: ['Chimoio', 'Gondola', 'Manica'] },
    { name: 'Tete', cities: ['Tete', 'Moatize', 'Songo'] },
    { name: 'Zambezia', cities: ['Quelimane', 'Mocuba', 'Guruè'] },
    { name: 'Nampula', cities: ['Nampula', 'Nacala', 'Ilha de Moçambique'] },
    { name: 'Niassa', cities: ['Lichinga', 'Cuamba', 'Mandimba'] },
    { name: 'Cabo Delgado', cities: ['Pemba', 'Montepuez', 'Mueda'] },
  ],
};

const Angola: CountryData = {
  code: 'AO', name: 'Angola', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Luanda', cities: ['Luanda', 'Viana', 'Cacuaco', 'Cazenga'] },
    { name: 'Benguela', cities: ['Benguela', 'Lobito', 'Catumbela'] },
    { name: 'Huambo', cities: ['Huambo', 'Caála', 'Bailundo'] },
    { name: 'Bié', cities: ['Kuito', 'Camacupa', 'Chissamba'] },
    { name: 'Cabinda', cities: ['Cabinda', 'Tchiowa', 'Landana'] },
    { name: 'Huíla', cities: ['Lubango', 'Matala', 'Chibia'] },
    { name: 'Malanje', cities: ['Malanje', 'Cacuso', 'Cangandala'] },
    { name: 'Lunda Norte', cities: ['Dundo', 'Chitato', 'Lucapa'] },
    { name: 'Lunda Sul', cities: ['Saurimo', 'Muconda', 'Cacolo'] },
    { name: 'Cunene', cities: ['Ondjiva', 'Xangongo', 'Cahama'] },
    { name: 'Kuanza Norte', cities: ['N\'dalatando', 'Lucala', 'Camabatela'] },
    { name: 'Kuanza Sul', cities: ['Sumbe', 'Porto Amboim', 'Libolo'] },
    { name: 'Cuando Cubango', cities: ['Menongue', 'Kuito Kuanavale', 'Calai'] },
    { name: 'Moxico', cities: ['Luena', 'Léua', 'Cazombo'] },
    { name: 'Uíge', cities: ['Uíge', 'Maquela do Zombo', 'Songo'] },
    { name: 'Zaire', cities: ['Mbanza Kongo', 'Soyo', 'Nzeto'] },
  ],
};

// ─────────────────────────────────────────────
// DIASPORA — EUROPE
// ─────────────────────────────────────────────
const UK: CountryData = {
  code: 'GB', name: 'United Kingdom', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'London', cities: ['London', 'Croydon', 'Lewisham', 'Hackney', 'Southwark', 'Newham', 'Brent', 'Ealing'] },
    { name: 'South East England', cities: ['Brighton', 'Southampton', 'Oxford', 'Reading', 'Guildford'] },
    { name: 'North West England', cities: ['Manchester', 'Liverpool', 'Salford', 'Blackpool', 'Preston'] },
    { name: 'West Midlands', cities: ['Birmingham', 'Coventry', 'Wolverhampton', 'Stoke-on-Trent'] },
    { name: 'Yorkshire and the Humber', cities: ['Leeds', 'Sheffield', 'Bradford', 'Hull', 'York'] },
    { name: 'East of England', cities: ['Cambridge', 'Norwich', 'Luton', 'Ipswich', 'Peterborough'] },
    { name: 'South West England', cities: ['Bristol', 'Exeter', 'Plymouth', 'Bath', 'Swindon'] },
    { name: 'East Midlands', cities: ['Nottingham', 'Leicester', 'Derby', 'Lincoln', 'Northampton'] },
    { name: 'North East England', cities: ['Newcastle upon Tyne', 'Sunderland', 'Middlesbrough', 'Durham'] },
    { name: 'Scotland', cities: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness'] },
    { name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport', 'Bangor'] },
    { name: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn', 'Newtownabbey'] },
  ],
};

const France: CountryData = {
  code: 'FR', name: 'France', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Île-de-France', cities: ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Argenteuil', 'Montreuil', 'Créteil', 'Nanterre'] },
    { name: 'Auvergne-Rhône-Alpes', cities: ['Lyon', 'Grenoble', 'Clermont-Ferrand', 'Saint-Étienne', 'Annecy'] },
    { name: 'Nouvelle-Aquitaine', cities: ['Bordeaux', 'Limoges', 'Poitiers', 'Pau', 'Bayonne'] },
    { name: 'Occitanie', cities: ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Narbonne'] },
    { name: 'Hauts-de-France', cities: ['Lille', 'Amiens', 'Roubaix', 'Tourcoing', 'Dunkirk'] },
    { name: 'Grand Est', cities: ['Strasbourg', 'Reims', 'Metz', 'Nancy', 'Mulhouse'] },
    { name: 'Normandie', cities: ['Rouen', 'Caen', 'Le Havre', 'Cherbourg', 'Alençon'] },
    { name: 'Pays de la Loire', cities: ['Nantes', 'Angers', 'Le Mans', 'Saint-Nazaire'] },
    { name: 'Bretagne', cities: ['Rennes', 'Brest', 'Quimper', 'Lorient'] },
    { name: 'Bourgogne-Franche-Comté', cities: ['Dijon', 'Besançon', 'Belfort', 'Chalon-sur-Saône'] },
    { name: 'Centre-Val de Loire', cities: ['Orléans', 'Tours', 'Blois', 'Chartres'] },
    { name: "Provence-Alpes-Côte d'Azur", cities: ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon'] },
    { name: 'Corse', cities: ['Ajaccio', 'Bastia', 'Porto-Vecchio'] },
  ],
};

const Germany: CountryData = {
  code: 'DE', name: 'Germany', subdivisionLabel: 'State',
  subdivisions: [
    { name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bonn', 'Aachen', 'Bielefeld'] },
    { name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Ingolstadt'] },
    { name: 'Baden-Württemberg', cities: ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg', 'Heidelberg'] },
    { name: 'Berlin', cities: ['Berlin', 'Mitte', 'Kreuzberg', 'Neukölln', 'Charlottenburg'] },
    { name: 'Hamburg', cities: ['Hamburg', 'Altona', 'Harburg', 'Wandsbek'] },
    { name: 'Saxony', cities: ['Dresden', 'Leipzig', 'Chemnitz', 'Zwickau'] },
    { name: 'Hesse', cities: ['Frankfurt', 'Wiesbaden', 'Kassel', 'Darmstadt'] },
    { name: 'Lower Saxony', cities: ['Hanover', 'Braunschweig', 'Oldenburg', 'Osnabrück'] },
    { name: 'Rhineland-Palatinate', cities: ['Mainz', 'Ludwigshafen', 'Koblenz', 'Trier'] },
    { name: 'Saxony-Anhalt', cities: ['Magdeburg', 'Halle', 'Dessau-Roßlau'] },
    { name: 'Thuringia', cities: ['Erfurt', 'Jena', 'Gera', 'Weimar'] },
    { name: 'Brandenburg', cities: ['Potsdam', 'Cottbus', 'Brandenburg an der Havel'] },
    { name: 'Schleswig-Holstein', cities: ['Kiel', 'Lübeck', 'Flensburg'] },
    { name: 'Mecklenburg-Vorpommern', cities: ['Rostock', 'Schwerin', 'Stralsund'] },
    { name: 'Saarland', cities: ['Saarbrücken', 'Neunkirchen', 'Homburg'] },
    { name: 'Bremen', cities: ['Bremen', 'Bremerhaven'] },
  ],
};

const Netherlands: CountryData = {
  code: 'NL', name: 'Netherlands', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'South Holland', cities: ['Rotterdam', 'The Hague', 'Leiden', 'Delft', 'Dordrecht'] },
    { name: 'North Holland', cities: ['Amsterdam', 'Haarlem', 'Zaandam', 'Almere'] },
    { name: 'Utrecht', cities: ['Utrecht', 'Amersfoort', 'Zeist'] },
    { name: 'North Brabant', cities: ['Eindhoven', 'Tilburg', 'Breda', 'Den Bosch'] },
    { name: 'Gelderland', cities: ['Nijmegen', 'Arnhem', 'Apeldoorn'] },
    { name: 'Overijssel', cities: ['Enschede', 'Zwolle', 'Deventer'] },
    { name: 'Groningen', cities: ['Groningen', 'Hoogezand', 'Veendam'] },
    { name: 'Friesland', cities: ['Leeuwarden', 'Sneek', 'Drachten'] },
    { name: 'Zeeland', cities: ['Middelburg', 'Terneuzen', 'Vlissingen'] },
    { name: 'Limburg', cities: ['Maastricht', 'Venlo', 'Heerlen'] },
    { name: 'Drenthe', cities: ['Assen', 'Emmen', 'Hoogeveen'] },
    { name: 'Flevoland', cities: ['Lelystad', 'Almere', 'Dronten'] },
  ],
};

const Belgium: CountryData = {
  code: 'BE', name: 'Belgium', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Brussels Capital Region', cities: ['Brussels', 'Ixelles', 'Molenbeek-Saint-Jean', 'Anderlecht', 'Schaerbeek'] },
    { name: 'Wallonia', cities: ['Liège', 'Charleroi', 'Namur', 'Mons', 'La Louvière'] },
    { name: 'Flanders', cities: ['Antwerp', 'Ghent', 'Bruges', 'Leuven', 'Mechelen'] },
  ],
};

const Sweden: CountryData = {
  code: 'SE', name: 'Sweden', subdivisionLabel: 'County',
  subdivisions: [
    { name: 'Stockholm', cities: ['Stockholm', 'Sollentuna', 'Södertälje', 'Huddinge', 'Botkyrka'] },
    { name: 'Västra Götaland', cities: ['Gothenburg', 'Mölndal', 'Borås', 'Trollhättan'] },
    { name: 'Skåne', cities: ['Malmö', 'Helsingborg', 'Lund', 'Kristianstad'] },
    { name: 'Östergötland', cities: ['Linköping', 'Norrköping', 'Motala'] },
    { name: 'Uppsala', cities: ['Uppsala', 'Enköping', 'Tierp'] },
    { name: 'Örebro', cities: ['Örebro', 'Kumla', 'Hallsberg'] },
    { name: 'Dalarna', cities: ['Falun', 'Borlänge', 'Mora'] },
    { name: 'Gävleborg', cities: ['Gävle', 'Sandviken', 'Hudiksvall'] },
    { name: 'Jönköping', cities: ['Jönköping', 'Huskvarna', 'Värnamo'] },
  ],
};

const Norway: CountryData = {
  code: 'NO', name: 'Norway', subdivisionLabel: 'County',
  subdivisions: [
    { name: 'Oslo', cities: ['Oslo', 'Grorud', 'Stovner', 'Alna'] },
    { name: 'Viken', cities: ['Drammen', 'Fredrikstad', 'Sarpsborg', 'Lillestrøm'] },
    { name: 'Innlandet', cities: ['Hamar', 'Lillehammer', 'Gjøvik', 'Elverum'] },
    { name: 'Vestland', cities: ['Bergen', 'Askøy', 'Knarvik', 'Osøyro'] },
    { name: 'Rogaland', cities: ['Stavanger', 'Sandnes', 'Haugesund', 'Egersund'] },
    { name: 'Trøndelag', cities: ['Trondheim', 'Steinkjer', 'Levanger', 'Stjørdal'] },
    { name: 'Troms og Finnmark', cities: ['Tromsø', 'Alta', 'Hammerfest', 'Kirkenes'] },
  ],
};

const Portugal: CountryData = {
  code: 'PT', name: 'Portugal', subdivisionLabel: 'District',
  subdivisions: [
    { name: 'Lisbon', cities: ['Lisbon', 'Amadora', 'Sintra', 'Setúbal', 'Almada'] },
    { name: 'Porto', cities: ['Porto', 'Gaia', 'Matosinhos', 'Braga', 'Guimarães'] },
    { name: 'Faro (Algarve)', cities: ['Faro', 'Portimão', 'Albufeira', 'Loulé'] },
    { name: 'Aveiro', cities: ['Aveiro', 'Ovar', 'Santa Maria da Feira'] },
    { name: 'Braga', cities: ['Braga', 'Guimarães', 'Barcelos'] },
    { name: 'Coimbra', cities: ['Coimbra', 'Figueira da Foz', 'Leiria'] },
    { name: 'Madeira', cities: ['Funchal', 'Câmara de Lobos', 'Machico'] },
    { name: 'Azores', cities: ['Ponta Delgada', 'Angra do Heroísmo', 'Horta'] },
  ],
};

const Spain: CountryData = {
  code: 'ES', name: 'Spain', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Community of Madrid', cities: ['Madrid', 'Móstoles', 'Alcalá de Henares', 'Fuenlabrada', 'Getafe'] },
    { name: 'Catalonia', cities: ['Barcelona', 'Hospitalet de Llobregat', 'Badalona', 'Sabadell', 'Terrassa'] },
    { name: 'Andalusia', cities: ['Seville', 'Málaga', 'Córdoba', 'Granada', 'Jerez de la Frontera'] },
    { name: 'Valencia', cities: ['Valencia', 'Alicante', 'Elche', 'Castellón'] },
    { name: 'Basque Country', cities: ['Bilbao', 'San Sebastián', 'Vitoria-Gasteiz'] },
    { name: 'Galicia', cities: ['Vigo', 'A Coruña', 'Pontevedra', 'Santiago de Compostela'] },
    { name: 'Castile and León', cities: ['Valladolid', 'Burgos', 'Salamanca', 'León'] },
    { name: 'Canary Islands', cities: ['Las Palmas', 'Santa Cruz de Tenerife', 'La Laguna'] },
    { name: 'Murcia', cities: ['Murcia', 'Cartagena', 'Lorca'] },
    { name: 'Balearic Islands', cities: ['Palma', 'Ibiza', 'Manacor'] },
  ],
};

const Italy: CountryData = {
  code: 'IT', name: 'Italy', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Lombardy', cities: ['Milan', 'Brescia', 'Bergamo', 'Monza', 'Como'] },
    { name: 'Lazio', cities: ['Rome', 'Latina', 'Frosinone', 'Viterbo'] },
    { name: 'Campania', cities: ['Naples', 'Salerno', 'Caserta', 'Benevento'] },
    { name: 'Sicily', cities: ['Palermo', 'Catania', 'Messina', 'Agrigento'] },
    { name: 'Veneto', cities: ['Venice', 'Verona', 'Padua', 'Vicenza', 'Treviso'] },
    { name: 'Piedmont', cities: ['Turin', 'Novara', 'Alessandria'] },
    { name: 'Emilia-Romagna', cities: ['Bologna', 'Modena', 'Parma', 'Reggio Emilia', 'Ferrara'] },
    { name: 'Tuscany', cities: ['Florence', 'Prato', 'Livorno', 'Pisa', 'Arezzo'] },
    { name: 'Puglia', cities: ['Bari', 'Lecce', 'Foggia', 'Taranto'] },
    { name: 'Calabria', cities: ['Reggio Calabria', 'Catanzaro', 'Cosenza', 'Crotone'] },
    { name: 'Sardinia', cities: ['Cagliari', 'Sassari', 'Nuoro', 'Oristano'] },
  ],
};

// ─────────────────────────────────────────────
// NORTH AMERICA
// ─────────────────────────────────────────────
const USA: CountryData = {
  code: 'US', name: 'United States', subdivisionLabel: 'State',
  subdivisions: [
    { name: 'Alabama', cities: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile'] },
    { name: 'Alaska', cities: ['Anchorage', 'Fairbanks', 'Juneau'] },
    { name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'] },
    { name: 'Arkansas', cities: ['Little Rock', 'Fort Smith', 'Fayetteville'] },
    { name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose', 'Oakland', 'Fresno', 'Long Beach'] },
    { name: 'Colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins'] },
    { name: 'Connecticut', cities: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford'] },
    { name: 'Delaware', cities: ['Wilmington', 'Dover', 'Newark'] },
    { name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'Tallahassee', 'St. Petersburg'] },
    { name: 'Georgia', cities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens'] },
    { name: 'Hawaii', cities: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua'] },
    { name: 'Idaho', cities: ['Boise', 'Nampa', 'Meridian'] },
    { name: 'Illinois', cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford'] },
    { name: 'Indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend'] },
    { name: 'Iowa', cities: ['Des Moines', 'Cedar Rapids', 'Davenport'] },
    { name: 'Kansas', cities: ['Wichita', 'Overland Park', 'Kansas City', 'Topeka'] },
    { name: 'Kentucky', cities: ['Louisville', 'Lexington', 'Bowling Green'] },
    { name: 'Louisiana', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'] },
    { name: 'Maine', cities: ['Portland', 'Lewiston', 'Bangor'] },
    { name: 'Maryland', cities: ['Baltimore', 'Silver Spring', 'Columbia', 'Rockville'] },
    { name: 'Massachusetts', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'] },
    { name: 'Michigan', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'] },
    { name: 'Minnesota', cities: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'] },
    { name: 'Mississippi', cities: ['Jackson', 'Gulfport', 'Southaven', 'Biloxi'] },
    { name: 'Missouri', cities: ['Kansas City', 'Saint Louis', 'Springfield', 'Columbia'] },
    { name: 'Montana', cities: ['Billings', 'Missoula', 'Great Falls'] },
    { name: 'Nebraska', cities: ['Omaha', 'Lincoln', 'Bellevue'] },
    { name: 'Nevada', cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas'] },
    { name: 'New Hampshire', cities: ['Manchester', 'Nashua', 'Concord'] },
    { name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton'] },
    { name: 'New Mexico', cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe'] },
    { name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon'] },
    { name: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem'] },
    { name: 'North Dakota', cities: ['Fargo', 'Bismarck', 'Grand Forks'] },
    { name: 'Ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'] },
    { name: 'Oklahoma', cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow'] },
    { name: 'Oregon', cities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro'] },
    { name: 'Pennsylvania', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading'] },
    { name: 'Rhode Island', cities: ['Providence', 'Cranston', 'Warwick', 'Pawtucket'] },
    { name: 'South Carolina', cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant'] },
    { name: 'South Dakota', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen'] },
    { name: 'Tennessee', cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'] },
    { name: 'Texas', cities: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Plano'] },
    { name: 'Utah', cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan'] },
    { name: 'Vermont', cities: ['Burlington', 'South Burlington', 'Rutland'] },
    { name: 'Virginia', cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Arlington'] },
    { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'] },
    { name: 'Washington D.C.', cities: ['Washington D.C.', 'Capitol Hill', 'Georgetown', 'Anacostia'] },
    { name: 'West Virginia', cities: ['Charleston', 'Huntington', 'Morgantown'] },
    { name: 'Wisconsin', cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha'] },
    { name: 'Wyoming', cities: ['Cheyenne', 'Casper', 'Laramie'] },
  ],
};

const Canada: CountryData = {
  code: 'CA', name: 'Canada', subdivisionLabel: 'Province',
  subdivisions: [
    { name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan'] },
    { name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Sherbrooke', 'Saguenay'] },
    { name: 'British Columbia', cities: ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna', 'Victoria'] },
    { name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert'] },
    { name: 'Manitoba', cities: ['Winnipeg', 'Brandon', 'Steinbach'] },
    { name: 'Saskatchewan', cities: ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw'] },
    { name: 'Nova Scotia', cities: ['Halifax', 'Sydney', 'Truro', 'New Glasgow'] },
    { name: 'New Brunswick', cities: ['Moncton', 'Saint John', 'Fredericton'] },
    { name: 'Newfoundland and Labrador', cities: ['St. John\'s', 'Corner Brook', 'Gander'] },
    { name: 'Prince Edward Island', cities: ['Charlottetown', 'Summerside'] },
    { name: 'Northwest Territories', cities: ['Yellowknife', 'Hay River', 'Inuvik'] },
    { name: 'Nunavut', cities: ['Iqaluit', 'Rankin Inlet', 'Arviat'] },
    { name: 'Yukon', cities: ['Whitehorse', 'Dawson City', 'Watson Lake'] },
  ],
};

// ─────────────────────────────────────────────
// MIDDLE EAST
// ─────────────────────────────────────────────
const UAE: CountryData = {
  code: 'AE', name: 'United Arab Emirates', subdivisionLabel: 'Emirate',
  subdivisions: [
    { name: 'Dubai', cities: ['Dubai', 'Deira', 'Bur Dubai', 'Jumeirah', 'Al Quoz'] },
    { name: 'Abu Dhabi', cities: ['Abu Dhabi', 'Al Ain', 'Khalifa City', 'Mussafah'] },
    { name: 'Sharjah', cities: ['Sharjah', 'Khor Fakkan', 'Dibba Al Hisn'] },
    { name: 'Ajman', cities: ['Ajman'] },
    { name: 'Ras Al Khaimah', cities: ['Ras Al Khaimah', 'Al Nakheel'] },
    { name: 'Fujairah', cities: ['Fujairah', 'Dibba Al Fujairah'] },
    { name: 'Umm Al Quwain', cities: ['Umm Al Quwain'] },
  ],
};

const SaudiArabia: CountryData = {
  code: 'SA', name: 'Saudi Arabia', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Riyadh', cities: ['Riyadh', 'Al-Kharj', 'Dawadmi', 'Shaqra'] },
    { name: 'Makkah', cities: ['Jeddah', 'Mecca', 'Taif', 'Qunfudhah'] },
    { name: 'Madinah', cities: ['Medina', 'Yanbu', 'Mahd adh Dhahab'] },
    { name: 'Eastern Province', cities: ['Dammam', 'Dhahran', 'Khobar', 'Al Hofuf', 'Qatif'] },
    { name: 'Asir', cities: ['Abha', 'Khamis Mushait', 'Najran', 'Bisha'] },
    { name: 'Tabuk', cities: ['Tabuk', 'Umluj', 'Al-Wajh'] },
    { name: 'Ha\'il', cities: ['Ha\'il', 'Baqaa', 'Al Shinan'] },
    { name: 'Al Jawf', cities: ['Sakaka', 'Domat Al Jandal', 'Al Qurayyat'] },
    { name: 'Jizan', cities: ['Jizan', 'Sabya', 'Abu Arish'] },
    { name: 'Najran', cities: ['Najran', 'Sharurah', 'Hubuna'] },
    { name: 'Al Bahah', cities: ['Al Bahah', 'Baljurashi', 'Al Mandaq'] },
    { name: 'Northern Borders', cities: ['Arar', 'Rafha', 'Turaif'] },
    { name: 'Qassim', cities: ['Buraidah', 'Unaizah', 'Al Rass'] },
  ],
};

const Qatar: CountryData = {
  code: 'QA', name: 'Qatar', subdivisionLabel: 'District',
  subdivisions: [
    { name: 'Doha', cities: ['Doha', 'Al Waab', 'Al Hilal', 'Al Rayyan'] },
    { name: 'Al Daayen', cities: ['Lusail', 'Al Khor'] },
    { name: 'Al Wakrah', cities: ['Al Wakrah', 'Al Wukair'] },
    { name: 'Al Shamal', cities: ['Al Ruwais', 'Madinat Al Shamal'] },
    { name: 'Umm Slal', cities: ['Umm Slal Ali', 'Umm Slal Mohammed'] },
  ],
};

// ─────────────────────────────────────────────
// OCEANIA
// ─────────────────────────────────────────────
const Australia: CountryData = {
  code: 'AU', name: 'Australia', subdivisionLabel: 'State',
  subdivisions: [
    { name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong', 'Parramatta', 'Blacktown'] },
    { name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Frankston'] },
    { name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns'] },
    { name: 'Western Australia', cities: ['Perth', 'Mandurah', 'Bunbury', 'Rockingham'] },
    { name: 'South Australia', cities: ['Adelaide', 'Mount Gambier', 'Gawler', 'Whyalla'] },
    { name: 'Tasmania', cities: ['Hobart', 'Launceston', 'Devonport', 'Burnie'] },
    { name: 'Australian Capital Territory', cities: ['Canberra', 'Belconnen', 'Tuggeranong'] },
    { name: 'Northern Territory', cities: ['Darwin', 'Alice Springs', 'Palmerston'] },
  ],
};

const NewZealand: CountryData = {
  code: 'NZ', name: 'New Zealand', subdivisionLabel: 'Region',
  subdivisions: [
    { name: 'Auckland', cities: ['Auckland', 'Manukau', 'Waitakere', 'North Shore'] },
    { name: 'Wellington', cities: ['Wellington', 'Lower Hutt', 'Upper Hutt', 'Porirua'] },
    { name: 'Canterbury', cities: ['Christchurch', 'Timaru', 'Rangiora'] },
    { name: 'Waikato', cities: ['Hamilton', 'Cambridge', 'Te Awamutu'] },
    { name: 'Bay of Plenty', cities: ['Tauranga', 'Rotorua', 'Whakatāne'] },
    { name: 'Otago', cities: ['Dunedin', 'Queenstown', 'Wanaka'] },
    { name: 'Manawatu-Whanganui', cities: ['Palmerston North', 'Whanganui'] },
    { name: 'Southland', cities: ['Invercargill', 'Bluff'] },
  ],
};

// ─────────────────────────────────────────────
// Minimal-data countries (country name only, no subdivisions = text input)
// ─────────────────────────────────────────────
const simple = (code: string, name: string, subdivisionLabel: SubdivisionLabel = 'Region'): CountryData =>
  ({ code, name, subdivisionLabel, subdivisions: [] });

// ─────────────────────────────────────────────
// COUNTRY GROUPS
// ─────────────────────────────────────────────
export const COUNTRY_GROUPS: CountryGroup[] = [
  {
    id: 'east_africa',
    label: 'East Africa',
    emoji: '🌍',
    countries: [Ethiopia, Kenya, Tanzania, Uganda, Rwanda, Burundi, Somalia, Eritrea, Djibouti, Madagascar,
      simple('SS', 'South Sudan', 'State'),
      simple('KM', 'Comoros', 'Island'),
      simple('SC', 'Seychelles', 'District'),
      simple('MU', 'Mauritius', 'District'),
    ],
  },
  {
    id: 'west_africa',
    label: 'West Africa',
    emoji: '🌍',
    countries: [Nigeria, Ghana, Senegal, CoteDIvoire, SierraLeone, Liberia, GuineaConakry, Cameroon, Mali, BurkinaFaso,
      simple('GW', 'Guinea-Bissau', 'Region'),
      simple('GM', 'Gambia', 'Division'),
      simple('CV', 'Cape Verde', 'Island'),
      simple('TG', 'Togo', 'Region'),
      simple('BJ', 'Benin', 'Department'),
      simple('NE', 'Niger', 'Region'),
      simple('MR', 'Mauritania', 'Wilaya'),
      simple('ST', 'São Tomé and Príncipe', 'District'),
    ],
  },
  {
    id: 'central_africa',
    label: 'Central Africa',
    emoji: '🌍',
    countries: [DRCongo,
      simple('CG', 'Congo', 'Department'),
      simple('CF', 'Central African Republic', 'Prefecture'),
      simple('TD', 'Chad', 'Region'),
      simple('GA', 'Gabon', 'Province'),
      simple('GQ', 'Equatorial Guinea', 'Province'),
    ],
  },
  {
    id: 'north_africa',
    label: 'North Africa',
    emoji: '🌍',
    countries: [Egypt, Morocco, Algeria, Tunisia,
      simple('LY', 'Libya', 'District'),
      simple('SD', 'Sudan', 'State'),
    ],
  },
  {
    id: 'south_africa_region',
    label: 'Southern Africa',
    emoji: '🌍',
    countries: [SouthAfrica, Zimbabwe, Zambia, Mozambique, Angola,
      simple('BW', 'Botswana', 'District'),
      simple('NA', 'Namibia', 'Region'),
      simple('MW', 'Malawi', 'Region'),
      simple('LS', 'Lesotho', 'District'),
      simple('SZ', 'Eswatini', 'Region'),
    ],
  },
  {
    id: 'europe',
    label: 'Europe',
    emoji: '🇪🇺',
    countries: [UK, France, Germany, Netherlands, Belgium, Sweden, Norway, Portugal, Spain, Italy,
      simple('CH', 'Switzerland', 'Canton'),
      simple('AT', 'Austria', 'State'),
      simple('IE', 'Ireland', 'Province'),
      simple('DK', 'Denmark', 'Region'),
      simple('FI', 'Finland', 'Region'),
    ],
  },
  {
    id: 'north_america',
    label: 'North America',
    emoji: '🌎',
    countries: [USA, Canada,
      simple('MX', 'Mexico', 'State'),
    ],
  },
  {
    id: 'middle_east',
    label: 'Middle East',
    emoji: '🌏',
    countries: [UAE, SaudiArabia, Qatar,
      simple('KW', 'Kuwait', 'Governorate'),
      simple('BH', 'Bahrain', 'Governorate'),
      simple('OM', 'Oman', 'Governorate'),
    ],
  },
  {
    id: 'oceania',
    label: 'Oceania',
    emoji: '🌏',
    countries: [Australia, NewZealand],
  },
];

// Flat list of all countries (useful for search)
export const ALL_COUNTRIES: CountryData[] = COUNTRY_GROUPS.flatMap((g) => g.countries);
export const AFRICAN_COUNTRY_CODES = new Set(
  COUNTRY_GROUPS
    .filter((group) =>
      ['east_africa', 'west_africa', 'central_africa', 'north_africa', 'south_africa_region'].includes(group.id)
    )
    .flatMap((group) => group.countries.map((country) => country.code))
);

// Look up a country by code
export const getCountry = (code: string) => ALL_COUNTRIES.find((c) => c.code === code);
export const getCountryByName = (name: string) => ALL_COUNTRIES.find((c) => c.name === name);
