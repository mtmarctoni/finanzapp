/**
 * Standardized finance categories for the app.
 * This ensures consistency between AI/OCR extraction and the database.
 */

export const STANDARD_CATEGORIES = [
  // Income
  "Salario",
  "Freelance",
  "Inversiones",
  "Regalos recibidos",
  "Otros ingresos",

  // Food & Dining
  "Restaurantes",
  "Supermercado",
  "Comida rápida",
  "Cafetería",
  "Bebidas",

  // Transportation
  "Transporte público",
  "Gasolina",
  "Taxi / Ride-sharing",
  "Coche (mantenimiento)",
  "Parking",

  // Housing
  "Alquiler / Hipoteca",
  "Servicios (luz, agua, gas)",
  "Internet / Teléfono",
  "Muebles / Decoración",
  "Reparaciones hogar",

  // Health
  "Salud",
  "Farmacia",
  "Dentista",
  "Gimnasio / Deporte",

  // Shopping
  "Ropa",
  "Zapatos",
  "Electrónica",
  "Regalos",
  "Mascotas",

  // Entertainment
  "Ocio",
  "Cine / Teatro",
  "Música / Streaming",
  "Libros",
  "Viajes",
  "Hoteles / Alojamiento",

  // Financial
  "Seguros",
  "Impuestos",
  "Comisiones bancarias",
  "Deudas / Préstamos",

  // Education
  "Educación",
  "Cursos / Formación",
  "Material escolar",

  // Personal
  "Belleza / Peluquería",
  "Suscripciones",
  "Limpieza",
  "Otros gastos",
] as const;

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

/**
 * Mapping from common variations (English, typos, OCR errors, AI hallucinations)
 * to standardized Spanish categories.
 * All keys must be quoted strings to handle special characters.
 */
export const CATEGORY_ALIASES: Record<string, StandardCategory> = {
  // Income
  "salary": "Salario",
  "wages": "Salario",
  "sueldo": "Salario",
  "nómina": "Salario",
  "nomina": "Salario",
  "freelance": "Freelance",
  "freelancing": "Freelance",
  "investments": "Inversiones",
  "dividendos": "Inversiones",
  "dividends": "Inversiones",
  "regalos recibidos": "Regalos recibidos",
  "otros ingresos": "Otros ingresos",

  // Food & Dining
  "restaurants": "Restaurantes",
  "restaurante": "Restaurantes",
  "dining": "Restaurantes",
  "food": "Restaurantes",
  "comida": "Restaurantes",
  "bar": "Restaurantes",
  "bares": "Restaurantes",
  "supermarket": "Supermercado",
  "supermarkets": "Supermercado",
  "supermercado": "Supermercado",
  "mercadona": "Supermercado",
  "eroski": "Supermercado",
  "lidl": "Supermercado",
  "aldi": "Supermercado",
  "carrefour": "Supermercado",
  "groceries": "Supermercado",
  "comida rápida": "Comida rápida",
  "comida rapida": "Comida rápida",
  "fast food": "Comida rápida",
  "burger": "Comida rápida",
  "pizza": "Comida rápida",
  "kebab": "Comida rápida",
  "cafeteria": "Cafetería",
  "cafe": "Cafetería",
  "café": "Cafetería",
  "coffee": "Cafetería",
  "drinks": "Bebidas",
  "bebidas": "Bebidas",
  "alcohol": "Bebidas",

  // Transportation
  "transporte público": "Transporte público",
  "transporte publico": "Transporte público",
  "bus": "Transporte público",
  "metro": "Transporte público",
  "tren": "Transporte público",
  "train": "Transporte público",
  "autobús": "Transporte público",
  "gasoline": "Gasolina",
  "petrol": "Gasolina",
  "gasolina": "Gasolina",
  "diesel": "Gasolina",
  "repostar": "Gasolina",
  "taxi / ride-sharing": "Taxi / Ride-sharing",
  "taxi": "Taxi / Ride-sharing",
  "uber": "Taxi / Ride-sharing",
  "bolt": "Taxi / Ride-sharing",
  "cabify": "Taxi / Ride-sharing",
  "coche (mantenimiento)": "Coche (mantenimiento)",
  "coche": "Coche (mantenimiento)",
  "car": "Coche (mantenimiento)",
  "taller": "Coche (mantenimiento)",
  "mecánico": "Coche (mantenimiento)",
  "parking": "Parking",
  "aparcamiento": "Parking",

  // Housing
  "alquiler / hipoteca": "Alquiler / Hipoteca",
  "alquiler": "Alquiler / Hipoteca",
  "hipoteca": "Alquiler / Hipoteca",
  "rent": "Alquiler / Hipoteca",
  "mortgage": "Alquiler / Hipoteca",
  "servicios (luz, agua, gas)": "Servicios (luz, agua, gas)",
  "servicios": "Servicios (luz, agua, gas)",
  "luz": "Servicios (luz, agua, gas)",
  "electricidad": "Servicios (luz, agua, gas)",
  "agua": "Servicios (luz, agua, gas)",
  "gas": "Servicios (luz, agua, gas)",
  "endesa": "Servicios (luz, agua, gas)",
  "internet / teléfono": "Internet / Teléfono",
  "internet / telefono": "Internet / Teléfono",
  "internet": "Internet / Teléfono",
  "teléfono": "Internet / Teléfono",
  "telefono": "Internet / Teléfono",
  "móvil": "Internet / Teléfono",
  "movil": "Internet / Teléfono",
  "fibra": "Internet / Teléfono",
  "wifi": "Internet / Teléfono",
  "muebles / decoración": "Muebles / Decoración",
  "muebles / decoracion": "Muebles / Decoración",
  "muebles": "Muebles / Decoración",
  "decoración": "Muebles / Decoración",
  "ikea": "Muebles / Decoración",
  "reparaciones hogar": "Reparaciones hogar",
  "fontanero": "Reparaciones hogar",
  "electricista": "Reparaciones hogar",

  // Health
  "health": "Salud",
  "salud": "Salud",
  "médico": "Salud",
  "medico": "Salud",
  "doctor": "Salud",
  "hospital": "Salud",
  "pharmacy": "Farmacia",
  "farmacia": "Farmacia",
  "dentist": "Dentista",
  "dentista": "Dentista",
  "gimnasio / deporte": "Gimnasio / Deporte",
  "gimnasio": "Gimnasio / Deporte",
  "deporte": "Gimnasio / Deporte",
  "gym": "Gimnasio / Deporte",
  "fitness": "Gimnasio / Deporte",
  "paddle": "Gimnasio / Deporte",
  "yoga": "Gimnasio / Deporte",

  // Shopping
  "clothes": "Ropa",
  "ropa": "Ropa",
  "clothing": "Ropa",
  "zara": "Ropa",
  "h&m": "Ropa",
  "shoes": "Zapatos",
  "zapatos": "Zapatos",
  "electronics": "Electrónica",
  "electrónica": "Electrónica",
  "electronica": "Electrónica",
  "amazon": "Electrónica",
  "mediaMarkt": "Electrónica",
  "gifts": "Regalos",
  "regalos": "Regalos",
  "present": "Regalos",
  "pets": "Mascotas",
  "mascotas": "Mascotas",
  "perro": "Mascotas",
  "gato": "Mascotas",
  "veterinario": "Mascotas",
  "pienso": "Mascotas",

  // Entertainment
  "entertainment": "Ocio",
  "ocio": "Ocio",
  "leisure": "Ocio",
  "fun": "Ocio",
  "cine / teatro": "Cine / Teatro",
  "cine": "Cine / Teatro",
  "teatro": "Cine / Teatro",
  "cinema": "Cine / Teatro",
  "música / streaming": "Música / Streaming",
  "musica / streaming": "Música / Streaming",
  "música": "Música / Streaming",
  "musica": "Música / Streaming",
  "spotify": "Música / Streaming",
  "netflix": "Música / Streaming",
  "streaming": "Música / Streaming",
  "books": "Libros",
  "libros": "Libros",
  "kindle": "Libros",
  "travel": "Viajes",
  "viajes": "Viajes",
  "vuelo": "Viajes",
  "flight": "Viajes",
  "hoteles / alojamiento": "Hoteles / Alojamiento",
  "hotel": "Hoteles / Alojamiento",
  "airbnb": "Hoteles / Alojamiento",
  "booking": "Hoteles / Alojamiento",

  // Financial
  "insurance": "Seguros",
  "seguros": "Seguros",
  "taxes": "Impuestos",
  "impuestos": "Impuestos",
  "hacienda": "Impuestos",
  "comisiones bancarias": "Comisiones bancarias",
  "comisiones": "Comisiones bancarias",
  "comisión": "Comisiones bancarias",
  "bank": "Comisiones bancarias",
  "deudas / préstamos": "Deudas / Préstamos",
  "deudas / prestamos": "Deudas / Préstamos",
  "deudas": "Deudas / Préstamos",
  "préstamo": "Deudas / Préstamos",
  "prestamo": "Deudas / Préstamos",

  // Education
  "education": "Educación",
  "educación": "Educación",
  "educacion": "Educación",
  "university": "Educación",
  "universidad": "Educación",
  "cursos / formación": "Cursos / Formación",
  "cursos / formacion": "Cursos / Formación",
  "cursos": "Cursos / Formación",
  "formación": "Cursos / Formación",
  "formacion": "Cursos / Formación",
  "udemy": "Cursos / Formación",
  "coursera": "Cursos / Formación",
  "material escolar": "Material escolar",

  // Personal
  "belleza / peluquería": "Belleza / Peluquería",
  "belleza / peluqueria": "Belleza / Peluquería",
  "belleza": "Belleza / Peluquería",
  "peluquería": "Belleza / Peluquería",
  "peluqueria": "Belleza / Peluquería",
  "barbero": "Belleza / Peluquería",
  "manicura": "Belleza / Peluquería",
  "subscriptions": "Suscripciones",
  "suscripciones": "Suscripciones",
  "subscription": "Suscripciones",
  "limpieza": "Limpieza",
  "cleaning": "Limpieza",
  "otros gastos": "Otros gastos",
  "otros": "Otros gastos",
  "misc": "Otros gastos",
  "miscellaneous": "Otros gastos",
};

/**
 * Normalize a category string to a standard category.
 * Handles:
 * - Case-insensitive matching
 * - Common aliases and translations
 * - Trimming whitespace
 * - Falls back to the original if no match found
 */
export function normalizeCategory(input: string): StandardCategory | string {
  if (!input || typeof input !== "string") {
    return "Otros gastos";
  }

  const trimmed = input.trim();

  // Exact match (case-insensitive)
  const exactMatch = STANDARD_CATEGORIES.find(
    (cat) => cat.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  // Alias match (case-insensitive)
  const aliasKey = Object.keys(CATEGORY_ALIASES).find(
    (key) => key.toLowerCase() === trimmed.toLowerCase()
  );
  if (aliasKey) return CATEGORY_ALIASES[aliasKey];

  // Partial match: check if input contains a known category word
  const lowerInput = trimmed.toLowerCase();
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (lowerInput.includes(alias.toLowerCase())) {
      return category;
    }
  }

  // No match found - return original but log it
  console.warn(`[Category] Unknown category "${trimmed}" - using as-is. Consider adding to CATEGORY_ALIASES.`);
  return trimmed;
}

/**
 * Strict validation: only allows standard categories.
 * Use this when you want to reject unknown categories.
 */
export function isStandardCategory(input: string): input is StandardCategory {
  const normalized = normalizeCategory(input);
  return STANDARD_CATEGORIES.includes(normalized as StandardCategory);
}
