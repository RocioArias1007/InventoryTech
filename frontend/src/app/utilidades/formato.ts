// ============================================================
// formato.ts
// Funciones para mostrar los números como la gente los lee.
// ============================================================

// Formato de pesos colombianos, sin decimales: $ 450.000
const formatoPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function formatearPesos(valor: number): string {
  return formatoPesos.format(valor);
}

// "14/10 · 3:45 p. m."
export function fechaHora(fecha: string): string {
  const d = new Date(fecha);
  const dia = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${dia} · ${hora}`;
}