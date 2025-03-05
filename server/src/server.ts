import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
app.set("trust proxy", true);


const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // frontend URL origin
        methods: ["GET", "POST"],
        credentials: true
    }
});

io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('getUserId', () => {
        const forwarded = socket.handshake.headers["x-forwarded-for"];
        const ip = forwarded?.toString().split(",")[0].trim() || socket.handshake.address;

        console.log("Client IP:", ip);
        console.log('Received getUserId:', socket.id);
        const uniqueId = uuidv4();
        socket.emit('userUniqueId', uniqueId);
    });

    socket.on('userLocationUpdate', (locationData) => {
        console.log('Received user location:', locationData);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.SERVER_PORT;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});