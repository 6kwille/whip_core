// builder_peds — writes html/js/builder-peds.js, the world builder's NPCs tab: every ped that has a picture
// in whip_media_previews/img/peds, grouped and given a name a person can read ("Indian Male #1", "Lamar Davis").
//
// A ped's gender (for "Male" / "Female" on a role) comes from DurtyFree's peds.json
// (github.com/DurtyFree/gta-v-data-dumps; game build 3407 when this was written), downloaded anywhere.
//
// Usage:  node dev/builder_peds.js <peds.json> [pictures folder] [out file]
//   The pictures default to the media pack holding img/peds (dev/assets_dirs.js), the out file to ..\html\js\builder-peds.js.
//   A new picture needs its name below (AMBIENT, ROLE, CHAR or ANIMAL): the script stops and lists any
//   it cannot name, and any two that would share a name. Not loaded by fxmanifest.lua.
const fs = require('fs');
const path = require('path');
if (!process.argv[2]) { console.error('usage: node builder_peds.js <peds.json> [pictures folder] [out file]'); process.exit(2); }
const peds = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PICTURES = process.argv[3] || require('./assets_dirs.js').assetDir('img/peds');   // in its media pack
const OUT = process.argv[4] || path.join(__dirname, '..', 'html', 'js', 'builder-peds.js');
const byModel = {};
for (const p of peds) byModel[String(p.Name).toLowerCase()] = p;

// ---- never shipped: the Altruist cult peds are nude. Their pictures are not in
// the media packs and they are never listed; a picture of one found here is left out and named, to be deleted.
const NOT_SHIPPED = /^a_[mf]_[ymo]_(acult|fatcult)(_\d+)?$/;

// ---- passers-by (a_m_*, a_f_*): "[Young|Old] <who> <Male|Female> #n" ------------------------------
const AMBIENT = {
    afriamer: 'African American', bankrobber: 'Bank Robber', beach: 'Beach',
    beachvesp: 'Vespucci Beach', bevhills: 'Rockford Hills', bodybuild: 'Bodybuilder', breakdance: 'Breakdancer',
    busicas: 'Business Casual', business: 'Business', carclub: 'Car Club', clubcust: 'Clubber', cyclist: 'Cyclist',
    dhill: 'Downhill Biker', downtown: 'Downtown', eastsa: 'East LS', epsilon: 'Epsilon', farmer: 'Farmer',
    fatbla: 'Heavyset Black', fatlatin: 'Heavyset Latino', fatwhite: 'Heavyset White',
    femaleagent: 'Agent', fitness: 'Fitness', gay: 'Stylish', genbiker: 'Biker', gencaspat: 'Casual',
    genfat: 'Heavyset', genhot: 'Glamorous', genstreet: 'Street', golfer: 'Golfer', hasjew: 'Hasidic Jewish',
    hiker: 'Hiker', hillbilly: 'Hillbilly', hippie: 'Hippie', hippy: 'Hippie', hipster: 'Hipster', indian: 'Indian',
    jetski: 'Jet Ski', juggalo: 'Juggalo', ktown: 'Korean', latino: 'Latino', malibu: 'Coastal', methhead: 'Meth Head',
    mexcntry: 'Rural Mexican', mexlabor: 'Mexican Laborer', mexthug: 'Mexican Thug', mlcrisis: 'Midlife Crisis',
    motox: 'Motocross', musclbeac: 'Muscle Beach', og_boss: 'OG Boss', paparazzi: 'Paparazzi',
    polynesian: 'Polynesian', prolhost: 'North Yankton', roadcyc: 'Road Cyclist', runner: 'Jogger',
    rurmeth: 'Meth Head', salton: 'Desert', scdressy: 'Dressy', skater: 'Skater', skidrow: 'Skid Row',
    smartcaspat: 'Smart Casual', socenlat: 'South LS Latino', soucent: 'South LS', soucentmc: 'South LS Smart',
    stbla: 'Black Street', stlat: 'Latino Street', studioparty: 'Studio Party', stwhi: 'White Street',
    sunbathe: 'Sunbather', surfer: 'Surfer', tattoocust: 'Tattooed', tennis: 'Tennis', topless: 'Topless',
    tourist: 'Tourist', tramp: 'Homeless', trampbeac: 'Beach Bum', tranvest: 'Drag', vindouche: 'Vinewood Bro',
    vinewood: 'Vinewood', yoga: 'Yoga',
};
const AGE = { y: 'Young ', m: '', o: 'Old ' };

// ---- jobs, gangs and walk-ons: "<role> <Male|Female> #n" ---------------------------------------------
// Keyed by the model, or by the model without its number. A role ending in '!' says its own gender
// ("Bride"), so no Male / Female is added.
const ROLE = {
    // services (s_)
    s_f_m_autoshop: 'Auto Shop Worker', s_f_m_fembarber: 'Hairdresser', s_f_m_maid: 'Maid!',
    s_f_m_retailstaff: 'Retail Staff', s_f_m_shop_high: 'Ponsonbys Staff', s_f_m_studioassist: 'Studio Assistant',
    s_f_m_sweatshop: 'Sweatshop Worker', s_f_m_warehouse: 'Warehouse Worker', s_f_y_airhostess: 'Air Hostess!',
    s_f_y_bartender: 'Bartender', s_f_y_baywatch: 'Lifeguard', s_f_y_beachbarstaff: 'Beach Bar Staff',
    s_f_y_casino: 'Casino Staff', s_f_y_clubbar: 'Club Bar Staff', s_f_y_cop: 'LSPD Officer',
    s_f_y_factory: 'Slaughterhouse Worker', s_f_y_hooker: 'Streetwalker', s_f_y_migrant: 'Migrant Worker',
    s_f_y_movprem: 'Movie Premiere Guest', s_f_y_ranger: 'Park Ranger', s_f_y_scrubs: 'Medical Staff',
    s_f_y_sheriff: 'Sheriff Deputy', s_f_y_shop_low: 'Store Clerk', s_f_y_shop_mid: 'Clothing Store Staff',
    s_f_y_stripper: 'Stripper', s_f_y_stripperlite: 'Stripper', s_f_y_sweatshop: 'Sweatshop Worker',
    s_m_m_ammucountry: 'Ammu-Nation Clerk', s_m_m_armoured: 'Gruppe Sechs Guard', s_m_m_autoshop: 'Auto Shop Worker',
    s_m_m_bailoffice: 'Bail Bondsman', s_m_m_bouncer: 'Bouncer', s_m_m_ccrew: 'Crew Member',
    s_m_m_chemsec: 'Merryweather Security', s_m_m_ciasec: 'IAA Agent', s_m_m_cntrybar: 'Bartender',
    s_m_m_cop: 'LSPD Officer', s_m_m_dockwork: 'Dock Worker', s_m_m_doctor: 'Doctor',
    s_m_m_drugprocess: 'Drug Lab Worker', s_m_m_fiboffice: 'FIB Agent', s_m_m_fibsec: 'FIB Security',
    s_m_m_fieldworker: 'Field Worker', s_m_m_gaffer: 'Film Gaffer', s_m_m_gardener: 'Gardener',
    s_m_m_gentransport: 'Transport Worker', s_m_m_hairdress: 'Hairdresser', s_m_m_hazmatworker: 'Hazmat Worker',
    s_m_m_highsec: 'Bodyguard', s_m_m_janitor: 'Janitor', s_m_m_kortzsecurity: 'Kortz Center Security',
    s_m_m_lathandy: 'Handyman', s_m_m_lifeinvad: 'Lifeinvader Employee', s_m_m_linecook: 'Line Cook',
    s_m_m_lsmetro: 'LS Transit Worker', s_m_m_mariachi: 'Mariachi', s_m_m_marine: 'Army Officer',
    s_m_m_migrant: 'Migrant Worker', s_m_m_movalien: 'Space Alien', s_m_m_movprem: 'Movie Premiere Guest',
    s_m_m_movspace: 'Astronaut', s_m_m_paramedic: 'Paramedic', s_m_m_pilot: 'Pilot', s_m_m_postal: 'GoPostal Worker',
    s_m_m_prisguard: 'Prison Guard', s_m_m_raceorg: 'Race Organizer', s_m_m_scientist: 'Scientist',
    s_m_m_security: 'Security Guard', s_m_m_snowcop: 'North Yankton Cop', s_m_m_strperf: 'Street Performer',
    s_m_m_strpreach: 'Street Preacher', s_m_m_strvend: 'Street Vendor', s_m_m_studioassist: 'Studio Assistant',
    s_m_m_studioprod: 'Studio Producer', s_m_m_studiosoueng: 'Sound Engineer', s_m_m_subcrew: 'Submarine Crew',
    s_m_m_tattoo: 'Tattoo Artist', s_m_m_trucker: 'Trucker', s_m_m_ups: 'Post OP Worker',
    s_m_m_warehouse: 'Warehouse Worker', s_m_o_busker: 'Busker', s_m_y_airworker: 'Ramp Agent',
    s_m_y_ammucity: 'Ammu-Nation Clerk', s_m_y_armymech: 'Army Mechanic', s_m_y_autopsy: 'Coroner',
    s_m_y_barman: 'Bartender', s_m_y_baywatch: 'Lifeguard', s_m_y_blackops: 'Merryweather Operative',
    s_m_y_busboy: 'Busboy!', s_m_y_casino: 'Casino Staff', s_m_y_chef: 'Chef', s_m_y_clown: 'Clown',
    s_m_y_clubbar: 'Club Bar Staff', s_m_y_construct: 'Construction Worker', s_m_y_cop: 'LSPD Officer',
    s_m_y_dealer: 'Drug Dealer', s_m_y_devinsec: 'Devin\'s Security', s_m_y_dockwork: 'Dock Worker',
    s_m_y_doorman: 'Doorman!', s_m_y_dwservice: 'Service Worker', s_m_y_factory: 'Slaughterhouse Worker',
    s_m_y_fireman: 'Firefighter', s_m_y_garbage: 'Garbage Collector', s_m_y_grip: 'Film Grip',
    s_m_y_hwaycop: 'Highway Patrol', s_m_y_marine: 'Soldier', s_m_y_mime: 'Mime', s_m_y_pestcont: 'Pest Control',
    s_m_y_pilot: 'Pilot', s_m_y_prismuscl: 'Prisoner', s_m_y_prisoner: 'Prisoner', s_m_y_ranger: 'Park Ranger',
    s_m_y_robber: 'Robber', s_m_y_sheriff: 'Sheriff Deputy', s_m_y_shop_mask: 'Mask Shop Clerk',
    s_m_y_strvend: 'Street Vendor', s_m_y_swat: 'NOOSE Officer', s_m_y_uscg: 'Coast Guard', s_m_y_valet: 'Valet',
    s_m_y_waiter: 'Waiter!', s_m_y_waretech: 'Warehouse Technician', s_m_y_westsec: 'Security Guard',
    s_m_y_winclean: 'Window Cleaner', s_m_y_xmech: 'Mechanic', s_m_y_xmech_02_mp: 'Mechanic',
    // gangs (g_)
    g_f_importexport: 'Import/Export Crew', g_f_m_fooliganz: 'Fooliganz', g_f_m_undeadmage: 'Undead Mage',
    g_f_y_ballas: 'Ballas', g_f_y_families: 'Families', g_f_y_lost: 'Lost MC', g_f_y_vagos: 'Vagos',
    g_m_importexport: 'Import/Export Crew', g_m_m_armboss: 'Armenian Mob Boss', g_m_m_armgoon: 'Armenian Mob',
    g_m_m_armlieut: 'Armenian Mob Lieutenant', g_m_m_cartelgoons: 'Cartel', g_m_m_cartelguards: 'Cartel Guard',
    g_m_m_casrn: 'Redneck', g_m_m_chemwork: 'Chem Lab Worker', g_m_m_chiboss: 'Triad Boss', g_m_m_chicold: 'Triad',
    g_m_m_chigoon: 'Triad', g_m_m_fooliganz: 'Fooliganz', g_m_m_friedlandergoons: 'Friedlander\'s Goon',
    g_m_m_genthug: 'Thug', g_m_m_goons: 'Goon', g_m_m_knoway: 'Knoway Gang', g_m_m_korboss: 'Kkangpae Boss',
    g_m_m_maragrande: 'Marabunta Grande', g_m_m_mexboss_01: 'Aztecas Boss', g_m_m_mexboss_02: 'Vagos Boss',
    g_m_m_prisoners: 'Prison Gang', g_m_m_slasher: 'Slasher', g_m_m_zombie: 'Zombie', g_m_y_armgoon: 'Armenian Mob',
    g_m_y_azteca: 'Aztecas', g_m_y_ballaeast: 'Ballas', g_m_y_ballaorig: 'Ballas', g_m_y_ballasout: 'Ballas',
    g_m_y_famca: 'Families', g_m_y_famdnf: 'Families', g_m_y_famfor: 'Families', g_m_y_korean: 'Kkangpae',
    g_m_y_korlieut: 'Kkangpae Lieutenant', g_m_y_lost: 'Lost MC', g_m_y_mexgang: 'Mexican Gang', g_m_y_mexgoon: 'Vagos',
    g_m_y_pologoon: 'Gang Member', g_m_y_salvaboss: 'Marabunta Boss', g_m_y_salvagoon: 'Marabunta Grande',
    g_m_y_strpunk: 'Street Punk',
    // walk-ons from the story and missions (ig_, u_)
    ig_acidlabcook: 'Acid Lab Cook', ig_agent: 'Agent', ig_armsmanufac: 'Arms Manufacturer',
    ig_ballas_leader: 'Ballas Leader', ig_ballasog: 'Ballas OG', ig_bankman: 'Bank Manager', ig_bestmen: 'Best Man!',
    ig_billionaire: 'Billionaire', ig_bountytarget: 'Bounty Target', ig_bride: 'Bride!', ig_callgirl: 'Call Girl!',
    ig_car3guy1: 'Car Guy', ig_car3guy2: 'Car Guy', ig_celeb: 'Celebrity', ig_chef: 'Chef', ig_chef2: 'Chef',
    ig_djgeneric: 'DJ', ig_drugdealer: 'Drug Dealer', ig_entourage_a: 'Entourage', ig_entourage_b: 'Entourage',
    ig_fbisuit: 'FIB Agent', ig_fibleader: 'FIB Leader', ig_fooliganz: 'Fooliganz', ig_furry: 'Furry', ig_golfer_a: 'Golfer',
    ig_golfer_b: 'Golfer', ig_groom: 'Groom!', ig_gunvanseller: 'Gun Van Seller', ig_hippyleader: 'Hippie Leader',
    ig_jaywalker: 'Jaywalker', ig_jewelass: 'Jewelry Assistant', ig_labrat: 'Lab Rat', ig_lifeinvad: 'Lifeinvader Employee',
    ig_madrazodriver: 'Madrazo\'s Driver', ig_mechanic: 'Mechanic', ig_musician: 'Musician', ig_old_man1a: 'Old Man!',
    ig_old_man2: 'Old Man!', ig_oldrichguy: 'Rich Old Man!', ig_party_promo: 'Party Promoter', ig_pilot: 'Pilot',
    ig_priest: 'Priest', ig_prolsec: 'North Yankton Guard', ig_ramp_gang: 'Rampage Gangster',
    ig_ramp_hic: 'Rampage Hillbilly', ig_ramp_hipster: 'Rampage Hipster', ig_ramp_mex: 'Rampage Vagos',
    ig_req_officer: 'Requisitions Officer', ig_russiandrunk: 'Russian Drunk', ig_screen_writer: 'Screenwriter',
    ig_security_a: 'Security Guard', ig_skeleton: 'Skeleton', ig_soundeng: 'Sound Engineer',
    ig_subcrewhead: 'Submarine Crew Chief', ig_tenniscoach: 'Tennis Coach', ig_trafficwarden: 'Traffic Warden',
    ig_vagos_leader: 'Vagos Leader', ig_vagspeak: 'Vagos Spokesman', ig_valencheat: 'Cheating Lover',
    ig_warehouseboss: 'Warehouse Boss', ig_zombie_dj: 'Zombie DJ',
    u_f_m_casinocash: 'Casino Cashier', u_f_m_casinoshop: 'Casino Shop Clerk', u_f_m_corpse: 'Corpse',
    u_f_m_drowned: 'Drowned Body', u_f_m_promourn: 'North Yankton Mourner', u_f_o_prolhost: 'North Yankton Hostage',
    u_f_y_corpse: 'Corpse', u_f_y_danceburl: 'Burlesque Dancer', u_f_y_dancelthr: 'Leather Dancer',
    u_f_y_dancerave: 'Rave Dancer', u_f_y_hotposh: 'Posh', u_f_y_jewelass: 'Jewelry Assistant',
    u_f_y_spyactress: 'Spy Actress!', u_m_m_bankman: 'Bank Manager', u_m_m_bikehire: 'Bike Hire Attendant',
    u_m_m_doa: 'DOA Agent', u_m_m_fibarchitect: 'FIB Architect', u_m_m_filmdirector: 'Film Director',
    u_m_m_jewelsec: 'Jewelry Store Guard', u_m_m_jewelthief: 'Jewel Thief', u_m_m_juggernaut: 'Juggernaut',
    u_m_m_partytarget: 'Party Target', u_m_m_prolsec: 'North Yankton Guard', u_m_m_promourn: 'North Yankton Mourner',
    u_m_m_rivalpap: 'Rival Paparazzo', u_m_m_spyactor: 'Spy Actor!', u_m_m_streetart: 'Street Artist',
    u_m_o_filmnoir: 'Film Noir', u_m_o_taphillbilly: 'Old Hillbilly!', u_m_o_tramp: 'Old Homeless Man!',
    u_m_y_burgerdrug: 'Burger Shot Dealer', u_m_y_corpse: 'Corpse', u_m_y_croupthief: 'Croupier Thief',
    u_m_y_cyclist: 'Pro Cyclist', u_m_y_danceburl: 'Burlesque Dancer', u_m_y_dancelthr: 'Leather Dancer',
    u_m_y_dancerave: 'Rave Dancer', u_m_y_fibmugger: 'FIB Mugger', u_m_y_gunvend: 'Gun Vendor',
    u_m_y_juggernaut: 'Juggernaut', u_m_y_paparazzi: 'Paparazzo', u_m_y_party: 'Partygoer', u_m_y_prisoner: 'Prisoner',
    u_m_y_proldriver: 'North Yankton Getaway Driver', u_m_y_sbike: 'Sports Bike Rider',
    u_m_y_smugmech: 'Smuggler Mechanic', u_m_y_staggrm: 'Stag Party Groom!', u_m_y_tattoo: 'Tattoo Artist',
    u_m_y_zombie: 'Zombie',
    // GTA Online's workers (mp_)
    mp_f_bennymech: 'Benny\'s Mechanic', mp_f_boatstaff: 'Yacht Crew', mp_f_cardesign: 'Car Designer',
    mp_f_chbar: 'Clubhouse Bartender', mp_f_cocaine: 'Cocaine Lab Worker', mp_f_counterfeit: 'Counterfeit Cash Worker',
    mp_f_execpa: 'Executive Assistant', mp_f_forgery: 'Document Forger', mp_f_freemode: 'Online Character',
    mp_f_helistaff: 'Heliport Staff', mp_f_meth: 'Meth Lab Worker', mp_f_stripperlite: 'Stripper',
    mp_f_weed: 'Weed Farm Worker', mp_g_m_pros: 'Professional', mp_m_avongoon: 'Avon\'s Goon',
    mp_m_boatstaff: 'Yacht Crew', mp_m_bogdangoon: 'Bogdan\'s Goon', mp_m_cocaine: 'Cocaine Lab Worker',
    mp_m_counterfeit: 'Counterfeit Cash Worker', mp_m_exarmy: 'Ex-Army', mp_m_execpa: 'Executive Assistant',
    mp_m_famdd: 'Families', mp_m_fibsec: 'FIB Security', mp_m_forgery: 'Document Forger',
    mp_m_freemode: 'Online Character', mp_m_g_vagfun: 'Vagos', mp_m_meth: 'Meth Lab Worker',
    mp_m_securoguard: 'SecuroServ Guard', mp_m_shopkeep: 'Shopkeeper', mp_m_waremech: 'Warehouse Mechanic',
    mp_m_weapexp: 'Weapons Expert', mp_m_weapwork: 'Weapons Worker', mp_m_weed: 'Weed Farm Worker',
    mp_s_m_armoured: 'Gruppe Sechs Guard',
};

// ---- people with a name: the name, and " #2" for a second look ---------------------------------------
// Keyed by the model, or by the model without its number (ig_lamardavis_02 -> "Lamar Davis #2").
const CHAR = {
    player_zero: 'Michael De Santa', player_one: 'Franklin Clinton', player_two: 'Trevor Philips',
    hc_driver: 'Eddie Toh (Heist Crew)', hc_gunman: 'Gustavo Mota (Heist Crew)', hc_hacker: 'Paige Harris (Heist Crew)',
    ig_abigail: 'Abigail Mathers', ig_agatha: 'Agatha Baker', ig_agent14: 'Agent 14', ig_mp_agent14: 'Agent 14',
    ig_ahronward: 'Ahron Ward', ig_alec: 'Alec', ig_amandatownley: 'Amanda De Santa', ig_andreas: 'Andreas Sanchez',
    ig_ary: 'ARY', ig_ashley: 'Ashley Butler', ig_avery: 'Avery Duggan', ig_avi: 'Avi Schwartzman',
    ig_avischwartzman: 'Avi Schwartzman', ig_avon: 'Avon Hertz', ig_barry: 'Barry', ig_benny: 'Benny',
    ig_beverly: 'Beverly Felton', ig_brad: 'Brad Snider', ig_brucie2: 'Brucie Kibbutz', ig_casey: 'Casey',
    ig_charlie_reed: 'Charlie Reed', ig_chengsr: 'Wei Cheng', ig_chrisformage: 'Cris Formage', ig_clay: 'Clay Simons',
    ig_claypain: 'Clay Jackson', ig_cletus: 'Cletus Ewing', ig_dale: 'Dale', ig_davenorton: 'Dave Norton',
    ig_dax: 'Dax', ig_denise: 'Denise Clinton', ig_devin: 'Devin Weston', ig_dix: 'Dixon',
    ig_djblamadon: 'The Black Madonna', ig_djblamrupert: 'Rupert (Black Madonna\'s Crew)',
    ig_djblamryanh: 'Ryan H (Black Madonna\'s Crew)', ig_djblamryans: 'Ryan S (Black Madonna\'s Crew)',
    ig_djdixmanager: 'Dixon\'s Manager', ig_djsolfotios: 'Fotios (Solomun\'s Crew)',
    ig_djsoljakob: 'Jakob (Solomun\'s Crew)', ig_djsolmanager: 'Solomun\'s Manager', ig_djsolmike: 'Mike (Solomun\'s Crew)',
    ig_djsolrobt: 'Robert (Solomun\'s Crew)', ig_djtalaurelia: 'Aurelia (Tale Of Us\'s Crew)',
    ig_djtalignazio: 'Ignazio (Tale Of Us\'s Crew)', ig_dom: 'Dom Beasley', ig_dreyfuss: 'Peter Dreyfuss',
    ig_drfriedlander: 'Dr. Friedlander', ig_englishdave: 'English Dave', ig_faber: 'Faber',
    ig_fabien: 'Fabien LaRouche', ig_floyd: 'Floyd Hebert', ig_g: 'Gerald',
    ig_georginacheng: 'Georgina Cheng', ig_guadalope: 'Guadalope', ig_gustavo: 'Gustavo Mota', ig_hao: 'Hao',
    ig_helmsmanpavel: 'Pavel', ig_huang: 'Huang', ig_hunter: 'The Hunter', ig_imani: 'Imani',
    ig_isldj_00: 'Rampa', ig_isldj_01: '&ME', ig_isldj_02: 'Adam Port', ig_isldj_03: 'Palms Trax',
    ig_isldj_04: 'Moodymann', ig_isldj_04_d_01: 'Moodymann\'s Dancer #1', ig_isldj_04_d_02: 'Moodymann\'s Dancer #2',
    ig_isldj_04_e_01: 'Moodymann\'s Dancer #3', ig_jackie: 'Jackie', ig_jamalamir: 'Jamal Amir', ig_janet: 'Janet',
    ig_jay_norris: 'Jay Norris', ig_jenettee: 'Jenette', ig_jimmyboston: 'Jimmy Boston',
    ig_jimmydisanto: 'Jimmy De Santa', ig_jimmydisanto2: 'Jimmy De Santa #2', ig_jio: 'Jio',
    ig_jodimarshall: 'Jodi Marshall', ig_joeminuteman: 'Joe (Minuteman)', ig_johnny_guns: 'Johnny Guns',
    ig_johnnyklebitz: 'Johnny Klebitz', ig_josef: 'Josef', ig_josh: 'Josh Bernstein', ig_juanstrickler: 'Juan Strickler',
    ig_karen_daniels: 'Karen Daniels', ig_kaylee: 'Kaylee', ig_kerrymcintosh: 'Kerry McIntosh',
    ig_lacey_jones: 'Lacey Jones', ig_lamardavis: 'Lamar Davis', ig_lazlow: 'Lazlow', ig_lestercrest: 'Lester Crest',
    ig_lildee: 'Lil Dee', ig_luchadora: 'Luchadora', ig_magenta: 'Magenta', ig_malc: 'Malc', ig_manuel: 'Manuel',
    ig_marnie: 'Marnie Allen', ig_martinmadrazo: 'Martin Madrazo', ig_maryann: 'Mary-Ann Quinn',
    ig_mason_duggan: 'Mason Duggan', ig_maude: 'Maude', ig_maudebf: 'Maude\'s Boyfriend', ig_michelle: 'Michelle',
    ig_miguelmadrazo: 'Miguel Madrazo', ig_milton: 'Milton McIlroy', ig_mimi: 'Mimi', ig_mjo: 'MJO', ig_molly: 'Molly',
    ig_money: 'Money', ig_moodyman: 'Moodymann', ig_mrk: 'Mr. K', ig_mrs_thornhill: 'Mrs. Thornhill',
    ig_mrsphillips: 'Mrs. Philips', ig_natalia: 'Natalia', ig_nervousron: 'Nervous Ron', ig_nigel: 'Nigel',
    ig_omega: 'Omega', ig_oneil: 'O\'Neil', ig_orleans: 'Bigfoot', ig_ortega: 'Ortega', ig_oscar: 'Oscar',
    ig_paige: 'Paige Harris', ig_paper: 'Paper', ig_patricia: 'Patricia Madrazo', ig_pernell_moss: 'Pernell Moss',
    ig_popov: 'Dima Popov', ig_rae: 'Rae', ig_rafdeangelis: 'Raf DeAngelis', ig_rashcosvki: 'Maxim Rashkovsky',
    ig_roccopelosi: 'Rocco Pelosi', ig_roostermccraw: 'Rooster McCraw', ig_sacha: 'Sacha Yetarian',
    ig_sessanta: 'Sessanta', ig_siemonyetarian: 'Simeon Yetarian', ig_sol: 'Solomun', ig_solomon: 'Solomon Richards',
    ig_sss: 'SSS', ig_stevehains: 'Steve Haines', ig_stretch: 'Stretch', ig_talcc: 'Carmine Conte (Tale Of Us)',
    ig_talina: 'Talina', ig_talmm: 'Matteo Milleri (Tale Of Us)', ig_tanisha: 'Tanisha Jackson', ig_taocheng: 'Tao Cheng',
    ig_taocheng2: 'Tao Cheng #2', ig_taostranslator: 'Tao\'s Translator', ig_taostranslator2: 'Tao\'s Translator #2',
    ig_terry: 'Terry Thorpe', ig_thornton: 'Thornton Duggan', ig_tomcasino: 'Tom Connors', ig_tomepsilon: 'Tom (Epsilon)',
    ig_tonya: 'Tonya Wiggins', ig_tonyprince: 'Tony Prince', ig_tracydisanto: 'Tracey De Santa', ig_tylerdix: 'Tyler Dixon',
    ig_valentina: 'Valentina', ig_vernon: 'Vernon', ig_vincent: 'Vincent Effenburger', ig_wade: 'Wade Hebert',
    ig_weiss: 'Weiss', ig_wendy: 'Wendy', ig_yusufamir: 'Yusuf Amir', ig_zimbor: 'Zimbor',
    mp_f_deadhooker: 'Dead Streetwalker', mp_f_misty: 'Misty', mp_headtargets: 'Head Targets', mp_m_claude: 'Claude',
    mp_m_marston: 'John Marston', mp_m_niko: 'Niko Bellic',
    u_f_m_debbie: 'Debbie', u_f_m_miranda: 'Miranda', u_f_o_carol: 'Carol', u_f_o_eileen: 'Eileen',
    u_f_o_moviestar: 'Pamela Drake', u_f_y_beth: 'Beth', u_f_y_bikerchic: 'Biker Chick', u_f_y_comjane: 'Jane',
    u_f_y_lauren: 'Lauren', u_f_y_mistress: 'Mistress', u_f_y_poppymich: 'Poppy Mitchell', u_f_y_princess: 'Princess',
    u_f_y_taylor: 'Taylor', u_m_m_aldinapoli: 'Al Di Napoli', u_m_m_blane: 'Blane', u_m_m_curtis: 'Curtis',
    u_m_m_edtoh: 'Eddie Toh', u_m_m_glenstank: 'Glen Stank', u_m_m_griff: 'Griff', u_m_m_jesus: 'Jesse',
    u_m_m_markfost: 'Mark Fostenburg', u_m_m_vince: 'Vince', u_m_m_willyfist: 'Willy Fist', u_m_m_yeti: 'Yeti',
    u_m_m_yulemonster: 'Yule Monster', u_m_o_dean: 'Dean', u_m_o_finguru: 'Bill Binder', u_m_y_abner: 'Abner',
    u_m_y_antonb: 'Anton Beaudelaire', u_m_y_babyd: 'Baby D', u_m_y_baygor: 'Baygor', u_m_y_caleb: 'Caleb',
    u_m_y_chip: 'Chip', u_m_y_gabriel: 'Gabriel', u_m_y_guido: 'Guido', u_m_y_hippie: 'Andy Moon',
    u_m_y_imporage: 'Impotent Rage', u_m_y_justin: 'Justin', u_m_y_mani: 'Mani', u_m_y_militarybum: 'Clinton',
    u_m_y_pogo: 'Pogo The Space Monkey', u_m_y_rsranger: 'Republican Space Ranger', u_m_y_ushi: 'Ushi',
};

// ---- animals: "Boar", or "Boar #1" / "Boar #2" when there are two looks ------------------------------
const ANIMAL = {
    boar: 'Boar', cat: 'Cat', chickenhawk: 'Chickenhawk', chimp: 'Chimpanzee', chop: 'Chop', cormorant: 'Cormorant',
    cow: 'Cow', coyote: 'Coyote', crow: 'Crow', deer: 'Deer', dolphin: 'Dolphin', fish: 'Fish', hen: 'Hen',
    humpback: 'Humpback Whale', husky: 'Husky', killerwhale: 'Killer Whale', mtlion: 'Mountain Lion',
    panther: 'Panther', pig: 'Pig', pigeon: 'Pigeon', poodle: 'Poodle', pug: 'Pug', rabbit: 'Rabbit', rat: 'Rat',
    retriever: 'Retriever', rhesus: 'Rhesus Monkey', rottweiler: 'Rottweiler', seagull: 'Seagull',
    sharkhammer: 'Hammerhead Shark', sharktiger: 'Tiger Shark', shepherd: 'German Shepherd', stingray: 'Stingray',
    westy: 'West Highland Terrier',
};

function group(m) {
    if (m.startsWith('a_c_')) return 'animals';
    if (m.startsWith('a_m_')) return 'men';
    if (m.startsWith('a_f_')) return 'women';
    if (m.startsWith('s_')) return 'services';
    if (m.startsWith('g_')) return 'gangs';
    if (m.startsWith('u_')) return 'unique';
    if (m.startsWith('mp_') || m.startsWith('hc_')) return 'online';
    return 'story';   // ig_, player_
}

const female = (m) => {
    if (/^(a|s|g|u|mp)_f_/.test(m)) return true;
    if (/^(a|s|g|u|mp|mp_g|mp_s)_m_/.test(m) || /^mp_[gs]_m_/.test(m)) return false;
    const p = byModel[m];
    if (!p) {
        console.error(m + ' is not in peds.json, so its gender is not known: name it in CHAR, or end its ROLE with !');
        process.exit(1);
    }
    return /female/i.test(p.Pedtype);
};

const lookup = (dict, m) => {
    if (dict[m] !== undefined) return [dict[m], 1];
    const s = m.match(/^(.*?)_?(\d+)$/);
    if (s && dict[s[1]] !== undefined) return [dict[s[1]], Number(s[2])];
    return null;
};

const found = fs.readdirSync(PICTURES).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();
const banned = found.filter((m) => NOT_SHIPPED.test(m));
if (banned.length) console.error('LEFT OUT, NEVER SHIPPED (delete these pictures):', banned.map((m) => m + '.webp').join(' '));
const pictures = found.filter((m) => !NOT_SHIPPED.test(m));
const stems = [];        // [model, stem, kind] in model order; numbered in a second pass
const missing = [];
for (const m of pictures) {
    let stem = null, kind = 'numbered';
    if (/^a_[mf]_/.test(m)) {
        const parts = m.split('_');
        let key = parts.slice(3).join('_').replace(/_\d+$/, '');
        if (AMBIENT[key] !== undefined) stem = AGE[parts[2]] + AMBIENT[key] + (parts[1] === 'm' ? ' Male' : ' Female');
    } else if (m.startsWith('a_c_')) {
        const key = m.slice(4).replace(/_\d+$/, '');
        if (ANIMAL[key] !== undefined) { stem = ANIMAL[key]; kind = 'animal'; }
    } else {
        const role = lookup(ROLE, m);
        if (role) {
            const r = role[0];
            stem = r.endsWith('!') ? r.slice(0, -1) : r + (female(m) ? ' Female' : ' Male');
        } else {
            const c = lookup(CHAR, m);
            if (c) { stem = c[0] + (c[1] > 1 ? ' #' + c[1] : ''); kind = 'named'; }
        }
    }
    if (stem === null) missing.push(m);
    else stems.push([m, stem, kind]);
}
if (missing.length) { console.error('NO NAME FOR:', missing.join(' ')); process.exit(1); }

const count = {};
for (const s of stems) if (s[2] !== 'named') count[s[1]] = (count[s[1]] || 0) + 1;
// A role met in several tabs counts on across them, everyday tabs first: Services' chef is "Chef Male #1",
// the story's chefs #2 on.
const FIRST = ['men', 'women', 'services', 'gangs', 'animals', 'unique', 'online', 'story'];
stems.sort((a, b) => FIRST.indexOf(group(a[0])) - FIRST.indexOf(group(b[0])) || (a[0] < b[0] ? -1 : 1));
const seen = {};
const rows = stems.map(([m, stem, kind]) => {
    let name = stem;
    if (kind === 'numbered' || (kind === 'animal' && count[stem] > 1)) {
        seen[stem] = (seen[stem] || 0) + 1;
        name = stem + ' #' + seen[stem];
    }
    return [m, group(m), name];
});

const dupes = {};
for (const r of rows) dupes[r[2]] = (dupes[r[2]] || []).concat(r[0]);
const clash = Object.entries(dupes).filter(([, v]) => v.length > 1);
if (clash.length) { console.error('SAME NAME:', JSON.stringify(clash)); process.exit(1); }
const unknown = pictures.filter((m) => !byModel[m]);

// In the tabs' own order (a cluster's "All" shows Story before Unique before Online), A to Z in each.
const TAB_ORDER = ['men', 'women', 'services', 'gangs', 'story', 'unique', 'online', 'animals'];
rows.sort((a, b) => TAB_ORDER.indexOf(a[1]) - TAB_ORDER.indexOf(b[1]) || a[2].localeCompare(b[2], 'en', { numeric: true }));

const out = `// ========================================
// THE WORLD BUILDER'S NPCs (the Director's World tab): every ped with a picture
//
// Generated from the pictures in whip_media_previews/img/peds (${rows.length} peds, one <model>.webp each), named so
// a person can read them: passers-by by who they are ("Indian Male #1", "Young Rockford Hills Female #2"),
// jobs and gangs by their role ("LSPD Officer Female #1", "Ballas Male #3"), the story's people by name
// ("Lamar Davis", "Lamar Davis #2" for his second look), animals by kind. A ped without a picture is still
// placed with "By name".
//
// Newer than DurtyFree's peds.json: ${unknown.join(', ') || 'none'}.
//
// A ped a game build does not have is refused when picked (client/property_furnish.lua asks the game).
// Do not edit by hand: regenerate it with node dev/builder_peds.js <peds.json> (the names are in there).
// ========================================

export const PED_CLUSTERS = [
    { key: 'people', label: 'People', glyph: 'person' },
    { key: 'characters', label: 'Story Mode Characters', glyph: 'person' },
    { key: 'animals', label: 'Animals', glyph: 'paw' },
];

export const PED_CATEGORIES = [
    { key: 'men', label: 'Men', cluster: 'people', glyph: 'person' },
    { key: 'women', label: 'Women', cluster: 'people', glyph: 'person' },
    { key: 'services', label: 'Services', cluster: 'people', glyph: 'person' },
    { key: 'gangs', label: 'Gangs', cluster: 'people', glyph: 'person' },
    { key: 'story', label: 'Story', cluster: 'characters', glyph: 'person' },
    { key: 'unique', label: 'Unique', cluster: 'characters', glyph: 'person' },
    { key: 'online', label: 'Online', cluster: 'characters', glyph: 'person' },
    { key: 'animals', label: 'Animals', cluster: 'animals', glyph: 'paw' },
];

/** [model, category, name] */
const ROWS = ${JSON.stringify(rows).replace(/\],\[/g, '],\n    [').replace(/^\[\[/, '[\n    [').replace(/\]\]$/, '],\n]')};

export const PEDS = ROWS.map((r) => ({ model: r[0], category: r[1], name: r[2] }));
`;
fs.writeFileSync(OUT, out);
const byGroup = {};
for (const r of rows) byGroup[r[1]] = (byGroup[r[1]] || 0) + 1;
console.log(rows.length, JSON.stringify(byGroup), 'not in the dump:', unknown.join(' '));
