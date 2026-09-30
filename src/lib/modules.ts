// Mirrors squadino's src/lib/settings.ts (the module lists only) — the plan decides which modules a new club starts with.
// Keep in step with that file by hand, like the schema mirror.
export interface EnabledModules {
  chat: boolean;
  events: boolean;
  news: boolean;
  staffing: boolean;
  training: boolean;
  merch: boolean;
  documents: boolean;
  sponsors: boolean;
  // Bookable sessions, class packs and session payments.
  bookings: boolean;
  // Workout programmes clients follow and log.
  programmes: boolean;
  [key: string]: boolean;
}

export const MODULE_DEFAULTS: EnabledModules = {
  chat: true, events: true, news: true, staffing: true, training: true, merch: true, documents: true, sponsors: true,
  bookings: true, programmes: true,
};

// What each plan includes — the most a club's admin can switch on. Bookings
// and programmes are on the Coach plan only.
export const VERSION_MODULES: Record<string, EnabledModules> = {
  FREE: {
    chat: false, events: true, news: true, staffing: false, training: true,
    merch: false, documents: false, sponsors: false, bookings: false, programmes: false,
  },
  BASIC: {
    chat: true, events: true, news: true, staffing: true, training: true,
    merch: false, documents: true, sponsors: true, bookings: false, programmes: false,
  },
  PRO: {
    chat: true, events: true, news: true, staffing: true, training: true,
    merch: true, documents: true, sponsors: true, bookings: false, programmes: false,
  },
  // A single coach or trainer: no staff roster, merch store or sponsors.
  COACH: {
    chat: true, events: true, news: true, staffing: false, training: true,
    merch: false, documents: true, sponsors: false, bookings: true, programmes: true,
  },
};
