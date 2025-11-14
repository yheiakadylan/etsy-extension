// content.js
console.log("AI Studio Helper đã được tiêm vào trang!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FILL_FORM") {
    console.log("Content script nhận được data:", request.data);
    const data = request.data;
    
    try {
      // Bắt đầu điền form
      fillField('textarea[name="title"]', data.title); // Sửa selector cho title
      fillField('textarea[name="description"]', data.description); // Sửa selector cho description
      
      // Xử lý Tags (phần này hơi phức tạp)
      fillTags(data.tags);

      // Xử lý Ảnh (phần KHÓ NHẤT)
      uploadImages(data.imageBase64s);

      sendResponse({ success: true });
    } catch (error) {
      console.error("Lỗi khi điền form:", error);
      alert(`Extension Lỗi: ${error.message}. Có thể giao diện Etsy đã thay đổi.`);
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

// Hàm hỗ trợ điền text (và kích hoạt React)
function fillField(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    // Gán giá trị một cách tự nhiên
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 
      'value'
    )?.set;
    
    if (nativeValueSetter) {
        nativeValueSetter.call(element, value);
    } else {
        // Fallback
        element.value = value;
    }

    // Gửi sự kiện 'input' và 'change' để React của Etsy nhận biết
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    throw new Error(`Không tìm thấy element: ${selector}`);
  }
}

// Hàm hỗ trợ điền tags (cần kiểm tra lại selector)
function fillTags(tags) {
  // Selector cho input tags của Etsy (có thể thay đổi)
  const tagInput = document.querySelector('input[name="tags"]');
  if (tagInput) {
    tags.forEach(tag => {
      tagInput.value = tag;
      tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, bubbles: true }));
    });
  } else {
    console.warn("Không tìm thấy ô nhập tag (input[name='tags']). Bỏ qua...");
  }
}

// --- PHẦN KHÓ NHẤT: UPLOAD ẢNH ---
async function uploadImages(base64s) {
  // 1. Tìm khu vực dropzone (Bạn PHẢI tự tìm selector này)
  // Đây là selector khả thi nhất cho dropzone của Etsy
  const dropzone = document.querySelector('div[data-ui-id="drop-zone-overlay"]');
  
  if (!dropzone) {
    throw new Error("Không tìm thấy khu vực upload ảnh (dropzone). Giao diện Etsy đã thay đổi.");
  }

  // 2. Chuyển base64 về File Object
  const files = await Promise.all(
    base64s.map((b64, index) => base64ToFile(b64, `mockup-${index}.png`))
  );

  // 3. Tạo sự kiện Kéo và Thả
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));

  // 4. Mô phỏng sự kiện
  dropzone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
  dropzone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
  dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
  
  console.log("Đã mô phỏng thả ảnh!");
}

// Hàm hỗ trợ chuyển Base64 sang File
async function base64ToFile(base64, filename) {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}