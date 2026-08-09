-- Catalog (DOP). Prices consistent with legacy demo subtotals.
insert into productos (sku, name, price, stock) values
  ('aceite-1l','Aceite vegetal 1L',180.00,120),
  ('arroz-5lb','Arroz premium 5lb',220.00,200),
  ('leche-1l','Leche entera 1L',65.00,300),
  ('cafe-500g','Café molido 500g',320.00,80),
  ('pollo-2kg','Pollo entero 2kg',380.00,60),
  ('pan-molde','Pan de molde',95.00,90),
  ('agua-6l','Agua embotellada 6L',130.00,150),
  ('jabon-liquido','Jabón líquido',110.00,100),
  ('huevos-docena','Huevos (docena)',150.00,120),
  ('azucar-5lb','Azúcar crema 5lb',160.00,140),
  ('habichuelas-1lb','Habichuelas rojas 1lb',70.00,180),
  ('espagueti-1lb','Espagueti 1lb',55.00,160),
  ('salami-1lb','Salami 1lb',140.00,70),
  ('platano-unidad','Plátano (unidad)',15.00,400)
on conflict (sku) do nothing;

-- Sample orders across every status, canonical items shape.
insert into pedidos (customer_name, customer_phone, telegram_chat_id, items, total, status, source, delivery_address, delivery_city, delivery_zone, created_at, confirmed_at, approved_at, rejected_at, rejection_reason, delivery_assigned_to, delivery_status, delivery_eta)
values
  ('María Rodríguez','809-555-1234','111111111',
   '[{"sku":"aceite-1l","product":"Aceite vegetal 1L","quantity":2,"price":180,"subtotal":360},{"sku":"arroz-5lb","product":"Arroz premium 5lb","quantity":1,"price":220,"subtotal":220}]'::jsonb,
   580,'pending','telegram','Calle Principal #45, Ensanche Naco','Santo Domingo','Zona Norte', now() - interval '2 hours', now() - interval '2 hours', null, null, null, null, null, null),

  ('Juan Pérez','809-555-5678','222222222',
   '[{"sku":"arroz-5lb","product":"Arroz premium 5lb","quantity":2,"price":220,"subtotal":440},{"sku":"leche-1l","product":"Leche entera 1L","quantity":3,"price":65,"subtotal":195}]'::jsonb,
   635,'approved','telegram','Av. Abraham Lincoln #123, Piantini','Santo Domingo','Zona Sur', now() - interval '1 day', now() - interval '1 day', now() - interval '23 hours', null, null, 'Carlos', 'in_transit', '25 min'),

  ('Ana Martínez','809-555-9012','333333333',
   '[{"sku":"cafe-500g","product":"Café molido 500g","quantity":2,"price":320,"subtotal":640}]'::jsonb,
   640,'pending','telegram','Calle El Sol #8, Gazcue','Santo Domingo','Zona Centro', now() - interval '3 hours', now() - interval '3 hours', null, null, null, null, null, null),

  ('Luis Fernández','809-555-3456','444444444',
   '[{"sku":"pollo-2kg","product":"Pollo entero 2kg","quantity":1,"price":380,"subtotal":380},{"sku":"pan-molde","product":"Pan de molde","quantity":1,"price":95,"subtotal":95}]'::jsonb,
   475,'approved','telegram','Av. Winston Churchill #55, Evaristo Morales','Santo Domingo','Zona Norte', now() - interval '2 days', now() - interval '2 days', now() - interval '47 hours', null, null, 'María', 'delivered', 'Entregado'),

  ('Carlos Mendoza','809-555-7890','555555555',
   '[{"sku":"agua-6l","product":"Agua embotellada 6L","quantity":3,"price":130,"subtotal":390},{"sku":"jabon-liquido","product":"Jabón líquido","quantity":2,"price":110,"subtotal":220}]'::jsonb,
   610,'rejected','telegram','Calle Duarte #200, Villa Consuelo','Santo Domingo','Zona Este', now() - interval '5 hours', now() - interval '5 hours', null, now() - interval '4 hours', 'Sin stock de agua embotellada', null, null, null),

  ('Pedro Sánchez','809-555-2468','666666666',
   '[{"sku":"salami-1lb","product":"Salami 1lb","quantity":1,"price":140,"subtotal":140},{"sku":"pan-molde","product":"Pan de molde","quantity":1,"price":95,"subtotal":95}]'::jsonb,
   235,'pending_confirmation','telegram','Av. Independencia #77, Zona Universitaria','Santo Domingo','Zona Oeste', now() - interval '30 minutes', null, null, null, null, null, null, null),

  ('Rosa Gómez','809-555-1357','777777777',
   '[{"sku":"platano-unidad","product":"Plátano (unidad)","quantity":4,"price":15,"subtotal":60},{"sku":"huevos-docena","product":"Huevos (docena)","quantity":2,"price":150,"subtotal":300},{"sku":"azucar-5lb","product":"Azúcar crema 5lb","quantity":1,"price":160,"subtotal":160}]'::jsonb,
   520,'approved','telegram','Calle Respaldo #12, Los Mina','Santo Domingo','Zona Este', now() - interval '6 hours', now() - interval '6 hours', now() - interval '5 hours', null, null, 'Carlos', 'assigned', '40 min'),

  ('Miguel Torres','809-555-8642','888888888',
   '[{"sku":"espagueti-1lb","product":"Espagueti 1lb","quantity":2,"price":55,"subtotal":110},{"sku":"habichuelas-1lb","product":"Habichuelas rojas 1lb","quantity":3,"price":70,"subtotal":210}]'::jsonb,
   320,'pending','telegram','Av. 27 de Febrero #400, Naco','Santo Domingo','Zona Norte', now() - interval '1 hour', now() - interval '1 hour', null, null, null, null, null, null),

  ('Laura Díaz','809-555-9753','999999999',
   '[{"sku":"cafe-500g","product":"Café molido 500g","quantity":1,"price":320,"subtotal":320}]'::jsonb,
   320,'cancelled','telegram','Calle Las Flores #3, Bella Vista','Santo Domingo','Zona Sur', now() - interval '8 hours', null, null, null, null, null, null, null);
