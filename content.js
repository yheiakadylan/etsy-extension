// content.js
console.log("AI Studio Helper đã được tiêm vào trang!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FILL_FORM") {
    console.log("Content script nhận được data:", request.data);
    const data = request.data;
    
    try {
      // --- CẬP NHẬT SELECTORS ---
      // Title
      fillField('#listing-title-input', data.title);
      
      // Description
      fillField('#listing-description-textarea', data.description);
      
      // Tags
      fillTags(data.tags);

      // Ảnh
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
    // (Kiểm tra xem element là textarea hay input, mặc dù cả 2 đều có prototype này)
    const prototype = (element.tagName === 'TEXTAREA') 
        ? window.HTMLTextAreaElement.prototype 
        : window.HTMLInputElement.prototype;
        
    const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (nativeValueSetter) {
        nativeValueSetter.call(element, value);
    } else {
        element.value = value; // Fallback
    }

    // Gửi sự kiện 'input' và 'change' để React của Etsy nhận biết
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    throw new Error(`Không tìm thấy element: ${selector}`);
  }
}

// Hàm hỗ trợ điền tags (cập nhật selector)
function fillTags(tags) {
  // --- CẬP NHẬT SELECTORS ---
  const tagInput = document.querySelector('#listing-tags-input');
  const addButton = document.querySelector('#listing-tags-button'); // Nút "Add" mới

  if (tagInput && addButton) {
    tags.forEach(tag => {
      // Dùng hàm fillField để React nhận diện
      fillField('#listing-tags-input', tag);
      
      // Click nút "Add"
      addButton.click();
    });
  } else {
    console.warn("Không tìm thấy ô nhập tag (#listing-tags-input) hoặc nút 'Add' (#listing-tags-button). Bỏ qua tags...");
  }
}

// --- PHẦN UPLOAD ẢNH (CẬP NHẬT SELECTOR) ---
async function uploadImages(base64s) {
  // --- CẬP NHẬT SELECTOR ---
  // Chúng ta sẽ nhắm mục tiêu vào khu vực upload chính
  const dropzone = document.querySelector('div[data-clg-id="WtUploadArea"]');
  
  if (!dropzone) {
    // Fallback: Thử tìm một input file trống
    const fileInput = document.querySelector('input[name="listing-media-upload"]');
    if (fileInput) {
      console.log("Không tìm thấy WtUploadArea, thử dùng input file trực tiếp...");
      await uploadImagesToInput(fileInput, base64s);
      return;
    }
    throw new Error("Không tìm thấy khu vực upload ảnh (WtUploadArea) hoặc input file. Giao diện Etsy đã thay đổi.");
  }

  const files = await Promise.all(
    base64s.map((b64, index) => base64ToFile(b64, `mockup-${index}.png`))
  );

  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));

  // Mô phỏng sự kiện
  dropzone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
  dropzone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
  dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
  
  console.log("Đã mô phỏng thả ảnh!");
}

// Hàm fallback: upload trực tiếp vào input
async function uploadImagesToInput(fileInput, base64s) {
  const files = await Promise.all(
    base64s.map((b64, index) => base64ToFile(b64, `mockup-${index}.png`))
  );

  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));

  fileInput.files = dataTransfer.files;
  // Kích hoạt sự kiện onchange
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  console.log("Đã gán file vào input!");
}


// Hàm hỗ trợ chuyển Base64 sang File (giữ nguyên)
async function base64ToFile(base64, filename) {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}