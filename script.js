// FrootRoute JavaScript Application

// Global state
let currentUser = null;
let authToken = null;
let map = null;
let userLocation = null;
let locationPermissionGranted = false;

// API Configuration
const API_BASE = window.location.origin;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Show loading screen
    showLoadingScreen();
    
    // Check for existing authentication
    checkAuthentication();
    
    // Hide loading screen after delay
    setTimeout(() => {
        hideLoadingScreen();
        
        if (authToken && currentUser) {
            showHome();
        } else {
            showLanding();
        }
    }, 2000);
}

function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}

// Authentication functions
function checkAuthentication() {
    authToken = localStorage.getItem('auth_token');
    const userId = localStorage.getItem('user_id');
    
    if (authToken && userId) {
        fetchUserProfile();
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            updateProfileDisplay();
        } else {
            // Token is invalid
            clearAuthentication();
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        clearAuthentication();
    }
}

function clearAuthentication() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('auth_token', authToken);
            localStorage.setItem('user_id', currentUser.id);
            
            showToast('Login successful!', 'success');
            
            // Check if location permission needs to be asked
            if (!currentUser.locationPermissionAsked) {
                showLocationDialog();
            } else {
                showHome();
            }
        } else {
            showToast(result.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

async function handleSignup() {
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    if (!username || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Account created successfully! Please log in.', 'success');
            showLogin();
        } else {
            showToast(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

function handleLogout() {
    clearAuthentication();
    showToast('Logged out successfully', 'success');
    showLanding();
}

// Location permission functions
function showLocationDialog() {
    document.getElementById('location-dialog').style.display = 'flex';
    showPermissionStep1();
}

function hideLocationDialog() {
    document.getElementById('location-dialog').style.display = 'none';
}

function showPermissionStep1() {
    document.getElementById('permission-step-1').style.display = 'block';
    document.getElementById('permission-step-2').style.display = 'none';
}

function showDurationOptions() {
    document.getElementById('permission-step-1').style.display = 'none';
    document.getElementById('permission-step-2').style.display = 'block';
}

function declineLocation() {
    saveLocationPermission(false);
}

async function acceptLocationWithDuration() {
    const selectedDuration = document.querySelector('input[name="duration"]:checked').value;
    
    // Request browser location permission
    try {
        await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    locationPermissionGranted = true;
                    resolve(position);
                },
                (error) => {
                    console.log('Browser location permission denied');
                    locationPermissionGranted = false;
                    reject(error);
                },
                { timeout: 10000 }
            );
        });
    } catch (error) {
        locationPermissionGranted = false;
    }
    
    saveLocationPermission(locationPermissionGranted, selectedDuration);
}

async function saveLocationPermission(granted, duration = null) {
    try {
        const data = { granted };
        if (granted && duration) {
            data.duration = duration;
        }
        
        const response = await fetch(`${API_BASE}/api/user/location-permission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            hideLocationDialog();
            showToast(granted ? 'Location sharing enabled!' : 'Location sharing disabled', 'success');
            showHome();
        } else {
            showToast('Failed to save location preferences', 'error');
        }
    } catch (error) {
        console.error('Error saving location permission:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

// Navigation functions
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    document.getElementById(pageId).classList.add('active');
    
    // Update navigation
    updateNavigation(pageId);
}

function updateNavigation(pageId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current nav item based on page
    const navMap = {
        'home-page': 'home',
        'map-page': 'map',
        'friends-page': 'friends',
        'profile-page': 'profile'
    };
    
    const navType = navMap[pageId];
    if (navType) {
        document.querySelectorAll(`[onclick="show${navType.charAt(0).toUpperCase() + navType.slice(1)}()"]`)
            .forEach(item => item.classList.add('active'));
    }
}

function showLanding() {
    showPage('landing-page');
}

function showLogin() {
    showPage('login-page');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
}

function showSignup() {
    showPage('signup-page');
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
}

function showHome() {
    if (!authToken) {
        showLanding();
        return;
    }
    showPage('home-page');
}

function showMap() {
    if (!authToken) {
        showLanding();
        return;
    }
    showPage('map-page');
    initializeMap();
}

function showFriends() {
    if (!authToken) {
        showLanding();
        return;
    }
    showToast('Friends feature coming soon!', 'info');
}

function showBandz() {
    if (!authToken) {
        showLanding();
        return;
    }
    showToast('FrootBand integration coming soon!', 'info');
}

function showProfile() {
    if (!authToken) {
        showLanding();
        return;
    }
    showPage('profile-page');
    updateProfileDisplay();
}

function showSettings() {
    showToast('Settings page coming soon!', 'info');
}

function showLocationSettings() {
    showToast('Location settings coming soon!', 'info');
}

// Map functions
function initializeMap() {
    if (map) {
        return; // Map already initialized
    }
    
    const mapContainer = document.getElementById('map-container');
    
    // Initialize Leaflet map
    map = L.map(mapContainer).setView([40.7128, -74.0060], 10); // Default to NYC
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add user location if available
    if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng])
            .addTo(map)
            .bindPopup('Your Location')
            .openPopup();
        
        map.setView([userLocation.lat, userLocation.lng], 13);
    }
    
    // Add sample friend markers
    addSampleFriends();
}

function addSampleFriends() {
    if (!map) return;
    
    const sampleFriends = [
        { name: 'Alice 🍎', lat: 40.7589, lng: -73.9851, fruit: '🍎' },
        { name: 'Bob 🍌', lat: 40.7505, lng: -73.9934, fruit: '🍌' },
        { name: 'Charlie 🍊', lat: 40.7282, lng: -74.0776, fruit: '🍊' }
    ];
    
    sampleFriends.forEach(friend => {
        const marker = L.marker([friend.lat, friend.lng]).addTo(map);
        marker.bindPopup(`${friend.fruit} ${friend.name}`);
    });
}

function centerOnUser() {
    if (!userLocation) {
        showToast('Location not available', 'warning');
        return;
    }
    
    map.setView([userLocation.lat, userLocation.lng], 15);
}

function toggleLocationSharing() {
    showToast('Location sharing toggle coming soon!', 'info');
}

// Utility functions
function updateProfileDisplay() {
    if (!currentUser) return;
    
    const usernameElement = document.getElementById('profile-username');
    const emailElement = document.getElementById('profile-email');
    
    if (usernameElement) usernameElement.textContent = currentUser.username || currentUser.name;
    if (emailElement) emailElement.textContent = currentUser.email;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'toast-message';
    messageElement.textContent = message;
    
    toast.appendChild(title);
    toast.appendChild(messageElement);
    container.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Event listeners for form submissions
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        
        if (activeElement.closest('#login-page')) {
            handleLogin();
        } else if (activeElement.closest('#signup-page')) {
            handleSignup();
        }
    }
});

// Handle browser back button
window.addEventListener('popstate', function(e) {
    if (e.state && e.state.page) {
        showPage(e.state.page);
    }
});

// Add page state to browser history
function pushState(page) {
    history.pushState({ page }, '', `#${page}`);
}

// Geolocation functions
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                resolve(userLocation);
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    });
}

// Network status handling
window.addEventListener('online', function() {
    showToast('Connection restored', 'success');
});

window.addEventListener('offline', function() {
    showToast('Connection lost', 'warning');
});

// Service Worker registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}

// Touch and gesture handling for mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
    // Prevent default scrolling on certain elements
    if (e.target.closest('.map-container')) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent zoom on double tap for better UX
let lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Initialize fruit character animation
function initializeFruitAnimation() {
    const fruits = ['🍎', '🍊', '🍌', '🍇', '🍓', '🥝', '🍑', '🥭', '🍍', '🥥'];
    const fruitEmoji = document.querySelector('.fruit-emoji');
    
    if (fruitEmoji) {
        let index = 0;
        setInterval(() => {
            fruitEmoji.textContent = fruits[index];
            index = (index + 1) % fruits.length;
        }, 500);
    }
}

// Call initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeFruitAnimation();
});