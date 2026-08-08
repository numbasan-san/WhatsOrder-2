export const CATALOGO = [
  { nombre: 'Aceite vegetal 1L', precio: 180 },
  { nombre: 'Arroz premium 5lb', precio: 220 },
  { nombre: 'Leche entera 1L', precio: 65 },
  { nombre: 'Huevos (30 unidades)', precio: 210 },
  { nombre: 'Azúcar blanca 2lb', precio: 85 },
  { nombre: 'Café molido 500g', precio: 320 },
  { nombre: 'Jabón líquido', precio: 95 },
  { nombre: 'Pollo entero 2kg', precio: 380 },
  { nombre: 'Pan de molde', precio: 120 },
  { nombre: 'Agua embotellada 6L', precio: 130 },
];

export const PRECIOS = Object.fromEntries(CATALOGO.map((p) => [p.nombre, p.precio]));

export const RAZONES_RECHAZO = [
  'Producto sin stock disponible',
  'Cliente no confirmó el pedido a tiempo',
  'Dirección de entrega fuera de cobertura',
  'Error en el cálculo del total',
  'Producto no disponible en la sucursal',
  'Cliente solicitó cancelación',
  'Método de pago no disponible',
  'Pedido duplicado',
];

export const ZONAS = ['Zona Norte', 'Zona Sur', 'Zona Este', 'Zona Oeste'];

export const AGENTES_CSR = ['CSR-Admin', 'CSR-María', 'CSR-Juan'];