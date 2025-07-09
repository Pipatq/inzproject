// --- GLOBAL STATE for Edit Page ---
let transactionData = {}; // Stores the original transaction data
let shoppingCart = [];    // Represents the current state of the cart
let productList = [];     // List of all available products
let userList = [];        // List of all staff/users
let transactionVersions = []; // History of transaction versions
let consultantSignaturePad, patientSignaturePad;
let newConsultantSignature = ''; // To store new signature data
let newPatientSignature = '';     // To store new signature data

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure the global TRANSACTION_ID is available from the HTML
    if (typeof TRANSACTION_ID === 'undefined' || !TRANSACTION_ID) {
        alert('ไม่พบรหัสรายการ (Transaction ID)');
        return;
    }
    document.getElementById('txnIdHeader').textContent = TRANSACTION_ID;

    // Initialize Signature Pads
    consultantSignaturePad = new SignaturePad(document.getElementById('consultantSignatureCanvas'));
    patientSignaturePad = new SignaturePad(document.getElementById('patientSignatureCanvas'));
    window.addEventListener('resize', () => {
        resizeCanvas(consultantSignaturePad);
        resizeCanvas(patientSignaturePad);
    });

    // Add listeners to capture new signature data
    consultantSignaturePad.onEnd = () => { newConsultantSignature = consultantSignaturePad.toDataURL(); updateReceiptPreview(); };
    patientSignaturePad.onEnd = () => { newPatientSignature = patientSignaturePad.toDataURL(); updateReceiptPreview(); };

    // Load all necessary data
    await loadInitialData();
    await loadTransactionForEdit();
    await loadTransactionVersions();

    // Add event listeners to form inputs to update the receipt preview in real-time
    addFormEventListeners();
});


// --- DATA LOADING ---

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

async function loadTransactionForEdit() {
    try {
        // --- เพิ่ม options object ที่มี headers เข้าไปตรงนี้ ---
        const response = await fetch(`/api/transaction/${TRANSACTION_ID}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        // --------------------------------------------------

        if (!response.ok) throw new Error((await response.json()).message);
        
        transactionData = await response.json();
        shoppingCart = transactionData.products_list || [];

        populateForm(transactionData);
        updateCartDisplay();
        
    } catch (error) {
        console.error(`Failed to load transaction:`, error);
        document.getElementById('edit-form-container').innerHTML = `<p style="color:red;">Could not load transaction data: ${error.message}</p>`;
    }
}

async function loadTransactionVersions() {
    try {
        const response = await fetch(`/api/transaction/${TRANSACTION_ID}/versions`);
        if (!response.ok) throw new Error('Could not fetch transaction versions.');
        transactionVersions = await response.json();
        populateVersionDropdown();
    } catch (error) {
        console.error("Failed to load transaction versions:", error);
    }
}


// --- UI & FORM POPULATION ---

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

function populateForm(data) {
    document.getElementById('firstName').value = data.fname || '';
    document.getElementById('lastName').value = data.lname || '';
    document.getElementById('gender').value = data.gender || '';
    document.getElementById('patientHN').value = data.patient_hn || '';
    document.getElementById('patientAge').value = data.patientAge ?? '';
    document.getElementById('patientType').value = data.type || 'opd';
    document.getElementById('doctorName').value = data.doctor_id || '';
    document.getElementById('consultant').value = data.consultant_id || '';
    document.getElementById('depositAmount').value = data.deposit_amount || 0;
    document.getElementById('comment').value = data.comment || '';
    
    const paymentMethod = data.payment_method;
    if (paymentMethod) {
        const radio = document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`);
        if (radio) radio.checked = true;
    }

    const reviewStatuses = data.review_status ? data.review_status.split(',') : [];
    document.querySelectorAll('input[name="reviewStatus"]').forEach(checkbox => {
        checkbox.checked = reviewStatuses.includes(checkbox.value);
    });

    displaySignature('consultant', data.consultant_signature_filename);
    displaySignature('patient', data.patient_signature_filename);
}

function displaySignature(type, filename) {
    const previewImg = document.getElementById(`${type}SignaturePreview`);
    if (filename) {
        previewImg.src = `/static/signatures/${filename}?t=${new Date().getTime()}`;
        previewImg.style.display = 'block';
    } else {
        previewImg.style.display = 'none';
    }
}

// --- REAL-TIME PREVIEW ---

function updateReceiptPreview() {
    const container = document.getElementById('receiptPreviewContainer');
    const template = document.getElementById('receipt');
    if (!container || !template) return;

    const clone = template.cloneNode(true);
    clone.id = 'receipt_display_clone';
    clone.classList.remove('print-area');

    container.innerHTML = '';
    container.appendChild(clone);

    const currentFormData = collectCurrentFormData(true);
    populatePrintableData(clone.id, currentFormData, shoppingCart);
}

function populatePrintableData(elementId, data, cart) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    const total = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
    const deposit = parseFloat(data.deposit_amount) || 0;
    const findUser = (id) => userList.find(u => u.id === id)?.name || 'N/A';

    const fields = {
        receiptId: data.transaction_id,
        receiptDate: data.date ? new Date(data.date).toLocaleString('th-TH') : new Date().toLocaleString('th-TH'),
        receiptName: `${data.fname || ''} ${data.lname || ''}`.trim(),
        receiptHN: data.patient_hn || 'N/A',
        receiptGender: data.gender || 'N/A',
        receiptAge: data.patient_age ? `${data.patient_age} ปี` : 'N/A',
        receiptType: data.type,
        receiptDoctor: findUser(data.doctor_id),
        receiptConsultant: findUser(data.consultant_id),
        receiptPaymentMethod: data.payment_method || 'N/A',
        receiptReviewStatus: data.review_status || 'N/A',
        comment: data.comment || 'N/A',
        receiptSubtotal: formatCurrency(total),
        receiptGrandTotal: formatCurrency(total),
        receiptDeposit: formatCurrency(deposit),
        receiptOutstanding: formatCurrency(total - deposit)
    };
    
    for (const key in fields) {
        const element = container.querySelector(`[data-field="${key}"]`);
        if (element) element.textContent = fields[key];
    }

    const itemsBody = container.querySelector('#receiptItemsTable_print tbody');
    if (itemsBody) {
        if (cart && cart.length > 0) {
            let rowsHtml = '';
            cart.forEach((item, index) => {
                const itemTotal = (item.price || 0) * (item.quantity || 0);
                rowsHtml += `
                    <tr>
                        <td>${item.name || 'N/A'}</td>
                        <td>${item.itemcode || 'N/A'}</td>
                        <td>${formatCurrency(item.price || 0)}</td>
                        <td>${item.quantity || 0}</td>
                        <td>${formatCurrency(itemTotal)}</td>
                    </tr>`;

                if ((index + 1) % 10 === 0 && (index + 1) < cart.length) {
                    rowsHtml += `<tr class="page-break-after-item"><td colspan="5" style="border:none; padding:0; height:0;"></td></tr>`;
                }
            });
            itemsBody.innerHTML = rowsHtml;
        } else {
            itemsBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">ไม่มีรายการสินค้า</td></tr>`;
        }
    }

    const consultantImg = container.querySelector('[data-field="receiptConsultantSignature"]');
    const patientImg = container.querySelector('[data-field="receiptPatientSignature"]');

    if (consultantImg) {
        const sigSrc = data.consultant_signature_b64 || (data.consultant_signature_filename ? `/static/signatures/${data.consultant_signature_filename}` : '');
        if (sigSrc) { consultantImg.src = sigSrc; consultantImg.style.display = 'block'; } else { consultantImg.style.display = 'none'; }
    }
    if (patientImg) {
        const sigSrc = data.patient_signature_b64 || (data.patient_signature_filename ? `/static/signatures/${data.patient_signature_filename}` : '');
        if (sigSrc) { patientImg.src = sigSrc; patientImg.style.display = 'block'; } else { patientImg.style.display = 'none'; }
    }
}


// --- ACTIONS & EVENT HANDLERS ---

function addFormEventListeners() {
    const form = document.getElementById('edit-form-container');
    form.addEventListener('input', (event) => {
        if (event.target.matches('input, select, textarea')) {
            if (event.target.id === 'patientType') {
                updatePricesInCart();
            } else {
                updateReceiptPreview();
            }
        }
    });
    form.addEventListener('change', (event) => {
        if (event.target.matches('input[type="radio"], input[type="checkbox"]')) {
            updateReceiptPreview();
        }
    });
}

function collectCurrentFormData(useGlobalVariableForPreview = false) {
    const ageValue = document.getElementById('patientAge').value.trim();
    const data = {
        transaction_id: TRANSACTION_ID,
        date: transactionData.date,
        fname: document.getElementById('firstName').value.trim(),
        lname: document.getElementById('lastName').value.trim(),
        patient_hn: document.getElementById('patientHN').value.trim(),
        patient_age: ageValue === '' ? null : parseInt(ageValue, 10),
        gender: document.getElementById('gender').value,
        type: document.getElementById('patientType').value,
        doctor_id: document.getElementById('doctorName').value,
        consultant_id: document.getElementById('consultant').value,
        deposit_amount: parseFloat(document.getElementById('depositAmount').value) || 0,
        payment_method: document.querySelector('input[name="paymentMethod"]:checked')?.value || '',
        review_status: Array.from(document.querySelectorAll('input[name="reviewStatus"]:checked')).map(cb => cb.value).join(','),
        comment: document.getElementById('comment').value.trim(),
        consultant_signature_filename: transactionData.consultant_signature_filename,
        patient_signature_filename: transactionData.patient_signature_filename,
        consultant_signature_b64: null,
        patient_signature_b64: null,
    };

    if (useGlobalVariableForPreview) {
        if (newConsultantSignature) data.consultant_signature_b64 = newConsultantSignature;
        if (newPatientSignature) data.patient_signature_b64 = newPatientSignature;
    } else {
        if (consultantSignaturePad && !consultantSignaturePad.isEmpty()) {
            data.consultant_signature_b64 = consultantSignaturePad.toDataURL();
        }
        if (patientSignaturePad && !patientSignaturePad.isEmpty()) {
            data.patient_signature_b64 = patientSignaturePad.toDataURL();
        }
    }
    
    return data;
}

async function saveChanges() {
    const changeReason = document.getElementById('changeReason').value.trim();
    if (!changeReason) {
        alert('กรุณาระบุเหตุผลในการแก้ไข');
        return;
    }
    
    const currentFormData = collectCurrentFormData(false);
    const billing = updateBillingSummary();

    const payload = {
        ...currentFormData,
        total: billing.productTotal,
        outstanding_balance: billing.outstandingBalance,
        cartItems: shoppingCart,
        change_reason: changeReason
    };

    try {
        const response = await fetch(`/api/transaction/${TRANSACTION_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unknown error');
        
        showSuccessNotification('บันทึกการเปลี่ยนแปลงสำเร็จ!');
        
        newConsultantSignature = '';
        newPatientSignature = '';
        consultantSignaturePad.clear();
        patientSignaturePad.clear();
        document.getElementById('changeReason').value = '';
        
        await loadTransactionForEdit();
        await loadTransactionVersions();
        
    } catch (error) {
        console.error('Failed to save changes:', error);
        alert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message}`);
    }
}

function printReceipt() {
    const currentFormData = collectCurrentFormData(true);
    populatePrintableData('receipt', currentFormData, shoppingCart);
    window.print();
}


// --- CART & SEARCH FUNCTIONS ---

function updatePricesInCart() {
    const patientTypeKey = document.getElementById('patientType').value.toLowerCase();
    if (!patientTypeKey) return;

    shoppingCart.forEach(cartItem => {
        const product = productList.find(p => p.itemcode === cartItem.itemcode);
        if (product) {
            cartItem.price = parseFloat(product[patientTypeKey] || 0);
        }
    });
    updateCartDisplay();
}

function updateCartDisplay() {
    const cartBody = document.getElementById('cartItems');
    if (!cartBody) return;
    cartBody.innerHTML = shoppingCart.map((item, index) => `
        <tr>
            <td style="text-align: left;">${item.name || 'N/A'}</td>
            <td>${item.itemcode || 'N/A'}</td>
            <td>${formatCurrency(item.price)}</td>
            <td><input type="number" min="1" value="${item.quantity}" onchange="updateQuantity(${index}, this.value)" style="width: 60px;"></td>
            <td>${formatCurrency((item.price || 0) * (item.quantity || 0))}</td>
            <td><button type="button" onclick="removeFromCart(${index})" style="background-color:#e74c3c; padding: 5px 10px;">X</button></td>
        </tr>
    `).join('');
    updateBillingSummary();
    updateReceiptPreview();
}

function updateQuantity(index, newQuantity) {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
        shoppingCart.splice(index, 1);
    } else {
        shoppingCart[index].quantity = qty;
    }
    updateCartDisplay();
}

function removeFromCart(index) {
    shoppingCart.splice(index, 1);
    updateCartDisplay();
}

function updateBillingSummary() {
    const productTotal = shoppingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const depositAmount = parseFloat(document.getElementById('depositAmount').value) || 0;
    const outstandingBalance = productTotal - depositAmount;

    document.getElementById('summaryGrandTotal').textContent = formatCurrency(productTotal);
    document.getElementById('summaryDeposit').textContent = formatCurrency(depositAmount);
    document.getElementById('summaryOutstanding').textContent = formatCurrency(outstandingBalance);
    document.getElementById('cartTotal').textContent = formatCurrency(productTotal);
    
    return { productTotal, depositAmount, outstandingBalance };
}

function searchProducts() {
    const searchTermEl = document.getElementById('searchProduct');
    const resultsDiv = document.getElementById('searchResults');
    if (!searchTermEl || !resultsDiv) return;
    
    const searchTerm = searchTermEl.value.toLowerCase();
    if (searchTerm.length < 1) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    const patientTypeKey = document.getElementById('patientType').value.toLowerCase();
    const filtered = productList.filter(p => 
        (p.name?.toLowerCase().includes(searchTerm)) || 
        (p.itemcode?.toLowerCase().includes(searchTerm))
    );
    
    resultsDiv.innerHTML = filtered.slice(0, 10).map(product => {
        const price = parseFloat(product[patientTypeKey] || 0);
        return `
            <div class="search-item" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" onclick="addItemToCart('${product.itemcode}')">
                [${product.itemcode || 'N/A'}] ${product.name || 'N/A'} - <strong>${formatCurrency(price)}</strong>
            </div>`;
    }).join('');
}

function clearSearch() {
    document.getElementById('searchProduct').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

function addItemToCart(itemCode) {
    const product = productList.find(p => p.itemcode === itemCode);
    if (!product) return;
    
    const patientTypeKey = document.getElementById('patientType').value.toLowerCase() || 'opd';
    const itemPrice = parseFloat(product[patientTypeKey] || 0);
    
    const existingItem = shoppingCart.find(item => item.itemcode === itemCode);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        shoppingCart.push({ itemcode: product.itemcode, name: product.name, price: itemPrice, quantity: 1 });
    }
    updateCartDisplay();
    clearSearch();
}

function quickSearch(term) {
    const searchInput = document.getElementById('searchProduct');
    if (searchInput) {
        searchInput.value = term;
        searchProducts();
    }
}

// --- HELPER & STYLE FUNCTIONS ---

function formatCurrency(value, decimals = 2) { 
    if (typeof value !== 'number') value = parseFloat(value) || 0; 
    return value.toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' บาท'; 
}

function resizeCanvas(pad) { 
    if (!pad || !pad.canvas) return; 
    const canvas = pad.canvas;
    const ratio = Math.max(window.devicePixelRatio || 1, 1); 
    const data = pad.toData(); 
    canvas.width = canvas.offsetWidth * ratio; 
    canvas.height = canvas.offsetHeight * ratio; 
    canvas.getContext("2d").scale(ratio, ratio); 
    pad.fromData(data);
}

function clearSignature(type) { 
    const pad = (type === 'consultant') ? consultantSignaturePad : patientSignaturePad;
    const preview = document.getElementById(`${type}SignaturePreview`);
    if (pad) pad.clear();
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    if (type === 'consultant') newConsultantSignature = '';
    if (type === 'patient') newPatientSignature = '';
    updateReceiptPreview();
}

function showSuccessNotification(message) { 
    const notification = document.createElement('div'); 
    notification.className = 'success-notification'; 
    notification.textContent = message; 
    document.body.appendChild(notification); 
    setTimeout(() => notification.classList.add('show'), 10); 
    setTimeout(() => { notification.classList.remove('show'); setTimeout(() => notification.remove(), 500); }, 4000); 
}

// --- VERSION HISTORY ---

function populateVersionDropdown() {
    const container = document.getElementById('version-selector-container');
    if (!container || transactionVersions.length === 0) {
        if(container) container.innerHTML = '';
        return;
    }
    
    let optionsHTML = `<label for="version-selector" style="margin-right: 10px;">ดูประวัติเวอร์ชัน:</label>
                       <select id="version-selector" onchange="viewVersion(this.value)">
                           <option value="latest">เวอร์ชันล่าสุด (ที่กำลังแก้ไข)</option>`;

    transactionVersions.sort((a, b) => b.version_number - a.version_number).forEach(v => {
        optionsHTML += `<option value="${v.version_id}">V${v.version_number} - ${new Date(v.created_at).toLocaleString('th-TH')} โดย ${v.created_by}</option>`;
    });

    optionsHTML += '</select>';
    container.innerHTML = optionsHTML;
}

function viewVersion(versionId) {
    if (versionId === 'latest') { 
        updateReceiptPreview();
        return; 
    }
    
    const selectedVersion = transactionVersions.find(v => String(v.version_id) === versionId);
    if (!selectedVersion) return;

    const dataToShow = selectedVersion.snapshot;
    const cartToShow = dataToShow.products_list || [];
    
    const container = document.getElementById('receiptPreviewContainer');
    const template = document.getElementById('receipt');
    if (!container || !template) return;
    
    const clone = template.cloneNode(true);
    clone.id = 'receipt_preview_for_version';
    clone.classList.remove('print-area');

    container.innerHTML = ''; 
    container.appendChild(clone);
    populatePrintableData(clone.id, dataToShow, cartToShow);
}