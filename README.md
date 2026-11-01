# 🚀 Nexus Hardware Caracas - Aplicación Móvil

Aplicación móvil moderna de alto rendimiento para tienda de hardware de computadoras en Caracas, Venezuela. Construida con arquitectura móvil de última generación, diseño Cyberpunk/Dark Gamer con **Glassmorphism**, y **Base de Datos Local Transaccional (IndexedDB)**.

---

## 📱 Características Principales

### 1. 🛍️ Catálogo y Tienda Interactiva
- **Categorías completas de hardware**: Procesadores (Ryzen e Intel), Tarjetas de Video (NVIDIA RTX Serie 40 y AMD RX), Placas Madre (AM5, AM4, LGA1700), Memorias RAM (DDR5, DDR4), Fuentes de Poder (80+ Gold/White), Almacenamiento (M.2 NVMe PCIe 4.0, SATA), Gabinetes, Refrigeración y Periféricos.
- **Filtros instantáneos**: Búsqueda en tiempo real por modelo, socket, interfaz o marca.
- **Precios duales en tiempo real**: Visualización en **Dólares ($)** y en **Bolívares (Bs.)** calculados a la tasa oficial **BCV del día**.
- **Fichas técnicas detalladas**: Modal con especificaciones técnicas completas (frecuencias, consumo TDP, VRAM, factor de forma).

### 2. ⚡ Asistente de Compatibilidad de PC ("PC Builder Wizard")
- El cliente introduce las especificaciones de su PC:
  - **Socket / Plataforma actual** (AM4, AM5, LGA1700, LGA1200, LGA1151).
  - **Tipo de Memoria RAM** (DDR4 o DDR5).
  - **Potencia de su Fuente de Poder** (400W, 500W, 600W, 750W, 850W+).
  - **Formato de Gabinete** (ATX, Micro-ATX, Mini-ITX).
- El motor analiza todo el inventario de la tienda y clasifica los productos en:
  - 🟢 **100% Compatibles**: Con botón de añadir directo y detalles de compatibilidad.
  - 🟡 **Con Advertencia**: Por ejemplo, si su fuente de poder es inferior a los Watts requeridos por una tarjeta gráfica potente.
  - 🔴 **Incompatibles**: Con desglose y explicación técnica del por qué (físico, de socket o de generación de memoria).

### 3. 🏬 Retiro en Tienda (5 Sucursales en Caracas) & 🛵 Delivery
- **Retiro en Tienda Presencial**:
  1. **Sucursal Altamira**: Av. Francisco de Miranda, Centro Plaza, Nivel 3, Local 22.
  2. **Sucursal Las Mercedes**: Calle París c/c Caroní, Torre D&G, PB.
  3. **Sucursal Chacao**: Av. Francisco de Miranda, Centro Lido, Nivel Galería.
  4. **Sucursal El Recreo**: Av. Casanova, C.C. El Recreo, Torre Sur, Nivel C2, Sabana Grande.
  5. **Sucursal La Candelaria**: Av. Urdaneta c/c Fuerzas Armadas, C.C. Galerías Ávila, Nivel PB.
  - **Selector de Fecha y Franja Horaria**: El cliente programa el día y la hora exacta en la que retirará su paquete.
- **Servicio de Delivery en Caracas**:
  - Cobertura con cálculo de tarifa por municipio: Chacao, Baruta, Sucre, Libertador y El Hatillo.
  - Campo para dirección exacta y punto de referencia.

### 4. 💳 Formas de Pago en Venezuela y Multimoneda
- **Pago Móvil Interbancario**: Datos oficiales (Banesco, RIF, teléfono, titular), monto exacto en Bs. y registro de número de referencia.
- **Efectivo ($ USD)**: Indicación de billete con el que cancelará para coordinar cambio.
- **Zelle**: Correo oficial y titular con registro de referencia.
- **Binance Pay**: Binance Pay ID oficial, cálculo en USDT sin comisiones y registro de TXID.
- **PayPal**: Pago con pasarela internacional.
- **Punto de Venta / Biopago**: Pago presencial en la sucursal al retirar.

### 5. 📦 Control de Inventario y Stock en Tiempo Real
- Cada producto tiene un stock registrado en la **Base de Datos Local**.
- **Descuento automático**: Al confirmar la compra, el sistema descuenta automáticamente las unidades del inventario en la base de datos.
- **Bloqueo de compras**: Si un producto se queda sin stock (0 unidades), pasa al estado **Agotado** y se deshabilita el botón de añadir.
- **Alertas de stock bajo**: Indicador visual para productos con 3 o menos unidades.

### 6. 📜 Historial de Compras
- Los clientes pueden consultar todas sus compras registradas con número de orden, fecha y hora, productos adquiridos, estado de entrega (Confirmado, En camino, Listo para retiro, Entregado) y método de pago con comprobante.

### 7. ⭐ Sistema de Reseñas de Clientes
- Formulario interactivo para calificar con estrellas (1 a 5) la **Atención al Cliente** de una sucursal o el rendimiento de un **Producto**.
- Las opiniones se almacenan en la base de datos local y se muestran públicamente con etiqueta de cliente verificado.

### 8. 🛠️ Panel de Administración y Reportes
- **KPIs Financieros**: Ventas totales en USD ($), ventas en Bolívares (Bs.), número total de pedidos y valorización total del inventario.
- **Ajuste de Tasa BCV**: Modificación con 1 clic de la tasa del día, actualizando todos los precios de la app de forma reactiva.
- **Gestión de Stock**: Edición rápida de stock físico para cada componente.
- **Creación de Productos**: Formulario para dar de alta nuevo hardware al catálogo.
- **Gestión de Estados de Pedidos**: Cambiar estados a "Confirmado", "Listo para retiro", "En camino" o "Entregado".

### 9. 🔐 Sistema de Registro, Autenticación y Control de Roles (RBAC)
- **Formularios de Registro Diferenciados por Rol**:
  - 👤 **Registro de Cliente**: Formulario completo para compradores (Nombre completo, username, correo, teléfono y contraseña). Permite realizar compras, autocompletar checkout, guardar historial de pedidos y publicar valoraciones verificadas.
  - 🛡️ **Registro de Administrador**: Formulario administrativo protegido con **Clave Maestra de Seguridad** (`NEXUS-ADMIN-2026`). Otorga privilegios directos de gestión de inventario, tasa BCV y visor relacional de base de datos.
- **Inicio de Sesión Flexible Multirrol**:
  - Detección inteligente de credenciales tanto para cuentas de **Cliente** como de **Administrador**.
  - Botones de acceso rápido para pruebas inmediatas:
    - ⚡ **Demo Admin**: `admin` / `admin2026`
    - ⚡ **Demo Cliente**: `carlos.m` / `cliente2026`
- **Gestión de Sesión y Perfil**:
  - Tarjeta de usuario con avatar, estado de conexión en vivo, datos de contacto y fecha de registro.
  - Acciones rápidas según rol y botón para cerrar sesión o cambiar de cuenta en 1 clic.
- **Protección de Rutas (Route Guards)**: Los clientes no pueden ver la base de datos ni los reportes confidenciales. Si un cliente intenta acceder, se muestra la pantalla de acceso restringido con accesos directos para iniciar sesión o registrarse como Administrador.

### 10. 🗄️ Visor y Gestión de Base de Datos en Formato de Tabla (Solo Administradores)
- **Acceso Exclusivo para Administradores**: El botón "BD Local" permanece oculto para clientes y solo se activa tras autenticarse con rol de Administrador.
- **Estructura en Tablas Relacionales**: Visor interactivo en vivo con tablas HTML normalizadas para `products`, `orders`, `branches`, `reviews`, `settings` y `users`.
- **Gestión de Usuarios en Tiempo Real**: Desde la tabla `users`, los administradores pueden cambiar el rol de cualquier usuario (`admin` o `cliente`), crear nuevos usuarios y auditar inicios de sesión.
- **Filtro y Búsqueda en Tiempo Real**: Búsqueda instantánea por fila en cualquiera de las columnas de la tabla activa.
- **Acciones y CRUD por Fila**: Edición interactiva directa (stocks, estados de pedido, precios, especificaciones) y eliminación con confirmación.
- **Exportación a CSV**: Descarga individual de cualquier tabla en formato `.csv` compatible con Excel (UTF-8 BOM).
- **Alternancia Tabla / JSON**: Switch para alternar entre vista tabular formateada y volcado JSON para desarrolladores.
- **Exportación e Importación JSON**: Respaldo completo de la base de datos en un solo archivo.
- **Script SQL Incluido**: Archivo `database.sql` con la definición DDL (`CREATE TABLE`), relaciones, claves foráneas e inserciones (`INSERT INTO`).
- **Documentación de Tablas**: Diccionario completo de datos en `DATABASE_TABLES.md`.

---

## 🚀 Cómo Iniciar la Aplicación

1. Haz doble clic en el archivo **`iniciar_app.bat`** en la carpeta principal.
2. O simplemente abre el archivo **`index.html`** con cualquier navegador moderno (Edge, Chrome, Brave, Firefox, Safari).
3. **Simulador Móvil**: En la esquina superior derecha tienes:
   - **Marco Teléfono**: Activa o desactiva la simulación de smartphone con marco y notch.
   - **Botón de Roles / Perfil**: Muestra el rol y usuario activo (`Admin: admin` o `Cliente: carlos.m` o `Acceso / Roles`). Haz clic para abrir el modal de Registro, Login o Perfil.
   - **BD Local**: Solo visible cuando se ha iniciado sesión con rol de Administrador.
   - **Icono de Usuario en la App Bar**: Acceso directo al Centro de Cuentas y Registro desde el encabezado móvil.

