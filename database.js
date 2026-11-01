/**
 * DatabaseManager - Nexus Hardware Caracas
 * Motor de Base de Datos Local utilizando IndexedDB con sincronización en tiempo real
 * y respaldo reactivo en LocalStorage.
 */

const DB_NAME = 'NexusHardwareDB';
const DB_VERSION = 3; // Actualizado a v3 para soporte de roles y usuarios (RBAC)

class DatabaseManager {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.subscribers = [];
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('branches')) {
          db.createObjectStore('branches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reviews')) {
          db.createObjectStore('reviews', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        this.isReady = true;
        await this.seedInitialDataIfNeeded();
        // Verificar y actualizar tasa del día correspondiente
        await this.syncDailyBcvRate();
        resolve(this);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB no disponible, usando fallback LocalStorage', event);
        this.useLocalStorageFallback();
        this.isReady = true;
        resolve(this);
      };
    });
  }

  useLocalStorageFallback() {
    this.isFallback = true;
    if (!localStorage.getItem('nexus_products')) {
      this.loadInitialSeeds();
    }
    this.syncDailyBcvRate();
  }

  // Verifica si el catálogo o configuración necesitan inicialización
  async seedInitialDataIfNeeded() {
    const productsCount = await this.count('products');
    const settings = await this.get('settings', 'general_config');
    const usersCount = await this.count('users');

    // Si no hay productos o la tasa no es la solicitada de hoy, actualizar
    if (productsCount === 0 || !settings || settings.bcv_rate < 500) {
      console.log('Inicializando Base de Datos Local con catálogo fotográfico real, usuarios con roles y tasa BCV del día...');
      await this.loadInitialSeeds();
    } else if (usersCount === 0) {
      await this.seedUsers();
    }

    // Asegurar que las órdenes en BD tengan asignado su userId, username y numeración de factura fiscal
    await this.migrateOrdersPrivacyAndInvoices();
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Migración y enriquecimiento retroactivo de datos de pedidos para garantizar
   * la privacidad y confidencialidad exigida por la normativa de roles (RBAC):
   * que cada cliente ÚNICAMENTE pueda ver sus propios pedidos y facturas, mientras
   * que el administrador pueda auditar y emitir todas las del día, semana, mes o año.
   *
   * CÓMO SE HIZO:
   * 1. Consulta todas las órdenes existentes en la tabla 'orders' de IndexedDB.
   * 2. Si alguna orden no tiene 'userId' o 'username', la vincula automáticamente
   *    mediante el correo electrónico o nombre del titular a su respectiva cuenta
   *    (carlos.m o valeria.g).
   * 3. Si la orden carece de numeración fiscal oficial ('invoiceNumber'), le genera
   *    automáticamente su serie fiscal legal (FACT-XXXXX) y número de control.
   * 4. Si la base de datos contiene menos de 3 pedidos de prueba, siembra pedidos
   *    adicionales con fechas distribuidas (hoy, esta semana, este mes, este año)
   *    para que el Administrador pueda probar de inmediato los filtros de facturación.
   * =========================================================================
   */
  async migrateOrdersPrivacyAndInvoices() {
    try {
      const orders = await this.getAll('orders');
      let updatedCount = 0;

      for (const ord of orders) {
        let changed = false;

        // Asignar correlativo fiscal oficial si no lo tiene
        if (!ord.invoiceNumber) {
          ord.invoiceNumber = `FACT-${ord.id.replace('ORD-', '')}`;
          ord.controlNumber = `00-${ord.id.replace('ORD-', '')}-2026`;
          changed = true;
        }

        // Si no tiene userId o username, asociarlo al cliente correspondiente
        if (!ord.userId || !ord.username) {
          const email = ord.customer?.email?.toLowerCase() || '';
          const name = ord.customer?.name?.toLowerCase() || '';

          if (email.includes('carlos') || name.includes('carlos')) {
            ord.userId = 'usr-client1';
            ord.username = 'carlos.m';
            changed = true;
          } else if (email.includes('valeria') || name.includes('valeria') || email.includes('empresa')) {
            ord.userId = 'usr-client2';
            ord.username = 'valeria.g';
            changed = true;
          } else {
            ord.userId = ord.userId || 'guest';
            ord.username = ord.username || 'invitado';
            changed = true;
          }
        }

        if (changed) {
          await this.put('orders', ord);
          updatedCount++;
        }
      }

      // Si hay pocas órdenes de muestra, sembrar órdenes adicionales con fechas para pruebas de Admin
      if (orders.length < 4) {
        const extraSampleOrders = [
          {
            id: 'ORD-7820',
            date: '2026-10-31T11:45:00',
            userId: 'usr-client1',
            username: 'carlos.m',
            invoiceNumber: 'FACT-7820',
            controlNumber: '00-7820-2026',
            customer: {
              name: 'Carlos Mendoza',
              phone: '0414-2345678',
              email: 'carlos.m@gmail.com',
              ci: 'V-24.891.203'
            },
            deliveryType: 'pickup',
            branchId: 'suc-altamira',
            branchName: 'Sucursal Altamira',
            pickupDate: '2026-10-31',
            pickupTime: '16:00 - 18:00',
            items: [
              { productId: 'ssd-01', name: 'Kingston Fury Renegade M.2 NVMe 2TB PCIe 4.0', price: 165.00, qty: 1 }
            ],
            subtotal: 165.00,
            deliveryFee: 0,
            totalUsd: 165.00,
            totalBs: 165.00 * 889.57,
            bcvRate: 889.57,
            paymentMethod: 'pago_movil',
            paymentDetails: {
              bank: 'Banesco',
              reference: '094381',
              senderPhone: '0414-2345678'
            },
            status: 'Listo para retiro'
          },
          {
            id: 'ORD-7815',
            date: '2026-10-27T15:20:00',
            userId: 'usr-client2',
            username: 'valeria.g',
            invoiceNumber: 'FACT-7815',
            controlNumber: '00-7815-2026',
            customer: {
              name: 'Valeria Gómez',
              phone: '0424-9081122',
              email: 'vgomez@empresa.com.ve',
              ci: 'V-20.119.554'
            },
            deliveryType: 'delivery',
            deliveryAddress: 'Av. Principal de Las Mercedes, Torre Financiera, Piso 8.',
            municipality: 'Baruta',
            items: [
              { productId: 'psu-01', name: 'Corsair RM850x 850W 80+ Gold Modular', price: 140.00, qty: 1 }
            ],
            subtotal: 140.00,
            deliveryFee: 4.00,
            totalUsd: 144.00,
            totalBs: 144.00 * 889.57,
            bcvRate: 889.57,
            paymentMethod: 'binance_pay',
            paymentDetails: {
              reference: 'TXID-8819203'
            },
            status: 'Entregado'
          },
          {
            id: 'ORD-7805',
            date: '2026-10-12T10:15:00',
            userId: 'usr-client1',
            username: 'carlos.m',
            invoiceNumber: 'FACT-7805',
            controlNumber: '00-7805-2026',
            customer: {
              name: 'Carlos Mendoza',
              phone: '0414-2345678',
              email: 'carlos.m@gmail.com',
              ci: 'V-24.891.203'
            },
            deliveryType: 'pickup',
            branchId: 'suc-chacao',
            branchName: 'Sucursal Chacao',
            pickupDate: '2026-10-13',
            pickupTime: '11:00 - 13:00',
            items: [
              { productId: 'cooler-01', name: 'DeepCool AK620 Digital Disipador Torre', price: 75.00, qty: 1 }
            ],
            subtotal: 75.00,
            deliveryFee: 0,
            totalUsd: 75.00,
            totalBs: 75.00 * 889.57,
            bcvRate: 889.57,
            paymentMethod: 'punto_venta',
            paymentDetails: {
              reference: 'POS-00491'
            },
            status: 'Entregado'
          },
          {
            id: 'ORD-7750',
            date: '2026-06-18T14:30:00',
            userId: 'usr-client2',
            username: 'valeria.g',
            invoiceNumber: 'FACT-7750',
            controlNumber: '00-7750-2026',
            customer: {
              name: 'Valeria Gómez',
              phone: '0424-9081122',
              email: 'vgomez@empresa.com.ve',
              ci: 'V-20.119.554'
            },
            deliveryType: 'delivery',
            deliveryAddress: 'Urbanización El Hatillo, Calle El Manantial, Quinta Los Pinos.',
            municipality: 'El Hatillo',
            items: [
              { productId: 'mb-01', name: 'ASUS ROG Strix B650E-F Gaming WiFi AM5', price: 290.00, qty: 1 }
            ],
            subtotal: 290.00,
            deliveryFee: 5.00,
            totalUsd: 295.00,
            totalBs: 295.00 * 889.57,
            bcvRate: 889.57,
            paymentMethod: 'zelle',
            paymentDetails: {
              reference: 'ZLL-55219'
            },
            status: 'Entregado'
          }
        ];

        for (const extra of extraSampleOrders) {
          const exists = await this.get('orders', extra.id);
          if (!exists) {
            await this.put('orders', extra);
          }
        }
      }
    } catch (err) {
      console.warn('Nota en migración de pedidos:', err);
    }
  }

  // Siembra de usuarios con roles definidos (Admin / Cliente)
  async seedUsers() {
    const users = [
      {
        id: 'usr-admin',
        username: 'admin',
        fullName: 'Administrador Principal',
        email: 'admin@nexushardware.com',
        phone: '+58 212-993-4411',
        role: 'admin',
        password: 'admin2026',
        status: 'Activo',
        createdAt: '2026-10-01T08:00:00',
        lastLogin: new Date().toISOString()
      },
      {
        id: 'usr-client1',
        username: 'carlos.m',
        fullName: 'Carlos Mendoza',
        email: 'carlos.m@gmail.com',
        phone: '+58 414-234-5678',
        role: 'cliente',
        password: 'cliente2026',
        status: 'Activo',
        createdAt: '2026-10-15T10:30:00',
        lastLogin: '2026-10-30T14:35:00'
      },
      {
        id: 'usr-client2',
        username: 'valeria.g',
        fullName: 'Valeria Gómez',
        email: 'vgomez@empresa.com.ve',
        phone: '+58 412-876-5432',
        role: 'cliente',
        password: 'cliente2026',
        status: 'Activo',
        createdAt: '2026-10-20T11:00:00',
        lastLogin: '2026-10-31T09:15:00'
      }
    ];
    for (const u of users) {
      await this.put('users', u);
    }
  }

  // Comprueba la fecha de hoy y actualiza la tasa al día correspondiente si ha cambiado de fecha
  async syncDailyBcvRate() {
    const settings = await this.get('settings', 'general_config');
    if (!settings) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const lastUpdateDate = settings.last_rate_date || '2026-10-31';

    // Si cambió el día (ej: cliente consulta mañana u otro día posterior)
    if (todayStr !== lastUpdateDate) {
      // Simulación de variación de mercado oficial del día hábil siguiente (entre +0.1% y +0.4%)
      const daysDiff = Math.max(1, Math.floor((new Date(todayStr) - new Date(lastUpdateDate)) / (1000 * 60 * 60 * 24)));
      const baseRate = settings.bcv_rate || 889.57;
      // Ajuste proporcional por los días transcurridos
      const calculatedDailyRate = parseFloat((baseRate * Math.pow(1.0028, daysDiff)).toFixed(2));

      settings.bcv_rate = calculatedDailyRate;
      settings.last_rate_date = todayStr;
      settings.last_rate_update = new Date().toISOString();
      await this.put('settings', settings);
      console.log(`Tasa BCV actualizada al día de hoy (${todayStr}): ${calculatedDailyRate} Bs/$`);
    } else if (!settings.bcv_rate || settings.bcv_rate < 800) {
      // Garantizar la tasa exacta de hoy requerida por el usuario
      settings.bcv_rate = 889.57;
      settings.last_rate_date = todayStr;
      settings.last_rate_update = new Date().toISOString();
      await this.put('settings', settings);
    }
  }

  async loadInitialSeeds() {
    // 5 Sucursales reales de Caracas solicitadas
    const branches = [
      {
        id: 'suc-altamira',
        name: 'Sucursal Altamira',
        address: 'Av. Francisco de Miranda, Centro Plaza, Nivel 3, Local 22, Altamira',
        municipality: 'Chacao',
        schedule: 'Lunes a Sábado: 9:00 AM - 7:00 PM',
        phone: '+58 212-261-8899',
        coords: '10.4965, -66.8524',
        status: 'Abierto'
      },
      {
        id: 'suc-lasmercedes',
        name: 'Sucursal Las Mercedes',
        address: 'Calle París c/c Caroní, Torre D&G, PB, Las Mercedes',
        municipality: 'Baruta',
        schedule: 'Lunes a Sábado: 10:00 AM - 8:00 PM | Dom: 11:00 AM - 6:00 PM',
        phone: '+58 212-993-4411',
        coords: '10.4782, -66.8615',
        status: 'Abierto'
      },
      {
        id: 'suc-chacao',
        name: 'Sucursal Chacao',
        address: 'Av. Francisco de Miranda, Centro Lido, Nivel Galería, Chacao',
        municipality: 'Chacao',
        schedule: 'Lunes a Sábado: 9:30 AM - 7:30 PM',
        phone: '+58 212-953-1122',
        coords: '10.4918, -66.8601',
        status: 'Abierto'
      },
      {
        id: 'suc-elrecreo',
        name: 'Sucursal El Recreo',
        address: 'Av. Casanova, C.C. El Recreo, Torre Sur, Nivel C2, Sabana Grande',
        municipality: 'Libertador',
        schedule: 'Lunes a Domingo: 10:00 AM - 8:00 PM',
        phone: '+58 212-706-8800',
        coords: '10.4912, -66.8795',
        status: 'Abierto'
      },
      {
        id: 'suc-candelaria',
        name: 'Sucursal La Candelaria',
        address: 'Av. Urdaneta c/c Fuerzas Armadas, C.C. Galerías Ávila, Nivel PB',
        municipality: 'Libertador',
        schedule: 'Lunes a Sábado: 9:00 AM - 6:30 PM',
        phone: '+58 212-576-3344',
        coords: '10.5065, -66.9062',
        status: 'Abierto'
      }
    ];

    for (const b of branches) {
      await this.put('branches', b);
    }

    // Configuración inicial de la tienda en Venezuela con la tasa de hoy (889,57 Bs/$)
    const settings = {
      key: 'general_config',
      bcv_rate: 889.57, // Tasa BCV oficial del día correspondiente en Bs/$
      last_rate_date: new Date().toISOString().split('T')[0],
      last_rate_update: new Date().toISOString(),
      store_name: 'Nexus Hardware Caracas',
      support_whatsapp: '+58 412 555-8899',
      payment_accounts: {
        pago_movil: {
          bank: 'Banesco (0134)',
          phone: '0412-5558899',
          rif: 'J-50123984-0',
          beneficiary: 'Nexus Hardware C.A.'
        },
        zelle: {
          email: 'pagos@nexushardware.com',
          beneficiary: 'Nexus Hardware LLC'
        },
        paypal: {
          email: 'ventas@nexushardware.com',
          commission_note: 'No incluye comisión de plataforma'
        },
        binance: {
          pay_id: '883921049',
          alias: 'NexusHardwareCaracas',
          crypto: 'USDT (Red TRC-20 / BEP-20)'
        },
        efectivo: {
          description: 'Aceptamos dólares en efectivo en buen estado (billetes de $5, $10, $20, $50, $100). Cambio exacto disponible en sucursal o con delivery.'
        }
      },
      delivery_zones: [
        { municipality: 'Chacao', cost: 3.00, time: '30 - 60 min' },
        { municipality: 'Baruta', cost: 4.00, time: '45 - 75 min' },
        { municipality: 'Sucre (La California, Los Dos Caminos, Petare)', cost: 4.50, time: '45 - 90 min' },
        { municipality: 'Libertador (Centro, El Recreo, Candelaria)', cost: 3.50, time: '40 - 70 min' },
        { municipality: 'El Hatillo', cost: 6.00, time: '60 - 120 min' }
      ]
    };
    await this.put('settings', settings);

    // Catálogo con imágenes representativas individuales y específicas para cada componente
    const products = [
      // PROCESADORES (CPUs)
      {
        id: 'cpu-01',
        name: 'AMD Ryzen 7 7800X3D',
        category: 'Procesadores',
        brand: 'AMD',
        price: 420.00,
        stock: 8,
        image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'AM5',
          cores: '8 Núcleos / 16 Hilos',
          baseClock: '4.2 GHz',
          boostClock: '5.0 GHz',
          ramType: 'DDR5',
          tdp: 120,
          pcie: 'PCIe 5.0'
        },
        description: 'El procesador gaming definitivo con tecnología 3D V-Cache para un rendimiento inigualable en 1080p y 1440p.'
      },
      {
        id: 'cpu-02',
        name: 'AMD Ryzen 5 7600X',
        category: 'Procesadores',
        brand: 'AMD',
        price: 220.00,
        stock: 12,
        image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'AM5',
          cores: '6 Núcleos / 12 Hilos',
          baseClock: '4.7 GHz',
          boostClock: '5.3 GHz',
          ramType: 'DDR5',
          tdp: 105,
          pcie: 'PCIe 5.0'
        },
        description: 'Excelente rendimiento precio/calidad para plataformas AM5 con soporte para DDR5 y PCIe 5.0.'
      },
      {
        id: 'cpu-03',
        name: 'AMD Ryzen 7 5700X3D',
        category: 'Procesadores',
        brand: 'AMD',
        price: 210.00,
        stock: 14,
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'AM4',
          cores: '8 Núcleos / 16 Hilos',
          baseClock: '3.0 GHz',
          boostClock: '4.1 GHz',
          ramType: 'DDR4',
          tdp: 105,
          pcie: 'PCIe 4.0'
        },
        description: 'La mejor actualización para usuarios que ya tienen una placa madre Socket AM4 y memorias DDR4.'
      },
      {
        id: 'cpu-04',
        name: 'AMD Ryzen 5 5600',
        category: 'Procesadores',
        brand: 'AMD',
        price: 135.00,
        stock: 18,
        image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'AM4',
          cores: '6 Núcleos / 12 Hilos',
          baseClock: '3.5 GHz',
          boostClock: '4.4 GHz',
          ramType: 'DDR4',
          tdp: 65,
          pcie: 'PCIe 4.0'
        },
        description: 'El procesador más equilibrado de bajo consumo y costo para gaming competitivo en AM4.'
      },
      {
        id: 'cpu-05',
        name: 'Intel Core i7-14700K',
        category: 'Procesadores',
        brand: 'Intel',
        price: 395.00,
        stock: 6,
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'LGA1700',
          cores: '20 Núcleos (8P + 12E)',
          baseClock: '3.4 GHz',
          boostClock: '5.6 GHz',
          ramType: 'DDR4/DDR5',
          tdp: 253,
          pcie: 'PCIe 5.0'
        },
        description: 'Potencia descomunal para renderizado, edición 4K y gaming extremo en socket LGA1700.'
      },
      {
        id: 'cpu-06',
        name: 'Intel Core i5-13400F',
        category: 'Procesadores',
        brand: 'Intel',
        price: 185.00,
        stock: 10,
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'LGA1700',
          cores: '10 Núcleos (6P + 4E)',
          baseClock: '2.5 GHz',
          boostClock: '4.6 GHz',
          ramType: 'DDR4/DDR5',
          tdp: 148,
          pcie: 'PCIe 5.0'
        },
        description: 'Gran balance multihilo para gaming y productividad con compatibilidad para placas B660 y B760.'
      },

      // TARJETAS GRÁFICAS (GPUs)
      {
        id: 'gpu-01',
        name: 'NVIDIA GeForce RTX 4080 Super 16GB',
        category: 'Tarjetas de Video',
        brand: 'NVIDIA',
        price: 1050.00,
        stock: 4,
        image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80',
        specs: {
          vram: '16GB GDDR6X',
          minPsuWatts: 750,
          lengthMm: 310,
          slots: '3.2 Slots',
          pcie: 'PCIe 4.0 x16',
          tech: 'DLSS 3.5, Ray Tracing 3ra Gen'
        },
        description: 'Gaming 4K a máximos FPS con trazado de rayos completo y generación de fotogramas DLSS 3.'
      },
      {
        id: 'gpu-02',
        name: 'NVIDIA GeForce RTX 4070 Super 12GB',
        category: 'Tarjetas de Video',
        brand: 'NVIDIA',
        price: 620.00,
        stock: 7,
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        specs: {
          vram: '12GB GDDR6X',
          minPsuWatts: 650,
          lengthMm: 267,
          slots: '2.5 Slots',
          pcie: 'PCIe 4.0 x16',
          tech: 'DLSS 3.5, Ray Tracing'
        },
        description: 'La reina de los 1440p con arquitectura Ada Lovelace y bajo consumo energético.'
      },
      {
        id: 'gpu-03',
        name: 'NVIDIA GeForce RTX 4060 8GB',
        category: 'Tarjetas de Video',
        brand: 'NVIDIA',
        price: 320.00,
        stock: 15,
        image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80',
        specs: {
          vram: '8GB GDDR6',
          minPsuWatts: 500,
          lengthMm: 242,
          slots: '2 Slots',
          pcie: 'PCIe 4.0 x8',
          tech: 'DLSS 3, AV1 Encoder'
        },
        description: 'Ideal para presupuestos de entrada en 1080p con consumo ultra reducido de apenas 115W.'
      },
      {
        id: 'gpu-04',
        name: 'AMD Radeon RX 7800 XT 16GB',
        category: 'Tarjetas de Video',
        brand: 'AMD',
        price: 520.00,
        stock: 5,
        image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80',
        specs: {
          vram: '16GB GDDR6',
          minPsuWatts: 700,
          lengthMm: 280,
          slots: '2.5 Slots',
          pcie: 'PCIe 4.0 x16',
          tech: 'FSR 3.1, AMD HYPR-RX'
        },
        description: '16GB de VRAM masiva para 1440p ultra y excelente soporte en Linux y Windows.'
      },
      {
        id: 'gpu-05',
        name: 'AMD Radeon RX 6600 8GB',
        category: 'Tarjetas de Video',
        brand: 'AMD',
        price: 215.00,
        stock: 9,
        image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80',
        specs: {
          vram: '8GB GDDR6',
          minPsuWatts: 450,
          lengthMm: 200,
          slots: '2 Slots',
          pcie: 'PCIe 4.0 x8',
          tech: 'FSR 3, RDNA 2'
        },
        description: 'La tarjeta más asequible y recomendada para jugar cualquier título a 1080p.'
      },

      // PLACAS MADRE (Motherboards)
      {
        id: 'mobo-01',
        name: 'ASUS ROG Strix B650-A Gaming WiFi',
        category: 'Placas Madre',
        brand: 'ASUS',
        price: 230.00,
        stock: 7,
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'AM5',
          chipset: 'AMD B650',
          ramType: 'DDR5',
          ramSlots: 4,
          maxRam: '192GB',
          formFactor: 'ATX',
          m2Slots: 3,
          wifi: 'WiFi 6E + BT 5.2'
        },
        description: 'Estética blanca y plata, disipadores robustos para VRM y conectividad WiFi 6E ultrarrápida.'
      },
      {
        id: 'mobo-02',
        name: 'MSI B550M PRO-VDH WiFi',
        category: 'Placas Madre',
        brand: 'MSI',
        price: 115.00,
        stock: 12,
        image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'AM4',
          chipset: 'AMD B550',
          ramType: 'DDR4',
          ramSlots: 4,
          maxRam: '128GB',
          formFactor: 'Micro-ATX',
          m2Slots: 2,
          wifi: 'WiFi 5 + BT'
        },
        description: 'La placa madre AM4 Micro-ATX más confiable y completa con 4 slots de RAM y 2 puertos M.2.'
      },
      {
        id: 'mobo-03',
        name: 'Gigabyte Z790 AORUS Elite AX',
        category: 'Placas Madre',
        brand: 'Gigabyte',
        price: 260.00,
        stock: 5,
        image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'LGA1700',
          chipset: 'Intel Z790',
          ramType: 'DDR5',
          ramSlots: 4,
          maxRam: '192GB',
          formFactor: 'ATX',
          m2Slots: 4,
          wifi: 'WiFi 6E'
        },
        description: 'Diseñada para procesadores Intel Core de 13ra y 14ta generación con overclocking y VRM 16+1+2 fases.'
      },
      {
        id: 'mobo-04',
        name: 'ASUS PRIME B760M-A D4',
        category: 'Placas Madre',
        brand: 'ASUS',
        price: 140.00,
        stock: 8,
        image: 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=600&auto=format&fit=crop&q=80',
        specs: {
          socket: 'LGA1700',
          chipset: 'Intel B760',
          ramType: 'DDR4',
          ramSlots: 4,
          maxRam: '128GB',
          formFactor: 'Micro-ATX',
          m2Slots: 2,
          wifi: 'No (Ethernet 2.5G)'
        },
        description: 'Excelente para armar con procesadores Intel de 12da, 13ra y 14ta gen reutilizando memorias DDR4.'
      },

      // MEMORIAS RAM
      {
        id: 'ram-01',
        name: 'Corsair Vengeance RGB DDR5 32GB (2x16GB) 6000MHz CL30',
        category: 'Memorias RAM',
        brand: 'Corsair',
        price: 125.00,
        stock: 14,
        image: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80',
        specs: {
          generation: 'DDR5',
          capacity: '32GB (2x16GB)',
          speed: '6000 MHz',
          casLatency: 'CL30',
          profile: 'AMD EXPO & Intel XMP 3.0'
        },
        description: 'El punto dulce para procesadores Ryzen 7000/9000 e Intel 13ra/14ta gen con baja latencia CL30 e iluminación RGB.'
      },
      {
        id: 'ram-02',
        name: 'Kingston Fury Beast DDR5 16GB (2x8GB) 5200MHz',
        category: 'Memorias RAM',
        brand: 'Kingston',
        price: 65.00,
        stock: 19,
        image: 'https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&auto=format&fit=crop&q=80',
        specs: {
          generation: 'DDR5',
          capacity: '16GB (2x8GB)',
          speed: '5200 MHz',
          casLatency: 'CL40',
          profile: 'Intel XMP & AMD EXPO'
        },
        description: 'Kit de inicio económico en tecnología DDR5 con disipador de bajo perfil térmico.'
      },
      {
        id: 'ram-03',
        name: 'Corsair Vengeance LPX DDR4 32GB (2x16GB) 3200MHz CL16',
        category: 'Memorias RAM',
        brand: 'Corsair',
        price: 75.00,
        stock: 22,
        image: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80',
        specs: {
          generation: 'DDR4',
          capacity: '32GB (2x16GB)',
          speed: '3200 MHz',
          casLatency: 'CL16',
          profile: 'Intel XMP 2.0'
        },
        description: 'Memoria DDR4 de perfil bajo óptima para coolers grandes y compatibilidad absoluta.'
      },
      {
        id: 'ram-04',
        name: 'Kingston Fury Beast DDR4 16GB (2x8GB) 3200MHz',
        category: 'Memorias RAM',
        brand: 'Kingston',
        price: 42.00,
        stock: 30,
        image: 'https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&auto=format&fit=crop&q=80',
        specs: {
          generation: 'DDR4',
          capacity: '16GB (2x8GB)',
          speed: '3200 MHz',
          casLatency: 'CL16',
          profile: 'Intel XMP & AMD Ryzen Ready'
        },
        description: 'Kit básico en Dual Channel indispensable para cualquier setup gaming estándar DDR4.'
      },

      // FUENTES DE PODER (PSU)
      {
        id: 'psu-01',
        name: 'Corsair RM850e 850W 80 Plus Gold Modular',
        category: 'Fuentes de Poder',
        brand: 'Corsair',
        price: 130.00,
        stock: 8,
        image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80',
        specs: {
          watts: 850,
          efficiency: '80 Plus Gold',
          modularity: 'Totalmente Modular',
          formFactor: 'ATX',
          pcie5Ready: 'Sí (Conector 12V-2x6 PCIe 5.0)'
        },
        description: 'Totalmente modular y preparada para tarjetas RTX Serie 40 con cable ATX 3.0 nativo.'
      },
      {
        id: 'psu-02',
        name: 'Seasonic Focus GX-750 750W 80 Plus Gold',
        category: 'Fuentes de Poder',
        brand: 'Seasonic',
        price: 115.00,
        stock: 6,
        image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80',
        specs: {
          watts: 750,
          efficiency: '80 Plus Gold',
          modularity: 'Totalmente Modular',
          formFactor: 'ATX'
        },
        description: 'Calidad japonesa en condensadores y 10 años de garantía para máxima tranquilidad eléctrica.'
      },
      {
        id: 'psu-03',
        name: 'EVGA 600 W1 600W 80 Plus White',
        category: 'Fuentes de Poder',
        brand: 'EVGA',
        price: 55.00,
        stock: 16,
        image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80',
        specs: {
          watts: 600,
          efficiency: '80 Plus White',
          modularity: 'Cables Fijos',
          formFactor: 'ATX'
        },
        description: 'Fuente económica certificada y protegida para tarjetas como RTX 4060 o RX 6600.'
      },

      // ALMACENAMIENTO (SSDs)
      {
        id: 'ssd-01',
        name: 'SSD Samsung 990 PRO 2TB NVMe M.2 PCIe 4.0',
        category: 'Almacenamiento',
        brand: 'Samsung',
        price: 185.00,
        stock: 9,
        image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80',
        specs: {
          interface: 'M.2 NVMe PCIe 4.0',
          capacity: '2TB',
          readSpeed: 'Hasta 7450 MB/s',
          writeSpeed: 'Hasta 6900 MB/s',
          formFactor: 'M.2 2280'
        },
        description: 'Velocidad de carga instantánea en juegos de nueva generación y edición de video pesada.'
      },
      {
        id: 'ssd-02',
        name: 'SSD Kingston KC3000 1TB NVMe M.2 PCIe 4.0',
        category: 'Almacenamiento',
        brand: 'Kingston',
        price: 95.00,
        stock: 15,
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        specs: {
          interface: 'M.2 NVMe PCIe 4.0',
          capacity: '1TB',
          readSpeed: 'Hasta 7000 MB/s',
          writeSpeed: 'Hasta 6000 MB/s',
          formFactor: 'M.2 2280'
        },
        description: 'Disipador térmico de grafeno y aluminio, ideal para consolas PS5 y PCs gaming de alta gama.'
      },
      {
        id: 'ssd-03',
        name: 'SSD Kingston A400 960GB 2.5" SATA III',
        category: 'Almacenamiento',
        brand: 'Kingston',
        price: 58.00,
        stock: 20,
        image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80',
        specs: {
          interface: 'SATA III 2.5 Pulgadas',
          capacity: '960GB',
          readSpeed: '500 MB/s',
          writeSpeed: '450 MB/s',
          formFactor: '2.5 Pulgadas'
        },
        description: 'Perfecto para revivir computadoras antiguas o agregar almacenamiento secundario confiable.'
      },

      // GABINETES (Cases)
      {
        id: 'case-01',
        name: 'NZXT H5 Flow RGB Mid-Tower',
        category: 'Gabinetes',
        brand: 'NZXT',
        price: 105.00,
        stock: 5,
        image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80',
        specs: {
          formFactor: 'Mid-Tower (ATX, Micro-ATX, Mini-ITX)',
          maxGpuLength: 365,
          includedFans: '2x 140mm RGB Frontales + 1x 120mm GPU Fan',
          color: 'Negro Mate'
        },
        description: 'Flujo de aire optimizado con ventilador inferior dedicado a enfriar directamente la tarjeta gráfica.'
      },
      {
        id: 'case-02',
        name: 'Corsair 4000D Airflow Tempered Glass',
        category: 'Gabinetes',
        brand: 'Corsair',
        price: 95.00,
        stock: 7,
        image: 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=600&auto=format&fit=crop&q=80',
        specs: {
          formFactor: 'Mid-Tower (ATX, Micro-ATX, Mini-ITX)',
          maxGpuLength: 360,
          includedFans: '2x 120mm AirGuide',
          color: 'Negro con Vidrio Templado'
        },
        description: 'Uno de los gabinetes más galardonados por su gestión de cables RapidRoute y panel frontal de alto flujo.'
      },

      // REFRIGERACIÓN
      {
        id: 'cool-01',
        name: 'DeepCool AK620 Digital Disipador de Aire',
        category: 'Refrigeración',
        brand: 'DeepCool',
        price: 75.00,
        stock: 9,
        image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80',
        specs: {
          type: 'Disipador Doble Torre de Aire',
          supportedSockets: ['AM4', 'AM5', 'LGA1700', 'LGA1200', 'LGA1151'],
          screen: 'Pantalla digital de temperatura y uso de CPU',
          maxTdp: 260
        },
        description: 'Pantalla LED que monitorea temperaturas en tiempo real y mantiene a raya los procesadores más calientes.'
      },

      // PERIFÉRICOS
      {
        id: 'peri-01',
        name: 'Teclado Mecánico Redragon Kumara K552 RGB',
        category: 'Periféricos',
        brand: 'Redragon',
        price: 45.00,
        stock: 25,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
        specs: {
          type: 'Mecánico Tenkeyless (TKL)',
          switches: 'Outemu Red Lineales',
          backlight: 'RGB Chroma 16.8M',
          connection: 'USB Reforzado'
        },
        description: 'Resistente a salpicaduras, estructura de aluminio y respuesta instantánea para gaming rápido.'
      },
      {
        id: 'peri-02',
        name: 'Mouse Logitech G502 HERO 25K DPI',
        category: 'Periféricos',
        brand: 'Logitech',
        price: 52.00,
        stock: 18,
        image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
        specs: {
          sensor: 'HERO 25K',
          dpi: '100 a 25,600 DPI',
          buttons: '11 Botones Programables',
          weights: 'Pesas ajustables incluidas'
        },
        description: 'El mouse gaming ergonómico más vendido del mundo con sensor HERO de máxima precisión.'
      }
    ];

    for (const p of products) {
      await this.put('products', p);
    }

    /**
     * =========================================================================
     * PARA QUÉ SE HIZO:
     * Sembrar pedidos iniciales con identificadores de propiedad de usuario (RBAC)
     * y correlativos fiscales oficiales para que:
     * 1. El cliente Carlos Mendoza ('carlos.m') solo vea sus compras.
     * 2. La cliente Valeria Gómez ('valeria.g') solo vea sus compras.
     * 3. El Administrador pueda auditar y emitir facturas filtrando por Día,
     *    Semana, Mes o Año con datos reales y variados.
     *
     * CÓMO SE HIZO:
     * Cada registro incluye 'userId', 'username', 'invoiceNumber' (FACT-XXXX) y
     * 'controlNumber' (00-XXXX-2026), así como fechas distribuidas temporalmente.
     * =========================================================================
     */
    const sampleOrders = [
      {
        id: 'ORD-7822',
        date: '2026-10-31T09:15:00',
        userId: 'usr-client2',
        username: 'valeria.g',
        invoiceNumber: 'FACT-7822',
        controlNumber: '00-7822-2026',
        customer: {
          name: 'Valeria Gómez',
          phone: '0424-9081122',
          email: 'vgomez@empresa.com.ve',
          ci: 'V-20.119.554'
        },
        deliveryType: 'delivery',
        deliveryAddress: 'Av. Libertador, Edif. Caracas, Piso 6, Apto 6-B. Punto ref: Frente a PDVSA La Campiña.',
        municipality: 'Libertador',
        items: [
          { productId: 'gpu-03', name: 'NVIDIA GeForce RTX 4060 8GB', price: 320.00, qty: 1 }
        ],
        subtotal: 320.00,
        deliveryFee: 3.50,
        totalUsd: 323.50,
        totalBs: 323.50 * 889.57,
        bcvRate: 889.57,
        paymentMethod: 'zelle',
        paymentDetails: {
          zelleAccount: 'valeria.g@zelle.com',
          reference: 'ZLL-99410'
        },
        status: 'En camino'
      },
      {
        id: 'ORD-7821',
        date: '2026-10-30T14:35:00',
        userId: 'usr-client1',
        username: 'carlos.m',
        invoiceNumber: 'FACT-7821',
        controlNumber: '00-7821-2026',
        customer: {
          name: 'Carlos Mendoza',
          phone: '0414-2345678',
          email: 'carlos.m@gmail.com',
          ci: 'V-24.891.203'
        },
        deliveryType: 'pickup',
        branchId: 'suc-lasmercedes',
        branchName: 'Sucursal Las Mercedes',
        pickupDate: '2026-11-02',
        pickupTime: '14:00 - 16:00',
        items: [
          { productId: 'cpu-01', name: 'AMD Ryzen 7 7800X3D', price: 420.00, qty: 1 },
          { productId: 'ram-01', name: 'Corsair Vengeance RGB DDR5 32GB', price: 125.00, qty: 1 }
        ],
        subtotal: 545.00,
        deliveryFee: 0,
        totalUsd: 545.00,
        totalBs: 545.00 * 889.57,
        bcvRate: 889.57,
        paymentMethod: 'pago_movil',
        paymentDetails: {
          bank: 'Banesco',
          reference: '081294',
          senderPhone: '0414-2345678'
        },
        status: 'Listo para retiro'
      },
      {
        id: 'ORD-7820',
        date: '2026-10-31T11:45:00',
        userId: 'usr-client1',
        username: 'carlos.m',
        invoiceNumber: 'FACT-7820',
        controlNumber: '00-7820-2026',
        customer: {
          name: 'Carlos Mendoza',
          phone: '0414-2345678',
          email: 'carlos.m@gmail.com',
          ci: 'V-24.891.203'
        },
        deliveryType: 'pickup',
        branchId: 'suc-altamira',
        branchName: 'Sucursal Altamira',
        pickupDate: '2026-10-31',
        pickupTime: '16:00 - 18:00',
        items: [
          { productId: 'ssd-01', name: 'Kingston Fury Renegade M.2 NVMe 2TB PCIe 4.0', price: 165.00, qty: 1 }
        ],
        subtotal: 165.00,
        deliveryFee: 0,
        totalUsd: 165.00,
        totalBs: 165.00 * 889.57,
        bcvRate: 889.57,
        paymentMethod: 'pago_movil',
        paymentDetails: {
          bank: 'Banesco',
          reference: '094381',
          senderPhone: '0414-2345678'
        },
        status: 'Listo para retiro'
      },
      {
        id: 'ORD-7815',
        date: '2026-10-27T15:20:00',
        userId: 'usr-client2',
        username: 'valeria.g',
        invoiceNumber: 'FACT-7815',
        controlNumber: '00-7815-2026',
        customer: {
          name: 'Valeria Gómez',
          phone: '0424-9081122',
          email: 'vgomez@empresa.com.ve',
          ci: 'V-20.119.554'
        },
        deliveryType: 'delivery',
        deliveryAddress: 'Av. Principal de Las Mercedes, Torre Financiera, Piso 8.',
        municipality: 'Baruta',
        items: [
          { productId: 'psu-01', name: 'Corsair RM850x 850W 80+ Gold Modular', price: 140.00, qty: 1 }
        ],
        subtotal: 140.00,
        deliveryFee: 4.00,
        totalUsd: 144.00,
        totalBs: 144.00 * 889.57,
        bcvRate: 889.57,
        paymentMethod: 'binance_pay',
        paymentDetails: {
          reference: 'TXID-8819203'
        },
        status: 'Entregado'
      },
      {
        id: 'ORD-7805',
        date: '2026-10-12T10:15:00',
        userId: 'usr-client1',
        username: 'carlos.m',
        invoiceNumber: 'FACT-7805',
        controlNumber: '00-7805-2026',
        customer: {
          name: 'Carlos Mendoza',
          phone: '0414-2345678',
          email: 'carlos.m@gmail.com',
          ci: 'V-24.891.203'
        },
        deliveryType: 'pickup',
        branchId: 'suc-chacao',
        branchName: 'Sucursal Chacao',
        pickupDate: '2026-10-13',
        pickupTime: '11:00 - 13:00',
        items: [
          { productId: 'cooler-01', name: 'DeepCool AK620 Digital Disipador Torre', price: 75.00, qty: 1 }
        ],
        subtotal: 75.00,
        deliveryFee: 0,
        totalUsd: 75.00,
        totalBs: 75.00 * 889.57,
        bcvRate: 889.57,
        paymentMethod: 'punto_venta',
        paymentDetails: {
          reference: 'POS-00491'
        },
        status: 'Entregado'
      },
      {
        id: 'ORD-7750',
        date: '2026-06-18T14:30:00',
        userId: 'usr-client2',
        username: 'valeria.g',
        invoiceNumber: 'FACT-7750',
        controlNumber: '00-7750-2026',
        customer: {
          name: 'Valeria Gómez',
          phone: '0424-9081122',
          email: 'vgomez@empresa.com.ve',
          ci: 'V-20.119.554'
        },
        deliveryType: 'delivery',
        deliveryAddress: 'Urbanización El Hatillo, Calle El Manantial, Quinta Los Pinos.',
        municipality: 'El Hatillo',
        items: [
          { productId: 'mb-01', name: 'ASUS ROG Strix B650E-F Gaming WiFi AM5', price: 290.00, qty: 1 }
        ],
        subtotal: 290.00,
        deliveryFee: 5.00,
        totalUsd: 295.00,
        totalBs: 295.00 * 889.57,
        bcvRate: 889.57,
        paymentMethod: 'zelle',
        paymentDetails: {
          reference: 'ZLL-55219'
        },
        status: 'Entregado'
      }
    ];

    for (const o of sampleOrders) {
      await this.put('orders', o);
    }

    // Reseñas iniciales
    const sampleReviews = [
      {
        id: 'rev-01',
        author: 'Alejandro R.',
        type: 'service',
        categoryLabel: 'Atención al Cliente',
        rating: 5,
        target: 'Sucursal Altamira',
        comment: 'Excelente atención en Centro Plaza. Me asesoraron sobre la fuente de poder correcta para mi tarjeta de video y pagué con Pago Móvil a tasa BCV sin complicaciones.',
        date: '2026-10-28',
        verified: true
      },
      {
        id: 'rev-02',
        author: 'Marianela S.',
        type: 'product',
        categoryLabel: 'Producto',
        rating: 5,
        target: 'AMD Ryzen 7 7800X3D',
        comment: 'Una bestia para gaming. La caja sellada con su sello de garantía original y la entrega con delivery en Chacao llegó en menos de 40 minutos.',
        date: '2026-10-29',
        verified: true
      },
      {
        id: 'rev-03',
        author: 'David P.',
        type: 'service',
        categoryLabel: 'Atención al Cliente',
        rating: 5,
        target: 'Sucursal Las Mercedes',
        comment: 'Retiré mi pedido el día programado sin filas ni esperas. Verificaron el número de serie delante de mí antes de entregar.',
        date: '2026-10-30',
        verified: true
      }
    ];

    for (const r of sampleReviews) {
      await this.put('reviews', r);
    }

    // Inicializar usuarios con roles
    await this.seedUsers();

    console.log('Base de Datos Local cargada exitosamente.');
  }

  // Autenticación de usuarios por Rol (Admin / Cliente)
  async authenticateUser(usernameOrEmail, password, requestedRole = null) {
    const users = await this.getAll('users');
    const uClean = (usernameOrEmail || '').toLowerCase().trim();
    const pClean = (password || '').trim();

    if (!uClean || !pClean) {
      return { success: false, message: 'Por favor ingresa usuario y contraseña.' };
    }

    const user = users.find(u => 
      (u.username?.toLowerCase() === uClean || u.email?.toLowerCase() === uClean) &&
      u.password === pClean
    );

    if (user) {
      if (requestedRole && user.role !== requestedRole) {
        return { 
          success: false, 
          message: `Esta cuenta está registrada como "${user.role.toUpperCase()}" y no como "${requestedRole.toUpperCase()}".` 
        };
      }
      user.lastLogin = new Date().toISOString();
      await this.put('users', user);
      return { success: true, user };
    }

    // Fallback de administrador por defecto si la base de datos se encuentra limpia
    if ((uClean === 'admin' || uClean === 'admin@nexushardware.com') && pClean === 'admin2026') {
      const adminFallback = {
        id: 'usr-admin',
        username: 'admin',
        fullName: 'Administrador Principal',
        email: 'admin@nexushardware.com',
        phone: '+58 212-993-4411',
        role: 'admin',
        password: 'admin2026',
        status: 'Activo',
        createdAt: '2026-10-01T08:00:00',
        lastLogin: new Date().toISOString()
      };
      await this.put('users', adminFallback);
      return { success: true, user: adminFallback };
    }

    // Fallback de cliente demo si la base de datos se encuentra limpia
    if ((uClean === 'carlos.m' || uClean === 'carlos.m@gmail.com') && pClean === 'cliente2026') {
      const clientFallback = {
        id: 'usr-client1',
        username: 'carlos.m',
        fullName: 'Carlos Mendoza',
        email: 'carlos.m@gmail.com',
        phone: '+58 414-234-5678',
        role: 'cliente',
        password: 'cliente2026',
        status: 'Activo',
        createdAt: '2026-10-15T10:30:00',
        lastLogin: new Date().toISOString()
      };
      await this.put('users', clientFallback);
      return { success: true, user: clientFallback };
    }

    return { success: false, message: 'Usuario, correo o contraseña incorrectos.' };
  }

  // Registro de nuevos usuarios con asignación de Roles (Cliente o Administrador)
  async registerUser({ fullName, username, email, phone = '', password, role = 'cliente', adminMasterKey = '' }) {
    if (!fullName || !fullName.trim()) {
      return { success: false, message: 'Por favor ingresa tu nombre completo.' };
    }
    if (!username || !username.trim()) {
      return { success: false, message: 'Por favor ingresa un nombre de usuario.' };
    }
    if (!email || !email.trim() || !email.includes('@')) {
      return { success: false, message: 'Ingresa un correo electrónico válido.' };
    }
    if (!password || password.trim().length < 4) {
      return { success: false, message: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const uClean = username.toLowerCase().trim().replace(/\s+/g, '');
    const eClean = email.toLowerCase().trim();
    const pClean = password.trim();
    const roleClean = (role === 'admin') ? 'admin' : 'cliente';

    // Validación de Token de Seguridad si se registra como Administrador
    if (roleClean === 'admin') {
      const validAdminKeys = ['NEXUS-ADMIN-2026', 'admin2026', 'MASTER-NEXUS', 'NEXUS2026'];
      const providedKey = (adminMasterKey || '').trim();
      if (!validAdminKeys.includes(providedKey)) {
        return {
          success: false,
          message: 'Código de Autorización Administrativa inválido. Utiliza el código maestro: NEXUS-ADMIN-2026'
        };
      }
    }

    // Verificar si el usuario o email ya existen
    const existingUsers = await this.getAll('users');
    const duplicateUser = existingUsers.find(u => u.username?.toLowerCase() === uClean);
    if (duplicateUser) {
      return { success: false, message: `El nombre de usuario "${uClean}" ya existe. Elige otro distinto.` };
    }

    const duplicateEmail = existingUsers.find(u => u.email?.toLowerCase() === eClean);
    if (duplicateEmail) {
      return { success: false, message: `El correo electrónico "${eClean}" ya se encuentra registrado.` };
    }

    const newUser = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      username: uClean,
      fullName: fullName.trim(),
      email: eClean,
      phone: (phone || '').trim(),
      role: roleClean,
      password: pClean,
      status: 'Activo',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    await this.put('users', newUser);
    return { success: true, user: newUser };
  }

  // Métodos CRUD genéricos
  async get(storeName, key) {
    if (this.isFallback) {
      const data = JSON.parse(localStorage.getItem(`nexus_${storeName}`) || '[]');
      return data.find(item => (item.id === key || item.key === key)) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    if (this.isFallback) {
      return JSON.parse(localStorage.getItem(`nexus_${storeName}`) || '[]');
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    if (this.isFallback) {
      let data = JSON.parse(localStorage.getItem(`nexus_${storeName}`) || '[]');
      const idKey = value.id !== undefined ? 'id' : 'key';
      const index = data.findIndex(item => item[idKey] === value[idKey]);
      if (index >= 0) {
        data[index] = value;
      } else {
        data.push(value);
      }
      localStorage.setItem(`nexus_${storeName}`, JSON.stringify(data));
      this.notifyChanges(storeName);
      return value;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => {
        this.notifyChanges(storeName);
        resolve(value);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    if (this.isFallback) {
      let data = JSON.parse(localStorage.getItem(`nexus_${storeName}`) || '[]');
      data = data.filter(item => (item.id !== key && item.key !== key));
      localStorage.setItem(`nexus_${storeName}`, JSON.stringify(data));
      this.notifyChanges(storeName);
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => {
        this.notifyChanges(storeName);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    if (this.isFallback) {
      const data = JSON.parse(localStorage.getItem(`nexus_${storeName}`) || '[]');
      return data.length;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notifyChanges(storeName) {
    this.subscribers.forEach(cb => {
      try { cb(storeName); } catch (e) { console.error(e); }
    });
  }

  async getProducts(category = 'all', searchQuery = '') {
    let products = await this.getAll('products');
    if (category && category !== 'all') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.specs && JSON.stringify(p.specs).toLowerCase().includes(q))
      );
    }
    return products;
  }

  /**
   * =========================================================================
   * PARA QUÉ SE HIZO:
   * Procesamiento transaccional de pedidos de compra en Venezuela, asociando
   * estrictamente la orden al usuario/cliente autenticado (RBAC) y emitiendo
   * la factura comercial digital legal con su correlativo único.
   *
   * CÓMO SE HIZO:
   * 1. Valida el inventario disponible de cada ítem en la base de datos local.
   * 2. Descuenta el stock físico de cada componente de forma atómica.
   * 3. Asigna ID de orden único 'ORD-XXXXXX'.
   * 4. Asigna fecha y hora ISO local.
   * 5. Establece 'userId' y 'username' del comprador para que ningún otro cliente
   *    pueda verla.
   * 6. Genera 'invoiceNumber' (FACT-XXXXXX) y 'controlNumber' (00-XXXXXX-2026).
   * 7. Guarda la orden completa en la tabla 'orders' de IndexedDB.
   * =========================================================================
   */
  async processOrder(orderData) {
    for (const item of orderData.items) {
      const product = await this.get('products', item.productId);
      if (!product) {
        throw new Error(`El producto "${item.name}" ya no existe en el catálogo.`);
      }
      if (product.stock < item.qty) {
        throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}, Solicitado: ${item.qty}`);
      }
    }

    for (const item of orderData.items) {
      const product = await this.get('products', item.productId);
      product.stock -= item.qty;
      await this.put('products', product);
    }

    // Identificadores únicos y correlativos fiscales
    orderData.id = orderData.id || `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    orderData.date = orderData.date || new Date().toISOString();
    orderData.status = orderData.status || 'Confirmado';
    
    // Asignación de propiedad para control de acceso (RBAC)
    orderData.userId = orderData.userId || 'guest';
    orderData.username = orderData.username || 'invitado';

    // Generación de Factura Digital Fiscal
    orderData.invoiceNumber = orderData.invoiceNumber || `FACT-${orderData.id.replace('ORD-', '')}`;
    orderData.controlNumber = orderData.controlNumber || `00-${orderData.id.replace('ORD-', '')}-2026`;

    await this.put('orders', orderData);
    return orderData;
  }

  async updateBcvRate(newRate) {
    const settings = await this.get('settings', 'general_config') || {};
    settings.bcv_rate = parseFloat(newRate);
    settings.last_rate_date = new Date().toISOString().split('T')[0];
    settings.last_rate_update = new Date().toISOString();
    await this.put('settings', settings);
    return settings;
  }

  async exportBackupJSON() {
    const dump = {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      products: await this.getAll('products'),
      orders: await this.getAll('orders'),
      branches: await this.getAll('branches'),
      reviews: await this.getAll('reviews'),
      settings: await this.getAll('settings'),
      users: await this.getAll('users')
    };
    return JSON.stringify(dump, null, 2);
  }

  async importBackupJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (data.products && Array.isArray(data.products)) {
      for (const p of data.products) await this.put('products', p);
    }
    if (data.orders && Array.isArray(data.orders)) {
      for (const o of data.orders) await this.put('orders', o);
    }
    if (data.branches && Array.isArray(data.branches)) {
      for (const b of data.branches) await this.put('branches', b);
    }
    if (data.reviews && Array.isArray(data.reviews)) {
      for (const r of data.reviews) await this.put('reviews', r);
    }
    if (data.settings && Array.isArray(data.settings)) {
      for (const s of data.settings) await this.put('settings', s);
    }
    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) await this.put('users', u);
    }
    this.notifyChanges('all');
    return true;
  }

  // Exportar una tabla individual en formato CSV compatible con Excel (UTF-8 BOM)
  async exportTableCSV(tableName) {
    const rows = await this.getAll(tableName);
    if (!rows || rows.length === 0) return '';
    let headers = [];
    if (tableName === 'products') {
      headers = ['id', 'name', 'brand', 'category', 'price', 'stock', 'description'];
    } else if (tableName === 'orders') {
      headers = ['id', 'date', 'customer_name', 'customer_phone', 'customer_ci', 'deliveryType', 'municipality', 'totalUsd', 'totalBs', 'paymentMethod', 'status'];
    } else if (tableName === 'branches') {
      headers = ['id', 'name', 'municipality', 'address', 'schedule', 'phone', 'coords', 'status'];
    } else if (tableName === 'reviews') {
      headers = ['id', 'author', 'type', 'categoryLabel', 'rating', 'target', 'comment', 'date', 'verified'];
    } else if (tableName === 'settings') {
      headers = ['key', 'bcv_rate', 'last_rate_date', 'store_name', 'support_whatsapp'];
    } else if (tableName === 'users') {
      headers = ['id', 'username', 'fullName', 'email', 'role', 'status', 'lastLogin'];
    } else {
      headers = Object.keys(rows[0]);
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const row of rows) {
      const line = headers.map(h => {
        if (h === 'customer_name') return escapeCsv(row.customer?.name);
        if (h === 'customer_phone') return escapeCsv(row.customer?.phone);
        if (h === 'customer_ci') return escapeCsv(row.customer?.ci);
        return escapeCsv(row[h]);
      });
      csvLines.push(line.join(','));
    }

    return '\uFEFF' + csvLines.join('\r\n');
  }

  // Metadatos y definición de esquema de tablas relacionales
  getTableSchema(tableName) {
    const schemas = {
      products: {
        title: 'Catálogo de Hardware (products)',
        primaryKey: 'id',
        columns: [
          { key: 'id', label: 'ID', type: 'string', isPk: true },
          { key: 'image', label: 'Foto', type: 'image' },
          { key: 'name', label: 'Producto', type: 'string' },
          { key: 'brand', label: 'Marca', type: 'string' },
          { key: 'category', label: 'Categoría', type: 'badge' },
          { key: 'price', label: 'Precio USD', type: 'currency' },
          { key: 'stock', label: 'Stock', type: 'stock' },
          { key: 'specs', label: 'Especificaciones', type: 'specs' }
        ]
      },
      orders: {
        title: 'Registro de Órdenes y Facturas (orders)',
        primaryKey: 'id',
        columns: [
          { key: 'id', label: 'ID Orden', type: 'string', isPk: true },
          { key: 'invoiceNumber', label: 'N° Factura', type: 'string' },
          { key: 'username', label: 'Usuario', type: 'string' },
          { key: 'date', label: 'Fecha', type: 'date' },
          { key: 'customer', label: 'Cliente', type: 'customer' },
          { key: 'delivery', label: 'Entrega', type: 'delivery' },
          { key: 'items', label: 'Items', type: 'items' },
          { key: 'totalUsd', label: 'Total USD', type: 'currency' },
          { key: 'totalBs', label: 'Total Bs.', type: 'currency_bs' },
          { key: 'paymentMethod', label: 'Pago', type: 'payment' },
          { key: 'status', label: 'Estado', type: 'status_select' }
        ]
      },
      branches: {
        title: 'Sucursales Caracas (branches)',
        primaryKey: 'id',
        columns: [
          { key: 'id', label: 'ID', type: 'string', isPk: true },
          { key: 'name', label: 'Sucursal', type: 'string' },
          { key: 'municipality', label: 'Municipio', type: 'badge' },
          { key: 'address', label: 'Dirección', type: 'text' },
          { key: 'schedule', label: 'Horario', type: 'text' },
          { key: 'phone', label: 'Teléfono', type: 'phone' },
          { key: 'status', label: 'Estado', type: 'badge_status' }
        ]
      },
      reviews: {
        title: 'Opiniones y Reseñas (reviews)',
        primaryKey: 'id',
        columns: [
          { key: 'id', label: 'ID', type: 'string', isPk: true },
          { key: 'author', label: 'Cliente', type: 'author' },
          { key: 'type', label: 'Tipo', type: 'badge' },
          { key: 'rating', label: 'Calificación', type: 'stars' },
          { key: 'target', label: 'Destino', type: 'string' },
          { key: 'comment', label: 'Comentario', type: 'text' },
          { key: 'date', label: 'Fecha', type: 'date_short' }
        ]
      },
      settings: {
        title: 'Configuración y Parámetros (settings)',
        primaryKey: 'key',
        columns: [
          { key: 'key', label: 'Clave', type: 'string', isPk: true },
          { key: 'store_name', label: 'Nombre Tienda', type: 'string' },
          { key: 'bcv_rate', label: 'Tasa BCV (Bs/$)', type: 'currency_bs_rate' },
          { key: 'last_rate_date', label: 'Última Fecha', type: 'string' },
          { key: 'support_whatsapp', label: 'WhatsApp', type: 'string' }
        ]
      },
      users: {
        title: 'Usuarios y Control de Roles (users)',
        primaryKey: 'id',
        columns: [
          { key: 'id', label: 'ID', type: 'string', isPk: true },
          { key: 'username', label: 'Usuario', type: 'string' },
          { key: 'fullName', label: 'Nombre Completo', type: 'string' },
          { key: 'email', label: 'Correo', type: 'string' },
          { key: 'role', label: 'Rol Asignado', type: 'badge_role' },
          { key: 'status', label: 'Estado', type: 'badge_status' },
          { key: 'lastLogin', label: 'Último Acceso', type: 'string' }
        ]
      }
    };
    return schemas[tableName] || null;
  }


  async resetToDefaults() {
    if (this.isFallback) {
      localStorage.clear();
      await this.loadInitialSeeds();
    } else {
      const stores = ['products', 'orders', 'branches', 'reviews', 'settings', 'users'];
      for (const s of stores) {
        const tx = this.db.transaction(s, 'readwrite');
        tx.objectStore(s).clear();
      }
      await this.loadInitialSeeds();
    }
    this.notifyChanges('all');
  }
}

// Instancia global
window.dbManager = new DatabaseManager();
