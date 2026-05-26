/**
 * Mock del módulo DB para tests.
 * Cada test define su propio comportamiento via mockQuery().
 */
export const query = jest.fn();

/** Helper para configurar fácilmente el mock en cada test */
export function mockQuery(rows: any[]) {
  query.mockResolvedValueOnce({ rows });
}

export function mockQueryError(msg: string) {
  query.mockRejectedValueOnce(new Error(msg));
}
