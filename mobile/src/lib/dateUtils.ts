export function parseApiDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    // Check if it's a naive datetime (contains 'T' or a space, and doesn't end with Z or timezone offset)
    const hasDateTimeSeparator = value.includes('T') || (value.includes(' ') && value.indexOf('-') < value.indexOf(' '));
    if (
      hasDateTimeSeparator &&
      !value.endsWith('Z') &&
      !/\+\d{2}:?\d{2}$/.test(value) &&
      !/-\d{2}:?\d{2}$/.test(value)
    ) {
      const normalized = value.replace(' ', 'T');
      return new Date(`${normalized}Z`);
    }
  }
  return new Date(value);
}
