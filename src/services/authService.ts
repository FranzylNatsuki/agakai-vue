import { appConfig } from '@/services/appConfig';

/** Placeholder auth service. TODO(backend): query `user` by senior_id + password. */
export const authService = {
  async login(seniorId: string, password: string): Promise<{ id: number }> {
    if (appConfig.useMockData) return { id: 1 };
    void seniorId;
    void password;
    throw new Error('Login is not connected to the backend yet.');
  },

  async logout(): Promise<void> {
    // TODO(backend): clear session.
  },
};
