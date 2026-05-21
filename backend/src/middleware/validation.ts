import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username requerido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
});

export const BuscarBeneficiarioSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
});

export const VerificacionSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  comercio_id: z.string().uuid('ID de comercio inválido'),
  beneficio_id: z.string().uuid('ID de beneficio inválido').optional(),
});

export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (err: any) {
      const errors = err.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ error: 'Validación fallida', details: errors });
    }
  };
};
