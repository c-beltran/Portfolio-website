/** Every live fact ID. No JSON imports, so e2e tests can import it. F05 is retired. */
export const FACT_IDS = [
  'F01',
  'F02',
  'F03',
  'F04',
  'F06',
  'F07',
  'F08',
  'F09',
  'F10',
  'F11',
  'F12',
  'P01',
  'P02',
  'P03',
  'P04',
  'P05',
  'P06',
  'ABOUT',
  // cars, the dealership, soccer, travel
  'H01',
  'H02',
  'H03',
  'H04',
  // home
  'H05',
  // the mug
  'H06',
  // the diploma
  'E01',
] as const;

export type FactId = (typeof FACT_IDS)[number];
