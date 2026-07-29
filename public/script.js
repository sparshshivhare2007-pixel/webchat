const socket = io();

// ========== DOM Elements ==========
const selectionScreen = document.getElementById('selection-screen');
const chatScreen = document.getElementById('chat-screen');
const joinBtn = document.getElementById('join-btn');
const showRoomsBtn = document.getElementById('show-rooms-btn');
const backBtn = document.getElementById('back-btn');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const messagesDiv = document.getElementById('messages');
const roomName = document.getElementById('room-name');
const onlineCount = document.getElementById('count');
const typingIndicator = document.getElementById('typing-indicator');
const typingUser = document.getElementById('typing-user');
const themeToggle = document.getElementById('theme-toggle');
const emojiToggle = document.getElementById('emoji-toggle');
const emojiPicker = document.getElementById('emoji-picker');
const emojiBtn = document.getElementById('emoji-btn');
const attachBtn = document.getElementById('attach-btn');
const voiceBtn = document.getElementById('voice-btn');
const fileInput = document.getElementById('file-input');
const voiceRecording = document.getElementById('voice-recording');
const recordingTimer = document.getElementById('recording-timer');
const stopRecordingBtn = document.getElementById('stop-recording-btn');
const roomsContainer = document.getElementById('rooms-container');
const roomsList = document.getElementById('rooms-list');

let currentRoom = '';
let username = '';
let typingTimeout = null;
let isDarkMode = false;
let lastDate = '';

// ========== Voice Recording Variables ==========
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingInterval = null;
let isRecording = false;

// ========== Load Rooms ==========
async function loadRooms() {
    try {
        const response = await fetch('/api/rooms');
        const rooms = await response.json();
        
        if (rooms.length === 0) {
            roomsContainer.innerHTML = `<p class="no-rooms">No active rooms. Create one!</p>`;
            return;
        }
        
        roomsContainer.innerHTML = rooms.map(room => `
            <div class="room-item" data-room="${room.name}">
                <div class="room-name">
                    <i class="fas fa-hashtag"></i>
                    ${room.name}
                </div>
                <div class="room-meta">
                    <span class="room-users">
                        <i class="fas fa-user"></i> ${room.users}
                    </span>
                    <button class="join-room-btn" onclick="joinExistingRoom('${room.name}')">
                        Join
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading rooms:', error);
        roomsContainer.innerHTML = `<p class="no-rooms">Failed to load rooms</p>`;
    }
}

// ========== Show/Hide Rooms ==========
let roomsVisible = false;

showRoomsBtn.addEventListener('click', () => {
    roomsVisible = !roomsVisible;
    roomsList.style.display = roomsVisible ? 'block' : 'none';
    showRoomsBtn.innerHTML = roomsVisible ? 
        '<i class="fas fa-times"></i> Close Rooms' : 
        '<i class="fas fa-door-open"></i> Enter Room';
    
    if (roomsVisible) {
        loadRooms();
    }
});

// ========== Join Existing Room ==========
function joinExistingRoom(room) {
    const name = document.getElementById('username').value.trim();
    if (!name) {
        alert('Please enter your name first!');
        document.getElementById('username').focus();
        return;
    }
    
    username = name;
    currentRoom = room;
    roomName.textContent = `📍 ${room}`;
    
    socket.emit('join-room', { roomName: room, username: name });
    
    selectionScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    messageInput.focus();
    roomsList.style.display = 'none';
    showRoomsBtn.innerHTML = '<i class="fas fa-door-open"></i> Enter Room';
    roomsVisible = false;
}

// ========== Join Chat (Create New Room) ==========
joinBtn.addEventListener('click', joinChat);
document.getElementById('username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

function joinChat() {
    const name = document.getElementById('username').value.trim();
    
    if (!name) {
        alert('Please enter your name!');
        document.getElementById('username').focus();
        return;
    }
    
    username = name;
    const room = `${name}'s Room`;
    currentRoom = room;
    roomName.textContent = `📍 ${room}`;
    
    socket.emit('join-room', { roomName: room, username: name });
    
    selectionScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    messageInput.focus();
}

// ========== Leave Chat ==========
backBtn.addEventListener('click', leaveChat);

function leaveChat() {
    if (confirm('Are you sure you want to leave?')) {
        chatScreen.style.display = 'none';
        selectionScreen.style.display = 'flex';
        messagesDiv.innerHTML = '';
        document.getElementById('online-count').textContent = '0';
        lastDate = '';
    }
}

// ========== Send Message ==========
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    
    socket.emit('send-message', { text: text });
    messageInput.value = '';
    messageInput.focus();
    emojiPicker.style.display = 'none';
}

// ========== Typing Indicator ==========
messageInput.addEventListener('input', () => {
    if (messageInput.value.length > 0) {
        socket.emit('typing', true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing', false);
        }, 1000);
    } else {
        socket.emit('typing', false);
    }
});

// ========== Socket Events ==========
socket.on('receive-message', displayMessage);
socket.on('previous-messages', (msgs) => {
    msgs.forEach(msg => displayMessage(msg));
});
socket.on('online-count', (count) => {
    onlineCount.textContent = count;
});
socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingUser.textContent = data.username;
        typingIndicator.style.display = 'block';
    } else {
        typingIndicator.style.display = 'none';
    }
});
socket.on('error', (msg) => {
    alert(msg);
});

// ========== Display Message ==========
function displayMessage(msg) {
    let msgDate = '';
    let msgTime = '';
    
    if (msg.time) {
        const parts = msg.time.split(',');
        if (parts.length >= 2) {
            msgDate = parts[0].trim();
            msgTime = parts.slice(1).join(',').trim();
        } else {
            msgTime = msg.time;
        }
    }
    
    if (msgDate && msgDate !== lastDate && !msg.isSystem) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'date-separator';
        dateDiv.textContent = msgDate;
        messagesDiv.appendChild(dateDiv);
        lastDate = msgDate;
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    
    if (msg.isSystem) {
        msgDiv.classList.add('system');
        msgDiv.innerHTML = `<div class="msg-text">${msg.text}</div>`;
    } else if (msg.user === username) {
        msgDiv.classList.add('own');
        msgDiv.innerHTML = `
            <div class="msg-text">${getMessageContent(msg)}</div>
            <div class="msg-time">${msgTime}</div>
        `;
    } else {
        msgDiv.classList.add('other');
        msgDiv.innerHTML = `
            <div class="msg-text">${getMessageContent(msg)}</div>
            <div class="msg-time">${msgTime}</div>
        `;
    }
    
    messagesDiv.appendChild(msgDiv);
    messagesDiv.parentElement.scrollTop = messagesDiv.parentElement.scrollHeight;
}

// ========== Get Message Content ==========
function getMessageContent(msg) {
    if (msg.type === 'voice') {
        return `
            <div class="voice-message">
                <audio controls style="width:100%; max-width:200px; height:36px; border-radius:20px;">
                    <source src="${msg.audioUrl}" type="audio/webm">
                    Your browser does not support audio.
                </audio>
                <span class="duration">${msg.duration || 0}s</span>
            </div>
        `;
    } else if (msg.type === 'file') {
        const isImage = msg.fileType && msg.fileType.startsWith('image/');
        if (isImage) {
            return `<img src="${msg.fileUrl}" style="max-width:180px; max-height:180px; border-radius:10px; cursor:pointer;" onclick="window.open('${msg.fileUrl}')" onerror="this.style.display='none'">`;
        } else {
            return `
                <div class="file-card" onclick="window.open('${msg.fileUrl}')">
                    <i class="fas ${getFileIcon(msg.fileType)}" style="font-size:24px; color:#667eea;"></i>
                    <div class="file-info">
                        <div class="file-name">${msg.fileName || 'File'}</div>
                        <div class="file-size">${formatFileSize(msg.fileSize || 0)}</div>
                    </div>
                </div>
            `;
        }
    } else {
        return msg.text;
    }
}

// ========== File Helpers ==========
function getFileIcon(fileType) {
    if (!fileType) return 'fa-file';
    if (fileType.startsWith('image/')) return 'fa-image';
    if (fileType === 'application/pdf') return 'fa-file-pdf';
    if (fileType.includes('word')) return 'fa-file-word';
    if (fileType.includes('text')) return 'fa-file-alt';
    if (fileType.includes('audio')) return 'fa-file-audio';
    if (fileType.includes('video')) return 'fa-file-video';
    return 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ========== FILE ATTACHMENT ==========
attachBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.url) {
            socket.emit('send-attachment', {
                fileUrl: result.url,
                fileName: result.name,
                fileType: result.type,
                fileSize: result.size
            });
        }

    } catch (error) {
        console.error('Upload error:', error);
    }

    fileInput.value = '';
});

// ========== VOICE RECORDING ==========
voiceBtn.addEventListener('click', async () => {
    if (isRecording) {
        stopRecording();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const duration = Math.round((Date.now() - recordingStartTime) / 1000);
            
            socket.emit('send-voice', {
                audioUrl: audioUrl,
                duration: duration
            });

            stream.getTracks().forEach(track => track.stop());
            voiceRecording.style.display = 'none';
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            voiceBtn.classList.remove('recording');
            isRecording = false;
            clearInterval(recordingInterval);
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        isRecording = true;
        voiceBtn.innerHTML = '<i class="fas fa-stop-circle" style="color:red;"></i>';
        voiceBtn.classList.add('recording');
        voiceRecording.style.display = 'flex';
        
        let seconds = 0;
        recordingTimer.textContent = '0s';
        recordingInterval = setInterval(() => {
            seconds++;
            recordingTimer.textContent = `${seconds}s`;
            if (seconds >= 60) {
                stopRecording();
            }
        }, 1000);

    } catch (error) {
        console.error('Microphone error:', error);
        alert('⚠️ Please allow microphone access to record voice notes!');
    }
});

stopRecordingBtn.addEventListener('click', stopRecording);

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        voiceRecording.style.display = 'none';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.classList.remove('recording');
        clearInterval(recordingInterval);
        isRecording = false;
    }
}

// ========== Emoji Picker ==========
emojiBtn.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
});

emojiToggle.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
});

document.querySelectorAll('.emoji-grid span').forEach(emoji => {
    emoji.addEventListener('click', () => {
        messageInput.value += emoji.textContent;
        messageInput.focus();
        emojiPicker.style.display = 'none';
    });
});

// ========== Dark Mode ==========
themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

// ========== Shake Animation ==========
function shakeElement(el) {
    el.style.animation = 'shake 0.5s ease';
    setTimeout(() => el.style.animation = '', 500);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// ========== Close emoji on outside click ==========
document.addEventListener('click', (e) => {
    if (!e.target.closest('#emoji-picker') && !e.target.closest('#emoji-btn') && !e.target.closest('#emoji-toggle')) {
        emojiPicker.style.display = 'none';
    }
});

// ========== Initial Load ==========
loadRooms();
console.log('🚀 Regional Chat App Loaded Successfully!');
