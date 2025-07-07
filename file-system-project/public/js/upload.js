document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('upload-form');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const cancelBtn = document.getElementById('cancel-btn'); // 1. ดึงปุ่ม Cancel เข้ามา

    if (!form || !dropZone || !fileInput || !cancelBtn) return;

    const originalDropZoneHTML = dropZone.innerHTML; // เก็บข้อความดั้งเดิมไว้

    // ---- Event Listeners สำหรับ Drag & Drop ----
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        fileInput.files = e.dataTransfer.files;
        handleFiles(fileInput.files);
    }, false);

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    // 2. เพิ่ม Event Listener ให้กับปุ่ม Cancel
    cancelBtn.addEventListener('click', () => {
        resetUploadUI();
    });

    // ฟังก์ชันจัดการไฟล์ที่ถูกเลือก/วาง
    function handleFiles(files) {
        if (files.length > 0) {
            dropZone.innerHTML = `<i class="fas fa-check-circle"></i> ${files.length} file(s) selected`;
            uploadBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block'; // แสดงปุ่ม Cancel
        } else {
            resetUploadUI();
        }
    }

    // 3. สร้างฟังก์ชันสำหรับ Reset UI
    function resetUploadUI() {
        fileInput.value = null; // ล้างไฟล์ที่เลือกใน input
        dropZone.innerHTML = originalDropZoneHTML; // คืนค่าข้อความเดิม
        uploadBtn.style.display = 'none'; // ซ่อนปุ่ม Upload
        cancelBtn.style.display = 'none'; // ซ่อนปุ่ม Cancel
    }
});
