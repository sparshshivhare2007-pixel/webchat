const socket = io();

// ========== DOM Elements ==========
const username = localStorage.getItem('username') || 'User';
const profilePic = localStorage.getItem('profilePic') || '';
const userId = localStorage.getItem('userId') || '';

const dashboardUsername = document.getElementById('dashboard-username');
const profileImg = document.getElementById('profile-img');
const defaultAvatar = document.getElementById('default-avatar');
const roomsList = document.getElementById('rooms-list');
const roomNameDisplay = document.getElementById('chat-room-name');
const roomMetaDisplay = document.getElementById('chat-room-meta');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const voiceBtn = document.getElementById('voice-btn');
const fileInput = document.getElementById('file-input');
const voiceRecording = document.getElementById('voice-recording');
const recordingTimer = document.getElementById('recording-timer');
const stopRecordingBtn = document.getElementById('stop-recording-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const themeToggle = document.getElementById('theme-toggle');
const callBtn = document.getElementById('call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const callStatus = document.getElementById('call-status');
const callUsersCount = document.getElementById('call-users-count');
const typingIndicator = document.getElementById('typing-indicator');
const typingUser = document.getElementById('typing-user');
const roomsTab = document.getElementById('rooms-tab');
const createTab = document.getElementById('create-tab');
const roomsContainer = document.getElementById('rooms-list-container');
const createContainer = document.getElementById('create-room-container');
const createRoomBtn = document.getElementById('create-room-btn');
const roomNameInput = document.getElementById('room-name');
const roomStateSelect = document.getElementById('room-state');
const roomDistrictSelect = document.getElementById('room-district');
const logoutBtn = document.getElementById('logout-btn');
const editProfileBtn = document.getElementById('edit-profile-btn');
const profileUpload = document.getElementById('profile-upload');

let currentRoomId = '';
let currentRoomName = '';
let isHost = false;
let isDarkMode = false;
let lastDate = '';
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingInterval = null;
let isRecording = false;
let typingTimeout = null;

// ========== Set User Profile ==========
dashboardUsername.textContent = username;
if (profilePic) {
    profileImg.src = profilePic;
    profileImg.style.display = 'block';
    defaultAvatar.style.display = 'none';
} else {
    profileImg.style.display = 'none';
    defaultAvatar.style.display = 'block';
}

// ========== Load States ==========
function loadStates() {
    roomStateSelect.innerHTML = '<option value="">Select State</option>';
    for (const [key, value] of Object.entries(INDIA_DATA)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = value.name;
        roomStateSelect.appendChild(option);
    }
}

roomStateSelect.addEventListener('change', function() {
    roomDistrictSelect.innerHTML = '<option value="">Select District</option>';
    if (this.value && INDIA_DATA[this.value]) {
        const districts = INDIA_DATA[this.value].districts;
        districts.forEach(district => {
            const option = document.createElement('option');
            option.value = district.toLowerCase().replace(/ /g, '-');
            option.textContent = district;
            roomDistrictSelect.appendChild(option);
        });
    }
});

// ========== Load Rooms ==========
async function loadRooms() {
    try {
        const response = await fetch('/api/rooms');
        const rooms = await response.json();
        
        if (rooms.length === 0) {
            roomsList.innerHTML = `<p class="loading-text">No active rooms. Create one!</p>`;
            return;
        }
        
        roomsList.innerHTML = rooms.map(room => `
            <div class="room-item ${room.id === currentRoomId ? 'active' : ''}" data-room="${room.id}">
                <div class="room-name">
                    <i class="fas fa-hashtag"></i>
                    ${room.name}
                </div>
                <div class="room-meta">
                    <span class="room-users">
                        <i class="fas fa-user"></i> ${room.users}
                    </span>
                    <button class="join-room-btn" onclick="joinRoom('${room.id}')">
                        Join
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading rooms:', error);
        roomsList.innerHTML = `<p class="loading-text">Failed to load rooms</p>`;
    }
}

// ========== Join Room ==========
function joinRoom(roomId) {
    socket.emit('join-room', { 
        roomId: roomId, 
        username: username, 
        profilePic: profilePic 
    });
}

// ========== Create Room ==========
createRoomBtn.addEventListener('click', () => {
    const name = roomNameInput.value.trim();
    const state = roomStateSelect.value;
    const district = roomDistrictSelect.value;
    
    if (!name) {
        alert('Please enter a room name!');
        roomNameInput.focus();
        return;
    }
    
    if (!state) {
        alert('Please select a state!');
        return;
    }
    
    if (!district) {
        alert('Please select a district!');
        return;
    }
    
    socket.emit('create-room', {
        roomName: name,
        state: state,
        district: district,
        username: username,
        profilePic: profilePic
    });
    
    roomNameInput.value = '';
    roomStateSelect.value = '';
    roomDistrictSelect.innerHTML = '<option value="">Select District</option>';
    roomsTab.click();
});

// ========== Send Message ==========
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentRoomId) return;
    
    socket.emit('send-message', { text: text });
    messageInput.value = '';
    messageInput.focus();
    emojiPicker.style.display = 'none';
}

// ========== Typing Indicator ==========
messageInput.addEventListener('input', () => {
    if (!currentRoomId) return;
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

// ========== File Upload ==========
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

// ========== Voice Recording ==========
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

// ========== Tab Switching ==========
roomsTab.addEventListener('click', () => {
    roomsTab.classList.add('active');
    createTab.classList.remove('active');
    roomsContainer.style.display = 'block';
    createContainer.style.display = 'none';
});

createTab.addEventListener('click', () => {
    createTab.classList.add('active');
    roomsTab.classList.remove('active');
    roomsContainer.style.display = 'none';
    createContainer.style.display = 'block';
});

// ========== Logout ==========
logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/';
});

// ========== Profile Upload ==========
editProfileBtn.addEventListener('click', () => {
    profileUpload.click();
});

profileUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profile', file);

    try {
        const response = await fetch('/upload-profile', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.url) {
            profileImg.src = result.url;
            profileImg.style.display = 'block';
            defaultAvatar.style.display = 'none';
            localStorage.setItem('profilePic', result.url);
        }
    } catch (error) {
        console.error('Upload error:', error);
    }
});

// ========== Call Controls ==========
callBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    socket.emit('start-call');
});

endCallBtn.addEventListener('click', () => {
    socket.emit('stop-call');
});

// ========== Socket Events ==========
socket.on('room-joined', (data) => {
    currentRoomId = data.roomId;
    currentRoomName = data.roomName;
    isHost = data.isHost;
    roomNameDisplay.textContent = `📍 ${data.roomName}`;
    roomMetaDisplay.textContent = `${data.users.length} members • 0 online`;
    loadRooms();
});

socket.on('room-created', (data) => {
    loadRooms();
});

socket.on('room-users', (users) => {
    roomMetaDisplay.textContent = `${users.length} members • ${users.length} online`;
});

socket.on('online-count', (count) => {
    const members = roomMetaDisplay.textContent.split('•')[0].trim();
    roomMetaDisplay.textContent = `${members} • ${count} online`;
});

socket.on('receive-message', displayMessage);
socket.on('previous-messages', (msgs) => {
    msgs.forEach(msg => displayMessage(msg));
});

socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingUser.textContent = data.username;
        typingIndicator.style.display = 'block';
    } else {
        typingIndicator.style.display = 'none';
    }
});

socket.on('call-started', (data) => {
    callStatus.style.display = 'flex';
    callBtn.style.display = 'none';
    endCallBtn.style.display = 'flex';
    callUsersCount.textContent = data.users.length;
});

socket.on('call-stopped', () => {
    callStatus.style.display = 'none';
    callBtn.style.display = 'flex';
    endCallBtn.style.display = 'none';
});

socket.on('call-users', (users) => {
    callUsersCount.textContent = users.length;
});

socket.on('new-host', (user) => {
    isHost = user.id === socket.id;
    if (isHost) {
        alert('You are now the new host!');
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

function getMessageContent(msg) {
    if (msg.type === 'voice') {
        return `
            <div class="voice-message">
                <audio controls style="width:100%; max-width:180px; height:34px; border-radius:20px;">
                    <source src="${msg.audioUrl}" type="audio/webm">
                    Your browser does not support audio.
                </audio>
                <span style="font-size:11px; color:rgba(255,255,255,0.4);">${msg.duration || 0}s</span>
            </div>
        `;
    } else if (msg.type === 'file') {
        const isImage = msg.fileType && msg.fileType.startsWith('image/');
        if (isImage) {
            return `<img src="${msg.fileUrl}" style="max-width:160px; max-height:160px; border-radius:10px; cursor:pointer;" onclick="window.open('${msg.fileUrl}')" onerror="this.style.display='none'">`;
        } else {
            return `
                <div class="file-card" onclick="window.open('${msg.fileUrl}')">
                    <i class="fas ${getFileIcon(msg.fileType)}" style="font-size:20px; color:rgba(255,255,255,0.6);"></i>
                    <div class="file-info">
                        <div style="font-weight:500; font-size:12px;">${msg.fileName || 'File'}</div>
                        <div style="font-size:10px; color:rgba(255,255,255,0.3);">${formatFileSize(msg.fileSize || 0)}</div>
                    </div>
                </div>
            `;
        }
    } else {
        return msg.text;
    }
}

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

// ========== Initialize ==========
loadStates();
loadRooms();

// Show default state
roomsTab.click();

// Connection status
socket.on('connect', () => {
    console.log('🟢 Connected to server');
    socket.emit('login', { username, profilePic });
});

console.log('🚀 RegionalChat Dashboard Loaded!');
