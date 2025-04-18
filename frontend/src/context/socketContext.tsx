import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  getSocket,
  registerCoreSocketEvents,
  unregisterCoreSocketEvents,
} from "@/socket";

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
  userReady: boolean;
  setUserReady: (v: boolean) => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  userReady: false,
  setUserReady: () => {},
});

// Custom hook to access the socket from context
const useSocket = () => useContext(SocketContext);

// SocketProvider component to manage socket instance and provide it through context
const SocketProvider = ({ children }: { children: ReactNode }) => {
  // Store socket instance
  const [socket] = useState<Socket>(() => getSocket());
  const [connected, setConnected] = useState(false);
  const [userReady, setUserReady] = useState(false);


  // Setup socket connection when the component mounts
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
      setUserReady(false); // reset on reconnect
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    registerCoreSocketEvents(socket);

    return () => {
      // IMPORTANT:
      // Do NOT disconnect socket here
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      unregisterCoreSocketEvents(socket);
    };
  }, [socket]);

  return (
    // Provide socket instance through context to its children
    <SocketContext.Provider
      value={{
        socket,
        connected,
        userReady,
        setUserReady,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export { SocketProvider, useSocket };
