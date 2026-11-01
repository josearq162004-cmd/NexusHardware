-- =============================================================================
-- PROYECTO: Nexus Hardware Caracas
-- ESQUEMA Y TABLAS RELACIONALES DE BASE DE DATOS (SQL)
-- Motor de compatibilidad: PostgreSQL / MySQL / SQLite / MariaDB
-- Generado el: 2026-10-31
-- =============================================================================

-- Deshabilitar restricciones temporalmente si es necesario para recrear tablas
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS reviews CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS branches CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;

-- -----------------------------------------------------------------------------
-- 1. TABLA: branches (Sucursales Físicas en Caracas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    municipality VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    schedule VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    coords VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Abierto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. TABLA: products (Catálogo de Componentes de Hardware y Periféricos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image TEXT,
    specs JSON,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices recomendados para búsquedas rápidas en catálogo
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- -----------------------------------------------------------------------------
-- 3. TABLA: orders (Órdenes de Compra y Transacciones)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50), -- Identificador del usuario propietario (RBAC y Privacidad de Pedidos)
    username VARCHAR(50), -- Nombre de usuario cliente (Ej: 'carlos.m', 'valeria.g')
    invoice_number VARCHAR(50), -- Serie fiscal de factura (Ej: 'FACT-7821')
    control_number VARCHAR(50), -- Número de control fiscal SENIAT (Ej: '00-7821-2026')
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(150),
    customer_ci VARCHAR(50),
    delivery_type VARCHAR(50) NOT NULL, -- 'pickup' (Retiro) o 'delivery' (Envío)
    branch_id VARCHAR(50),
    branch_name VARCHAR(150),
    pickup_date DATE,
    pickup_time VARCHAR(50),
    delivery_address TEXT,
    municipality VARCHAR(100),
    subtotal DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
    total_usd DECIMAL(10, 2) NOT NULL,
    total_bs DECIMAL(14, 2) NOT NULL,
    bcv_rate DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'pago_movil', 'zelle', 'binance', 'efectivo', 'paypal', 'pos'
    payment_reference VARCHAR(100),
    payment_details JSON,
    status VARCHAR(50) DEFAULT 'Confirmado', -- 'Pendiente', 'Confirmado', 'Listo para retiro', 'En camino', 'Entregado', 'Cancelado'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);

-- -----------------------------------------------------------------------------
-- 4. TABLA: order_items (Líneas de Detalle de Productos por Orden)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- -----------------------------------------------------------------------------
-- 5. TABLA: reviews (Calificaciones y Opiniones de Clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(50) PRIMARY KEY,
    author VARCHAR(100) NOT NULL,
    review_type VARCHAR(50) NOT NULL, -- 'service' (Atención) o 'product' (Hardware)
    category_label VARCHAR(100),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    target VARCHAR(150) NOT NULL,
    comment TEXT NOT NULL,
    review_date DATE NOT NULL,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- -----------------------------------------------------------------------------
-- 6. TABLA: settings (Configuración General y Parámetros del Negocio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    bcv_rate DECIMAL(10, 2) NOT NULL,
    last_rate_date DATE NOT NULL,
    last_rate_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    store_name VARCHAR(150) NOT NULL,
    support_whatsapp VARCHAR(50),
    payment_accounts JSON,
    delivery_zones JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. TABLA: users (Usuarios y Control de Acceso Basado en Roles - RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cliente', -- 'admin' (Administrador) | 'cliente' (Cliente/Comprador)
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Activo',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);


-- =============================================================================
-- INSERCIÓN DE DATOS INICIALES (SEEDS NORMALIZADOS)
-- =============================================================================

-- 1. Sucursales en Caracas
INSERT INTO branches (id, name, municipality, address, schedule, phone, coords, status) VALUES
('suc-altamira', 'Sucursal Altamira', 'Chacao', 'Av. Francisco de Miranda, Centro Plaza, Nivel 3, Local 22, Altamira', 'Lunes a Sábado: 9:00 AM - 7:00 PM', '+58 212-261-8899', '10.4965, -66.8524', 'Abierto'),
('suc-lasmercedes', 'Sucursal Las Mercedes', 'Baruta', 'Calle París c/c Caroní, Torre D&G, PB, Las Mercedes', 'Lunes a Sábado: 10:00 AM - 8:00 PM | Dom: 11:00 AM - 6:00 PM', '+58 212-993-4411', '10.4782, -66.8615', 'Abierto'),
('suc-chacao', 'Sucursal Chacao', 'Chacao', 'Av. Francisco de Miranda, Centro Lido, Nivel Galería, Chacao', 'Lunes a Sábado: 9:30 AM - 7:30 PM', '+58 212-953-1122', '10.4918, -66.8601', 'Abierto'),
('suc-elrecreo', 'Sucursal El Recreo', 'Libertador', 'Av. Casanova, C.C. El Recreo, Torre Sur, Nivel C2, Sabana Grande', 'Lunes a Domingo: 10:00 AM - 8:00 PM', '+58 212-706-8800', '10.4912, -66.8795', 'Abierto'),
('suc-candelaria', 'Sucursal La Candelaria', 'Libertador', 'Av. Urdaneta c/c Fuerzas Armadas, C.C. Galerías Ávila, Nivel PB', 'Lunes a Sábado: 9:00 AM - 6:30 PM', '+58 212-576-3344', '10.5065, -66.9062', 'Abierto')
ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status);

-- 2. Configuración y Tasa Oficial BCV
INSERT INTO settings (setting_key, bcv_rate, last_rate_date, store_name, support_whatsapp, payment_accounts, delivery_zones) VALUES
('general_config', 889.57, '2026-10-31', 'Nexus Hardware Caracas', '+58 412 555-8899',
 '{"pago_movil":{"bank":"Banesco (0134)","phone":"0412-5558899","rif":"J-50123984-0","beneficiary":"Nexus Hardware C.A."},"zelle":{"email":"pagos@nexushardware.com","beneficiary":"Nexus Hardware LLC"},"binance":{"pay_id":"883921049","alias":"NexusHardwareCaracas","crypto":"USDT"},"paypal":{"email":"ventas@nexushardware.com"}}',
 '[{"municipality":"Chacao","cost":3.00,"time":"30 - 60 min"},{"municipality":"Baruta","cost":4.00,"time":"45 - 75 min"},{"municipality":"Sucre","cost":4.50,"time":"45 - 90 min"},{"municipality":"Libertador","cost":3.50,"time":"40 - 70 min"},{"municipality":"El Hatillo","cost":6.00,"time":"60 - 120 min"}]'
)
ON DUPLICATE KEY UPDATE bcv_rate=VALUES(bcv_rate), last_rate_date=VALUES(last_rate_date);

-- 3. Productos (Catálogo de Hardware)
INSERT INTO products (id, name, brand, category, price, stock, image, specs, description) VALUES
('cpu-01', 'AMD Ryzen 7 7800X3D', 'AMD', 'Procesadores', 420.00, 8, 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80', '{"socket":"AM5","cores":"8 Núcleos / 16 Hilos","baseClock":"4.2 GHz","boostClock":"5.0 GHz","ramType":"DDR5","tdp":120,"pcie":"PCIe 5.0"}', 'El procesador gaming definitivo con tecnología 3D V-Cache para un rendimiento inigualable.'),
('cpu-02', 'AMD Ryzen 5 7600X', 'AMD', 'Procesadores', 220.00, 12, 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80', '{"socket":"AM5","cores":"6 Núcleos / 12 Hilos","baseClock":"4.7 GHz","boostClock":"5.3 GHz","ramType":"DDR5","tdp":105,"pcie":"PCIe 5.0"}', 'Excelente rendimiento precio/calidad para plataformas AM5 con soporte para DDR5 y PCIe 5.0.'),
('cpu-03', 'AMD Ryzen 7 5700X3D', 'AMD', 'Procesadores', 210.00, 14, 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80', '{"socket":"AM4","cores":"8 Núcleos / 16 Hilos","baseClock":"3.0 GHz","boostClock":"4.1 GHz","ramType":"DDR4","tdp":105,"pcie":"PCIe 4.0"}', 'La mejor actualización para usuarios que ya tienen una placa madre Socket AM4 y memorias DDR4.'),
('cpu-04', 'AMD Ryzen 5 5600', 'AMD', 'Procesadores', 135.00, 18, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80', '{"socket":"AM4","cores":"6 Núcleos / 12 Hilos","baseClock":"3.5 GHz","boostClock":"4.4 GHz","ramType":"DDR4","tdp":65,"pcie":"PCIe 4.0"}', 'El procesador más equilibrado de bajo consumo y costo para gaming competitivo en AM4.'),
('cpu-05', 'Intel Core i7-14700K', 'Intel', 'Procesadores', 395.00, 6, 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80', '{"socket":"LGA1700","cores":"20 Núcleos (8P + 12E)","baseClock":"3.4 GHz","boostClock":"5.6 GHz","ramType":"DDR4/DDR5","tdp":253,"pcie":"PCIe 5.0"}', 'Potencia híbrida brutal tanto para creadores de contenido profesional como para gaming de alta tasa de cuadros.'),
('cpu-06', 'Intel Core i5-13400F', 'Intel', 'Procesadores', 185.00, 15, 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80', '{"socket":"LGA1700","cores":"10 Núcleos (6P + 4E)","baseClock":"2.5 GHz","boostClock":"4.6 GHz","ramType":"DDR4/DDR5","tdp":65,"pcie":"PCIe 4.0/5.0"}', 'Gran balance calidad/precio para presupuestos intermedios en Socket LGA1700.'),
('gpu-01', 'NVIDIA GeForce RTX 4080 Super 16GB', 'NVIDIA', 'Tarjetas de Video', 1050.00, 4, 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80', '{"vram":"16GB GDDR6X","recommendedPsu":750,"lengthMm":304,"pcie":"PCIe 4.0 x16","tdp":320,"dlss":"DLSS 3.5"}', 'Poder descomunal en resolución 4K nativo con trazado de rayos completo y soporte DLSS 3.5 Frame Generation.'),
('gpu-02', 'NVIDIA GeForce RTX 4070 Super 12GB', 'NVIDIA', 'Tarjetas de Video', 640.00, 9, 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80', '{"vram":"12GB GDDR6X","recommendedPsu":650,"lengthMm":242,"pcie":"PCIe 4.0 x16","tdp":220,"dlss":"DLSS 3.5"}', 'La reina del rendimiento en 1440p con memoria GDDR6X ultrarrápida y consumo sumamente contenido.'),
('gpu-03', 'NVIDIA GeForce RTX 4060 8GB', 'NVIDIA', 'Tarjetas de Video', 320.00, 15, 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80', '{"vram":"8GB GDDR6","recommendedPsu":550,"lengthMm":210,"pcie":"PCIe 4.0 x8","tdp":115,"dlss":"DLSS 3.5"}', 'Eficiencia insuperable para resolución 1080p con consumo de apenas 115W y soporte DLSS 3.'),
('gpu-04', 'AMD Radeon RX 7800 XT 16GB', 'AMD', 'Tarjetas de Video', 540.00, 7, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80', '{"vram":"16GB GDDR6","recommendedPsu":700,"lengthMm":267,"pcie":"PCIe 4.0 x16","tdp":263,"fsr":"FSR 3"}', '16GB de VRAM pura para dominar cualquier juego exigente en 1440p con arquitectura RDNA 3.'),
('gpu-05', 'AMD Radeon RX 6600 8GB', 'AMD', 'Tarjetas de Video', 215.00, 20, 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80', '{"vram":"8GB GDDR6","recommendedPsu":450,"lengthMm":200,"pcie":"PCIe 4.0 x8","tdp":132,"fsr":"FSR 3"}', 'La mejor opción precio/calidad para armar una PC gamer de entrada que mueva todo en 1080p.'),
('mobo-01', 'ASUS ROG Strix B650-A Gaming WiFi', 'ASUS', 'Placas Madre', 230.00, 8, 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80', '{"socket":"AM5","chipset":"AMD B650","formFactor":"ATX","ramType":"DDR5","maxRamSpeed":6400,"m2Slots":3,"wifi":"WiFi 6E"}', 'Placa base premium con diseño plateado, disipadores robustos para VRM y conectividad WiFi 6E.'),
('mobo-02', 'MSI B550M PRO-VDH WiFi', 'MSI', 'Placas Madre', 110.00, 16, 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80', '{"socket":"AM4","chipset":"AMD B550","formFactor":"Micro-ATX","ramType":"DDR4","maxRamSpeed":4400,"m2Slots":2,"wifi":"WiFi AC"}', 'La motherboard más vendida para Socket AM4 con soporte PCIe 4.0, doble puerto M.2 y WiFi integrado.'),
('mobo-03', 'Gigabyte Z790 AORUS Elite AX', 'Gigabyte', 'Placas Madre', 260.00, 5, 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80', '{"socket":"LGA1700","chipset":"Intel Z790","formFactor":"ATX","ramType":"DDR5","maxRamSpeed":7600,"m2Slots":4,"wifi":"WiFi 6E"}', 'Plataforma definitiva para procesadores Intel Core de 13ª y 14ª generación con soporte para memorias DDR5 de alta frecuencia.'),
('ram-01', 'Corsair Vengeance RGB DDR5 32GB (2x16GB) 6000MHz CL30', 'Corsair', 'Memorias RAM', 125.00, 14, 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80', '{"type":"DDR5","capacity":"32GB (2x16GB)","speed":6000,"latency":"CL30","rgb":true,"profile":"AMD EXPO / Intel XMP 3.0"}', 'El kit ideal con latencia baja CL30 para maximizar el rendimiento de la serie Ryzen 7000 e Intel Core.'),
('ram-03', 'Corsair Vengeance LPX DDR4 32GB (2x16GB) 3200MHz CL16', 'Corsair', 'Memorias RAM', 72.00, 25, 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80', '{"type":"DDR4","capacity":"32GB (2x16GB)","speed":3200,"latency":"CL16","rgb":false,"profile":"Intel XMP 2.0"}', 'Perfil bajo para máxima compatibilidad con disipadores de aire grandes y rendimiento sólido en DDR4.'),
('psu-01', 'Corsair RM850e 850W 80 Plus Gold Modular', 'Corsair', 'Fuentes de Poder', 130.00, 11, 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80', '{"watts":850,"efficiency":"80 Plus Gold","modular":"Full Modular","pcieGen5":true,"formFactor":"ATX"}', 'Certificación 80 Plus Gold con soporte nativo para cable PCIe 5.0 12VHPWR para tarjetas serie RTX 40.'),
('ssd-01', 'SSD Samsung 990 PRO 2TB NVMe M.2 PCIe 4.0', 'Samsung', 'Almacenamiento', 180.00, 9, 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80', '{"interface":"PCIe 4.0 NVMe M.2","readSpeed":"7450 MB/s","writeSpeed":"6900 MB/s","capacity":"2TB","tbw":1200}', 'Velocidades demenciales de lectura y escritura para cargas de juego instantáneas y edición de video 4K/8K.'),
('case-01', 'NZXT H5 Flow RGB Mid-Tower', 'NZXT', 'Gabinetes', 115.00, 7, 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80', '{"supportedMobo":"ATX, Micro-ATX, Mini-ITX","maxGpuLength":365,"fansIncluded":2,"frontPanel":"Mesh Perforado","sidePanel":"Vidrio Templado"}', 'Gabinete con flujo de aire optimizado, ventilador inferior dedicado a la GPU y panel frontal mesh.'),
('cooler-01', 'DeepCool AK620 Digital Disipador de Aire', 'DeepCool', 'Refrigeración', 75.00, 10, 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80', '{"type":"Aire Torre Doble","tdpMax":260,"fans":2,"supportedSockets":"AM4, AM5, LGA1700, LGA1200","display":"Pantalla Digital de Temp"}', 'Doble torre de disipación de calor con pantalla digital en la parte superior que monitorea temperatura en tiempo real.')
ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), stock=VALUES(stock);

-- 4. Órdenes Iniciales de Prueba
INSERT INTO orders (id, order_date, customer_name, customer_phone, customer_email, customer_ci, delivery_type, branch_id, branch_name, pickup_date, pickup_time, delivery_address, municipality, subtotal, delivery_fee, total_usd, total_bs, bcv_rate, payment_method, payment_reference, payment_details, status) VALUES
('ORD-7821', '2026-10-30 14:35:00', 'Carlos Mendoza', '0414-2345678', 'carlos.m@gmail.com', 'V-24.891.203', 'pickup', 'suc-lasmercedes', 'Sucursal Las Mercedes', '2026-11-02', '14:00 - 16:00', NULL, 'Baruta', 545.00, 0.00, 545.00, 484815.65, 889.57, 'pago_movil', '081294', '{"bank":"Banesco","reference":"081294","senderPhone":"0414-2345678"}', 'Listo para retiro'),
('ORD-7822', '2026-10-31 09:15:00', 'Valeria Gómez', '0424-9081122', 'vgomez@empresa.com.ve', 'V-20.119.554', 'delivery', NULL, NULL, NULL, NULL, 'Av. Libertador, Edif. Caracas, Piso 6, Apto 6-B. Frente a PDVSA La Campiña.', 'Libertador', 320.00, 3.50, 323.50, 287775.89, 889.57, 'zelle', 'ZLL-99410', '{"zelleAccount":"valeria.g@zelle.com","reference":"ZLL-99410"}', 'En camino')
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- 5. Líneas de Productos de las Órdenes (order_items)
INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity) VALUES
(1, 'ORD-7821', 'cpu-01', 'AMD Ryzen 7 7800X3D', 420.00, 1),
(2, 'ORD-7821', 'ram-01', 'Corsair Vengeance RGB DDR5 32GB', 125.00, 1),
(3, 'ORD-7822', 'gpu-03', 'NVIDIA GeForce RTX 4060 8GB', 320.00, 1)
ON DUPLICATE KEY UPDATE quantity=VALUES(quantity);

-- 6. Reseñas Iniciales
INSERT INTO reviews (id, author, review_type, category_label, rating, target, comment, review_date, verified) VALUES
('rev-01', 'Alejandro R.', 'service', 'Atención al Cliente', 5, 'Sucursal Altamira', 'Excelente atención en Centro Plaza. Me asesoraron sobre la fuente de poder correcta para mi tarjeta de video y pagué con Pago Móvil a tasa BCV sin complicaciones.', '2026-10-28', TRUE),
('rev-02', 'Marianela S.', 'product', 'Producto', 5, 'AMD Ryzen 7 7800X3D', 'Una bestia para gaming. La caja sellada con su sello de garantía original y la entrega con delivery en Chacao llegó en menos de 40 minutos.', '2026-10-29', TRUE),
('rev-03', 'David P.', 'service', 'Atención al Cliente', 5, 'Sucursal Las Mercedes', 'Retiré mi pedido el día programado sin filas ni esperas. Verificaron el número de serie delante de mí antes de entregar.', '2026-10-30', TRUE)
ON DUPLICATE KEY UPDATE rating=VALUES(rating);

-- 7. Usuarios del Sistema y Roles Asignados (RBAC)
INSERT INTO users (id, username, full_name, email, role, password_hash, status, last_login) VALUES
('usr-admin', 'admin', 'Administrador Principal', 'admin@nexushardware.com', 'admin', 'admin2026', 'Activo', CURRENT_TIMESTAMP),
('usr-client1', 'carlos.m', 'Carlos Mendoza', 'carlos.m@gmail.com', 'cliente', 'cliente2026', 'Activo', '2026-10-30 14:35:00'),
('usr-client2', 'valeria.g', 'Valeria Gómez', 'vgomez@empresa.com.ve', 'cliente', 'cliente2026', 'Activo', '2026-10-31 09:15:00')
ON DUPLICATE KEY UPDATE role=VALUES(role), status=VALUES(status);

