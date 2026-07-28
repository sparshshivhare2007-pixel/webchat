const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Store all data
const rooms = {};
const onlineUsers = {};

io.on('connection', (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    // Join Room
    socket.on('join-room', (data) => {
        const { state, region, language, username } = data;
        const roomName = `${state}-${region}-${language}`;
        
        // Leave previous room
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
        }
        
        socket.join(roomName);
        socket.currentRoom = roomName;
        socket.username = username || 'Anonymous';
        socket.userData = { state, region, language, username: socket.username };
        
        // Initialize room if not exists
        if (!rooms[roomName]) {
            rooms[roomName] = {
                messages: [],
                users: []
            };
        }
        
        // Add user to room
        if (!rooms[roomName].users.includes(socket.id)) {
            rooms[roomName].users.push(socket.id);
        }
        
        // Send previous messages (last 50)
        const lastMessages = rooms[roomName].messages.slice(-50);
        socket.emit('previous-messages', lastMessages);
        
        // Send online users count
        io.to(roomName).emit('online-count', rooms[roomName].users.length);
        
        // Welcome message
        const welcomeMsg = {
            user: '🟢 System',
            text: `${socket.username} joined the chat!`,
            time: new Date().toLocaleTimeString(),
            isSystem: true
        };
        io.to(roomName).emit('receive-message', welcomeMsg);
        
        console.log(`📢 ${socket.username} joined ${roomName}`);
    });

    // Handle new message
    socket.on('send-message', (msg) => {
        const room = socket.currentRoom;
        if (room && rooms[room]) {
            const messageData = {
                user: socket.username,
                text: msg.text,
                time: new Date().toLocaleTimeString(),
                userId: socket.id,
                isSystem: false
            };
            
            rooms[room].messages.push(messageData);
            io.to(room).emit('receive-message', messageData);
        }
    });

    // Typing indicator
    socket.on('typing', (isTyping) => {
        const room = socket.currentRoom;
        if (room) {
            socket.to(room).emit('user-typing', {
                username: socket.username,
                isTyping: isTyping
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`🔴 User Disconnected: ${socket.id}`);
        
        if (socket.currentRoom && rooms[socket.currentRoom]) {
            // Remove user from room
            rooms[socket.currentRoom].users = rooms[socket.currentRoom].users.filter(
                id => id !== socket.id
            );
            
            // Update online count
            io.to(socket.currentRoom).emit('online-count', rooms[socket.currentRoom].users.length);
            
            // Leave message
            const leaveMsg = {
                user: '🔴 System',
                text: `${socket.username || 'Someone'} left the chat`,
                time: new Date().toLocaleTimeString(),
                isSystem: true
            };
            io.to(socket.currentRoom).emit('receive-message', leaveMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
