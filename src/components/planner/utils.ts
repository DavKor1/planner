export const MS_DAY = 86400000;

export const parseDate = (iso: string | null | undefined): Date => {
  if (!iso) return new Date();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtIso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const startOfWeek = (d: Date): Date => {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
};

export const sameDay = (a: Date, b: Date): boolean => fmtIso(a) === fmtIso(b);

export const daysBetween = (a: Date, b: Date): number =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_DAY);

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
export const MONTH_NAMES_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];
export const DAY_NAMES_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export const HOUR_START = 7;
export const HOUR_END = 21;
export const HOUR_PX = 36;
export const TIME_COL = 56;

export const fmtHour = (h: number): string => {
  const hr = ((Math.floor(h) - 1) % 12) + 1;
  const ampm = h < 12 ? "a" : "p";
  const min = h % 1 ? ":30" : "";
  return `${hr}${min}${ampm}`;
};
