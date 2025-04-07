export const CATEGORIES = [
  'QFI',
  'Comida',
  'Otros Gastos',
  'Viajes/ Transporte',
  'Tools',
  'Formación',
  'Cripto W',
  'Hobby',
  'Cripto D',
  'Empleo',
  'Alquiler',
  'Café',
  'Ads',
  'Otros Ingresos',
  'Piso JB38',
  'MasTrafico',
  'Salud',
  'Autónomo'
] as const

export type Category = typeof CATEGORIES[number]
