// Generates a strong but readable password suggestion, e.g. "Brave-Otter-4827!".
// Two capitalised words + a 4-digit number + a symbol guarantees upper, lower,
// digit and symbol classes and a length well over the 8-char minimum, while
// staying easy to read back and type.

const WORDS = [
  "Swift", "Brave", "Mighty", "Speedy", "Golden", "Silver", "Cosmic", "Turbo",
  "Rapid", "Bold", "Lucky", "Sunny", "Epic", "Prime", "Zesty", "Nimble",
  "Marlin", "Shark", "Dolphin", "Falcon", "Tiger", "Comet", "Rocket", "Otter",
  "Panther", "Ripple", "Wave", "Bolt", "Ace", "Hawk", "Fox", "Ray",
];
const SYMBOLS = ["!", "@", "#", "$", "%", "*", "?"];

// Uniform random integer in [0, max), using the crypto RNG when available.
function rand(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pick<T>(arr: T[]): T {
  return arr[rand(arr.length)];
}

export function suggestPassword(): string {
  const num = 1000 + rand(9000); // 1000–9999, always 4 digits
  return `${pick(WORDS)}-${pick(WORDS)}-${num}${pick(SYMBOLS)}`;
}
