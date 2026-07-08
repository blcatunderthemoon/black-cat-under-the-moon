import { createContext, useContext } from 'react';
import { dashFetch } from './dashboard-fetch.js';

export const AdminApiContext = createContext(dashFetch);

export function useAdminApi() {
  return useContext(AdminApiContext);
}
