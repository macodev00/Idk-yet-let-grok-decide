import { isValidTimeZone } from "./time.js";

export const CITIES = [
  ["Accra", "Ghana", "Africa/Accra"],
  ["Adelaide", "Australia", "Australia/Adelaide"],
  ["Amsterdam", "Netherlands", "Europe/Amsterdam"],
  ["Anchorage", "United States", "America/Anchorage"],
  ["Athens", "Greece", "Europe/Athens"],
  ["Auckland", "New Zealand", "Pacific/Auckland"],
  ["Bangkok", "Thailand", "Asia/Bangkok"],
  ["Berlin", "Germany", "Europe/Berlin"],
  ["Bogotá", "Colombia", "America/Bogota"],
  ["Brisbane", "Australia", "Australia/Brisbane"],
  ["Brussels", "Belgium", "Europe/Brussels"],
  ["Bucharest", "Romania", "Europe/Bucharest"],
  ["Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires"],
  ["Cairo", "Egypt", "Africa/Cairo"],
  ["Casablanca", "Morocco", "Africa/Casablanca"],
  ["Chicago", "United States", "America/Chicago"],
  ["Colombo", "Sri Lanka", "Asia/Colombo"],
  ["Copenhagen", "Denmark", "Europe/Copenhagen"],
  ["Denver", "United States", "America/Denver"],
  ["Dhaka", "Bangladesh", "Asia/Dhaka"],
  ["Dubai", "United Arab Emirates", "Asia/Dubai"],
  ["Dublin", "Ireland", "Europe/Dublin"],
  ["Fiji", "Fiji", "Pacific/Fiji"],
  ["Halifax", "Canada", "America/Halifax"],
  ["Helsinki", "Finland", "Europe/Helsinki"],
  ["Ho Chi Minh City", "Vietnam", "Asia/Ho_Chi_Minh"],
  ["Hong Kong", "China", "Asia/Hong_Kong"],
  ["Honolulu", "United States", "Pacific/Honolulu"],
  ["Istanbul", "Türkiye", "Europe/Istanbul"],
  ["Jakarta", "Indonesia", "Asia/Jakarta"],
  ["Johannesburg", "South Africa", "Africa/Johannesburg"],
  ["Karachi", "Pakistan", "Asia/Karachi"],
  ["Kuala Lumpur", "Malaysia", "Asia/Kuala_Lumpur"],
  ["Kyiv", "Ukraine", "Europe/Kyiv"],
  ["Lagos", "Nigeria", "Africa/Lagos"],
  ["Lima", "Peru", "America/Lima"],
  ["Lisbon", "Portugal", "Europe/Lisbon"],
  ["London", "United Kingdom", "Europe/London"],
  ["Los Angeles", "United States", "America/Los_Angeles"],
  ["Madrid", "Spain", "Europe/Madrid"],
  ["Manila", "Philippines", "Asia/Manila"],
  ["Melbourne", "Australia", "Australia/Melbourne"],
  ["Mexico City", "Mexico", "America/Mexico_City"],
  ["Moscow", "Russia", "Europe/Moscow"],
  ["Mumbai", "India", "Asia/Kolkata"],
  ["Nairobi", "Kenya", "Africa/Nairobi"],
  ["New York", "United States", "America/New_York"],
  ["Oslo", "Norway", "Europe/Oslo"],
  ["Paris", "France", "Europe/Paris"],
  ["Perth", "Australia", "Australia/Perth"],
  ["Phoenix", "United States", "America/Phoenix"],
  ["Prague", "Czechia", "Europe/Prague"],
  ["Reykjavik", "Iceland", "Atlantic/Reykjavik"],
  ["Riyadh", "Saudi Arabia", "Asia/Riyadh"],
  ["Rome", "Italy", "Europe/Rome"],
  ["Santiago", "Chile", "America/Santiago"],
  ["São Paulo", "Brazil", "America/Sao_Paulo"],
  ["Seoul", "South Korea", "Asia/Seoul"],
  ["Shanghai", "China", "Asia/Shanghai"],
  ["Singapore", "Singapore", "Asia/Singapore"],
  ["St. John's", "Canada", "America/St_Johns"],
  ["Stockholm", "Sweden", "Europe/Stockholm"],
  ["Sydney", "Australia", "Australia/Sydney"],
  ["Taipei", "Taiwan", "Asia/Taipei"],
  ["Tehran", "Iran", "Asia/Tehran"],
  ["Tokyo", "Japan", "Asia/Tokyo"],
  ["Toronto", "Canada", "America/Toronto"],
  ["Vancouver", "Canada", "America/Vancouver"],
  ["Vienna", "Austria", "Europe/Vienna"],
  ["Warsaw", "Poland", "Europe/Warsaw"],
  ["Zurich", "Switzerland", "Europe/Zurich"],
  ["UTC", "Coordinated Universal Time", "UTC"],
];

function fold(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function resolvePlace(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (isValidTimeZone(raw)) {
    const known = CITIES.find((city) => city[2] === raw);
    return { place: known ? known[0] : raw, timeZone: raw };
  }
  const query = fold(raw);
  const exact = CITIES.filter((city) => {
    const label = fold(city[0]);
    const withCountry = fold(`${city[0]}, ${city[1]}`);
    return query === label || query === withCountry;
  });
  if (exact.length === 1) return { place: exact[0][0], timeZone: exact[0][2] };
  const prefix = CITIES.filter((city) => fold(city[0]).startsWith(query));
  if (prefix.length === 1) return { place: prefix[0][0], timeZone: prefix[0][2] };
  return null;
}
