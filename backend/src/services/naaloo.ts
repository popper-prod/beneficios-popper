// ============================================
// Integración con API de Naaloo
// ============================================

const NAALOO_API_URL = 'https://backend.naaloo.com';
const NAALOO_TOKEN = process.env.NAALOO_TOKEN || '';

interface NaalooEmpleado {
  id: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  dni: string;
  legajo: string;
  image: string;
  imageFr: string;
  area?: string;
  sector?: string;
  cargo?: string;
  activo: boolean;
  fechaIngreso: string;
  email: string;
  telefonos: string;
  cuil: string;
  fechaNacimiento: string;
  genero: number;
  oficinaNombre: string;
}

interface NaalooResponse {
  data: NaalooEmpleado[];
  totalCount?: number;
}

// Buscar empleado por DNI en Naaloo
export async function buscarEmpleadoPorDni(dni: string): Promise<NaalooEmpleado | null> {
  try {
    // Naaloo no tiene endpoint de búsqueda por DNI directo
    // Traemos la lista y filtramos
    const response = await fetch(`${NAALOO_API_URL}/personal/?page=1&limit=1000`, {
      headers: {
        'Authorization': `Bearer ${NAALOO_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Naaloo API error: ${response.status}`);
      return null;
    }

    const data: NaalooResponse = await response.json();
    const empleado = data.data.find(e => e.dni === dni && e.activo);

    return empleado || null;
  } catch (error) {
    console.error('Error conectando con Naaloo:', error);
    return null;
  }
}

// Obtener todos los empleados activos de Naaloo
export async function obtenerEmpleadosActivos(): Promise<NaalooEmpleado[]> {
  try {
    const allEmpleados: NaalooEmpleado[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${NAALOO_API_URL}/personal/?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${NAALOO_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) break;

      const data: NaalooResponse = await response.json();

      if (data.data.length === 0) {
        hasMore = false;
      } else {
        allEmpleados.push(...data.data.filter(e => e.activo));
        page++;
        if (data.data.length < limit) hasMore = false;
      }
    }

    return allEmpleados;
  } catch (error) {
    console.error('Error obteniendo empleados de Naaloo:', error);
    return [];
  }
}

// Obtener TODOS los empleados (activos e inactivos) para sincronización
export async function obtenerTodosEmpleados(): Promise<NaalooEmpleado[]> {
  try {
    // Traer todo en una sola request con limit alto
    const response = await fetch(`${NAALOO_API_URL}/personal/?page=1&limit=2000`, {
      headers: {
        'Authorization': `Bearer ${NAALOO_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Naaloo API error: ${response.status}`);
      return [];
    }

    const data: NaalooResponse = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error obteniendo todos los empleados de Naaloo:', error);
    return [];
  }
}

// ============================================
// Autenticacion via Naaloo (multitenant)
// Flujo: 1) /auth/tenants devuelve los tenants del usuario
//        2) /auth/ con token=tenant valida y devuelve JWT + datos
// ============================================
export interface NaalooAuthUser {
  id: number;
  email: string;
  userName: string;
  firstName: string;
  lastName: string;
  fullName: string;
  image?: string;
  tenant?: string;
  token: string;
  validEmail?: boolean;
}

// Headers que la app web de Naaloo envia en cada request (detectados via reverse-engineering del bundle)
const NAALOO_HEADERS = {
  'Content-Type': 'application/json',
  'X-Client-Version': '2.79.002',
  'Origin': 'https://app.naaloo.com',
  'Referer': 'https://app.naaloo.com/',
};

export async function loginNaaloo(userName: string, password: string): Promise<NaalooAuthUser | null> {
  try {
    // Paso 1: obtener tenants del usuario
    const tenantsRes = await fetch(`${NAALOO_API_URL}/auth/tenants`, {
      method: 'POST',
      headers: NAALOO_HEADERS,
      body: JSON.stringify({
        userName,
        password,
        applicationName: 'naaloo',
      }),
    });

    if (!tenantsRes.ok) {
      console.error('Naaloo /auth/tenants error:', tenantsRes.status);
      return null;
    }

    const tenantsData: any = await tenantsRes.json();
    const tenants = tenantsData?.tenants || [];
    if (!Array.isArray(tenants) || tenants.length === 0) {
      console.error('Naaloo: usuario sin tenants');
      return null;
    }

    // Tomar el tenant que contenga "popper", o el primero
    const tenant = tenants.find((t: any) =>
      String(t?.tenant || t?.name || '').toLowerCase().includes('popper')
    ) || tenants[0];

    const tenantToken: string = tenant?.token || tenant?.tenant || String(tenant?.id || '');
    if (!tenantToken) {
      console.error('Naaloo: tenant sin token');
      return null;
    }

    // Paso 2: autenticar contra el tenant
    const authRes = await fetch(`${NAALOO_API_URL}/auth/`, {
      method: 'POST',
      headers: NAALOO_HEADERS,
      body: JSON.stringify({
        userName,
        password,
        token: tenantToken,
        applicationName: 'naaloo',
      }),
    });

    if (!authRes.ok) {
      console.error('Naaloo /auth/ error:', authRes.status);
      return null;
    }

    const auth: any = await authRes.json();
    if (!auth?.token) return null;

    return {
      id: auth.id,
      email: String(auth.email || '').toLowerCase(),
      userName: auth.userName || userName,
      firstName: auth.firstName || '',
      lastName: auth.lastName || '',
      fullName: auth.fullName || `${auth.firstName || ''} ${auth.lastName || ''}`.trim(),
      image: auth.image,
      tenant: auth.tenant,
      token: auth.token,
      validEmail: auth.validEmail,
    };
  } catch (error: any) {
    console.error('Error login Naaloo:', error?.message || error);
    return null;
  }
}

// Convertir empleado de Naaloo al formato de beneficiario local
export function naalooToBeneficiario(empleado: NaalooEmpleado) {
  // Asignar nivel según antigüedad
  const antiguedad = empleado.fechaIngreso
    ? (Date.now() - new Date(empleado.fechaIngreso).getTime()) / (1000 * 60 * 60 * 24 * 365)
    : 0;

  let nivel = 'bronce';
  if (antiguedad >= 5) nivel = 'platinum';
  else if (antiguedad >= 3) nivel = 'oro';
  else if (antiguedad >= 1) nivel = 'plata';

  return {
    dni: empleado.dni,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    email: empleado.email,
    telefono: empleado.telefonos,
    nivel,
    departamento: empleado.area || empleado.oficinaNombre,
    empresa: 'Grupo Popper',
    legajo: empleado.legajo,
    foto: empleado.image || null,
    cargo: empleado.cargo || null,
    sector: empleado.sector || null,
    activo: empleado.activo,
    fecha_ingreso: empleado.fechaIngreso,
    naaloo_id: empleado.id,
  };
}
