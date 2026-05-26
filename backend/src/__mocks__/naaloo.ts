export const buscarEmpleadoPorDni = jest.fn().mockResolvedValue(null);
export const naalooToBeneficiario = jest.fn((emp: any) => emp);
export const obtenerTodosEmpleados = jest.fn().mockResolvedValue([]);
export const loginNaaloo = jest.fn().mockResolvedValue(null);
export const obtenerEmpleadoCompleto = jest.fn().mockResolvedValue(null);
export const normalizarRelacion = jest.fn((r: string) => r);
