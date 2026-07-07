/**
 * Tests de integración para endpoints públicos críticos.
 * Cubren los flujos que SI fallan, el sistema no sirve.
 *
 * Los mocks de DB están en src/__mocks__/db.ts
 * Se ejecutan con: npm test
 */

import request from 'supertest';
import express from 'express';

// Mockear antes de importar rutas
jest.mock('../src/db');
jest.mock('../src/services/naaloo');

import { query, mockQuery } from '../src/__mocks__/db';
import publicRoutes from '../src/routes/public';

// App mínima para los tests
const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const COMERCIO_ID = 'com-123';
const BENEFICIO_ID = 'ben-456';
const DNI = '12345678';

function mockComercio() {
  mockQuery([{ id: COMERCIO_ID, nombre: 'Farmacia Test' }]);
}

function mockTitular(overrides = {}) {
  mockQuery([{
    id: 'tit-001', dni: DNI, nombre: 'Juan', apellido: 'Pérez',
    nivel: 'junior', departamento: 'Ventas', sector: null,
    fecha_ingreso: '2022-01-01', activo: true, es_talento_popper: false,
    ...overrides,
  }]);
}

function mockBeneficioActivo(overrides = {}) {
  mockQuery([{
    id: BENEFICIO_ID, nombre: 'Descuento 20%', activo: true,
    fecha_inicio: null, fecha_fin: null,
    tipo: 'descuento', descuento: 20, valor_fijo: null,
    escala_descuentos: null, modalidad: 'descuento',
    aplica_a: 'empleado', categoria: 'salud',
    limite_uso_diario: null, limite_uso_mensual: null, limite_total: null,
    usa_limite_jerarquia: false,
    ...overrides,
  }]);
}

// ─────────────────────────────────────────────
// GET /beneficiario/:comercioId/:dni
// ─────────────────────────────────────────────
describe('GET /api/public/beneficiario/:comercioId/:dni', () => {

  test('DNI inválido (menos de 7 dígitos) → 400', async () => {
    const res = await request(app).get(`/api/public/beneficiario/${COMERCIO_ID}/123`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/DNI/i);
  });

  test('Comercio inexistente → 404', async () => {
    mockQuery([]); // comercio not found
    const res = await request(app).get(`/api/public/beneficiario/${COMERCIO_ID}/${DNI}`);
    expect(res.status).toBe(404);
  });

  test('Colaborador inactivo → 403', async () => {
    mockComercio();
    mockTitular({ activo: false });
    const res = await request(app).get(`/api/public/beneficiario/${COMERCIO_ID}/${DNI}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/inactivo/i);
  });

  test('Titular válido → 200 con beneficios', async () => {
    mockComercio();
    mockTitular();
    // beneficios del comercio
    mockQuery([{
      id: BENEFICIO_ID, nombre: 'Descuento 20%', descripcion: null,
      tipo: 'descuento', descuento: 20, valor_fijo: null,
      horario_inicio: null, horario_fin: null, nivel_minimo: 'bronce',
      origen: 'externo', categoria: 'salud', aplica_a: 'empleado',
      modalidad: 'descuento', escala_descuentos: null, restricciones: null,
      excluye_outlet: false, relaciones_familiar: null, usa_limite_jerarquia: false,
      max_invitados: 0, cubre_invitados: false,
    }]);
    // foto Naaloo
    const { buscarEmpleadoPorDni } = require('../src/__mocks__/naaloo');
    buscarEmpleadoPorDni.mockResolvedValueOnce(null);

    const res = await request(app).get(`/api/public/beneficiario/${COMERCIO_ID}/${DNI}`);
    expect(res.status).toBe(200);
    expect(res.body.beneficiario.dni).toBe(DNI);
    expect(res.body.beneficios).toHaveLength(1);
    expect(res.body.beneficios[0].tipo_descuento).toBe('descuento');
  });

  test('Beneficio gratuito → tipo_descuento = "gratuito"', async () => {
    mockComercio();
    mockTitular();
    mockQuery([{
      id: BENEFICIO_ID, nombre: 'Acceso Gratis', descripcion: null,
      tipo: 'gratuito', descuento: null, valor_fijo: null,
      horario_inicio: null, horario_fin: null, nivel_minimo: 'bronce',
      origen: 'interno', categoria: 'recreacion', aplica_a: 'empleado',
      modalidad: 'acceso', escala_descuentos: null, restricciones: null,
      excluye_outlet: false, relaciones_familiar: null, usa_limite_jerarquia: false,
      max_invitados: 0, cubre_invitados: false,
    }]);
    const { buscarEmpleadoPorDni } = require('../src/__mocks__/naaloo');
    buscarEmpleadoPorDni.mockResolvedValueOnce(null);

    const res = await request(app).get(`/api/public/beneficiario/${COMERCIO_ID}/${DNI}`);
    expect(res.status).toBe(200);
    expect(res.body.beneficios[0].tipo_descuento).toBe('gratuito');
  });

  test('Beneficio de otro aplica_a="familiar" → filtrado para titular', async () => {
    mockComercio();
    mockTitular();
    mockQuery([{
      id: BENEFICIO_ID, nombre: 'Solo familiar', tipo: 'descuento',
      descuento: 10, aplica_a: 'familiar', horario_inicio: null, horario_fin: null,
      escala_descuentos: null, usa_limite_jerarquia: false, max_invitados: 0, cubre_invitados: false,
    }]);
    const { buscarEmpleadoPorDni } = require('../src/__mocks__/naaloo');
    buscarEmpleadoPorDni.mockResolvedValueOnce(null);

    const res = await request(app).get(`/api/public/beneficiario/${COMERCIO_ID}/${DNI}`);
    expect(res.status).toBe(200);
    expect(res.body.beneficios).toHaveLength(0); // filtrado correctamente
  });
});

// ─────────────────────────────────────────────
// POST /api/public/canjear
// ─────────────────────────────────────────────
describe('POST /api/public/canjear', () => {

  const body = () => ({
    dni: DNI,
    beneficio_id: BENEFICIO_ID,
    comercio_id: COMERCIO_ID,
    monto: 1000,
  });

  test('Faltan campos requeridos → 400', async () => {
    const res = await request(app).post('/api/public/canjear').send({ dni: DNI });
    expect(res.status).toBe(400);
  });

  test('Colaborador no encontrado → 404', async () => {
    // titular not found
    mockQuery([]);
    // familiar not found
    mockQuery([]);
    // Naaloo not found (mock ya devuelve null por default)
    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(404);
  });

  test('Colaborador inactivo → 403', async () => {
    mockQuery([{ id: 'tit-001', activo: false, nombre: 'Juan', apellido: 'Pérez', motivo_baja: 'Renuncia' }]);
    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(403);
    expect(res.body.inactivo).toBe(true);
  });

  test('Beneficio no asignado al comercio → 404', async () => {
    // titular activo
    mockQuery([{ id: 'tit-001', activo: true, nombre: 'Juan', apellido: 'Pérez', motivo_baja: null }]);
    // familiar check (no es menor)
    mockQuery([]);
    // beneficio con JOIN comercio_beneficios → no encontrado
    mockQuery([]);
    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrado|no habilitado/i);
  });

  test('Beneficio vencido → 403', async () => {
    mockQuery([{ id: 'tit-001', activo: true, nombre: 'Juan', apellido: 'Pérez', motivo_baja: null }]);
    mockQuery([]); // no es menor
    // beneficio con fecha_fin en el pasado
    mockQuery([{
      id: BENEFICIO_ID, nombre: 'Ben vencido', activo: true,
      fecha_inicio: '2020-01-01',
      fecha_fin: '2020-12-31', // vencido
      descuento: 20, escala_descuentos: null, modalidad: 'descuento',
      aplica_a: 'empleado', categoria: 'salud',
      limite_uso_diario: null, limite_uso_mensual: null, limite_total: null,
      usa_limite_jerarquia: false,
    }]);
    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/venció/i);
  });

  test('Canje exitoso → 200 con código de referencia', async () => {
    // titular
    mockQuery([{ id: 'tit-001', activo: true, nombre: 'Juan', apellido: 'Pérez', motivo_baja: null }]);
    // no es menor
    mockQuery([]);
    // beneficio activo y vigente (con JOIN comercio_beneficios ok)
    mockBeneficioActivo();
    // no aplica_a='talento'
    // fecha ok (null)
    // limite_uso_diario: null
    // limite_uso_mensual: null
    // limite_total: null
    // usa_limite_jerarquia: false → skip
    // calcular descuento: datos del titular
    mockQuery([{ fecha_ingreso: '2022-01-01', es_talento_popper: false }]);
    // INSERT verificacion
    mockQuery([{ id: 'ver-001', estado: 'exitoso', codigo_referencia: 'QR-TEST-ABC', fecha_verificacion: new Date().toISOString(), monto: 1000 }]);
    // UPDATE uso_actual
    mockQuery([]);

    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(200);
    expect(res.body.exito).toBe(true);
    expect(res.body.verificacion.codigo_referencia).toBe('QR-TEST-ABC');
  });

  test('Límite diario alcanzado → 429', async () => {
    mockQuery([{ id: 'tit-001', activo: true, nombre: 'Juan', apellido: 'Pérez', motivo_baja: null }]);
    mockQuery([]); // no es menor
    mockBeneficioActivo({ limite_uso_diario: 1, limite_uso_mensual: null, limite_total: null });
    // limite_uso_diario: ya tiene 1 uso hoy
    mockQuery([{ total: '1' }]);
    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/hoy|d[ií]a/i);
  });

  test('Beneficio exclusivo Talento rechaza titular normal → 403', async () => {
    mockQuery([{ id: 'tit-001', activo: true, nombre: 'Juan', apellido: 'Pérez', motivo_baja: null }]);
    mockQuery([]); // no es menor
    mockBeneficioActivo({ aplica_a: 'talento' });
    // verificar talento → no es talento
    mockQuery([{ es_talento_popper: false }]);
    const res = await request(app).post('/api/public/canjear').send(body());
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Talento/i);
  });
});

// ─────────────────────────────────────────────
// GET /api/public/historial/:dni
// ─────────────────────────────────────────────
describe('GET /api/public/historial/:dni', () => {

  test('DNI inválido → 400', async () => {
    const res = await request(app).get('/api/public/historial/abc');
    expect(res.status).toBe(400);
  });

  test('DNI no encontrado → historial vacío (no 404)', async () => {
    mockQuery([]); // no titular
    mockQuery([]); // no familiar
    const res = await request(app).get(`/api/public/historial/${DNI}`);
    expect(res.status).toBe(200);
    expect(res.body.historial).toEqual([]);
  });

  test('Titular con canjes → retorna historial con montos reales', async () => {
    mockQuery([{ id: 'tit-001' }]); // titular encontrado
    mockQuery([{
      fecha_verificacion: '2025-03-01T10:00:00Z',
      estado: 'exitoso',
      codigo_referencia: 'QR-AAA',
      monto_descuento: 200,
      monto_final: 800,
      monto_original: 1000,
      beneficio_nombre: 'Farmacia 20%',
      beneficio_tipo: 'descuento',
      tipo_descuento: 'descuento',
      valor_fijo: null,
      comercio_nombre: 'Farmacia Test',
    }]);
    const res = await request(app).get(`/api/public/historial/${DNI}`);
    expect(res.status).toBe(200);
    expect(res.body.historial).toHaveLength(1);
    expect(res.body.historial[0].monto_descuento).toBe(200);
    expect(res.body.historial[0].tipo_descuento).toBe('descuento');
  });
});

// ─────────────────────────────────────────────
// MODO VITRINA (TV) — GET /tv/:qrCode y GET /tv
// ─────────────────────────────────────────────
describe('GET /api/public/tv/:qrCode (vitrina comercio)', () => {

  test('Comercio inexistente → 404', async () => {
    mockQuery([]); // comercio not found
    const res = await request(app).get('/api/public/tv/QR-NOEXISTE');
    expect(res.status).toBe(404);
  });

  test('Comercio válido → catálogo sin datos personales', async () => {
    mockQuery([{ id: COMERCIO_ID, nombre: 'Farmacia Test', direccion: 'Av. Test 1', ciudad: 'Ushuaia', logo: null }]);
    mockQuery([{
      id: BENEFICIO_ID, nombre: 'Descuento Salud', descripcion: 'En medicamentos',
      tipo: 'descuento', descuento: 20, valor_fijo: null,
      categoria: 'salud', origen: 'externo', aplica_a: 'ambos',
      escala_descuentos: { tiers: [{ antiguedad_min_meses: 0, porcentaje: 20 }, { antiguedad_min_meses: 36, porcentaje: 35 }] },
      horario_inicio: null, horario_fin: null, restricciones: null, excluye_outlet: false,
    }]);

    const res = await request(app).get('/api/public/tv/QR-FARMACIA');
    expect(res.status).toBe(200);
    expect(res.body.comercio.nombre).toBe('Farmacia Test');
    expect(res.body.qr_code).toBe('QR-FARMACIA');
    expect(res.body.beneficios).toHaveLength(1);
    // descuento_max sale de la escala (35 > 20 base)
    expect(res.body.beneficios[0].descuento_max).toBe(35);
    // nunca datos personales
    expect(JSON.stringify(res.body)).not.toMatch(/dni|beneficiario|legajo/i);
  });
});

describe('GET /api/public/tv (cartelera general)', () => {

  test('Devuelve beneficios vigentes con sus comercios', async () => {
    mockQuery([{
      id: BENEFICIO_ID, nombre: 'Pase de Esquí', descripcion: 'Temporada completa',
      tipo: 'gratuito', descuento: null, valor_fijo: null,
      categoria: 'skipass', origen: 'interno', aplica_a: 'empleado',
      escala_descuentos: null, horario_inicio: null, horario_fin: null,
      restricciones: null, excluye_outlet: false,
      comercios: ['Boletería Cerro Castor'],
    }]);

    const res = await request(app).get('/api/public/tv');
    expect(res.status).toBe(200);
    expect(res.body.beneficios).toHaveLength(1);
    expect(res.body.beneficios[0].comercios).toEqual(['Boletería Cerro Castor']);
    expect(res.body.beneficios[0].tipo).toBe('gratuito');
  });
});
