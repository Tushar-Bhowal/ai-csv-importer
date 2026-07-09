import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'

import { isBlank } from './extract.js'

export interface PhoneParts {
  countryCode: string // '+91'
  mobile: string // bare national digits
}

// Excel silently turns a long numeric column into a float: 9.87654321e+09.
function undoExcelNumeric(raw: string): string {
  const text = raw.trim()
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(text)) return BigInt(Math.round(Number(text))).toString()
  if (/^\d+\.0+$/.test(text)) return text.split('.')[0] as string
  return text
}

const countryForCallingCode = (digits: string): CountryCode | undefined =>
  getCountries().find((c) => getCountryCallingCode(c) === digits)

// Never the model's job: a 240-country dataset is deterministic, free, and
// cannot invent a digit.
export function normalizePhone(raw: string, defaultCountryCode = '+91'): PhoneParts | null {
  if (isBlank(raw)) return null

  let text = undoExcelNumeric(raw)
  if (text.startsWith('00')) text = `+${text.slice(2)}`

  const defaultDigits = defaultCountryCode.replace(/\D/g, '')
  const defaultCountry = countryForCallingCode(defaultDigits)

  const parsed = parsePhoneNumberFromString(
    text,
    defaultCountry ? { defaultCountry } : undefined,
  )
  if (parsed?.isValid()) {
    return { countryCode: `+${parsed.countryCallingCode}`, mobile: parsed.nationalNumber }
  }

  // libphonenumber rejects well-formed but unallocated numbers. A CRM still
  // wants the lead, so fall back to a digit split rather than dropping it.
  const digits = text.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null

  if (digits.length > 10 && digits.startsWith(defaultDigits)) {
    return { countryCode: `+${defaultDigits}`, mobile: digits.slice(defaultDigits.length) }
  }
  return { countryCode: defaultCountryCode, mobile: digits.replace(/^0+/, '') }
}
