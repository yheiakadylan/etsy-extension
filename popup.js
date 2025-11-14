// popup.js

const API_URL = "https://imagetoupload.vercel.app"; 

// Cập nhật các element
const loginView = document.getElementById('login-view');
const listView = document.getElementById('list-view');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const welcomeUser = document.getElementById('welcome-user');
const logoutButton = document.getElementById('logout-button');

// Selectors cho 2 danh sách
const pendingList = document.getElementById('pending-list');
const pendingListMessage = document.getElementById('pending-list-message');
const appliedList = document.getElementById('applied-list');
const appliedListMessage = document.getElementById('applied-list-message');

// (Giữ nguyên hàm showLoginView, showListView, và event listener 'DOMContentLoaded')
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
  loadListings(); // Tải danh sách khi hiển thị
}

document.addEventListener('DOMContentLoaded', async () => {
  const { idToken } = await chrome.storage.local.get('idToken');
  if (idToken) {
    showListView();
  } else {
    showLoginView();
  }
});


// (Giữ nguyên event listener 'loginForm.addEventListener')
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

// (Giữ nguyên event listener 'logoutButton.addEventListener')
logoutButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(['idToken', 'username']);
  showLoginView();
});

// --- HÀM TẠO ITEM CHO DANH SÁCH (Hàm mới) ---
function createListItem(listing) {
  const li = document.createElement('li');
      
  const titleSpan = document.createElement('span');
  titleSpan.textContent = listing.title;
  titleSpan.title = listing.title;
  li.appendChild(titleSpan);
  
  const applyButton = document.createElement('button');
  
  // Nút sẽ có chữ khác nhau tùy theo status
  applyButton.textContent = (listing.status === 'applied') ? 'Áp dụng lại' : 'Áp dụng';
  
  applyButton.onclick = () => {
    applyButton.textContent = 'Đang...';
    applyButton.disabled = true;
    
    chrome.runtime.sendMessage(
      { type: "APPLY_LISTING", listingId: listing.id },
      (response) => {
        if (response && response.success) {
          // THAY ĐỔI LỚN: Thay vì xóa <li>,
          // chúng ta tải lại toàn bộ danh sách
          // để nó tự động chuyển từ "pending" -> "applied"
          loadListings();
        } else {
          alert(`Lỗi: ${response ? response.error : 'Không thể kết nối'}`);
          // Reset nút về trạng thái cũ
          applyButton.textContent = (listing.status === 'applied') ? 'Áp dụng lại' : 'Áp dụng';
          applyButton.disabled = false;
        }
      }
    );
  };
  
  li.appendChild(applyButton);
  return li;
}

// --- CẬP NHẬT HÀM TẢI DANH SÁCH ---
async function loadListings() {
  // Xóa nội dung cũ
  pendingList.innerHTML = '';
  appliedList.innerHTML = '';
  pendingListMessage.textContent = 'Đang tải...';
  appliedListMessage.textContent = ''; // Xóa tin nhắn danh sách đã áp dụng

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

    // Lọc danh sách ra làm 2
    const pending = listings.filter(l => l.status !== 'applied');
    const applied = listings.filter(l => l.status === 'applied');

    // Xử lý danh sách "Chưa áp dụng"
    if (pending.length === 0) {
      pendingListMessage.textContent = 'Không có listing nào đang chờ.';
    } else {
      pendingListMessage.textContent = '';
      pending.forEach((listing) => {
        pendingList.appendChild(createListItem(listing));
      });
    }

    // Xử lý danh sách "Đã áp dụng"
    if (applied.length === 0) {
      appliedListMessage.textContent = 'Chưa có listing nào được áp dụng.';
    } else {
      appliedListMessage.textContent = '';
      applied.forEach((listing) => {
        appliedList.appendChild(createListItem(listing));
      });
    }

  } catch (error) {
    console.error("Lỗi tải listings:", error);
    pendingListMessage.textContent = 'Lỗi khi tải danh sách.';
    if (error.message.includes("Chưa đăng nhập")) {
      showLoginView();
    }
  }
}