import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  getSocket,
  registerCoreSocketEvents,
  unregisterCoreSocketEvents,
} from "@/socket";

type SocketContextType = {
  socket: Socket | null;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
});

// Custom hook to access the socket from context
const useSocket = () => useContext(SocketContext);

// SocketProvider component to manage socket instance and provide it through context
const SocketProvider = ({ children }: { children: ReactNode }) => {
  // Store socket instance
  const [socket] = useState<Socket>(() => getSocket());

  // Setup socket connection when the component mounts
  useEffect(() => {
    registerCoreSocketEvents(socket);

    return () => {
      // IMPORTANT:
      // Do NOT disconnect socket here
      unregisterCoreSocketEvents(socket);
    };
  }, [socket]);

  return (
    // Provide socket instance through context to its children
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}

export { SocketProvider, useSocket };
