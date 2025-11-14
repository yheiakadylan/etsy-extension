// popup.js

// !!! QUAN TRỌNG: Thay thế URL này bằng URL Vercel app của bạn
const API_URL = "https://imagetoupload.vercel.app"; 

// Lấy các element từ HTML
const loginView = document.getElementById('login-view');
const listView = document.getElementById('list-view');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const welcomeUser = document.getElementById('welcome-user');
const logoutButton = document.getElementById('logout-button');
const listingList = document.getElementById('listing-list');
const listMessage = document.getElementById('list-message');

// Hiển thị giao diện dựa trên trạng thái đăng nhập
function showLoginView() {
  loginView.classList.remove('hidden');
  listView.classList.add('hidden');
}

async function showListView() {
  const { username } = await chrome.storage.local.get('username');
  if (!username) {
    showLoginView();
    return;
  }
  loginView.classList.add('hidden');
  listView.classList.remove('hidden');
  welcomeUser.textContent = `Chào, ${username}!`;
  loadListings();
}

// 1. Kiểm tra trạng thái đăng nhập khi mở popup
document.addEventListener('DOMContentLoaded', async () => {
  const { idToken } = await chrome.storage.local.get('idToken');
  if (idToken) {
    showListView();
  } else {
    showLoginView();
  }
});

// 2. Xử lý Form Đăng nhập
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  loginError.textContent = '';
  loginButton.disabled = true;
  loginButton.textContent = "Đang đăng nhập...";

  try {
    const response = await fetch(`${API_URL}/api/extension-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Đăng nhập thất bại');
    }

    // Lưu token và username vào bộ nhớ extension
    await chrome.storage.local.set({ idToken: data.token, username: username });
    showListView();

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    loginError.textContent = 'Sai username hoặc password.';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Đăng nhập";
  }
});

// 3. Xử lý Đăng xuất
logoutButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(['idToken', 'username']);
  showLoginView();
});

// 4. Tải danh sách Listings
async function loadListings() {
  listingList.innerHTML = '';
  listMessage.textContent = 'Đang tải...';

  try {
    const { idToken } = await chrome.storage.local.get('idToken');
    if (!idToken) {
      throw new Error("Chưa đăng nhập");
    }

    const response = await fetch(`${API_URL}/api/get-listings`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    const listings = await response.json();
    if (!response.ok) {
      throw new Error(listings.error || "Lỗi tải danh sách");
    }

    if (listings.length === 0) {
      listMessage.textContent = 'Không có listing nào đang chờ.';
      return;
    }

    listMessage.textContent = '';
    listings.forEach((listing) => {
      const li = document.createElement('li');
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = listing.title;
      titleSpan.title = listing.title;
      li.appendChild(titleSpan);
      
      const applyButton = document.createElement('button');
      applyButton.textContent = 'Áp dụng';
      applyButton.onclick = () => {
        applyButton.textContent = 'Đang...';
        applyButton.disabled = true;
        
        // Gửi yêu cầu cho background.js để xử lý
        chrome.runtime.sendMessage(
          { type: "APPLY_LISTING", listingId: listing.id },
          (response) => {
            if (response && response.success) {
              li.remove(); // Xóa khỏi danh sách sau khi áp dụng
            } else {
              alert(`Lỗi: ${response ? response.error : 'Không thể kết nối'}`);
              applyButton.textContent = 'Áp dụng';
              applyButton.disabled = false;
            }
          }
        );
      };
      
      li.appendChild(applyButton);
      listingList.appendChild(li);
    });

  } catch (error) {
    console.error("Lỗi tải listings:", error);
    listMessage.textContent = 'Lỗi khi tải danh sách.';
    if (error.message.includes("Chưa đăng nhập")) {
      showLoginView();
    }
  }
}