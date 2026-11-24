/** The weather the window shows. */
export type Condition = 'clear' | 'partly' | 'overcast' | 'fog' | 'rain' | 'snow' | 'storm';

/** A rough place: the visitor's time zone's main city. */
export type Place = { lat: number; lon: number };

export type Sky = {
  condition: Condition;
  /** 0–1: drizzle light … downpour heavy; for skies, how much cloud. */
  intensity: number;
  windMs: number;
  /** Where the wind comes from, degrees clockwise from north. */
  windDeg: number;
  /** 1 by day, 0 at night, between in twilight. */
  dayness: number;
  source: 'live' | 'fallback' | 'override';
};
