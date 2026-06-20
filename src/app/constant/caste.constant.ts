export interface TCasteClanNode {
  id: string;
  name: string;
}

export interface TCasteNode {
  id: string;
  name: string;
  clans?: readonly TCasteClanNode[];
}

export interface TCasteCategoryNode {
  id: string;
  name: string;
  castes: readonly TCasteNode[];
}
// Canonical caste identity hierarchy for cascading UI.
// The app stores selected IDs only: category -> caste/biradari/tribe -> clan/lineage.
export const CASTE_TREE = [
  {
    id: 'PUNJABI',
    name: 'Punjabi',
    castes: [
      {
        id: 'JATT',
        name: 'Jatt',
        clans: [
          { id: 'BAJWA', name: 'Bajwa' },
          { id: 'CHEEMA', name: 'Cheema' },
          { id: 'GHUMMAN', name: 'Ghumman' },
          { id: 'TARAR', name: 'Tarar' },
          { id: 'GONDAL', name: 'Gondal' },
          { id: 'SIDHU', name: 'Sidhu' },
          { id: 'GILL', name: 'Gill' },
          { id: 'SANDHU', name: 'Sandhu' },
        ],
      },
      {
        id: 'RAJPUT',
        name: 'Rajput',
        clans: [
          { id: 'BHATTI', name: 'Bhatti' },
          { id: 'JANJUA', name: 'Janjua' },
          { id: 'KHOKHAR', name: 'Khokhar' },
          { id: 'WATTOO', name: 'Wattoo' },
          { id: 'CHOUHAN', name: 'Chouhan' },
          { id: 'MINHAS', name: 'Minhas' },
          { id: 'NIAZ', name: 'Niaz' },
          { id: 'JOYA', name: 'Joya' },
        ],
      },
      { id: 'ARAIN', name: 'Arain' },
      { id: 'GUJJAR', name: 'Gujjar' },
      { id: 'AWAN', name: 'Awan' },
      { id: 'GAKHAR', name: 'Gakhar' },
      { id: 'DOGAR', name: 'Dogar' },
      { id: 'KAMBOH', name: 'Kamboh' },
      { id: 'KAKAZAI', name: 'Kakazai' },
    ],
  },
  {
    id: 'RELIGIOUS_LINEAGE',
    name: 'Religious Lineage',
    castes: [
      {
        id: 'SYED',
        name: 'Syed',
        clans: [
          { id: 'GILLANI', name: 'Gillani' },
          { id: 'HASHMI', name: 'Hashmi' },
          { id: 'RIZVI', name: 'Rizvi' },
          { id: 'BUKHARI', name: 'Bukhari' },
          { id: 'ZAIDI', name: 'Zaidi' },
        ],
      },
      { id: 'QURESHI', name: 'Qureshi' },
      {
        id: 'SHEIKH',
        name: 'Sheikh',
        clans: [
          { id: 'SIDDIQUI', name: 'Siddiqui' },
          { id: 'FAROOQI', name: 'Farooqi' },
          { id: 'USMANI', name: 'Usmani' },
        ],
      },
      { id: 'MUGHAL', name: 'Mughal' },
      { id: 'ABBASI', name: 'Abbasi' },
      { id: 'ALVI', name: 'Alvi' },
    ],
  },
  {
    id: 'PASHTUN',
    name: 'Pashtun',
    castes: [
      { id: 'YOUSEFZAI', name: 'Yousafzai' },
      { id: 'AFRIDI', name: 'Afridi' },
      { id: 'KHATTAK', name: 'Khattak' },
      { id: 'DURRANI', name: 'Durrani' },
      { id: 'NIAZI', name: 'Niazi' },
      {
        id: 'MEHSUD',
        name: 'Mehsud',
        clans: [
          { id: 'ALIZAI', name: 'Alizai' },
          { id: 'BAHLULZAI', name: 'Bahlulzai' },
          { id: 'SHAMAN_KHEL', name: 'Shaman Khel' },
          { id: 'MANZAI', name: 'Manzai' },
          { id: 'BALIZAI', name: 'Balizai' },
          { id: 'JALAL_KHEL', name: 'Jalal Khel' },
        ],
      },
      {
        id: 'WAZIR',
        name: 'Wazir',
        clans: [
          { id: 'AHMADZAI_WAZIR', name: 'Ahmadzai Wazir' },
          { id: 'UTMANZAI_WAZIR', name: 'Utmanzai Wazir' },
          { id: 'BAKA_KHEL', name: 'Baka Khel' },
          { id: 'JANI_KHEL', name: 'Jani Khel' },
        ],
      },
      { id: 'BANGASH', name: 'Bangash' },
      { id: 'SHINWARI', name: 'Shinwari' },
      { id: 'KAKARI', name: 'Kakari' },
      { id: 'ACHAKZAI', name: 'Achakzai' },
    ],
  },
  {
    id: 'BALOCH_BRAHUI',
    name: 'Baloch / Brahui',
    castes: [
      {
        id: 'RIND',
        name: 'Rind',
        clans: [
          { id: 'MIRANZAI', name: 'Miranzai' },
          { id: 'TAHIRZAI', name: 'Tahirzai' },
          { id: 'SHAHALZAI', name: 'Shahalzai' },
          { id: 'PEROZAI', name: 'Perozai' },
          { id: 'MIROZAI', name: 'Mirozai' },
          { id: 'KHIAZAI', name: 'Khiazai' },
          { id: 'NUHANI', name: 'Nuhani' },
        ],
      },
      { id: 'BUGTI', name: 'Bugti' },
      {
        id: 'MARRI',
        name: 'Marri',
        clans: [
          { id: 'GAZANI', name: 'Gazani' },
          { id: 'LOHARANI', name: 'Loharani' },
        ],
      },
      { id: 'LASHARI', name: 'Lashari' },
      { id: 'MENGAL', name: 'Mengal' },
      { id: 'MAZARI', name: 'Mazari' },
      { id: 'LEGHARI', name: 'Leghari' },
      { id: 'JATOI', name: 'Jatoi' },
      { id: 'TALPUR', name: 'Talpur' },
      { id: 'KHOSA', name: 'Khosa' },
      { id: 'CHANDIO', name: 'Chandio' },
      { id: 'RAISANI', name: 'Raisani' },
    ],
  },
  {
    id: 'SINDHI',
    name: 'Sindhi',
    castes: [
      { id: 'SOOMRO', name: 'Soomro' },
      { id: 'SAMMO', name: 'Sammo' },
      { id: 'JUNEJO', name: 'Junejo' },
      { id: 'BHUTTO', name: 'Bhutto' },
      { id: 'SHAH', name: 'Shah' },
      { id: 'MEMON', name: 'Memon' },
      { id: 'MAKHDOOM', name: 'Makhdoom' },
      { id: 'PALIJO', name: 'Palijo' },
    ],
  },
  {
    id: 'KASHMIRI',
    name: 'Kashmiri',
    castes: [
      { id: 'BUTT', name: 'Butt' },
      { id: 'DAR', name: 'Dar' },
      { id: 'LONE', name: 'Lone' },
      { id: 'MIR', name: 'Mir' },
      { id: 'PIRACHA', name: 'Piracha / Paracha' },
      { id: 'WANI', name: 'Wani' },
      { id: 'RATHER', name: 'Rather' },
    ],
  },
  {
    id: 'ARTISAN_PROFESSIONAL',
    name: 'Artisan & Professional',
    castes: [
      { id: 'LOHAR_MISTRI', name: 'Lohar / Mistri' },
      { id: 'TARKHAN', name: 'Tarkhan' },
      { id: 'KUMHAR', name: 'Kumhar' },
      { id: 'MOCHI', name: 'Mochi' },
      { id: 'NAI', name: 'Nai' },
      { id: 'ANSARI', name: 'Ansari (Momin)' },
      { id: 'QASSAB', name: 'Qassab' },
      { id: 'DHOBI', name: 'Dhobi' },
    ],
  },
  {
    id: 'SOUTH_ASIAN_REGIONAL',
    name: 'South Asian Regional',
    castes: [
      { id: 'BENGALI', name: 'Bengali' },
      { id: 'GUJARATI', name: 'Gujarati' },
      { id: 'MARATHI', name: 'Marathi' },
      { id: 'TAMIL', name: 'Tamil' },
      { id: 'TELUGU', name: 'Telugu' },
      { id: 'MALAYALI', name: 'Malayali' },
      { id: 'SARAIKI', name: 'Saraiki' },
      { id: 'KAYASTHA', name: 'Kayestha' },
      { id: 'BRAHMIN', name: 'Brahmin' },
      { id: 'KHATRI', name: 'Khatri' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
] as const satisfies readonly TCasteCategoryNode[];

const mapOptions = <T extends readonly { id: string; name: string }[]>(
  values: T
) =>
  values.reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.name;
    return acc;
  }, {});

const flattenCasteNodes = () =>
  (CASTE_TREE as readonly TCasteCategoryNode[]).flatMap(
    (category) => category.castes
  );

const flattenClanNodes = () =>
  flattenCasteNodes().flatMap((caste) => caste.clans ?? []);
export const CASTE_CATEGORIES = mapOptions(CASTE_TREE);
export const CASTE_TREE_CASTES = mapOptions(flattenCasteNodes());
export const CASTE_CLANS = mapOptions(flattenClanNodes());

export type CasteCategoryKey = keyof typeof CASTE_CATEGORIES;
export type CasteTreeCasteKey = keyof typeof CASTE_TREE_CASTES;
export type ClanKey = keyof typeof CASTE_CLANS;
