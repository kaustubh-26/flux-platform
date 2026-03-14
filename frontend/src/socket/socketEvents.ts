import { Socket } from "socket.io-client";

type SessionInitPayload = {
  userId: string;
  userType: "guest" | "authenticated";
};

type CoreSocketEventHandlers = {
  onSessionInit?: (session: SessionInitPayload) => void;
};

export const registerCoreSocketEvents = (socket: Socket, handlers?: CoreSocketEventHandlers) => {
  socket.on("connect", () => {
    console.log("Connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error.message);
  });

  socket.on("session:init", (session: SessionInitPayload) => {
    console.log("Resolved session:", session);
    handlers?.onSessionInit?.(session);
  });

  socket.io.on("reconnect_attempt", (attempt) => {
    console.log("Reconnect attempt:", attempt);
  });

  socket.io.on("reconnect", (attempt) => {
    console.log("Reconnected after attempts:", attempt);
  });

  socket.io.on("reconnect_failed", () => {
    console.error("Reconnect failed");
  });
};

export const unregisterCoreSocketEvents = (socket: Socket) => {
  socket.off("connect");
  socket.off("disconnect");
  socket.off("connect_error");
  socket.off("session:init");

  socket.io.off("reconnect_attempt");
  socket.io.off("reconnect");
  socket.io.off("reconnect_failed");
};
