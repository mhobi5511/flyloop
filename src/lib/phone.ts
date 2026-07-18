import { countryCallingCodes } from "@/lib/country-calling-codes";

export type MobileCountryCodeOption = {
  country: string;
  iso2: string;
  dialCode: string;
};

const countryNameFormatter = new Intl.DisplayNames(["en"], { type: "region" });

export const mobileCountryCodeOptions: MobileCountryCodeOption[] = countryCallingCodes
  .map(([countryCode, dialCode]) => ({
    country: countryNameFormatter.of(countryCode) ?? countryCode,
    iso2: countryCode,
    dialCode,
  }))
  .sort((a, b) => a.country.localeCompare(b.country));

export const fallbackMobileCountryCode = "+49";

export function getMobileCountryCodeFromLocale(locale?: string) {
  const region = locale?.split("-").pop()?.toUpperCase();
  const match = mobileCountryCodeOptions.find((option) => option.iso2 === region);

  return match?.dialCode ?? fallbackMobileCountryCode;
}

export function normalizeLocalPhoneNumber(value: string) {
  return value.replace(/[\s\-()]/g, "");
}

export function normalizePhoneToE164(dialCode: string, localNumber: string) {
  const cleanDialCode = dialCode.trim();
  const cleanLocalNumber = normalizeLocalPhoneNumber(localNumber);

  if (!mobileCountryCodeOptions.some((option) => option.dialCode === cleanDialCode)) {
    return null;
  }

  if (!/^\d+$/.test(cleanLocalNumber)) {
    return null;
  }

  const nationalNumber = cleanLocalNumber.replace(/^0+/, "");

  if (nationalNumber.length < 4 || nationalNumber.length > 14) {
    return null;
  }

  const e164 = `${cleanDialCode}${nationalNumber}`;

  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

export function splitE164PhoneNumber(value?: string | null, dialCode?: string | null) {
  if (!value || !dialCode || !value.startsWith(dialCode)) {
    return value ?? "";
  }

  return value.slice(dialCode.length);
}

export function formatMobileCountryCodeLabel(option: MobileCountryCodeOption) {
  return `${option.country} (${option.dialCode})`;
}

export function phoneToWhatsAppPath(phone: string) {
  return phone.replace(/^\+/, "").replace(/\D/g, "");
}
