/**
 * Bundle opcional para entornos con nube (staging/producción): `FormaFirebase` (IIFE global).
 * Sin este bundle la Beta funciona en modo local (localStorage), igual que antes.
 */
export { BackendError, createFirebaseBackend } from '../infrastructure/firebase'
export { WORKSPACE_ID } from '../modules/workspace-sync'
