import type { TCasteClanNode } from './caste.constant';

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
  ISLAM: { SUNNI: 'Sunni', SHIA: 'Shia', AHMADI: 'Ahmadi', ISMAILI: 'Ismaili', IBADI: 'Ibadi', OTHER: 'Other' },
  CHRISTIANITY: { CATHOLIC: 'Catholic', PROTESTANT: 'Protestant', ORTHODOX: 'Orthodox', OTHER: 'Other' },
  HINDUISM: { VAISHNAVISM: 'Vaishnavism', SHAIVISM: 'Shaivism', SHAKTISM: 'Shaktism', SMARTISM: 'Smartism', OTHER: 'Other' },
  BUDDHISM: { THERAVADA: 'Theravada', MAHAYANA: 'Mahayana', VAJRAYANA: 'Vajrayana', OTHER: 'Other' },
  SIKHISM: { JAT: 'Jat', KHATRI: 'Khatri', ARORA: 'Arora', OTHER: 'Other' },
  JUDAISM: { ORTHODOX: 'Orthodox', CONSERVATIVE: 'Conservative', REFORM: 'Reform', OTHER: 'Other' },
  OTHER: { OTHER: 'Other' },
};
export type SectKey = keyof (typeof SECTS)[keyof typeof SECTS];

// 3. SECT DETAILS
export const SECT_DETAILS = {
  ISLAM: {
    SUNNI: {
      HANAFI: 'Hanafi',
      SHAFII: "Shafii",
      MALIKI: 'Maliki',
      HANBALI: 'Hanbali',
      DEOBANDI: 'Deobandi',
      BARELVI: 'Barelvi (Ahl-e-Sunnat)',
      AHL_E_HADITH: 'Ahl-e-Hadith (Salafi)',
      ASHARI: "Ash'ari",
      MATURIDI: 'Maturidi',
      ATHARI: 'Athari',
      OTHER: 'Other',
    },
    SHIA: {
      TWELVER: "Twelver (Ithna Ashari / Ja'fari)",
      ISMAILI: 'Ismaili',
      ISMAILI_NIZARI: 'Ismaili Nizari (Aga Khani)',
      ISMAILI_MUSTALI: 'Ismaili Mustali (Dawoodi/Sulaymani Bohra)',
      ZAYDI: 'Zaydi',
      OTHER: 'Other',
    },
    AHMADI: {
      OTHER: 'Other',
    },
    ISMAILI: {
      NIZARI: 'Nizari',
      MUSTALI: 'Mustali',
      BOHRA: 'Bohra',
      OTHER: 'Other',
    },
    IBADI: {
      IBADI: 'Ibadi',
      OTHER: 'Other',
    },
    OTHER: {
      OTHER: 'Other',
    },
  },
  CHRISTIANITY: {
    CATHOLIC: { OTHER: 'Other' },
    PROTESTANT: { OTHER: 'Other' },
    ORTHODOX: { OTHER: 'Other' },
    OTHER: { OTHER: 'Other' },
  },
  HINDUISM: {
    VAISHNAVISM: { OTHER: 'Other' },
    SHAIVISM: { OTHER: 'Other' },
    SHAKTISM: { OTHER: 'Other' },
    SMARTISM: { OTHER: 'Other' },
    OTHER: { OTHER: 'Other' },
  },
  BUDDHISM: {
    THERAVADA: { OTHER: 'Other' },
    MAHAYANA: { OTHER: 'Other' },
    VAJRAYANA: { OTHER: 'Other' },
    OTHER: { OTHER: 'Other' },
  },
  SIKHISM: {
    JAT: { OTHER: 'Other' },
    KHATRI: { OTHER: 'Other' },
    ARORA: { OTHER: 'Other' },
    OTHER: { OTHER: 'Other' },
  },
  JUDAISM: {
    ORTHODOX: { OTHER: 'Other' },
    CONSERVATIVE: { OTHER: 'Other' },
    REFORM: { OTHER: 'Other' },
    OTHER: { OTHER: 'Other' },
  },
  OTHER: {
    OTHER: { OTHER: 'Other' },
  },
} as const;

export const SECT_DETAIL_VALUES = {
  HANAFI: 'Hanafi',
  SHAFII: "Shafii",
  MALIKI: 'Maliki',
  HANBALI: 'Hanbali',
  DEOBANDI: 'Deobandi',
  BARELVI: 'Barelvi (Ahl-e-Sunnat)',
  AHL_E_HADITH: 'Ahl-e-Hadith (Salafi)',
  ASHARI: "Ash'ari",
  MATURIDI: 'Maturidi',
  ATHARI: 'Athari',
  TWELVER: "Twelver (Ithna Ashari / Ja'fari)",
  ISMAILI: 'Ismaili',
  ISMAILI_NIZARI: 'Ismaili Nizari (Aga Khani)',
  ISMAILI_MUSTALI: 'Ismaili Mustali (Dawoodi/Sulaymani Bohra)',
  ZAYDI: 'Zaydi',
  NIZARI: 'Nizari',
  MUSTALI: 'Mustali',
  BOHRA: 'Bohra',
  IBADI: 'Ibadi',
  OTHER: 'Other',
} as const;
export type SectDetailKey = keyof typeof SECT_DETAIL_VALUES;

// Religious tree option types for cascading UI data.
export interface TReligionDetailGroupNode {
  id: string;
  name: string;
  options: readonly TCasteClanNode[];
}

export interface TReligionSectNode {
  id: string;
  name: string;
  detailGroups?: readonly TReligionDetailGroupNode[];
}

export interface TReligionTreeNode {
  id: string;
  name: string;
  sects: readonly TReligionSectNode[];
}
export const RELIGION_TREE = [
  {
    id: 'ISLAM',
    name: 'Islam',
    sects: [
      {
        id: 'SUNNI',
        name: 'Sunni',
        detailGroups: [
          {
            id: 'madhhab',
            name: 'Madhhab',
            options: [
              { id: 'HANAFI', name: 'Hanafi' },
              { id: 'SHAFII', name: "Shafi'i" },
              { id: 'MALIKI', name: 'Maliki' },
              { id: 'HANBALI', name: 'Hanbali' },
            ],
          },
          {
            id: 'movement',
            name: 'Movement',
            options: [
              { id: 'DEOBANDI', name: 'Deobandi' },
              { id: 'BARELVI', name: 'Barelvi (Ahl-e-Sunnat)' },
              { id: 'AHL_E_HADITH', name: 'Ahl-e-Hadith (Salafi)' },
            ],
          },
          {
            id: 'orientation',
            name: 'Theological Orientation',
            options: [
              { id: 'ASHARI', name: "Ash'ari" },
              { id: 'MATURIDI', name: 'Maturidi' },
              { id: 'ATHARI', name: 'Athari' },
            ],
          },
        ],
      },
      {
        id: 'SHIA',
        name: 'Shia',
        detailGroups: [
          {
            id: 'branch',
            name: 'Branch',
            options: [
              { id: 'TWELVER', name: "Twelver (Ithna Ashari / Ja'fari)" },
              { id: 'ISMAILI', name: 'Ismaili' },
              { id: 'ZAYDI', name: 'Zaydi' },
            ],
          },
        ],
      },
      { id: 'ISMAILI', name: 'Ismaili' },
      { id: 'IBADI', name: 'Ibadi' },
      { id: 'AHMADI', name: 'Ahmadi' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
  {
    id: 'CHRISTIANITY',
    name: 'Christianity',
    sects: [
      { id: 'CATHOLIC', name: 'Catholic' },
      { id: 'PROTESTANT', name: 'Protestant' },
      { id: 'ORTHODOX', name: 'Orthodox' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
  {
    id: 'HINDUISM',
    name: 'Hinduism',
    sects: [
      { id: 'VAISHNAVISM', name: 'Vaishnavism' },
      { id: 'SHAIVISM', name: 'Shaivism' },
      { id: 'SHAKTISM', name: 'Shaktism' },
      { id: 'SMARTISM', name: 'Smartism' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
  {
    id: 'BUDDHISM',
    name: 'Buddhism',
    sects: [
      { id: 'THERAVADA', name: 'Theravada' },
      { id: 'MAHAYANA', name: 'Mahayana' },
      { id: 'VAJRAYANA', name: 'Vajrayana' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
  {
    id: 'SIKHISM',
    name: 'Sikhism',
    sects: [
      { id: 'JAT', name: 'Jat' },
      { id: 'KHATRI', name: 'Khatri' },
      { id: 'ARORA', name: 'Arora' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
  {
    id: 'JUDAISM',
    name: 'Judaism',
    sects: [
      { id: 'ORTHODOX', name: 'Orthodox' },
      { id: 'CONSERVATIVE', name: 'Conservative' },
      { id: 'REFORM', name: 'Reform' },
      { id: 'OTHER', name: 'Other' },
    ],
  },
  { id: 'OTHER', name: 'Other', sects: [{ id: 'OTHER', name: 'Other' }] },
] as const satisfies readonly TReligionTreeNode[];
const mapOptions = <T extends readonly { id: string; name: string }[]>(
  values: T
) =>
  values.reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.name;
    return acc;
  }, {});
const flattenReligionSects = () =>
  (RELIGION_TREE as readonly TReligionTreeNode[]).flatMap(
    (religion) => religion.sects
  );

const flattenReligionDetailOptions = (groupId: string) =>
  flattenReligionSects().flatMap((sect) =>
    (sect.detailGroups ?? [])
      .filter((group) => group.id === groupId)
      .flatMap((group) => group.options)
  );

export const RELIGION_TREE_RELIGIONS = mapOptions(RELIGION_TREE);
export const RELIGION_TREE_SECTS = mapOptions(flattenReligionSects());
export const RELIGION_TREE_MADHHABS = mapOptions(
  flattenReligionDetailOptions('madhhab')
);
export const RELIGION_TREE_MOVEMENTS = mapOptions(
  flattenReligionDetailOptions('movement')
);

export type MovementKey = keyof typeof RELIGION_TREE_MOVEMENTS;
// 7. MADHHABS
export const MADHHABS = {
  HANAFI: 'Hanafi',
  SHAFII: "Shafi'i",
  MALIKI: 'Maliki',
  HANBALI: 'Hanbali',
  OTHER: 'Other',
} as const;
export type MadhhabKey = keyof typeof MADHHABS;

// 8. THEOLOGICAL ORIENTATIONS
export const THEOLOGICAL_ORIENTATIONS = {
  DEOBANDI: 'Deobandi',
  BARELVI: 'Barelvi (Ahl-e-Sunnat)',
  AHL_E_HADITH: 'Ahl-e-Hadith (Salafi)',
  ASHARI: "Ash'ari",
  MATURIDI: 'Maturidi',
  ATHARI: 'Athari',
  OTHER: 'Other',
} as const;
export type TheologicalOrientationKey = keyof typeof THEOLOGICAL_ORIENTATIONS;

// 9. SUFI ORDERS
export const SUFI_ORDERS = {
  NAQSHBANDI: 'Naqshbandi',
  CHISTI: 'Chisti',
  QADRI: 'Qadri',
  SUHRAWARDI: 'Suhrawardi',
  SHADHILI: 'Shadhili',
  MEVLEVI: 'Mevlevi',
  OTHER: 'Other',
} as const;
export type SufiOrderKey = keyof typeof SUFI_ORDERS;
