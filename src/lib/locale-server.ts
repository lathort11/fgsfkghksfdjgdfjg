import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

/** Reads the visitor's language from the cookie set by the language switcher. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "ru";
}
