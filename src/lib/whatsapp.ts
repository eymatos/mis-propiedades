/** Convierte un teléfono dominicano a formato internacional para wa.me. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) return `1${digits}`;
  if (digits.length >= 8) return digits;
  return null;
}

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
