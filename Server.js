const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// ⭐ INDIAN STANDARD TIME SET KAREIN
process.env.TZ = 'Asia/Kolkata';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ⭐ UPLOAD FOLDER CREATE KAREIN
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ⭐ MULTER SETUP - File Upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    // Allowed file types
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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// Store all data
const rooms = {};
const onlineUsers = {};

// ⭐ HELPER FUNCTION - IST TIME (Full Date + Time)
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

// ⭐ HELPER FUNCTION - Sirf Time (Short)
function getISTTimeShort() {
    return new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// ⭐ FILE UPLOAD ROUTE
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    
    res.json({
        url: fileUrl,
        type: fileType,
        name: fileName,
        size: fileSize
    });
});

io.on('connection', (socket) => {
    console.log(`🟢 User Connected: ${socket.id} at ${getISTTime()}`);

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
        
        // ⭐ Welcome message with IST time
        const welcomeMsg = {
            user: '🟢 System',
            text: `${socket.username} joined the chat!`,
            time: getISTTime(),
            isSystem: true
        };
        io.to(roomName).emit('receive-message', welcomeMsg);
        
        console.log(`📢 ${socket.username} joined ${roomName} at ${getISTTime()}`);
    });

    // ⭐ Handle Text Message
    socket.on('send-message', (msg) => {
        const room = socket.currentRoom;
        if (room && rooms[room]) {
            const messageData = {
                user: socket.username,
                text: msg.text,
                time: getISTTime(),
                userId: socket.id,
                isSystem: false,
                type: 'text'
            };
            
            rooms[room].messages.push(messageData);
            io.to(room).emit('receive-message', messageData);
        }
    });

    // ⭐ Handle Voice Message
    socket.on('send-voice', (data) => {
        const room = socket.currentRoom;
        if (room && rooms[room] && data.audioUrl) {
            const messageData = {
                user: socket.username,
                text: '🎙️ Voice Note',
                time: getISTTime(),
                userId: socket.id,
                isSystem: false,
                type: 'voice',
                audioUrl: data.audioUrl,
                duration: data.duration || 0
            };
            
            rooms[room].messages.push(messageData);
            io.to(room).emit('receive-message', messageData);
        }
    });

    // ⭐ Handle File Attachment
    socket.on('send-attachment', (data) => {
        const room = socket.currentRoom;
        if (room && rooms[room] && data.fileUrl) {
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
                fileSize: data.fileSize
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
        console.log(`🔴 User Disconnected: ${socket.id} at ${getISTTime()}`);
        
        if (socket.currentRoom && rooms[socket.currentRoom]) {
            // Remove user from room
            rooms[socket.currentRoom].users = rooms[socket.currentRoom].users.filter(
                id => id !== socket.id
            );
            
            // Update online count
            io.to(socket.currentRoom).emit('online-count', rooms[socket.currentRoom].users.length);
            
            // ⭐ Leave message with IST time
            const leaveMsg = {
                user: '🔴 System',
                text: `${socket.username || 'Someone'} left the chat`,
                time: getISTTime(),
                isSystem: true
            };
            io.to(socket.currentRoom).emit('receive-message', leaveMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🕐 Current IST Time: ${getISTTime()}`);
});
