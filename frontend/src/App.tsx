import { useEffect, useState } from 'react';
import './App.css';
import DashboardPage from './pages/dashboard';
import LoginPage from './pages/login';

function getCurrentPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function App() {
  const [path, setPath] = useState(getCurrentPath());

  useEffect(() => {
    const handlePopState = () => {
      setPath(getCurrentPath());
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (path === '/login') {
    return <LoginPage />;
  }

  return <DashboardPage />;
}

export default App;
