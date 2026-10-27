const fmt = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** RD$12,500.00 */
export function formatDOP(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  const safe = Number.isFinite(n) ? n : 0;
  const sign = safe < 0 ? "-" : "";
  return `${sign}RD$${fmt.format(Math.abs(safe))}`;
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Valor para columnas numeric (se guardan como texto). */
export function toMoneyString(n: number): string {
  return round2(n).toFixed(2);
}

const UNIDADES = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = CENTENAS[c];
  if (r > 0) {
    const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
    s = s ? `${s} ${resto}` : resto;
  }
  return s;
}

function apocopar(s: string): string {
  return s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");
}

export function numeroEnLetras(n: number): string {
  n = Math.floor(n);
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "un millón" : `${apocopar(numeroEnLetras(millones))} millones`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? "mil" : `${apocopar(menorQueMil(miles))} mil`);
  }
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(" ");
}

/** "DIEZ MIL QUINIENTOS PESOS DOMINICANOS CON 00/100" */
export function montoEnLetras(value: number): string {
  const pesos = Math.floor(round2(value));
  const centavos = Math.round((round2(value) - pesos) * 100);
  let palabras = apocopar(numeroEnLetras(pesos));
  if (pesos >= 1_000_000 && pesos % 1_000_000 === 0) palabras += " de";
  const moneda = pesos === 1 ? "peso dominicano" : "pesos dominicanos";
  return `${palabras} ${moneda} con ${String(centavos).padStart(2, "0")}/100`.toUpperCase();
}
