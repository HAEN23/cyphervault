import { create } from 'zustand';

// Definimos la estructura exacta que tendrá un Secreto en el frontend
export interface Secret {
  id: string;
  title: string;
  environment: string;
  url: string;
  isExpired?: boolean;
}

// Definimos qué datos y funciones guardará nuestra "memoria global"
interface SecretStore {
  secrets: Secret[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSecrets: (secrets: Secret[]) => void;
}

// Creamos y exportamos la tienda (store)
export const useSecretStore = create<SecretStore>((set) => ({
  secrets: [], // Inicialmente vacío, luego se llenará con los datos de tu API de Node.js
  searchQuery: '',
  
  // Función para actualizar el buscador en tiempo real
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Función para guardar los secretos que lleguen de la base de datos
  setSecrets: (newSecrets) => set({ secrets: newSecrets }),
}));