
// 1. RELIGION
export const RELIGIONS = {
  ISLAM: 'Islam',
  CHRISTIANITY: 'Christianity',
  HINDUISM: 'Hinduism',
  BUDDHISM: 'Buddhism',
  SIKHISM: 'Sikhism',
  JUDAISM: 'Judaism',
  OTHER: 'Other',
} as const;
export type ReligionKey = keyof typeof RELIGIONS;

// 2. SECT
export const SECTS: Record<ReligionKey, Record<string, string>> = {
  ISLAM: { SUNNI: 'Sunni', SHIA: 'Shia', AHMADI: 'Ahmadi', ISMAILI: 'Ismaili', OTHER: 'Other' },
  CHRISTIANITY: { CATHOLIC: 'Catholic', PROTESTANT: 'Protestant', ORTHODOX: 'Orthodox', OTHER: 'Other' },
  HINDUISM: { VAISHNAVISM: 'Vaishnavism', SHAIVISM: 'Shaivism', SHAKTISM: 'Shaktism', SMARTISM: 'Smartism', OTHER: 'Other' },
  BUDDHISM: { THERAVADA: 'Theravada', MAHAYANA: 'Mahayana', VAJRAYANA: 'Vajrayana', OTHER: 'Other' },
  SIKHISM: { JAT: 'Jat', KHATRI: 'Khatri', ARORA: 'Arora', OTHER: 'Other' },
  JUDAISM: { ORTHODOX: 'Orthodox', CONSERVATIVE: 'Conservative', REFORM: 'Reform', OTHER: 'Other' },
  OTHER: { OTHER: 'Other' },
};
export type SectKey = keyof (typeof SECTS)[keyof typeof SECTS];


// 3. CASTS
export const CASTS = {
  PATHAN: 'Pathan',
  PUNJABI: 'Punjabi',
  SINDHI: 'Sindhi',
  BENGALI: 'Bengali',
  GUJARATI: 'Gujarati',
  MARATHI: 'Marathi',
  TAMIL: 'Tamil',
  TELUGU: 'Telugu',
  MALAYALI: 'Malayali',
  PASHTUN: 'Pashtun',
  KASHMIRI: 'Kashmiri',
  SARAIKI: 'Saraiki',
  BALOCH: 'Baloch',
  RAJPUT: 'Rajput',
  KAYASTHA: 'Kayastha',
  BRAHMIN: 'Brahmin',
  KHATRI: 'Khatri',
  JATT: 'Jatt',
  ARAIN: 'Arain',
  SYED: 'Syed',
  OTHER: 'Other',
} as const;
export type CastKey = keyof typeof CASTS;

// 4. RELATIONSHIP STATUS
export const RELATIONSHIP_STATUSES = {
  SINGLE: 'Single',
  NEVER_MARRIED: 'Never Married',
  ENGAGED: 'Engaged',
  MARRIED: 'Married',
  SEPARATED: 'Separated',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
} as const;
export type RelationshipStatusKey = keyof typeof RELATIONSHIP_STATUSES;


// 5. CHILDREN
export const CHILDREN = {
  NONE: 'No children',
  WITH_ME: 'Yes, living with me',
  NOT_WITH_ME: 'Yes, not living with me',
} as const;
export type ChildrenKey = keyof typeof CHILDREN;

// 6. MOVE ABROAD
export const MOVE_ABROAD = {
  YES: 'Yes, open to relocating',
  MAYBE: 'Maybe, depends on opportunity',
  NO: 'No, prefer staying local',
} as const;
export type MoveAbroadKey = keyof typeof MOVE_ABROAD;

// 7. HIGHEST EDUCATION
export const HIGHEST_EDUCATION = {
  HIGH_SCHOOL: 'High School Graduate',
  ASSOCIATES: "Associate's Degree",
  BACHELORS: "Bachelor's Degree",
  MASTERS: "Master's Degree",
  DOCTORATE: 'Doctorate',
  DIPLOMA: 'Diploma/Trade School',
  OTHER: 'Other',
} as const;
export type HighestEducationKey = keyof typeof HIGHEST_EDUCATION;

// 8. SMOKING HABITS
export const SMOKE_STATUSES = {
  NEVER: 'Never',
  OCCASIONAL: 'Occasionally',
  REGULAR: 'Regularly',
} as const;
export type SmokeStatusKey = keyof typeof SMOKE_STATUSES;

// 9. ALCOHOL HABITS
export const DRINK_STATUSES = {
  NEVER: 'Never',
  OCCASIONAL: 'Occasionally',
  SOCIAL: 'Socially',
  REGULAR: 'Regularly',
} as const;
export type DrinkStatusKey = keyof typeof DRINK_STATUSES;

// 10. INTERESTS (grouped by category)
export const INTEREST_CATEGORIES = {
  ARTS_CRAFTS: 'Arts & Crafts 🎨',
  FOOD_COOKING: 'Food & Cooking 🍲',
  BOOKS_LIT: 'Books & Literature 📚',
  MUSIC: 'Music 🎵',
  TRAVEL: 'Travel & Adventure ✈️',
  SPORTS_FITNESS: 'Sports & Fitness 🏅',
  FASHION_STYLE: 'Fashion & Style 👗',
  MOVIES_TV: 'Movies & TV Shows 🎬',
  MISC: 'Miscellaneous ✨',
} as const;

export const INTERESTS = {
  PAINTING: 'Painting 🎨',
  SEWING: 'Sewing 🧵',
  DRAWING: 'Drawing ✏️',
  POTTERY: 'Pottery 🏺',
  DESIGN: 'Design 🖌️',
  SCULPTURE: 'Sculpture 🗿',
  DIGITAL_ART: 'Digital Art 💻',
  WOODWORKING: 'Woodworking 🔨',
  PHOTOGRAPHY: 'Photography 📸',
  DIY_CRAFTS: 'DIY Crafts 🛠️',
  DESSERTS: 'Desserts 🍰',
  SPICY_FOOD: 'Spicy Food 🌶️',
  BAKING: 'Baking 🧁',
  STREET_FOOD: 'Street Food 🍢',
  HEALTHY_FOOD: 'Healthy Food 🥗',
  TRADITIONAL_CUISINE: 'Traditional Cuisine 🍛',
  COFFEE_LOVER: 'Coffee Lover ☕',
  HOME_COOKING: 'Home Cooking 🍳',
  FANTASY: 'Fantasy 🧝‍♂️',
  BIOGRAPHIES: 'Biographies 📖',
  SCI_FI: 'Sci-Fi 🚀',
  FICTION: 'Fiction 📘',
  POETRY: 'Poetry ✒️',
  PHILOSOPHY: 'Philosophy 🧠',
  RELIGIOUS: 'Religious 📿',
  NON_FICTION: 'Non-Fiction 📚',
  LISTENING_MUSIC: 'Listening to Music 🎧',
  SINGING: 'Singing 🎤',
  DANCING: 'Dancing 💃',
  INSTRUMENTS: 'Playing Instruments 🎸',
  JAZZ: 'Jazz 🎷',
  SONGWRITING: 'Songwriting ✍️',
  CLASSICAL_MUSIC: 'Classical Music 🎻',
  ROCK_POP: 'Rock/Pop Music 🎸',
  CONCERTS: 'Concerts & Festivals 🎫',
  MUSIC_PRODUCTION: 'Music Production 🎛️',
  EXPLORING: 'Exploring 🧭',
  ABROAD: 'Abroad 🌍',
  CULTURAL: 'Cultural 🏛️',
  BACKPACKING: 'Backpacking 🎒',
  MOUNTAINS: 'Mountains 🏔️',
  ROAD_TRIPS: 'Road Trips 🚗',
  CAMPING: 'Camping 🏕️',
  VOLUNTEERING: 'Volunteering 🤝',
  SOLO_TRAVEL: 'Solo Travel 🧳',
  BEACH: 'Beach 🏖️',
  RUNNING: 'Running 🏃‍♂️',
  FOOTBALL: 'Football ⚽',
  BASKETBALL: 'Basketball 🏀',
  TENNIS: 'Tennis 🎾',
  GYM: 'Gym/Weightlifting 🏋️‍♂️',
  SWIMMING: 'Swimming 🏊‍♂️',
  HIKING: 'Hiking 🥾',
  MARTIAL_ARTS: 'Martial Arts 🥋',
  CYCLING: 'Cycling 🚴‍♂️',
  YOGA: 'Yoga 🧘‍♂️',
  VINTAGE: 'Vintage 🕰️',
  STYLING: 'Styling 👗',
  FASHION_PHOTO: 'Fashion Photography 📸',
  STREETWEAR: 'Streetwear 🧢',
  DIY_FASHION: 'DIY Fashion ✂️',
  SUSTAINABLE: 'Sustainable Fashion ♻️',
  HAUTE_COUTURE: 'Haute Couture 👠',
  JEWELRY: 'Jewelry 💍',
  MAKEUP: 'Makeup 💄',
  ACTION: 'Action 🎬',
  COMEDY: 'Comedy 😂',
  DRAMA: 'Drama 🎭',
  SCIFI_MOVIES: 'Sci-Fi (Movies/TV) 👽',
  ANIME: 'Anime 🌸',
  THRILLER: 'Thriller 🔪',
  HORROR: 'Horror 🧟',
  ROMANCE: 'Romance ❤️',
  CLASSICS: 'Classics 🎞️',
  PETS: 'Pets 🐾',
  PUZZLES: 'Puzzles 🧩',
  HISTORY: 'History 🏺',
  DIY_HOME: 'DIY Home 🛠️',
  ASTROLOGY: 'Astrology 🔮',
  BOARD_GAMES: 'Board Games 🎲',
  LANGUAGES: 'Languages 🗣️',
  COLLECTING: 'Collecting 🗃️',
  GARDENING: 'Gardening 🌱',
  SPIRITUALITY: 'Spirituality ✨',
} as const;
export type InterestKey = keyof typeof INTERESTS;

// Optional mapping from category to interests (useful for UI grouping)
export const INTERESTS_BY_CATEGORY: Record<keyof typeof INTEREST_CATEGORIES, InterestKey[]> = {
  ARTS_CRAFTS: [
    'PAINTING',
    'SEWING',
    'DRAWING',
    'POTTERY',
    'DESIGN',
    'SCULPTURE',
    'DIGITAL_ART',
    'WOODWORKING',
    'PHOTOGRAPHY',
    'DIY_CRAFTS',
  ],
  FOOD_COOKING: [
    'DESSERTS',
    'SPICY_FOOD',
    'BAKING',
    'STREET_FOOD',
    'HEALTHY_FOOD',
    'TRADITIONAL_CUISINE',
    'COFFEE_LOVER',
    'HOME_COOKING',
  ],
  BOOKS_LIT: [
    'FANTASY',
    'BIOGRAPHIES',
    'SCI_FI',
    'FICTION',
    'POETRY',
    'PHILOSOPHY',
    'RELIGIOUS',
    'NON_FICTION',
  ],
  MUSIC: [
    'LISTENING_MUSIC',
    'SINGING',
    'DANCING',
    'INSTRUMENTS',
    'JAZZ',
    'SONGWRITING',
    'CLASSICAL_MUSIC',
    'ROCK_POP',
    'CONCERTS',
    'MUSIC_PRODUCTION',
  ],
  TRAVEL: [
    'EXPLORING',
    'ABROAD',
    'CULTURAL',
    'BACKPACKING',
    'MOUNTAINS',
    'ROAD_TRIPS',
    'CAMPING',
    'VOLUNTEERING',
    'SOLO_TRAVEL',
    'BEACH',
  ],
  SPORTS_FITNESS: [
    'RUNNING',
    'FOOTBALL',
    'BASKETBALL',
    'TENNIS',
    'GYM',
    'SWIMMING',
    'HIKING',
    'MARTIAL_ARTS',
    'CYCLING',
    'YOGA',
  ],
  FASHION_STYLE: [
    'VINTAGE',
    'STYLING',
    'FASHION_PHOTO',
    'STREETWEAR',
    'DIY_FASHION',
    'SUSTAINABLE',
    'HAUTE_COUTURE',
    'JEWELRY',
    'MAKEUP',
  ],
  MOVIES_TV: [
    'ACTION',
    'COMEDY',
    'DRAMA',
    'SCIFI_MOVIES',
    'ANIME',
    'THRILLER',
    'HORROR',
    'ROMANCE',
    'CLASSICS',
  ],
  MISC: [
    'PETS',
    'PUZZLES',
    'HISTORY',
    'DIY_HOME',
    'ASTROLOGY',
    'BOARD_GAMES',
    'LANGUAGES',
    'COLLECTING',
    'GARDENING',
    'SPIRITUALITY',
  ],
};

// 11. PERSONALITY TRAITS
export const PERSONALITY_TRAITS = {
  OUTGOING: 'Outgoing 😃',
  INTROVERTED: 'Introverted 🤫',
  CREATIVE: 'Creative 🎨',
  HONEST: 'Honest 🤝',
  SENSITIVE: 'Sensitive 🌿',
  ROMANTIC: 'Romantic ❤️',
  LOYAL: 'Loyal 🐾',
  CONFIDENT: 'Confident 💪',
  CALM_PATIENT: 'Calm/Patient 🧘',
  ADVENTUROUS: 'Adventurous 🧭',
  EMPATHETIC: 'Empathetic 🤗',
  FUNNY: 'Funny 😂',
  INDEPENDENT: 'Independent 🦅',
  HARD_WORKING: 'Hard-working 🔨',
  SPONTANEOUS: 'Spontaneous 🎉',
  SOCIAL: 'Social 🗣️',
  SUPPORTIVE: 'Supportive 🤝',
  PRAGMATIC: 'Pragmatic 📐',
  INTELLECTUAL: 'Intellectual 🧠',
  COMPASSIONATE: 'Compassionate 💗',
  GOAL_ORIENTED: 'Goal-Oriented 🎯',
  ORGANIZED: 'Organized 📅',
  EASY_GOING: 'Easy-going 😌',
} as const;
export type PersonalityKey = keyof typeof PERSONALITY_TRAITS;
