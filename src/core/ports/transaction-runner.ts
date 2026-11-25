/** Ejecuta `work` de forma atómica (transacción de Firestore en producción; simulada en Mock). */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>
}
