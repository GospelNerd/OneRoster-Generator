// Creative naming scheme. Combinatorial word banks yield large numbers of
// distinct, obviously-fake names so test data never resembles a real person.
//
//   School   -> "Raspberry James Elementary School"   (flavor + person + level)
//   District -> "Marigold Valley Unified School District" (flavor + geo + type)
//   Class    -> "Preposterous Platypus" / "Pink Elephant" (adjective + animal)
//   Person   -> "Jamika Jellyroll"                      (first + whimsy surname)

'use strict';

// Fruits, colors, and other flavor words that lead a school name.
const FLAVORS = [
  'Raspberry', 'Blueberry', 'Tangerine', 'Marigold', 'Crimson', 'Cobalt',
  'Emerald', 'Saffron', 'Clementine', 'Mulberry', 'Juniper', 'Hazelnut',
  'Cinnamon', 'Persimmon', 'Lavender', 'Cerulean', 'Marmalade', 'Huckleberry',
  'Butterscotch', 'Pomegranate', 'Sunflower', 'Peppermint', 'Apricot',
  'Dandelion', 'Nectarine', 'Periwinkle', 'Chartreuse', 'Plum', 'Tangelo',
  'Gooseberry',
];

// A person-ish token that sits in the middle of a school name.
const SCHOOL_PEOPLE = [
  'James', 'Ada', 'Rivera', 'Okonkwo', 'Delgado', 'Whitmore', 'Castellano',
  'Amara', 'Bishop', 'Cortez', 'Hollis', 'Ravenscroft', 'Merriweather',
  'Underwood', 'Kingsley', 'Larkspur', 'Fairbanks', 'Sterling', 'Ellsworth',
  'Marchetti', 'Nakamura', 'Beauregard', 'Fitzgerald', 'Vandersloot',
  'Abernathy', 'Winterbourne', 'Calloway', 'Deveraux', 'Montgomery', 'Ashby',
];

// Geographic words for district names.
const GEO = [
  'Valley', 'Ridge', 'Heights', 'Hollow', 'Springs', 'Grove', 'Meadows',
  'Harbor', 'Summit', 'Prairie', 'Canyon', 'Bluff', 'Brook', 'Glen', 'Vale',
  'Crossing', 'Landing', 'Falls', 'Cove', 'Highlands',
];

const DISTRICT_TYPES = [
  'Unified School District',
  'Independent School District',
  'Public Schools',
  'County Schools',
  'Consolidated School District',
];

// Whimsical adjectives, reused for class titles and for alliterative surnames.
const ADJECTIVES = [
  'Preposterous', 'Whimsical', 'Ludicrous', 'Bombastic', 'Cantankerous',
  'Effervescent', 'Gregarious', 'Rambunctious', 'Serendipitous', 'Persnickety',
  'Quixotic', 'Boisterous', 'Curious', 'Dapper', 'Ferocious', 'Gallant',
  'Hapless', 'Incandescent', 'Jovial', 'Kooky', 'Luminous', 'Majestic',
  'Nimble', 'Obstinate', 'Peculiar', 'Radiant', 'Sprightly', 'Tenacious',
  'Voracious', 'Zany', 'Pink', 'Wobbly', 'Zesty', 'Bewildered',
];

const ANIMALS = [
  'Platypus', 'Elephant', 'Narwhal', 'Aardvark', 'Chinchilla', 'Pangolin',
  'Wombat', 'Axolotl', 'Capybara', 'Ocelot', 'Meerkat', 'Tapir', 'Quokka',
  'Lemur', 'Manatee', 'Ferret', 'Hedgehog', 'Armadillo', 'Mongoose',
  'Salamander', 'Flamingo', 'Pelican', 'Toucan', 'Otter', 'Badger', 'Bison',
  'Cheetah', 'Dingo', 'Gecko', 'Heron', 'Iguana', 'Jackal', 'Koala', 'Lynx',
  'Marmot', 'Newt', 'Osprey', 'Puffin', 'Raccoon', 'Stoat',
];

// Diverse given names.
const FIRST_NAMES = [
  'Jamika', 'Aisha', 'Mateo', 'Priya', 'Kenji', 'Fatima', 'Diego', 'Amara',
  'Liam', 'Sofia', 'Omar', 'Zara', 'Hiroshi', 'Nadia', 'Malik', 'Elena',
  'Tariq', 'Yuki', 'Camila', 'Dev', 'Ingrid', 'Kwame', 'Lucia', 'Rashid',
  'Freya', 'Bao', 'Anaya', 'Cyrus', 'Delphine', 'Emeka', 'Farah', 'Giselle',
  'Hassan', 'Imani', 'Javier', 'Keiko', 'Leila', 'Marcus', 'Nikhil', 'Olga',
  'Pedro', 'Quincy', 'Rosa', 'Samuel', 'Thandiwe', 'Ulises', 'Valentina',
  'Wei', 'Ximena', 'Yosef', 'Zainab', 'Beatrix', 'Caspian', 'Dahlia', 'Ezra',
  'Fiona', 'Grover', 'Harriet', 'Isadora', 'Jasper', 'Kiara', 'Lorenzo',
  'Maya', 'Noor', 'Ravi', 'Selena', 'Tobias', 'Uma', 'Vikram', 'Winnie',
];

// Playful surnames. Grouped so we can attempt first-letter alliteration.
const WHIMSY_SURNAMES = [
  'Applesauce', 'Bumblebee', 'Buttercup', 'Cartwheel', 'Copperpot',
  'Dazzleberry', 'Doodlebug', 'Everglade', 'Flapjack', 'Fiddlesticks',
  'Gingersnap', 'Grumbleton', 'Higgledy', 'Honeywell', 'Inkwell', 'Jellyroll',
  'Jamboree', 'Jitterbug', 'Jinglepocket', 'Kerfuffle', 'Kettleworth',
  'Lollipop', 'Livingood', 'Marmalade', 'Moonbeam', 'Noodleman', 'Oddbody',
  'Pumpernickel', 'Pillowsworth', 'Quibble', 'Razzmatazz', 'Snickerdoodle',
  'Tumbleweed', 'Umbrella', 'Vanderpuff', 'Wobblesworth', 'Xylophone',
  'Yodelay', 'Zigzagger', 'Bramblewood', 'Cricketwhistle', 'Dewdrop',
  'Fizzlewick', 'Gumboot', 'Huckleberry', 'Jamsworth', 'Kindlewood',
  'Lanternfish', 'Mossbottom', 'Nettlebed', 'Puddleduck', 'Quillfeather',
  'Ripplebrook', 'Snapdragon', 'Thistledown', 'Wickerbasket',
];

const LEVELS = {
  elementary: { word: 'Elementary', grades: ['KG', '01', '02', '03', '04', '05'] },
  middle: { word: 'Middle', grades: ['06', '07', '08'] },
  high: { word: 'High', grades: ['09', '10', '11', '12'] },
  k12: { word: '', grades: ['KG', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] },
};

function byFirstLetter(list) {
  const map = {};
  for (const w of list) {
    const k = w[0].toUpperCase();
    (map[k] = map[k] || []).push(w);
  }
  return map;
}

const SURNAMES_BY_LETTER = byFirstLetter(WHIMSY_SURNAMES);
const ANIMALS_BY_LETTER = byFirstLetter(ANIMALS);

// Factory tracks used names to keep orgs and class titles unique per dataset.
class NameFactory {
  constructor(rng) {
    this.rng = rng;
    this.usedOrgs = new Set();
    this.usedClasses = new Set();
  }

  _unique(set, makeFn, maxTries = 40) {
    for (let i = 0; i < maxTries; i++) {
      const v = makeFn();
      if (!set.has(v)) {
        set.add(v);
        return v;
      }
    }
    // Fallback: append a counter so we never loop forever.
    let n = 2;
    let base = makeFn();
    while (set.has(`${base} ${n}`)) n++;
    const v = `${base} ${n}`;
    set.add(v);
    return v;
  }

  schoolName(levelWord) {
    return this._unique(this.usedOrgs, () => {
      const flavor = this.rng.pick(FLAVORS);
      const person = this.rng.pick(SCHOOL_PEOPLE);
      return levelWord
        ? `${flavor} ${person} ${levelWord} School`
        : `${flavor} ${person} School`;
    });
  }

  districtName() {
    return this._unique(this.usedOrgs, () => {
      const flavor = this.rng.pick(FLAVORS);
      const geo = this.rng.pick(GEO);
      const type = this.rng.pick(DISTRICT_TYPES);
      return `${flavor} ${geo} ${type}`;
    });
  }

  // Adjective + animal, attempting alliteration ~60% of the time.
  classTitle() {
    return this._unique(this.usedClasses, () => {
      const adj = this.rng.pick(ADJECTIVES);
      const letter = adj[0].toUpperCase();
      const pool = ANIMALS_BY_LETTER[letter];
      const animal =
        pool && this.rng.bool(0.6) ? this.rng.pick(pool) : this.rng.pick(ANIMALS);
      return `${adj} ${animal}`;
    });
  }

  // First name + whimsy surname, attempting alliteration ~50% of the time.
  personName() {
    const first = this.rng.pick(FIRST_NAMES);
    const letter = first[0].toUpperCase();
    const pool = SURNAMES_BY_LETTER[letter];
    const family =
      pool && this.rng.bool(0.5) ? this.rng.pick(pool) : this.rng.pick(WHIMSY_SURNAMES);
    return { given: first, family };
  }
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-+|-+$/g, '');
}

module.exports = { NameFactory, LEVELS, slugify };
