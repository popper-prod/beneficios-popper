/**
 * Tests de la reconciliación de bajas del sync con Naaloo.
 *
 * Contexto: el endpoint /personal/ de Naaloo devuelve SOLO empleados activos y el
 * roster completo. Por eso las bajas se detectan por AUSENCIA en el feed, no por
 * un flag activo=false. Ver services/syncService.ts (bloque "RECONCILIACIÓN DE BAJAS").
 */

// El moduleNameMapper de jest.config redirige `../db` (usado por syncService) a este
// mismo mock, así que importándolo directo pinchamos la instancia que usa el sync.
import { query } from '../src/__mocks__/db';
import { runSyncNaaloo } from '../src/services/syncService';

const mockQuery = query as jest.Mock;

// Empleado tal como lo devuelve Naaloo (solo los campos que usa el sync)
function empNaaloo(dni: string, extra: Record<string, any> = {}) {
  return {
    id: Number(dni),
    dni,
    nombre: `Nombre${dni}`,
    apellido: `Apellido${dni}`,
    nombreCompleto: `Nombre${dni} Apellido${dni}`,
    activo: true, // Naaloo nunca devuelve inactivos
    fechaIngreso: '2020-01-01',
    email: null,
    telefonos: '',
    area: 'Ventas',
    ...extra,
  };
}

// Fila local en beneficiarios
function local(id: string, dni: string, extra: Record<string, any> = {}) {
  return { id, dni, activo: true, naaloo_id: Number(dni), origen: 'naaloo', ...extra };
}

// Configura los mocks de query (localMap) y fetch (feed de Naaloo)
function setup(feed: any[], localRows: any[]) {
  const SELECT_LOCAL = 'SELECT id, dni, activo, naaloo_id, origen FROM beneficiarios';
  mockQuery.mockImplementation((sql: string) => {
    if (typeof sql === 'string' && sql.includes(SELECT_LOCAL)) {
      return Promise.resolve({ rows: localRows });
    }
    // Cualquier otra query (ALTER, UPDATE, INSERT logs, etc.) → sin filas
    return Promise.resolve({ rows: [] });
  });

  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: feed }),
  });
}

// Devuelve las llamadas a query cuyo SQL matchea el regex
function queriesMatching(re: RegExp): any[][] {
  return mockQuery.mock.calls.filter((c) => typeof c[0] === 'string' && re.test(c[0]));
}

describe('runSyncNaaloo — reconciliación de bajas', () => {
  test('da de baja a un beneficiario local activo que ya no aparece en el feed de Naaloo', async () => {
    // Feed: 111 y 222 siguen activos. 333 (Pirovano) ya no está → debe darse de baja.
    const feed = [empNaaloo('111'), empNaaloo('222')];
    const localRows = [
      local('id-111', '111'),
      local('id-222', '222'),
      local('id-333', '333'), // ausente del feed → baja
      local('id-999', '999', { naaloo_id: null, origen: 'local' }), // admin manual → intocable
    ];
    setup(feed, localRows);

    const result = await runSyncNaaloo('Test');

    expect(result.resumen.bajasReconciliadas).toBe(1);
    expect(result.resumen.reconciliacionOmitida).toBe(false);

    const bajas = queriesMatching(/UPDATE beneficiarios SET activo=FALSE.*reconciliaci/i);
    expect(bajas).toHaveLength(1);
    // Solo 333 se dio de baja; 999 (origen local) NO
    const idsBaja = bajas[0][1] as string[];
    expect(idsBaja).toContain('id-333');
    expect(idsBaja).not.toContain('id-999');
  });

  test('NO reconcilia cuando ninguno falta (todos los locales siguen en el feed)', async () => {
    const feed = [empNaaloo('111'), empNaaloo('222')];
    const localRows = [local('id-111', '111'), local('id-222', '222')];
    setup(feed, localRows);

    const result = await runSyncNaaloo('Test');

    expect(result.resumen.bajasReconciliadas).toBe(0);
    expect(result.resumen.reconciliacionOmitida).toBe(false);
    expect(queriesMatching(/UPDATE beneficiarios SET activo=FALSE.*reconciliaci/i)).toHaveLength(0);
  });

  test('SALVAGUARDA: omite la reconciliación si las bajas candidatas superan el umbral (feed parcial)', async () => {
    // Feed trae solo 1 activo, pero localmente hay 30 activos → 29 candidatos a baja.
    // umbral = max(20, ceil(30*0.15)=5) = 20. 29 > 20 → se omite y NO se da de baja a nadie.
    const feed = [empNaaloo('1')];
    const localRows = Array.from({ length: 30 }, (_, i) => local(`id-${i}`, String(i)));
    // aseguremos que el dni '1' del feed exista localmente para que sea un match real
    localRows[1] = local('id-1', '1');
    setup(feed, localRows);

    const result = await runSyncNaaloo('Test');

    expect(result.resumen.reconciliacionOmitida).toBe(true);
    expect(result.resumen.bajasReconciliadas).toBe(0);
    expect(queriesMatching(/UPDATE beneficiarios SET activo=FALSE.*reconciliaci/i)).toHaveLength(0);
  });
});
