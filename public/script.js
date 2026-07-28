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

let currentRoom = '';
let username = '';
let typingTimeout = null;
let isDarkMode = false;

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

// ========== Display Message ==========
function displayMessage(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    
    if (msg.isSystem) {
        msgDiv.classList.add('system');
        msgDiv.innerHTML = `<div class="msg-text">${msg.text}</div>`;
    } else if (msg.user === username) {
        msgDiv.classList.add('own');
        msgDiv.innerHTML = `
            <div class="msg-user">
                <span>${msg.user}</span>
                <span class="msg-time">${msg.time}</span>
            </div>
            <div class="msg-text">${msg.text}</div>
        `;
    } else {
        msgDiv.classList.add('other');
        msgDiv.innerHTML = `
            <div class="msg-user">
                <span>${msg.user}</span>
                <span class="msg-time">${msg.time}</span>
            </div>
            <div class="msg-text">${msg.text}</div>
        `;
    }
    
    messagesDiv.appendChild(msgDiv);
    messagesDiv.parentElement.scrollTop = messagesDiv.parentElement.scrollHeight;
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
