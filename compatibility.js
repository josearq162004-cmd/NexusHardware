/**
 * CompatibilityEngine - Nexus Hardware Caracas
 * Motor de análisis de compatibilidad técnica entre las especificaciones
 * de la PC del cliente y el catálogo de hardware de la tienda.
 */

class CompatibilityEngine {
  constructor() {
    this.userSpecs = {
      socket: 'AM4',          // AM4, AM5, LGA1700, LGA1200, LGA1151, any
      ramType: 'DDR4',        // DDR4, DDR5
      psuWatts: 600,          // 400, 500, 600, 750, 850, 1000
      formFactor: 'ATX',      // ATX, Micro-ATX, Mini-ITX
      storageSlot: 'm2_nvme', // m2_nvme, sata_ssd
      targetUpgrade: 'all'    // all, cpu, gpu, ram, mobo, psu, ssd
    };
  }

  setUserSpecs(specs) {
    this.userSpecs = { ...this.userSpecs, ...specs };
  }

  // Evalúa un producto contra las especificaciones del usuario
  evaluateProduct(product) {
    const { socket, ramType, psuWatts, formFactor } = this.userSpecs;
    const p = product;
    const cat = p.category;

    let status = 'compatible'; // 'compatible' | 'warning' | 'incompatible'
    let reason = 'Totalmente compatible con tu sistema actual.';
    let details = [];

    // 1. PROCESADORES (CPUs)
    if (cat === 'Procesadores') {
      const prodSocket = p.specs?.socket;
      const prodRam = p.specs?.ramType || '';

      if (socket !== 'any' && prodSocket !== socket) {
        status = 'incompatible';
        reason = `Incompatible de socket: Este procesador usa Socket ${prodSocket}, mientras tu PC tiene Socket ${socket}.`;
      } else if (ramType !== 'any' && prodRam.includes('DDR5') && !prodRam.includes('DDR4') && ramType === 'DDR4') {
        status = 'incompatible';
        reason = `Incompatible de RAM: Este procesador (${p.name}) requiere memoria DDR5 y tu PC usa DDR4.`;
      } else {
        status = 'compatible';
        reason = `Compatible con tu placa madre Socket ${socket} y memoria ${ramType}.`;
      }
    }

    // 2. PLACAS MADRE (Motherboards)
    else if (cat === 'Placas Madre') {
      const prodSocket = p.specs?.socket;
      const prodRam = p.specs?.ramType;
      const prodForm = p.specs?.formFactor;

      if (socket !== 'any' && prodSocket !== socket) {
        status = 'incompatible';
        reason = `Socket diferente: Esta placa tiene Socket ${prodSocket}, no compatible con tu procesador ${socket}.`;
      } else if (ramType !== 'any' && prodRam !== ramType && !prodRam.includes(ramType)) {
        status = 'incompatible';
        reason = `Tipo de memoria no soportado: Esta placa requiere ${prodRam}, tus módulos son ${ramType}.`;
      } else if (formFactor === 'Mini-ITX' && prodForm === 'ATX') {
        status = 'warning';
        reason = `Tamaño: Esta placa es formato ATX grande, verifica que quepa en tu gabinete actual.`;
      } else {
        status = 'compatible';
        reason = `100% compatible con tu Socket ${socket} y memoria ${ramType}.`;
      }
    }

    // 3. TARJETAS DE VIDEO (GPUs)
    else if (cat === 'Tarjetas de Video') {
      const minPsu = p.specs?.minPsuWatts || 500;
      const userPsu = parseInt(psuWatts) || 500;

      if (userPsu < minPsu) {
        status = 'warning';
        reason = `Alerta de Fuente: Esta GPU recomienda al menos ${minPsu}W. Tu fuente de ${userPsu}W podría quedarse corta bajo carga máxima.`;
      } else {
        status = 'compatible';
        reason = `Compatible: Tu fuente de ${userPsu}W soporta perfectamente el requerimiento mínimo (${minPsu}W). Conexión PCIe universal.`;
      }
    }

    // 4. MEMORIAS RAM
    else if (cat === 'Memorias RAM') {
      const prodGen = p.specs?.generation;
      if (ramType !== 'any' && prodGen !== ramType) {
        status = 'incompatible';
        reason = `Incompatibilidad física de slot: Tu sistema utiliza memoria ${ramType}, y este módulo es ${prodGen}. Las ranuras son físicamente distintas.`;
      } else {
        status = 'compatible';
        reason = `Compatible: Módulo ${prodGen} apto para la velocidad y slots de tu plataforma.`;
      }
    }

    // 5. FUENTES DE PODER (PSU)
    else if (cat === 'Fuentes de Poder') {
      // Las fuentes ATX estándar son compatibles universalmente
      status = 'compatible';
      reason = `Compatible universalmente: Conectores estándar ATX 24 pines y PCIe para tu placa madre y componentes.`;
    }

    // 6. ALMACENAMIENTO (SSDs)
    else if (cat === 'Almacenamiento') {
      const isM2 = p.specs?.interface?.includes('M.2');
      if (isM2 && this.userSpecs.storageSlot === 'sata_only') {
        status = 'warning';
        reason = `Verifica si tu placa madre tiene puerto M.2 disponible antes de adquirir este NVMe.`;
      } else {
        status = 'compatible';
        reason = `Compatible: Interfaz estándar para arranque veloz del sistema operativo y juegos.`;
      }
    }

    // 7. GABINETES Y REFRIGERACIÓN
    else if (cat === 'Gabinetes' || cat === 'Refrigeración') {
      if (cat === 'Refrigeración' && p.specs?.supportedSockets) {
        if (!p.specs.supportedSockets.includes(socket) && socket !== 'any') {
          status = 'warning';
          reason = `Verifica incluir el bracket de anclaje para tu Socket ${socket}.`;
        } else {
          status = 'compatible';
          reason = `Compatible con el anclaje térmico de tu procesador ${socket}.`;
        }
      } else {
        status = 'compatible';
        reason = `Compatible con componentes estándar ATX/Micro-ATX.`;
      }
    }

    // 8. PERIFÉRICOS
    else {
      status = 'compatible';
      reason = `Universalmente compatible mediante conexión USB/Plug & Play.`;
    }

    return {
      product: p,
      status,
      reason
    };
  }

  // Analizar todo el catálogo
  analyzeInventory(allProducts) {
    const results = {
      compatible: [],
      warning: [],
      incompatible: []
    };

    allProducts.forEach(product => {
      const evaluated = this.evaluateProduct(product);
      results[evaluated.status].push(evaluated);
    });

    return results;
  }
}

// Instancia global
window.compatibilityEngine = new CompatibilityEngine();
