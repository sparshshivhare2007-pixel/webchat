const socket = io();

// ========== DOM Elements ==========
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('login-username');
const profileInput = document.getElementById('profileInput');
const profilePreview = document.getElementById('profilePreview');
const aboutLink = document.getElementById('about-link');
const contactLink = document.getElementById('contact-link');
const aboutModal = document.getElementById('about-modal');
const contactModal = document.getElementById('contact-modal');
const closeBtns = document.querySelectorAll('.close-btn');

let profilePic = '';

// ========== Profile Picture Upload ==========
profileInput.addEventListener('change', async (e) => {
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
            profilePic = result.url;
            profilePreview.innerHTML = `<img src="${profilePic}" alt="Profile">`;
        }
    } catch (error) {
        console.error('Upload error:', error);
    }
});

// ========== Login ==========
loginBtn.addEventListener('click', login);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

function login() {
    const username = usernameInput.value.trim();
    if (!username) {
        alert('Please enter your name!');
        usernameInput.focus();
        return;
    }

    socket.emit('login', { username, profilePic });
}

socket.on('login-success', (data) => {
    localStorage.setItem('username', data.username);
    localStorage.setItem('profilePic', data.profilePic);
    localStorage.setItem('userId', data.userId);
    window.location.href = '/dashboard.html';
});

// ========== Modals ==========
aboutLink.addEventListener('click', (e) => {
    e.preventDefault();
    aboutModal.style.display = 'flex';
});

contactLink.addEventListener('click', (e) => {
    e.preventDefault();
    contactModal.style.display = 'flex';
});

closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        aboutModal.style.display = 'none';
        contactModal.style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.style.display = 'none';
    if (e.target === contactModal) contactModal.style.display = 'none';
});

console.log('🚀 RegionalChat Login Page Loaded!');
