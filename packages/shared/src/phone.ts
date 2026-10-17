import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

/** Normalises user input to E.164 ("+996706304803"); null when the number is not valid. */
export function normalizePhone(input: string, defaultCountry: CountryCode = 'KG'): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

/** "+996 706 30 48 03" for Kyrgyz numbers (as in the design), international format otherwise. */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (/^996\d{9}$/.test(digits)) {
    return `+${digits.replace(/^(\d{3})(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5')}`;
  }
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
