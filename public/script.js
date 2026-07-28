const socket = io();

// ========== DOM Elements ==========
const selectionScreen = document.getElementById('selection-screen');
const chatScreen = document.getElementById('chat-screen');
const joinBtn = document.getElementById('join-btn');
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

// ========== NEW DOM Elements for Voice & Attachment ==========
const attachBtn = document.getElementById('attach-btn');
const voiceBtn = document.getElementById('voice-btn');
const fileInput = document.getElementById('file-input');
const voiceRecording = document.getElementById('voice-recording');
const recordingTimer = document.getElementById('recording-timer');
const stopRecordingBtn = document.getElementById('stop-recording-btn');

let currentRoom = '';
let username = '';
let typingTimeout = null;
let isDarkMode = false;

// ========== Voice Recording Variables ==========
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingInterval = null;
let isRecording = false;

// ========== Auto-generate username ==========
const randomNum = Math.floor(Math.random() * 1000);
document.getElementById('username').value = `User_${randomNum}`;

// ========== Join Chat ==========
joinBtn.addEventListener('click', joinChat);
document.querySelectorAll('#state, #region, #language').forEach(el => {
    el.addEventListener('change', () => {
        if (document.getElementById('state').value && 
            document.getElementById('region').value && 
            document.getElementById('language').value) {
            joinBtn.style.opacity = '1';
        }
    });
});

function joinChat() {
    const state = document.getElementById('state').value;
    const region = document.getElementById('region').value;
    const language = document.getElementById('language').value;
    username = document.getElementById('username').value.trim() || 'Anonymous';

    if (!state || !region || !language) {
        shakeElement(joinBtn);
        return;
    }

    currentRoom = `${state}-${region}-${language}`;
    
    // Show room name with emojis
    const stateNames = {
        'uttar-pradesh': 'UP', 'maharashtra': 'MH', 'delhi': 'DL',
        'bihar': 'BR', 'rajasthan': 'RJ', 'tamil-nadu': 'TN',
        'karnataka': 'KA', 'kerala': 'KL', 'gujarat': 'GJ',
        'andhra-pradesh': 'AP', 'madhya-pradesh': 'MP', 'west-bengal': 'WB'
    };
    roomName.textContent = `📍 ${stateNames[state] || state} | ${region.toUpperCase()} | ${language.toUpperCase()}`;

    socket.emit('join-room', { state, region, language, username });

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

    const msgData = { text: text };
    socket.emit('send-message', msgData);
    messageInput.value = '';
    messageInput.focus();
    
    // Hide emoji picker
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

// ========== Receive Messages ==========
socket.on('receive-message', (msg) => {
    displayMessage(msg);
});

// ========== Previous Messages ==========
socket.on('previous-messages', (msgs) => {
    msgs.forEach(msg => displayMessage(msg));
});

// ========== Online Count ==========
socket.on('online-count', (count) => {
    onlineCount.textContent = count;
});

// ========== Typing Indicator (Other Users) ==========
socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingUser.textContent = data.username;
        typingIndicator.style.display = 'block';
    } else {
        typingIndicator.style.display = 'none';
    }
});

// ========== DISPLAY MESSAGE (Updated for Voice & File) ==========
function displayMessage(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    
    if (msg.isSystem) {
        msgDiv.classList.add('system');
        msgDiv.innerHTML = `<div class="msg-text">${msg.text}</div>`;
    } else if (msg.user === username) {
        msgDiv.classList.add('own');
        msgDiv.innerHTML = getMessageHTML(msg, true);
    } else {
        msgDiv.classList.add('other');
        msgDiv.innerHTML = getMessageHTML(msg, false);
    }
    
    messagesDiv.appendChild(msgDiv);
    messagesDiv.parentElement.scrollTop = messagesDiv.parentElement.scrollHeight;
}

// ========== Get Message HTML (Supports Text, Voice, File) ==========
function getMessageHTML(msg, isOwn) {
    let content = '';
    const timeDisplay = msg.time || new Date().toLocaleTimeString();
    
    if (msg.type === 'voice') {
        // Voice Note
        content = `
            <div class="msg-user">
                <span>${msg.user}</span>
                <span class="msg-time">${timeDisplay}</span>
            </div>
            <div class="msg-text voice-message">
                <audio controls style="width:100%; max-width:250px; height:40px; border-radius:20px;">
                    <source src="${msg.audioUrl}" type="audio/webm">
                    Your browser does not support audio.
                </audio>
                <span style="font-size:12px; color:#999; margin-left:5px;">${msg.duration || 0}s</span>
            </div>
        `;
    } else if (msg.type === 'file') {
        // File Attachment
        const isImage = msg.fileType && msg.fileType.startsWith('image/');
        content = `
            <div class="msg-user">
                <span>${msg.user}</span>
                <span class="msg-time">${timeDisplay}</span>
            </div>
            <div class="msg-text file-message">
                ${isImage ? 
                    `<img src="${msg.fileUrl}" style="max-width:200px; max-height:200px; border-radius:10px; cursor:pointer; border:2px solid #e0e0e0;" onclick="window.open('${msg.fileUrl}')" onerror="this.style.display='none'">` :
                    `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:#f0f0f0; border-radius:10px; cursor:pointer;" onclick="window.open('${msg.fileUrl}')">
                        <i class="fas ${getFileIcon(msg.fileType)}" style="font-size:24px; color:#667eea;"></i>
                        <div>
                            <div style="font-weight:500; font-size:14px;">${msg.fileName || 'File'}</div>
                            <div style="font-size:12px; color:#999;">${formatFileSize(msg.fileSize || 0)}</div>
                        </div>
                    </div>`
                }
            </div>
        `;
    } else {
        // Text Message
        content = `
            <div class="msg-user">
                <span>${msg.user}</span>
                <span class="msg-time">${timeDisplay}</span>
            </div>
            <div class="msg-text">${msg.text}</div>
        `;
    }
    
    return content;
}

// ========== File Icon Helper ==========
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

// ========== File Size Formatter ==========
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

    // Show uploading message
    const tempMsg = {
        user: username,
        text: `📤 Uploading ${file.name}...`,
        time: new Date().toLocaleTimeString(),
        isSystem: false,
        type: 'text'
    };
    displayMessage(tempMsg);

    // Upload file
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.url) {
            // Send attachment via socket
            socket.emit('send-attachment', {
                fileUrl: result.url,
                fileName: result.name,
                fileType: result.type,
                fileSize: result.size
            });
        }

    } catch (error) {
        console.error('Upload error:', error);
        const errorMsg = {
            user: '🔴 System',
            text: '❌ Failed to upload file!',
            time: new Date().toLocaleTimeString(),
            isSystem: true
        };
        displayMessage(errorMsg);
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
            
            // Calculate duration
            const duration = Math.round((Date.now() - recordingStartTime) / 1000);
            
            // Send voice message
            socket.emit('send-voice', {
                audioUrl: audioUrl,
                duration: duration
            });

            // Display voice message in chat
            const voiceMsg = {
                user: username,
                text: '🎙️ Voice Note',
                time: new Date().toLocaleTimeString(),
                isSystem: false,
                type: 'voice',
                audioUrl: audioUrl,
                duration: duration
            };
            displayMessage(voiceMsg);

            // Clean up
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
        voiceRecording.style.display = 'block';
        
        // Timer
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
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

emojiToggle.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
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

// Add shake animation dynamically
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

console.log('🚀 Regional Chat App Loaded Successfully!');
