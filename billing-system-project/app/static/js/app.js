// --- GLOBAL STATE ---
let productList = [];
let userList = [];
let shoppingCart = [];
let currentPatientDetails = {};
let transactionHistory = [];
let currentlyViewedTransaction = null;

// Signature Pad สำหรับผู้ให้คำปรึกษา
let signaturePad = null;
let consultantSignatureBase64 = '';

// Signature Pad สำหรับผู้ป่วย
let patientSignaturePad = null;
let patientSignatureBase64 = '';

// Pagination สำหรับประวัติการทำรายการ
let historyCurrentPage = 1;
const historyPageSize = 15;

// Pagination สำหรับตารางสินค้าทั้งหมด
let allProductsCurrentPage = 1;
const allProductsPageSize = 20;


// --- ฟังก์ชันช่วยเหลือ (Helper Functions) ---

/**
 * จัดรูปแบบตัวเลขให้มีทศนิยมและเพิ่มหน่วย "บาท"
 * @param {number} value - ตัวเลขที่ต้องการจัดรูปแบบ
 * @param {number} [decimals=2] - จำนวนทศนิยม
 * @returns {string} ตัวเลขที่จัดรูปแบบแล้ว
 */
function formatCurrency(value, decimals = 2) {
    // ตรวจสอบว่าเป็นตัวเลขที่ถูกต้องหรือไม่ ถ้าไม่ใช่ให้คืนค่าเป็น 0.00 บาท
    const number = parseFloat(value);
    if (isNaN(number)) {
        return (0).toLocaleString('th-TH', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + ' บาท';
    }
    return number.toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }) + ' บาท';
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    addNotificationStyles();
    await loadInitialData();
    await loadTransactionHistory();

    // เริ่มต้น Signature Pads
    initSignaturePad();
    initPatientSignaturePad();

    setupLoginModal();
    renderAllProductsTable();
    document.getElementById('patientType').addEventListener('change', renderAllProductsTable);
    
    const firstNameInput = document.getElementById('firstName');
    if (firstNameInput) {
        firstNameInput.focus();
    }

    // HN Formatting Script
    const hnInput = document.getElementById('patientHN');
    if (hnInput) {
        hnInput.addEventListener('input', function (e) {
            let value = e.target.value;
            let digits = value.replace(/\D/g, '');
            digits = digits.substring(0, 10); // Max 10 digits

            let formattedValue = '';
            if (digits.length > 0) {
                formattedValue += digits.substring(0, 2);
            }
            if (digits.length > 2) {
                formattedValue += '-' + digits.substring(2, 4);
            }
            if (digits.length > 4) {
                formattedValue += '-' + digits.substring(4, 10);
            }
            e.target.value = formattedValue;
        });
    }
});

/**
 * เริ่มต้น Signature Pad บน Canvas ของผู้ให้คำปรึกษา
 */
function initSignaturePad() {
    const canvas = document.getElementById('consultantSignatureCanvas');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)'
        });
        resizeCanvas(); // ปรับขนาดครั้งแรก
        window.addEventListener('resize', resizeCanvas);
    } else {
        console.warn("Canvas 'consultantSignatureCanvas' not found.");
    }
}

/**
 * เริ่มต้น Signature Pad บน Canvas ของผู้ป่วย
 */
function initPatientSignaturePad() {
    const canvas = document.getElementById('patientSignatureCanvas');
    if (canvas) {
        patientSignaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)'
        });
        resizePatientCanvas(); // ปรับขนาดครั้งแรก
        window.addEventListener('resize', resizePatientCanvas);
    } else {
        console.warn("Canvas 'patientSignatureCanvas' not found.");
    }
}

/**
 * ปรับขนาด Canvas ลายเซ็นผู้ให้คำปรึกษาให้พอดีและคมชัด
 */
function resizeCanvas() {
    if (!signaturePad) return;
    const canvas = signaturePad.canvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const newWidth = canvas.offsetWidth * ratio;
    const newHeight = canvas.offsetHeight * ratio;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        const data = signaturePad.toData();
        canvas.width = newWidth;
        canvas.height = newHeight;
        canvas.getContext('2d').scale(ratio, ratio);
        signaturePad.clear();
        signaturePad.fromData(data);
    }
}

/**
 * ปรับขนาด Canvas ลายเซ็นผู้ป่วยให้พอดีและคมชัด
 */
function resizePatientCanvas() {
    if (!patientSignaturePad) return;
    const canvas = patientSignaturePad.canvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const newWidth = canvas.offsetWidth * ratio;
    const newHeight = canvas.offsetHeight * ratio;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        const data = patientSignaturePad.toData();
        canvas.width = newWidth;
        canvas.height = newHeight;
        canvas.getContext('2d').scale(ratio, ratio);
        patientSignaturePad.clear();
        patientSignaturePad.fromData(data);
    }
}

/**
 * ล้างลายเซ็นผู้ให้คำปรึกษา
 */
function clearSignature() {
    if (signaturePad) {
        signaturePad.clear();
        consultantSignatureBase64 = '';
        const previewImg = document.getElementById('consultantSignaturePreview');
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
    }
}

/**
 * ล้างลายเซ็นผู้ป่วย
 */
function clearPatientSignature() {
    if (patientSignaturePad) {
        patientSignaturePad.clear();
        patientSignatureBase64 = '';
        const previewImg = document.getElementById('patientSignaturePreview');
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'none';
        }
    }
}

/**
 * บันทึกลายเซ็นผู้ให้คำปรึกษา
 */
function saveSignature() {
    if (signaturePad && !signaturePad.isEmpty()) {
        consultantSignatureBase64 = signaturePad.toDataURL('image/png');
        const previewImg = document.getElementById('consultantSignaturePreview');
        if (previewImg) {
            previewImg.src = consultantSignatureBase64;
            previewImg.style.display = 'block';
        }
        showSuccessNotification('บันทึกลายเซ็นผู้ให้คำปรึกษาเรียบร้อย!');
    } else {
        alert('กรุณาลงลายเซ็นผู้ให้คำปรึกษาก่อนบันทึกค่ะ');
    }
}

/**
 * บันทึกลายเซ็นผู้ป่วย
 */
function savePatientSignature() {
    if (patientSignaturePad && !patientSignaturePad.isEmpty()) {
        patientSignatureBase64 = patientSignaturePad.toDataURL('image/png');
        const previewImg = document.getElementById('patientSignaturePreview');
        if (previewImg) {
            previewImg.src = patientSignatureBase64;
            previewImg.style.display = 'block';
        }
        showSuccessNotification('บันทึกลายเซ็นผู้ป่วยเรียบร้อย!');
    } else {
        alert('กรุณาลงลายเซ็นผู้ป่วยก่อนบันทึกค่ะ');
    }
}

/**
 * แทรก CSS สำหรับการแจ้งเตือนและสไตล์อื่นๆ
 */
function addNotificationStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .success-notification {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background-color: #28a745; color: white; padding: 16px 30px;
            border-radius: 8px; z-index: 1001; font-size: 1.1em; font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0;
            transition: top 0.5s ease, opacity 0.5s ease;
        }
        .success-notification.show { top: 80px; opacity: 1; }
        #consultantSignatureCanvas, #patientSignatureCanvas {
            width: 400px; height: 250px; border: 1px dashed #ccc;
            border-radius: 8px; cursor: crosshair; touch-action: none;
        }
        .signature-buttons { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; width: 400px; }
        @media (max-width: 768px) {
            #consultantSignatureCanvas, #patientSignatureCanvas, .signature-buttons { width: 100%; }
            .signature-buttons { flex-direction: column; }
        }
        @media print {
            .signature-img { max-height: 40px; max-width: 180px; display: block; object-fit: contain; }
            .signature { text-align: center; }
            .page-break-after-item {
                page-break-after: always;
                break-after: page;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * แสดงข้อความแจ้งเตือน
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

/**
 * โหลดข้อมูลเริ่มต้น (สินค้า, ผู้ใช้) จาก API
 */
async function loadInitialData() {
    try {
        const response = await fetch('/api/initial-data', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        const data = await response.json();
        
        if (!data || !data.products || !data.users) throw new Error("Invalid data structure.");
        
        productList = data.products;
        userList = data.users;
        populateDropdowns();

    } catch (error) {
        console.error("CRITICAL ERROR loading initial data:", error);
        alert("ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์");
    }
}

/**
 * เติมข้อมูลลงใน Dropdown (แพทย์, ผู้ให้คำปรึกษา)
 */
function populateDropdowns() {
    const doctorSelect = document.getElementById('doctorName');
    const consultantSelect = document.getElementById('consultant');
    if (!doctorSelect || !consultantSelect) return;

    doctorSelect.innerHTML = '<option value="">-- เลือกแพทย์ --</option>';
    consultantSelect.innerHTML = '<option value="">-- เลือกผู้ให้คำปรึกษา --</option>';

    userList.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        if (user.role?.toLowerCase() === 'doctor') {
            doctorSelect.appendChild(option.cloneNode(true));
        } else if (user.role?.toLowerCase() === 'consultant') {
            consultantSelect.appendChild(option.cloneNode(true));
        }
    });
}

/**
 * เปิดแท็บที่ระบุ
 * @param {string} tabId - ID ของแท็บ
 */
function openTab(tabId) {
    if (tabId !== 'receiptTab') currentlyViewedTransaction = null;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-button[onclick*="'${tabId}'"]`).classList.add('active');
}

// --- Product and Cart Functions ---

/**
 * แสดงตารางสินค้าทั้งหมดพร้อม Pagination
 */
function renderAllProductsTable() {
    const allProductsBody = document.getElementById('allProductsBody');
    if (!allProductsBody) return;

    const searchTerm = document.getElementById('searchProduct')?.value.toLowerCase() || '';
    let displayProducts = productList.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchTerm)) ||
        (p.itemcode && p.itemcode.toLowerCase().includes(searchTerm))
    );
    displayProducts.sort((a, b) => (a.itemcode || '').localeCompare(b.itemcode || ''));

    const totalPages = Math.ceil(displayProducts.length / allProductsPageSize);
    const startIndex = (allProductsCurrentPage - 1) * allProductsPageSize;
    const paginatedProducts = displayProducts.slice(startIndex, startIndex + allProductsPageSize);

    allProductsBody.innerHTML = paginatedProducts.map(product => `
        <tr>
            <td>${product.itemcode || 'N/A'}</td>
            <td>${product.name || 'N/A'}</td>
            <td>${formatCurrency(product.opd || 0)}</td>
            <td>${formatCurrency(product.ipd || 0)}</td>
            <td>${formatCurrency(product.foreign_opd || 0)}</td>
            <td>${formatCurrency(product.foreign_ipd || 0)}</td>
            <td>${formatCurrency(product.staff || 0)}</td>
            <td><button onclick="addItemToCart('${product.itemcode}')" style="padding: 5px 10px;">+</button></td>
        </tr>
    `).join('');
    renderProductPagination(totalPages);
}

/**
 * แสดงปุ่ม Pagination สำหรับตารางสินค้า
 * @param {number} totalPages - จำนวนหน้าทั้งหมด
 */
function renderProductPagination(totalPages) {
    const paginationContainer = document.getElementById('productPagination');
    if (!paginationContainer || totalPages <= 1) {
        if(paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    let paginationHTML = `<button onclick="changeAllProductsPage(${allProductsCurrentPage - 1})" ${allProductsCurrentPage === 1 ? 'disabled' : ''}>&laquo; ก่อนหน้า</button>`;
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<button onclick="changeAllProductsPage(${i})" class="${i === allProductsCurrentPage ? 'active' : ''}">${i}</button>`;
    }
    paginationHTML += `<button onclick="changeAllProductsPage(${allProductsCurrentPage + 1})" ${allProductsCurrentPage === totalPages ? 'disabled' : ''}>ถัดไป &raquo;</button>`;
    paginationContainer.innerHTML = paginationHTML;
}

/**
 * เปลี่ยนหน้าของตารางสินค้า
 * @param {number} newPage - หน้าใหม่
 */
function changeAllProductsPage(newPage) {
    const totalPages = Math.ceil(productList.length / allProductsPageSize);
    if (newPage < 1 || newPage > totalPages) return;
    allProductsCurrentPage = newPage;
    renderAllProductsTable();
}

/**
 * ค้นหาสินค้า
 */
function searchProducts() {
    const searchTermEl = document.getElementById('searchProduct');
    const resultsDiv = document.getElementById('searchResults');
    if (!searchTermEl || !resultsDiv) return;

    const searchTerm = searchTermEl.value.toLowerCase();
    if (searchTerm.length < 1) {
        resultsDiv.innerHTML = '';
        return;
    }

    const patientTypeEl = document.getElementById('patientType');
    const patientTypeKey = patientTypeEl ? patientTypeEl.value.toLowerCase() : 'opd';

    const filtered = productList.filter(p =>
        (p.name && p.name.toLowerCase().includes(searchTerm)) ||
        (p.itemcode && p.itemcode.toLowerCase().includes(searchTerm))
    );

    resultsDiv.innerHTML = filtered.slice(0, 10).map(product => {
        const price = parseFloat(product[patientTypeKey] || 0);
        return `<div class="search-item" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" onclick="addItemToCart('${product.itemcode}')">[${product.itemcode}] ${product.name} - <strong>${formatCurrency(price, 2)}</strong></div>`;
    }).join('');
}

/**
 * ล้างการค้นหาสินค้า
 */
function clearSearch() {
    const searchInput = document.getElementById('searchProduct');
    const searchResults = document.getElementById('searchResults');
    if (!searchInput || !searchResults) return;
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchInput.focus();
}

/**
 * เพิ่มสินค้าลงในตะกร้า
 * @param {string} itemCode - รหัสสินค้า
 */
function addItemToCart(itemCode) {
    const product = productList.find(p => p.itemcode === itemCode);
    if (!product) {
        console.warn("Product not found for itemCode:", itemCode);
        alert("Product not found in available items. Please check product data.");
        return;
    }

    const patientTypeEl = document.getElementById('patientType');
    const patientTypeKey = patientTypeEl ? patientTypeEl.value.toLowerCase() : 'opd';

    const itemPrice = parseFloat(product[patientTypeKey] || 0);
    if (isNaN(itemPrice) || itemPrice < 0) {
        console.warn(`Product ${itemCode} (${product.name}) has invalid price (${itemPrice}) for patient type ${patientTypeKey}. Please check product data.`);
    }

    const existingItem = shoppingCart.find(item => item.itemcode === itemCode);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        shoppingCart.push({
            itemcode: product.itemcode,
            name: product.name,
            price: itemPrice,
            quantity: 1
        });
    }
    updateCartDisplay();
    clearSearch();
}
/**
 * อัปเดตการแสดงผลตะกร้าสินค้า
 */
function updateCartDisplay() {
    const cartBody = document.getElementById('cartItems');
    if (!cartBody) return;
    cartBody.innerHTML = shoppingCart.map((item, index) => `
        <tr>
            <td style="text-align: left;">${item.name}</td>
            <td>${item.itemcode}</td>
            <td>${formatCurrency(item.price)}</td>
            <td><input type="number" min="1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)" style="width: 60px;"></td>
            <td>${formatCurrency(item.price * item.quantity)}</td>
            <td><button onclick="removeFromCart(${index})" style="background-color:#e74c3c; padding: 5px 10px;">X</button></td>
        </tr>
    `).join('');
    updateBillingSummary();
}

/**
 * อัปเดตจำนวนสินค้าในตะกร้า
 * @param {number} index - ดัชนีสินค้า
 * @param {string|number} newQuantity - จำนวนใหม่
 */
function updateQuantity(index, newQuantity) {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
        shoppingCart.splice(index, 1);
    } else {
        shoppingCart[index].quantity = qty;
    }
    updateCartDisplay();
}

/**
 * ลบสินค้าออกจากตะกร้า
 * @param {number} index - ดัชนีสินค้า
 */
function removeFromCart(index) {
    shoppingCart.splice(index, 1);
    updateCartDisplay();
}


// --- Billing and Receipt Functions ---

/**
 * อัปเดตสรุปยอดชำระ
 * @returns {object} รายละเอียดการคำนวณบิล
 */
function updateBillingSummary() {
    const productTotal = shoppingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const depositAmount = parseFloat(document.getElementById('depositAmount').value) || 0;
    const grandTotal = productTotal;
    const outstandingBalance = grandTotal - depositAmount;

    document.getElementById('summaryGrandTotal').textContent = formatCurrency(grandTotal);
    document.getElementById('summaryDeposit').textContent = formatCurrency(depositAmount);
    document.getElementById('summaryOutstanding').textContent = formatCurrency(outstandingBalance);
    document.getElementById('cartTotal').textContent = formatCurrency(productTotal);

    return { productTotal, depositAmount, grandTotal, outstandingBalance };
}

/**
 * Performs a quick search by setting the search input value and triggering search.
 * ทำการค้นหาด่วนโดยกำหนดค่าในช่องค้นหาและเรียกฟังก์ชันค้นหา
 * @param {string} term - คำที่ต้องการค้นหา
 */
function quickSearch(term) {
    const searchInput = document.getElementById('searchProduct');
    if (searchInput) {
        searchInput.value = term;
        searchProducts();
    }
}
/**
 * สร้างและบันทึกใบเสร็จใหม่
 */
async function generateReceipt() {
    if (!document.getElementById('firstName').value.trim()) {
        alert("กรุณากรอกชื่อจริง");
        return;
    }
    if (signaturePad.isEmpty() || patientSignaturePad.isEmpty()) {
        alert("กรุณาลงลายเซ็นของผู้ให้คำปรึกษาและผู้ป่วยให้ครบถ้วน");
        return;
    }

    const ageValue = document.getElementById('patientAge').value.trim();
    const parsedAge = parseInt(ageValue, 10);
    if (!ageValue || isNaN(parsedAge) || parsedAge < 0) {
        alert("กรุณากรอกอายุให้ถูกต้อง!");
        return;
    }

    const doctorSelect = document.getElementById('doctorName');
    const consultantSelect = document.getElementById('consultant');
    
    const selectedDoctorName = userList.find(u => u.id === doctorSelect.value)?.name || 'N/A';
    const selectedConsultantName = userList.find(u => u.id === consultantSelect.value)?.name || 'N/A';

    currentPatientDetails = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        gender: document.getElementById('gender').value,
        patientHN: document.getElementById('patientHN').value.trim(),
        patientAge: parsedAge,
        type: document.getElementById('patientType').value,
        doctorId: doctorSelect.value,
        consultantId: consultantSelect.value,
        doctorName: selectedDoctorName,
        consultant: selectedConsultantName,
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        reviewStatus: Array.from(document.querySelectorAll('input[name="reviewStatus"]:checked')).map(cb => cb.value).join(','),
        comment: document.getElementById('comment').value.trim(),
        consultantSignature: consultantSignatureBase64,
        patientSignature: patientSignatureBase64
    };

    const transactionId = 'TXN-' + Date.now();
    const wasSaveSuccessful = await saveTransaction(transactionId);

    if (wasSaveSuccessful) {
        showSuccessNotification(`บันทึกข้อมูลสำเร็จ! (ID: ${transactionId})`);
        populateReceiptForDisplay(transactionId, currentPatientDetails, shoppingCart);
        openTab('receiptTab');
    }
}

/**
 * ส่งข้อมูลการทำรายการไปบันทึกที่ API
 * @param {string} transactionId - ID ของการทำรายการ
 * @returns {Promise<boolean>} true ถ้าสำเร็จ
 */
async function saveTransaction(transactionId) {
    const billing = updateBillingSummary();
    const transactionData = {
        transaction_id: transactionId,
        fname: currentPatientDetails.firstName,
        lname: currentPatientDetails.lastName,
        gender: currentPatientDetails.gender,
        patient_hn: currentPatientDetails.patientHN,
        patient_age: currentPatientDetails.patientAge,
        date: new Date().toISOString(),
        type: currentPatientDetails.type,
        cartItems: shoppingCart.map(item => ({ itemcode: item.itemcode, quantity: item.quantity, price: item.price })),
        total: billing.productTotal,
        doctor_id: currentPatientDetails.doctorId,
        consultant_id: currentPatientDetails.consultantId,
        doctor_name: currentPatientDetails.doctorName,
        consultant_name: currentPatientDetails.consultant,
        deposit_amount: billing.depositAmount,
        outstanding_balance: billing.outstandingBalance,
        payment_method: currentPatientDetails.paymentMethod,
        review_status: currentPatientDetails.reviewStatus,
        comment: currentPatientDetails.comment,
        consultant_signature_b64: currentPatientDetails.consultantSignature,
        patient_signature_b64: currentPatientDetails.patientSignature
    };

    try {
        const response = await fetch('/api/save-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Server error');
        await loadTransactionHistory();
        return true;
    } catch (error) {
        console.error("Error saving transaction:", error);
        alert("ไม่สามารถบันทึกการทำรายการได้: " + error.message);
        return false;
    }
}

/**
 * แสดงข้อมูลใบเสร็จบนหน้าจอ (รวมปุ่มแก้ไข)
 * @param {string} transactionId - ID การทำรายการ
 * @param {object} details - รายละเอียด
 * @param {Array} cart - รายการสินค้า
 * @param {object} [transaction=null] - ข้อมูลรายการเต็ม (จากประวัติ)
 */
function populateReceiptForDisplay(transactionId, details, cart, transaction = null) {
    const template = document.getElementById('receipt');
    const receiptContainer = document.querySelector('#receiptTab .receipt-preview-container');
    if (!template || !receiptContainer) return;

    const clone = template.cloneNode(true);
    clone.id = 'receipt_display';
    clone.classList.remove('print-area');

    const originalTitle = clone.querySelector('h2');
    if (originalTitle) {
        const headerWrapper = document.createElement('div');
        headerWrapper.style.display = 'flex';
        headerWrapper.style.justifyContent = 'space-between';
        headerWrapper.style.alignItems = 'center';
        
        const newTitle = document.createElement('h2');
        newTitle.textContent = originalTitle.textContent;
        
        const editIcon = document.createElement('i');
        editIcon.className = 'fas fa-cog';
        editIcon.title = 'แก้ไขรายการ';
        editIcon.style.cursor = 'pointer';
        editIcon.style.fontSize = '1.5rem';
        editIcon.onclick = () => {
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.dataset.redirectUrl = `/edit/${transactionId}`;
                loginModal.style.display = 'flex';
                const loginForm = document.getElementById('login-form');
                const errorMessageElement = document.getElementById('login-error-message');
                if (loginForm) loginForm.reset();
                if (errorMessageElement) errorMessageElement.style.display = 'none';
                document.getElementById('username').focus();
            }
        };
        
        headerWrapper.appendChild(newTitle);
        headerWrapper.appendChild(editIcon);
        originalTitle.parentNode.replaceChild(headerWrapper, originalTitle);
    }
    
    receiptContainer.innerHTML = '';
    receiptContainer.appendChild(clone);
    populatePrintableData(clone.id, transactionId, details, cart, transaction);
}


/**
 * เติมข้อมูลลงในส่วนที่พิมพ์ได้
 * @param {string} elementId - ID ของ container
 * @param {string} transactionId - ID การทำรายการ
 * @param {object} details - รายละเอียด
 * @param {Array} cart - รายการสินค้า
 * @param {object} [transaction=null] - ข้อมูลรายการเต็ม
 */
function populatePrintableData(elementId, transactionId, details, cart, transaction) {
    const container = document.getElementById(elementId);
    if (!container) return;

    const billing = transaction ? {
        productTotal: parseFloat(transaction.total || 0),
        depositAmount: parseFloat(transaction.deposit_amount || 0),
        outstandingBalance: parseFloat(transaction.outstanding_balance || 0),
    } : updateBillingSummary();

    // --- START: FIX for displayAge is not defined ---
    // ดึงค่าอายุที่ถูกต้องจาก `details` object ซึ่งมี `patientAge` อยู่เสมอ
    let displayAge = 'N/A';
    const age = details.patientAge;
    if (age !== null && age !== undefined && !isNaN(age)) {
        displayAge = `${age} ปี`;
    }
    // --- END: FIX ---

    const fields = {
        receiptId: transactionId,
        receiptDate: new Date(transaction ? transaction.date : Date.now()).toLocaleString('th-TH'),
        receiptName: `${details.firstName || ''} ${details.lastName || ''}`,
        receiptHN: details.patientHN || 'N/A',
        receiptGender: details.gender || 'N/A',
        receiptAge: displayAge, // ใช้ค่าอายุที่กำหนดไว้อย่างถูกต้อง
        receiptType: details.type,
        receiptDoctor: details.doctorName,
        receiptConsultant: details.consultant,
        receiptPaymentMethod: details.paymentMethod || 'N/A',
        receiptReviewStatus: details.reviewStatus || 'N/A',
        receiptSubtotal: billing.productTotal.toFixed(2),
        receiptGrandTotal: (billing.productTotal).toFixed(2),
        receiptDeposit: billing.depositAmount.toFixed(2),
        receiptOutstanding: billing.outstandingBalance.toFixed(2),
        comment: details.comment || 'N/A',
    };

    for (const key in fields) {
        const element = container.querySelector(`[data-field="${key}"]`);
        if (element) {
            element.textContent = ['receiptSubtotal', 'receiptGrandTotal', 'receiptDeposit', 'receiptOutstanding'].includes(key)
                ? parseFloat(fields[key]).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : fields[key];
        }
    }

    // จัดการลายเซ็นผู้ให้คำปรึกษา
    const consultantSigImg = container.querySelector('[data-field="receiptConsultantSignature"]');
    if (consultantSigImg) {
        const sigSrc = transaction?.consultant_signature_filename 
            ? `/static/signatures/${transaction.consultant_signature_filename}` 
            : (transaction?.consultant_signature_b64 || details.consultantSignature);
        
        if (sigSrc) {
            consultantSigImg.src = sigSrc;
            consultantSigImg.style.display = 'block';
        } else {
            consultantSigImg.style.display = 'none';
        }
    }

    // จัดการลายเซ็นผู้ป่วย
    const patientSigImg = container.querySelector('[data-field="receiptPatientSignature"]');
    if (patientSigImg) {
        const sigSrc = transaction?.patient_signature_filename 
            ? `/static/signatures/${transaction.patient_signature_filename}` 
            : (transaction?.patient_signature_b64 || details.patientSignature);

        if (sigSrc) {
            patientSigImg.src = sigSrc;
            patientSigImg.style.display = 'block';
        } else {
            patientSigImg.style.display = 'none';
        }
    }
    
    // เติมข้อมูลรายการสินค้า
    const receiptItemsBody = container.querySelector('#receiptItemsTable_print tbody');
    if (receiptItemsBody) {
        if (cart && cart.length > 0) {
            let rowsHtml = '';
            cart.forEach((item, index) => {
                const name = item.name || 'N/A';
                const itemcode = item.itemcode || 'N/A';
                const price = parseFloat(item.price || 0);
                const quantity = parseInt(item.quantity || 0);
                const itemTotal = price * quantity;
                
                rowsHtml += `
                <tr>
                    <td style="text-align: left;">${name}</td>
                    <td>${itemcode}</td>
                    <td>${formatCurrency(price)}</td>
                    <td>${quantity}</td>
                    <td>${formatCurrency(itemTotal)}</td>
                </tr>`;

                // จัดการการแบ่งหน้า
                if ((index + 1) % 10 === 0 && (index + 1) < cart.length) {
                    rowsHtml += `<tr class="page-break-after-item"><td colspan="5" style="border:none; padding:0; height:0;"></td></tr>`;
                }
            });
            receiptItemsBody.innerHTML = rowsHtml;
        } else {
            receiptItemsBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">ไม่มีรายการสินค้า</td></tr>`;
        }
    }
}

/**
 * สั่งพิมพ์ใบเสร็จหลัก
 */
function printMainReceipt() {
    const isHistoryView = !!currentlyViewedTransaction;
    let details, cart, transactionId, transactionDataForPrint = null;

    if (isHistoryView) {
        transactionDataForPrint = currentlyViewedTransaction;
        cart = Array.isArray(transactionDataForPrint.products_list) ? transactionDataForPrint.products_list : [];
        transactionId = transactionDataForPrint.transaction_id;
        
        details = {
            ...transactionDataForPrint,
            firstName: transactionDataForPrint.fname,
            lastName: transactionDataForPrint.lname,
            patientHN: transactionDataForPrint.patient_hn || 'N/A',
            patientAge: transactionDataForPrint.patientAge, // ใช้ patientAge (camelCase)
            doctorName: transactionDataForPrint.doctor_name,
            consultant: transactionDataForPrint.consultant_name,
            paymentMethod: transactionDataForPrint.payment_method || 'N/A',
            reviewStatus: transactionDataForPrint.review_status || 'N/A',
            consultantSignature: transactionDataForPrint.consultant_signature_b64,
            patientSignature: transactionDataForPrint.patient_signature_b64
        };
    } else {
        details = currentPatientDetails;
        cart = shoppingCart;
        transactionId = document.querySelector('#receipt_display [data-field="receiptId"]')?.textContent || 'N/A';
    }
    
    populatePrintableData('receipt', transactionId, details, cart, transactionDataForPrint);
    window.print();
}

/**
 * รีเซ็ตฟอร์มทั้งหมด
 */
function resetFlow() {
    document.getElementById('mainForm').reset();
    
    shoppingCart = [];
    currentPatientDetails = {};
    currentlyViewedTransaction = null;

    clearSignature();
    consultantSignatureBase64 = '';
    clearPatientSignature();
    patientSignatureBase64 = '';

    clearSearch();
    updateCartDisplay();
    openTab('mainTab');
    document.getElementById('firstName').focus();
}


// --- History Functions ---

/**
 * โหลดประวัติการทำรายการ
 */
async function loadTransactionHistory() {
    try {
        // --- เพิ่ม options object ที่มี headers เข้าไปตรงนี้ ---
        const response = await fetch('/api/transaction-history', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        // --------------------------------------------------

        if (!response.ok) {
            transactionHistory = [];
        } else {
            transactionHistory = await response.json() || [];
        }
        searchHistory();
    } catch (error) {
        console.error("Error loading transaction history:", error);
        transactionHistory = [];
        searchHistory();
    }
}

/**
 * ค้นหาและแสดงผลประวัติ
 */
function searchHistory() {
    const searchTerm = document.getElementById('historySearch').value.toLowerCase();
    const historyDiv = document.getElementById('historyResults');
    if (!historyDiv) return;

    const sortedHistory = [...transactionHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    const filtered = sortedHistory.filter(txn =>
        (txn.fname && String(txn.fname).toLowerCase().includes(searchTerm)) ||
        (txn.lname && String(txn.lname).toLowerCase().includes(searchTerm)) ||
        (txn.patient_hn && String(txn.patient_hn).toLowerCase().includes(searchTerm)) ||
        (txn.transaction_id && String(txn.transaction_id).toLowerCase().includes(searchTerm)) ||
        (txn.doctor_name && String(txn.doctor_name).toLowerCase().includes(searchTerm)) ||
        (txn.consultant_name && String(txn.consultant_name).toLowerCase().includes(searchTerm)) ||
        (txn.patientAge && String(txn.patientAge).toLowerCase().includes(searchTerm)) // ค้นหาจาก patientAge
    );
    
    historyCurrentPage = 1; // Reset page on new search
    renderHistoryPage(filtered);
}

/**
 * แสดงผลประวัติในหน้าปัจจุบัน
 * @param {Array} filteredHistory - ประวัติที่กรองแล้ว
 */
function renderHistoryPage(filteredHistory) {
    const historyDiv = document.getElementById('historyResults');
    const totalPages = Math.ceil(filteredHistory.length / historyPageSize);
    const startIndex = (historyCurrentPage - 1) * historyPageSize;
    const paginatedItems = filteredHistory.slice(startIndex, startIndex + historyPageSize);
    
    if (paginatedItems.length === 0) {
        historyDiv.innerHTML = '<p>ไม่พบประวัติการทำรายการ</p>';
    } else {
        historyDiv.innerHTML = paginatedItems.map(txn => {
            const ageDisplay = (txn.patientAge !== null && txn.patientAge !== undefined) ? `${txn.patientAge} ปี` : 'N/A';
            return `
            <div onclick="viewReceiptFromHistory('${txn.transaction_id}')" style="padding: 10px; border: 1px solid #ddd; margin-bottom: 5px; cursor: pointer; border-radius: 8px;">
                <strong>${txn.fname || ''} ${txn.lname || ''}</strong> (HN: ${txn.patient_hn || 'N/A'}) (อายุ: ${ageDisplay})
                <div style="float: right;">ค้างชำระ: <strong style="color: #c0392b;">${formatCurrency(txn.outstanding_balance || 0)}</strong></div>
                <div style="font-size:0.9em; color: #555;">ID: ${txn.transaction_id} | วันที่: ${new Date(txn.date).toLocaleDateString('th-TH')}</div>
            </div>`;
        }).join('');
    }
    renderHistoryPagination(totalPages, filteredHistory);
}

/**
 * แสดง Pagination สำหรับประวัติ
 * @param {number} totalPages - จำนวนหน้าทั้งหมด
 * @param {Array} filteredHistory - ประวัติที่กรองแล้ว
 */
function renderHistoryPagination(totalPages, filteredHistory) {
    const paginationContainer = document.getElementById('historyPagination');
    if (!paginationContainer || totalPages <= 1) {
        if(paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    let paginationHTML = `<button onclick="changeHistoryPage(-1, ${totalPages})" ${historyCurrentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
    paginationHTML += `<span> หน้า ${historyCurrentPage} / ${totalPages} </span>`;
    paginationHTML += `<button onclick="changeHistoryPage(1, ${totalPages})" ${historyCurrentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
    paginationContainer.innerHTML = paginationHTML;
    
    paginationContainer.querySelector('button:first-child').onclick = () => changeHistoryPage(historyCurrentPage - 1, totalPages, filteredHistory);
    paginationContainer.querySelector('button:last-child').onclick = () => changeHistoryPage(historyCurrentPage + 1, totalPages, filteredHistory);
}

/**
 * เปลี่ยนหน้าของประวัติ
 * @param {number} newPage - หน้าใหม่
 * @param {number} totalPages - จำนวนหน้าทั้งหมด
 * @param {Array} filteredHistory - ประวัติที่กรองแล้ว
 */
function changeHistoryPage(newPage, totalPages, filteredHistory) {
    if (newPage < 1 || newPage > totalPages) return;
    historyCurrentPage = newPage;
    renderHistoryPage(filteredHistory);
}


/**
 * แสดงใบเสร็จจากประวัติ
 * @param {string} txnId - ID การทำรายการ
 */
function viewReceiptFromHistory(txnId) {
    const txn = transactionHistory.find(t => t.transaction_id === txnId);
    if (!txn) { alert("ไม่พบการทำรายการนี้!"); return; }
    currentlyViewedTransaction = txn;

    const cart = Array.isArray(txn.products_list) ? txn.products_list : [];
    
    const detailsForReceipt = {
        firstName: txn.fname,
        lastName: txn.lname,
        gender: txn.gender,
        patientHN: txn.patient_hn || 'N/A',
        patientAge: txn.patientAge, // ใช้ patientAge (camelCase)
        type: txn.type,
        doctorName: txn.doctor_name || 'N/A',
        consultant: txn.consultant_name || 'N/A',
        paymentMethod: txn.payment_method,
        reviewStatus: txn.review_status,
        comment: txn.comment,
        consultantSignature: txn.consultant_signature_b64,
        patientSignature: txn.patient_signature_b64
    };
    
    populateReceiptForDisplay(txn.transaction_id, detailsForReceipt, cart, txn);
    openTab('receiptTab');
}

// --- Login Modal ---
function setupLoginModal() {
    const loginIcon = document.getElementById('login-icon');
    const loginModal = document.getElementById('login-modal');
    const closeModalButton = document.querySelector('.modal-close-button');
    const loginForm = document.getElementById('login-form');
    const errorMessageElement = document.getElementById('login-error-message');

    if (!loginIcon || !loginModal || !closeModalButton || !loginForm) return;

    loginIcon.addEventListener('click', () => {
        loginModal.dataset.redirectUrl = '/crud'; // Default redirect for admin icon
        loginModal.style.display = 'flex';
        errorMessageElement.style.display = 'none';
        loginForm.reset();
        document.getElementById('username').focus();
    });

    closeModalButton.addEventListener('click', () => loginModal.style.display = 'none');
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.style.display = 'none';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        errorMessageElement.style.display = 'none';
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok && data.status === 'success') {
                showSuccessNotification('เข้าสู่ระบบสำเร็จ!');
                loginModal.style.display = 'none';
                const redirectUrl = loginModal.dataset.redirectUrl || data.redirect_url;
                setTimeout(() => { window.location.href = redirectUrl; }, 1000);
            } else {
                errorMessageElement.textContent = data.message || 'เกิดข้อผิดพลาด';
                errorMessageElement.style.display = 'block';
            }
        } catch (error) {
            errorMessageElement.textContent = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
            errorMessageElement.style.display = 'block';
        }
    });
}