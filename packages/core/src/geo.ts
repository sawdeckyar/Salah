/**
 * Geospatial helpers: distances and bounding boxes. Pure math, no I/O.
 */
import type { Coordinates } from './types.js';

export const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Great-circle (haversine) distance between two points, in metres.
 */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Bounding box that fully contains a circle of `radiusMeters` around `center`.
 * Longitude span widens with latitude (poles converge). Latitude is clamped to
 * [-90, 90] and longitude is left unnormalised so callers can detect/wrap the
 * antimeridian if they need to.
 */
export function boundingBox(
  center: Coordinates,
  radiusMeters: number,
): BoundingBox {
  const latDelta = toDeg(radiusMeters / EARTH_RADIUS_M);
  const cosLat = Math.cos(toRad(center.latitude));
  const lonDelta =
    cosLat <= 1e-9 ? 180 : toDeg(radiusMeters / (EARTH_RADIUS_M * cosLat));

  return {
    south: Math.max(-90, center.latitude - latDelta),
    north: Math.min(90, center.latitude + latDelta),
    west: center.longitude - lonDelta,
    east: center.longitude + lonDelta,
  };
}

/**
 * Sort a list of items by ascending distance from `origin`, annotating each
 * with `distanceMeters`. Returns a new array; inputs are not mutated.
 */
export function sortByDistance<T extends { location: Coordinates }>(
  origin: Coordinates,
  items: T[],
): (T & { distanceMeters: number })[] {
  return items
    .map((item) => ({
      ...item,
      distanceMeters: haversineMeters(origin, item.location),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Average of a list of points (simple centroid). Throws if empty. */
export function centroid(points: Coordinates[]): Coordinates {
  if (points.length === 0) throw new Error('centroid requires at least one point');
  let lat = 0;
  let lon = 0;
  for (const p of points) {
    lat += p.latitude;
    lon += p.longitude;
  }
  return { latitude: lat / points.length, longitude: lon / points.length };
}
