import axios from 'axios';
import env from '../config/env';
import { redisClient } from '../config/redis.config';

const NOMINATIM_REVERSE_URL =
  process.env.NOMINATIM_REVERSE_URL ||
  'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  `RishtaPro/1.0 (${env.ADMIN_MAIL})`;
const GEOCODE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
let lastNominatimRequestAt = 0;

interface INominatimReverseResponse {
  address?: {
    city?: string;
    country?: string;
    county?: string;
    municipality?: string;
    state?: string;
    state_district?: string;
    town?: string;
    village?: string;
  };
  display_name?: string;
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getGeocodeCacheKey = (latitude: number, longitude: number) =>
  `reverse_geocode:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;

const getCachedAddress = async (cacheKey: string) => {
  if (!redisClient.isOpen) {
    return null;
  }

  try {
    return await redisClient.get(cacheKey);
  } catch {
    return null;
  }
};

const setCachedAddress = async (cacheKey: string, address: string) => {
  if (!redisClient.isOpen) {
    return;
  }

  try {
    await redisClient.set(cacheKey, address, {
      EX: GEOCODE_CACHE_TTL_SECONDS,
    });
  } catch {
    // Geocoding cache is only an optimization; API response should still work.
  }
};

const waitForNominatimRateLimit = async () => {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1000) {
    await sleep(1000 - elapsed);
  }

  lastNominatimRequestAt = Date.now();
};

const formatNominatimAddress = (payload: INominatimReverseResponse) => {
  const address = payload.address;
  if (!address) {
    return payload.display_name || null;
  }

  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county;
  const state = address.state || address.state_district;
  const parts = [locality];

  if (
    state &&
    locality &&
    !state.toLowerCase().includes(locality.toLowerCase())
  ) {
    parts.push(state);
  }

  parts.push(address.country);

  const formatted = parts.filter(Boolean).join(', ');
  return formatted || payload.display_name || null;
};

// Reverse-geocoding must never break the nearby matches response.
export const reverseGeocodeCoordinates = async (
  latitude: number,
  longitude: number
) => {
  const cacheKey = getGeocodeCacheKey(latitude, longitude);
  const cachedAddress = await getCachedAddress(cacheKey);
  if (cachedAddress) {
    return cachedAddress;
  }

  try {
    await waitForNominatimRateLimit();

    const { data } = await axios.get<INominatimReverseResponse>(
      NOMINATIM_REVERSE_URL,
      {
        headers: {
          'User-Agent': NOMINATIM_USER_AGENT,
        },
        params: {
          addressdetails: 1,
          format: 'jsonv2',
          lat: latitude,
          lon: longitude,
          zoom: 10,
        },
        timeout: 2500,
      }
    );

    const formattedAddress = formatNominatimAddress(data);
    if (formattedAddress) {
      await setCachedAddress(cacheKey, formattedAddress);
    }

    return formattedAddress;
  } catch {
    return null;
  }
};
