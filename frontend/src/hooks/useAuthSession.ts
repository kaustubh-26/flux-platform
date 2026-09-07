import { useContext } from 'react';
import { AuthContext } from '@/context/authContext';

const useAuthSession = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthSession must be used within an AuthProvider');
  }

  return context;
};

export default useAuthSession;
