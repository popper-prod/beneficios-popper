// ============================================
// GRUPO POPPER - Pantalla de Verificación Premium
// ============================================

import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/Card';
import { BenefitLevelBadge } from '../ui/Badge';
import { 
  Beneficiary, 
  Benefit, 
  Commerce, 
  Verification 
} from '../../types';

interface VerificationScreenProps {
  onVerify: (formData: {
    dni: string;
    comercioId: string;
    beneficioId?: string;
  }) => Promise<{ success: boolean; message: string; verification?: Verification }>;
  getBeneficiaryByDni: (dni: string) => Beneficiary | undefined;
  getBenefitsForBeneficiary: (id: string) => Benefit[];
  commerce: Commerce[];
  currentUserId?: string;
  currentUserName: string;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  onVerify,
  getBeneficiaryByDni,
  getBenefitsForBeneficiary,
  commerce,
  currentUserName,
}) => {
  const [step, setStep] = useState<'scan' | 'select' | 'confirm' | 'result'>('scan');
  const [dni, setDni] = useState('');
  const [selectedCommerce, setSelectedCommerce] = useState('');
  const [selectedBenefit, setSelectedBenefit] = useState('');
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [availableBenefits, setAvailableBenefits] = useState<Benefit[]>([]);
  const [result, setResult] = useState<{ success: boolean; message: string; verification?: Verification } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Buscar beneficiario cuando se ingresa DNI
  useEffect(() => {
    if (dni.length === 8) {
      const searchBeneficiary = async () => {
        setIsLoading(true);
        const found = await getBeneficiaryByDni(dni);
        setIsLoading(false);

        if (found) {
          setBeneficiary(found);
          setAvailableBenefits(getBenefitsForBeneficiary(found.id));
          setStep('select');
          setError('');
        } else {
          setBeneficiary(null);
          setAvailableBenefits([]);
          setError('Beneficiario no encontrado con ese DNI');
        }
      };
      searchBeneficiary();
    }
  }, [dni, getBeneficiaryByDni, getBenefitsForBeneficiary]);

  const handleVerify = async () => {
    if (!beneficiary || !selectedCommerce) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await onVerify({
        dni: beneficiary.dni,
        comercioId: selectedCommerce,
        beneficioId: selectedBenefit || undefined,
      });

      setResult(response);
      setStep('result');
    } catch (err) {
      setError('Error al procesar la verificación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setDni('');
    setSelectedCommerce('');
    setSelectedBenefit('');
    setBeneficiary(null);
    setAvailableBenefits([]);
    setResult(null);
    setError('');
    setStep('scan');
  };

  const selectedCommerceData = commerce.find(c => c.id === selectedCommerce);
  const selectedBenefitData = availableBenefits.find(b => b.id === selectedBenefit);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header de pasos */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-4">
          {['scan', 'select', 'confirm', 'result'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full font-bold transition-all duration-300',
                step === s ? 'bg-[#1e3a5f] text-white scale-110 shadow-lg' :
                ['scan', 'select', 'confirm', 'result'].indexOf(step) > i ? 'bg-emerald-500 text-white' :
                'bg-gray-200 text-gray-500'
              )}>
                {['scan', 'select', 'confirm', 'result'].indexOf(step) > i ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div className={cn(
                  'w-16 h-1 rounded transition-all duration-300',
                  ['scan', 'select', 'confirm', 'result'].indexOf(step) > i ? 'bg-emerald-500' : 'bg-gray-200'
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-center mt-3 space-x-8 text-sm">
          <span className={cn('font-medium', step === 'scan' ? 'text-[#1e3a5f]' : 'text-gray-400')}>
            Escanear
          </span>
          <span className={cn('font-medium', step === 'select' ? 'text-[#1e3a5f]' : 'text-gray-400')}>
            Seleccionar
          </span>
          <span className={cn('font-medium', step === 'confirm' ? 'text-[#1e3a5f]' : 'text-gray-400')}>
            Confirmar
          </span>
          <span className={cn('font-medium', step === 'result' ? 'text-[#1e3a5f]' : 'text-gray-400')}>
            Resultado
          </span>
        </div>
      </div>

      {/* Paso 1: Escanear DNI */}
      {step === 'scan' && (
        <Card>
          <CardHeader
            title="Ingresar DNI del Beneficiario"
            subtitle="Ingrese el número de DNI o escanee el código QR"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            }
          />
          <CardContent>
            {/* Simulación de cámara QR */}
            <div className="bg-gray-900 rounded-2xl p-8 mb-6 relative overflow-hidden">
              <div className="aspect-square max-w-xs mx-auto relative">
                {/* Marcos de escaneo */}
                <div className="absolute inset-0">
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#ffd700] rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#ffd700] rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#ffd700] rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#ffd700] rounded-br-lg" />
                </div>
                {/* Línea de escaneo animada */}
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent animate-scan" />
              </div>
              <p className="text-center text-white/60 text-sm mt-4">
                Apunte la cámara al código QR o ingrese el DNI manualmente
              </p>
            </div>

            <div className="text-center mb-4">
              <span className="text-sm text-gray-500">O ingrese el DNI manualmente:</span>
            </div>

            <Input
              label="Número de DNI"
              type="number"
              placeholder="Ingrese 8 dígitos"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              maxLength={8}
              error={error}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Seleccionar Beneficio */}
      {step === 'select' && beneficiary && (
        <Card>
          <CardHeader
            title="Seleccionar Beneficio"
            subtitle="Elija el beneficio a canjear"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            }
            action={
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Cambiar DNI
              </Button>
            }
          />
          <CardContent>
            {/* Info del beneficiario */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a87] rounded-2xl p-6 text-white mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                  {beneficiary.nombre[0]}{beneficiary.apellido[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    {beneficiary.nombre} {beneficiary.apellido}
                  </h3>
                  <p className="text-white/70">DNI: {beneficiary.dni}</p>
                  {beneficiary.legajo && (
                    <p className="text-white/70 text-sm">Legajo: {beneficiary.legajo}</p>
                  )}
                </div>
                <BenefitLevelBadge level={beneficiary.nivel} size="lg" />
              </div>
            </div>

            {/* Selección de sucursal */}
            <Select
              label="Sucursal / Comercio"
              value={selectedCommerce}
              onChange={(e) => {
                setSelectedCommerce(e.target.value);
                setSelectedBenefit('');
              }}
              options={commerce.filter(c => c.activo).map(c => ({
                value: c.id,
                label: `${c.nombre} - ${c.ciudad}`,
              }))}
              placeholder="Seleccione una sucursal"
            />

            {/* Lista de beneficios disponibles */}
            {selectedCommerce && (
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Beneficios Disponibles
                </label>
                <div className="space-y-3">
                  {availableBenefits
                    .filter(b => commerce.find(c => c.id === selectedCommerce)?.beneficiosDisponibles.includes(b.id))
                    .map((benefit) => (
                      <button
                        key={benefit.id}
                        onClick={() => setSelectedBenefit(benefit.id)}
                        className={cn(
                          'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
                          selectedBenefit === benefit.id
                            ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-800">{benefit.nombre}</h4>
                              <BenefitLevelBadge level={benefit.nivelMinimo} size="sm" />
                            </div>
                            <p className="text-sm text-gray-500">{benefit.descripcion}</p>
                            {benefit.descuento && (
                              <p className="text-lg font-bold text-emerald-600 mt-2">
                                {benefit.descuento}% OFF
                              </p>
                            )}
                          </div>
                          {selectedBenefit === benefit.id && (
                            <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  {availableBenefits.filter(b => 
                    commerce.find(c => c.id === selectedCommerce)?.beneficiosDisponibles.includes(b.id)
                  ).length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No hay beneficios disponibles en esta sucursal
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="ghost" onClick={handleReset}>
              Cancelar
            </Button>
            <Button
              onClick={() => setStep('confirm')}
              disabled={!selectedBenefit}
            >
              Continuar
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Paso 3: Confirmar */}
      {step === 'confirm' && beneficiary && selectedCommerceData && selectedBenefitData && (
        <Card>
          <CardHeader
            title="Confirmar Verificación"
            subtitle="Revise los datos antes de confirmar"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
          />
          <CardContent>
            <div className="space-y-4">
              {/* Resumen */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-700 mb-3">Resumen de la Verificación</h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Beneficiario:</span>
                    <span className="font-medium">{beneficiary.nombre} {beneficiary.apellido}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">DNI:</span>
                    <span className="font-medium">{beneficiary.dni}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Nivel:</span>
                    <BenefitLevelBadge level={beneficiary.nivel} size="sm" />
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Sucursal:</span>
                      <span className="font-medium">{selectedCommerceData.nombre}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Beneficio:</span>
                      <span className="font-medium">{selectedBenefitData.nombre}</span>
                    </div>
                    {selectedBenefitData.descuento && (
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-gray-500">Descuento:</span>
                        <span className="text-xl font-bold text-emerald-600">
                          {selectedBenefitData.descuento}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Verificador */}
              <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white font-bold">
                  {currentUserName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Verificado por:</p>
                  <p className="font-medium text-gray-800">{currentUserName}</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" onClick={() => setStep('select')}>
              Volver
            </Button>
            <Button
              onClick={handleVerify}
              isLoading={isLoading}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            >
              Confirmar Verificación
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Paso 4: Resultado */}
      {step === 'result' && result && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              {result.success ? (
                <>
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-100 rounded-full mb-6">
                    <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Verificación Exitosa!</h2>
                  <p className="text-gray-500 mb-6">{result.message}</p>
                  
                  {result.verification && (
                    <div className="bg-gray-50 rounded-xl p-4 text-left max-w-sm mx-auto">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Código:</span>
                          <span className="font-mono font-medium">{result.verification.codigoReferencia}</span>
                        </div>
                        {result.verification.montoDescuento && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Descuento:</span>
                            <span className="font-bold text-emerald-600">
                              -${result.verification.montoDescuento.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500">Hora:</span>
                          <span className="font-medium">
                            {new Date(result.verification.fechaVerificacion).toLocaleTimeString('es-AR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-6">
                    <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Verificación No Completada</h2>
                  <p className="text-gray-500 mb-6">{result.message}</p>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter justify="center">
            <Button onClick={handleReset} size="lg">
              Nueva Verificación
            </Button>
          </CardFooter>
        </Card>
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-50px); opacity: 0; }
          50% { transform: translateY(50px); opacity: 1; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default VerificationScreen;
