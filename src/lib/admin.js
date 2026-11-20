// Usuario administrador de la app. Las reglas de Firestore (firestore.rules) comprueban el mismo email
// en el servidor: ocultar la interfaz no basta, la escritura la autoriza siempre Firestore.
export const ADMIN_EMAIL = 'dlopezm1977@gmail.com';

export function isAdmin(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL;
}
