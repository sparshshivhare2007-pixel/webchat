const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

process.env.TZ = 'Asia/Kolkata';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ========== Upload Folders ==========
const uploadDir = path.join(__dirname, 'public/uploads');
const profileDir = path.join(__dirname, 'public/uploads/profiles');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

// ========== Multer Setup ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (req.path === '/upload-profile') {
            cb(null, profileDir);
        } else {
            cb(null, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
                          'application/pdf', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'text/plain', 'audio/webm', 'audio/mp3', 'audio/mpeg'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// ========== Data Store ==========
const rooms = {};
const users = {};

// ========== Helper Functions ==========
function getISTTime() {
    return new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function generateRoomId() {
    return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// ========== Routes ==========
app.get('/api/rooms', (req, res) => {
    const roomList = Object.keys(rooms).map(roomId => {
        const room = rooms[roomId];
        return {
            id: roomId,
            name: room.name,
            state: room.state,
            district: room.district,
            users: room.users ? room.users.length : 0,
            host: room.host,
            created: room.created
        };
    });
    res.json(roomList);
});

app.get('/api/room/:roomId', (req, res) => {
    const room = rooms[req.params.roomId];
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
        id: req.params.roomId,
        name: room.name,
        state: room.state,
        district: room.district,
        host: room.host,
        users: room.users || [],
        messages: room.messages || []
    });
});

// Profile Upload
app.post('/upload-profile', upload.single('profile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        url: `/uploads/profiles/${req.file.filename}`
    });
});

// File Upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        url: `/uploads/${req.file.filename}`,
        type: req.file.mimetype,
        name: req.file.originalname,
        size: req.file.size
    });
});

// ========== Socket.IO ==========
io.on('connection', (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    // ========== Login ==========
    socket.on('login', (data) => {
        const { username, profilePic } = data;
        socket.username = username;
        socket.profilePic = profilePic || '';
        users[socket.id] = { username, profilePic: socket.profilePic };
        console.log(`👤 ${username} logged in`);
        socket.emit('login-success', { 
            username, 
            profilePic: socket.profilePic,
            userId: socket.id 
        });
    });

    // ========== Create Room ==========
    socket.on('create-room', (data) => {
        const { roomName, state, district, username, profilePic } = data;
        const roomId = generateRoomId();
        
        rooms[roomId] = {
            id: roomId,
            name: roomName,
            state: state,
            district: district,
            host: username,
            hostId: socket.id,
            created: getISTTime(),
            users: [{
                id: socket.id,
                username: username,
                profilePic: profilePic || '',
                isHost: true
            }],
            messages: [],
            callActive: false,
            callUsers: []
        };

        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.isHost = true;

        io.emit('room-created', {
            id: roomId,
            name: roomName,
            state: state,
            district: district,
            host: username,
            users: 1
        });

        socket.emit('room-joined', {
            roomId: roomId,
            roomName: roomName,
            isHost: true,
            users: rooms[roomId].users
        });

        console.log(`📢 Room created: ${roomName} by ${username}`);
    });

    // ========== Join Room ==========
    socket.on('join-room', (data) => {
        const { roomId, username, profilePic } = data;
        const room = rooms[roomId];
        
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
        }

        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.isHost = false;

        room.users.push({
            id: socket.id,
            username: username,
            profilePic: profilePic || '',
            isHost: false
        });

        socket.emit('previous-messages', room.messages.slice(-50));
        io.to(roomId).emit('room-users', room.users);
        io.to(roomId).emit('online-count', room.users.length);

        const welcomeMsg = {
            user: '🟢 System',
            text: `${username} joined the chat!`,
            time: getISTTime(),
            isSystem: true
        };
        io.to(roomId).emit('receive-message', welcomeMsg);

        socket.emit('room-joined', {
            roomId: roomId,
            roomName: room.name,
            isHost: false,
            users: room.users
        });

        console.log(`👤 ${username} joined ${room.name}`);
    });

    // ========== Send Message ==========
    socket.on('send-message', (data) => {
        const room = rooms[socket.currentRoom];
        if (!room) return;

        const messageData = {
            user: socket.username,
            text: data.text,
            time: getISTTime(),
            userId: socket.id,
            isSystem: false,
            type: 'text',
            profilePic: socket.profilePic || ''
        };

        room.messages.push(messageData);
        io.to(socket.currentRoom).emit('receive-message', messageData);
    });

    // ========== Send Voice ==========
    socket.on('send-voice', (data) => {
        const room = rooms[socket.currentRoom];
        if (!room) return;

        const messageData = {
            user: socket.username,
            text: '🎙️ Voice Note',
            time: getISTTime(),
            userId: socket.id,
            isSystem: false,
            type: 'voice',
            audioUrl: data.audioUrl,
            duration: data.duration,
            profilePic: socket.profilePic || ''
        };

        room.messages.push(messageData);
        io.to(socket.currentRoom).emit('receive-message', messageData);
    });

    // ========== Send Attachment ==========
    socket.on('send-attachment', (data) => {
        const room = rooms[socket.currentRoom];
        if (!room) return;

        const messageData = {
            user: socket.username,
            text: `📎 ${data.fileName}`,
            time: getISTTime(),
            userId: socket.id,
            isSystem: false,
            type: 'file',
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSize: data.fileSize,
            profilePic: socket.profilePic || ''
        };

        room.messages.push(messageData);
        io.to(socket.currentRoom).emit('receive-message', messageData);
    });

    // ========== Typing ==========
    socket.on('typing', (isTyping) => {
        const room = socket.currentRoom;
        if (room) {
            socket.to(room).emit('user-typing', {
                username: socket.username,
                isTyping: isTyping
            });
        }
    });

    // ========== Call Controls ==========
    socket.on('start-call', () => {
        const room = rooms[socket.currentRoom];
        if (!room) return;

        if (!socket.isHost) {
            socket.emit('error', 'Only host can start a call');
            return;
        }

        room.callActive = true;
        room.callUsers = room.users.map(u => u.id);
        io.to(socket.currentRoom).emit('call-started', {
            host: socket.username,
            users: room.users
        });
    });

    socket.on('stop-call', () => {
        const room = rooms[socket.currentRoom];
        if (!room) return;

        if (!socket.isHost) {
            socket.emit('error', 'Only host can stop the call');
            return;
        }

        room.callActive = false;
        room.callUsers = [];
        io.to(socket.currentRoom).emit('call-stopped');
    });

    socket.on('join-call', () => {
        const room = rooms[socket.currentRoom];
        if (!room || !room.callActive) return;

        if (!room.callUsers.includes(socket.id)) {
            room.callUsers.push(socket.id);
        }
        io.to(socket.currentRoom).emit('call-users', room.callUsers);
    });

    socket.on('leave-call', () => {
        const room = rooms[socket.currentRoom];
        if (!room) return;

        room.callUsers = room.callUsers.filter(id => id !== socket.id);
        io.to(socket.currentRoom).emit('call-users', room.callUsers);
    });

    // ========== Disconnect ==========
    socket.on('disconnect', () => {
        console.log(`🔴 User Disconnected: ${socket.id}`);
        
        const room = rooms[socket.currentRoom];
        if (room) {
            room.users = room.users.filter(u => u.id !== socket.id);
            io.to(socket.currentRoom).emit('room-users', room.users);
            io.to(socket.currentRoom).emit('online-count', room.users.length);

            const leaveMsg = {
                user: '🔴 System',
                text: `${socket.username || 'Someone'} left the chat`,
                time: getISTTime(),
                isSystem: true
            };
            io.to(socket.currentRoom).emit('receive-message', leaveMsg);

            if (socket.isHost && room.users.length > 0) {
                room.users[0].isHost = true;
                room.host = room.users[0].username;
                room.hostId = room.users[0].id;
                io.to(socket.currentRoom).emit('new-host', room.users[0]);
            }
        }

        delete users[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🕐 Current IST Time: ${getISTTime()}`);
});
