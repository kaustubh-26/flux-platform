import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        const serverUrl = window.location.hostname.includes('.dev')
            ? `wss://${window.location.host}`  // Secure WS
            : `ws://${window.location.host}`;

        socket = io(serverUrl, {
            path: "/socket.io",
            transports: ["websocket", "polling"], // allow upgrade
            autoConnect: true,

            reconnection: true,
            reconnectionAttempts: Infinity,

            reconnectionDelay: 1000,        // start at 1s
            reconnectionDelayMax: 5000,     // cap at 5s
            timeout: 20000,                 // connection timeout
        });
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
