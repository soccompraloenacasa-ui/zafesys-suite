// Ciudades disponibles para instalación
export const CITIES = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'cali', label: 'Cali' },
  { value: 'pereira', label: 'Pereira' },
] as const;

export type CityValue = typeof CITIES[number]['value'];
