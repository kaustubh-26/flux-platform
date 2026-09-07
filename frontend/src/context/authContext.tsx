import { createContext, type ReactNode, useEffect, useState } from 'react';

export interface AuthSessionUser {
  sub: string;
  userId: string;
  provider: string;
  email: string | null;
  name: string;
  iat: number;
  exp: number;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  logoutPending: boolean;
  user: AuthSessionUser | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthSessionResponse {
  authenticated: boolean;
  user?: AuthSessionUser;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutPending, setLogoutPending] = useState(false);

  const refreshSession = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await fetch('/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as AuthSessionResponse;
      setUser(data.authenticated ? data.user ?? null : null);
    } catch (error) {
      console.error('Failed to load auth session', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLogoutPending(true);

    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Logout failed with status ${response.status}`);
      }

      setUser(null);
    } catch (error) {
      console.error('Failed to logout', error);
      throw error;
    } finally {
      setLogoutPending(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        isLoading,
        logoutPending,
        user,
        refreshSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
