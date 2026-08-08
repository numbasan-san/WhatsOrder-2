function hashSeed(seed: string | number) {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function seededFloat(seed: string | number): number {
  return hashSeed(seed)();
}

export function seededInt(seed: string | number, min: number, max: number): number {
  return Math.floor(seededFloat(seed) * (max - min + 1)) + min;
}

export function seededPick<T>(seed: string | number, items: T[]): T {
  return items[seededInt(seed, 0, items.length - 1)];
}