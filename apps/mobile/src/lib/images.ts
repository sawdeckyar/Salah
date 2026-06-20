import type { CommunityCategory, Place } from '@salah/core';

/**
 * Image URLs for the Explore feed. Uses a place's real OSM photo when present;
 * otherwise a cuisine/category-matched stock photo from LoremFlickr — a free,
 * key-less Creative-Commons image service. `lock` makes each card's image stable.
 *
 * (Real Google Maps photos would require the paid Google Places Photos API.)
 */
function seed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100000;
}

function sanitizeKeywords(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z, ]/g, '')
    .trim()
    .replace(/\s+/g, ',')
    .split(',')
    .filter(Boolean)
    .slice(0, 2)
    .join(',');
}

const KIND_KEYWORDS: Record<string, string> = {
  restaurant: 'restaurant,food',
  cafe: 'coffee,cafe',
  fast_food: 'food',
  shop: 'grocery,store',
  other: 'food',
};

function flickr(keywords: string, lock: number): string {
  return `https://loremflickr.com/600/360/${keywords}?lock=${lock}`;
}

/** A photo for a halal place — its own, or a cuisine-matched stock image. */
export function placeImage(p: Place): string {
  if (p.imageUrl) return p.imageUrl;
  const kw = p.cuisine
    ? `${sanitizeKeywords(p.cuisine)},food`
    : KIND_KEYWORDS[p.kind] ?? 'food';
  return flickr(sanitizeKeywords(kw) || 'food', seed(p.id));
}

const CATEGORY_KEYWORDS: Record<CommunityCategory, string> = {
  fun: 'park,family',
  event: 'event,celebration',
  gathering: 'community,people',
  meetup: 'meetup,group',
};

/** A banner image for a community post category. */
export function categoryImage(category: CommunityCategory, id: string): string {
  return flickr(CATEGORY_KEYWORDS[category], seed(id));
}
