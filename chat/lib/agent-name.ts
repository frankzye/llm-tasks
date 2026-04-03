const ADJECTIVES = [
  "Bright",
  "Calm",
  "Clever",
  "Swift",
  "Noble",
  "Quiet",
  "Brisk",
  "Happy",
  "Sharp",
  "Solar",
  "Lunar",
  "Rapid",
];

const NOUNS = [
  "Falcon",
  "Harbor",
  "Maple",
  "River",
  "Beacon",
  "Summit",
  "Willow",
  "Canyon",
  "Forest",
  "Orbit",
  "Comet",
  "Meadow",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function generateAgentName(maxLen = 20): string {
  for (let i = 0; i < 40; i += 1) {
    const name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
    if (name.length <= maxLen) return name;
  }
  return "Bright Falcon";
}

