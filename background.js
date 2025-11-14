// background.js

// !!! QUAN TRỌNG: Thay thế URL này bằng URL Vercel app của bạn
const API_URL = "https://imagetoupload.vercel.app"; 

// Lắng nghe message từ popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "APPLY_LISTING") {
    console.log("Background nhận được yêu cầu:", request.listingId);
    
    (async () => {
      try {
        // 1. Lấy token đã lưu
        const { idToken } = await chrome.storage.local.get('idToken');
        if (!idToken) {
          throw new Error("Người dùng chưa đăng nhập.");
        }

        // 2. Gọi API để lấy chi tiết listing
        const response = await fetch(`${API_URL}/api/get-listing-details?id=${request.listingId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Không thể lấy chi tiết listing.");
        }
        
        console.log(`Đã lấy chi tiết listing, ${data.imageBase64s.length} ảnh`);

        // 3. Tìm tab Etsy đang hoạt động (ĐÃ CẬP NHẬT URL)
        const tabs = await chrome.tabs.query({
          active: true,
          url: [
            "https://*.etsy.com/your/listings/create*",
            "https://*.etsy.com/listing/copy/*",
            "https://*.etsy.com/your/shops/me/listing-editor/copy/*" 
          ]
        });

        if (tabs.length === 0) {
          throw new Error("Không tìm thấy tab Etsy đang mở. Hãy mở trang 'Tạo Listing' hoặc 'Copy Listing'.");
        }
        
        // 4. Gửi toàn bộ dữ liệu (đã có base64) cho content.js
        await chrome.tabs.sendMessage(tabs[0].id, { type: "FILL_FORM", data: data });

        sendResponse({ success: true });
        
      } catch (error) {
        console.error("Lỗi ở background.js:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; 
  }
});