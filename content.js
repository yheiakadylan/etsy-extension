// content.js
console.log("AI Studio Helper đã được tiêm vào trang! (v3)");

// Hàm hỗ trợ delay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- LÀM CHO LISTENER BẤT ĐỒNG BỘ ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FILL_FORM") {
    console.log("Content script nhận được data:", request.data);
    const data = request.data;
    
    // Dùng (async () => {})() để xử lý bất đồng bộ
    (async () => {
      try {
        // 1. Điền Title
        fillField('#listing-title-input', data.title);
        
        // 2. Điền Description
        fillField('#listing-description-textarea', data.description);
        
        // 3. Điền Tags (kiểu mới)
        fillTags(data.tags);

        // 4. Xóa ảnh cũ (TÍNH NĂNG MỚI)
        await deleteExistingImages();

        // 5. Upload ảnh mới
        await uploadImages(data.imageBase64s);

        sendResponse({ success: true });
      } catch (error) {
        console.error("Lỗi khi điền form:", error);
        alert(`Extension Lỗi: ${error.message}. Có thể giao diện Etsy đã thay đổi.`);
        sendResponse({ success: false, error: error.message });
      }
    })(); // Gọi hàm async ngay lập tức
  }
  return true; // Rất quan trọng: Báo với Chrome là sendResponse sẽ được gọi sau
});

// Hàm fillField (giữ nguyên, không đổi)
function fillField(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    // Gán giá trị một cách tự nhiên
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

// --- HÀM TAGS ĐÃ SỬA ---
async function fillTags(tags) {
  // --- CẬP NHẬT SELECTORS ---
  const tagInput = document.querySelector('#listing-tags-input');
  const addButton = document.querySelector('#listing-tags-button'); // Nút "Add"

  if (tagInput && addButton) {
    // 1. Gộp tất cả tag thành MỘT chuỗi, cách nhau bằng dấu phẩy
    const tagString = tags.join(',');

    // 2. Điền MỘT chuỗi này vào ô input
    fillField('#listing-tags-input', tagString);
    await wait(100);    
    // 3. Click nút "Add" để Etsy xử lý chuỗi
    addButton.click();
    
    console.log("Đã điền chuỗi tag và click 'Add'.");
  } else {
    console.warn("Không tìm thấy ô nhập tag (#listing-tags-input) hoặc nút 'Add' (#listing-tags-button). Bỏ qua tags...");
  }
}

// --- HÀM MỚI: XÓA ẢNH CŨ ---
async function deleteExistingImages() {
  console.log("Đang tìm và xóa ảnh cũ...");
  // Selector dựa trên HTML bạn cung cấp
  const deleteButtons = document.querySelectorAll('button[data-testid="image-delete-button"]');
  
  if (deleteButtons.length === 0) {
    console.log("Không tìm thấy ảnh cũ để xóa.");
    return;
  }

  console.log(`Tìm thấy ${deleteButtons.length} ảnh cũ. Đang xóa...`);
  
  for (const button of deleteButtons) {
    button.click();
    // Chờ một chút để UI kịp cập nhật
    await wait(250); 
  }
  
  console.log("Đã xóa xong ảnh cũ. Chờ 1 giây trước khi upload ảnh mới...");
  // Chờ 1 giây để Etsy xử lý xong việc xóa
  await wait(1000); 
}

// --- HÀM UPLOAD ẢNH (giữ nguyên, chỉ gọi sau hàm xóa) ---
async function uploadImages(base64s) {
  console.log("Bắt đầu upload ảnh mới...");
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
  
  console.log("Đã mô phỏng thả ảnh mới!");
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