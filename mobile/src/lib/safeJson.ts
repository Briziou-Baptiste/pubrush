/**
 * Safe JSON parsing and object sanitization utilities.
 * Protects against Prototype Pollution attacks (CVE-2026-97724) by stripping
 * __proto__, constructor, and prototype keys from external payloads.
 */

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }

  const cleanObj: Record<string, any> = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    cleanObj[key] = sanitizeObject(value);
  }

  return cleanObj as T;
}

export function safeJsonParse<T = any>(jsonString: string, fallback?: T): T {
  try {
    const parsed = JSON.parse(jsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
    return sanitizeObject(parsed);
  } catch {
    return fallback as T;
  }
}
