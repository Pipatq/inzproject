# --- 1. Imports ที่จำเป็น ---
import os
import uuid
import base64
import json
import pandas as pd
from datetime import datetime
from flask import (Blueprint, Response, render_template, jsonify, 
                   request, flash, redirect, url_for, current_app)
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
from .models import db, Item, Staff, Transaction, TransactionItem, User,TransactionVersion
from .extensions import db
from functools import wraps


main_bp = Blueprint('main', __name__)


# --- 2. Helper Function สำหรับบันทึกลายเซ็น ---
def save_signature_file(b64_data, transaction_id):
    """
    ถอดรหัส Base64, สร้างชื่อไฟล์ที่ไม่ซ้ำกัน, และบันทึกไฟล์ลายเซ็น
    """
    if not b64_data:
        return None
    try:
        # สร้างโฟลเดอร์ (ถ้ายังไม่มี)
        signature_folder = os.path.join(current_app.static_folder, 'signatures')
        os.makedirs(signature_folder, exist_ok=True)
        
        # ตัดส่วนหัวของ Base64 string ออก
        header, encoded = b64_data.split(",", 1)
        signature_binary = base64.b64decode(encoded)
        
        # สร้างชื่อไฟล์ใหม่ที่ไม่ซ้ำกัน
        filename = f"sig_{transaction_id}_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(signature_folder, filename)
        
        with open(filepath, "wb") as f:
            f.write(signature_binary)
        return filename
    except Exception as e:
        print(f"Error saving signature file: {e}")
        return None


# --- 3. Route หลักสำหรับแสดงหน้าเว็บ ---
@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/crud')
@login_required
def crud_page():
    return render_template('crud.html', current_user=current_user)

@main_bp.route('/import', methods=['GET', 'POST'])
@login_required
def import_page():
    if not current_user.role or current_user.role.role_name not in ['admin', 'super admin']:
        flash('Permission Denied.', 'error')
        return redirect(url_for('main.crud_page'))

    # กำหนดโครงสร้าง Header ที่คาดหวังและ PK field
    MODEL_MAP = {
        'staff': {'model': Staff, 'expected_headers': ['staff_id', 'name_th', 'name_en', 'staff_role'], 'pk_field': 'staff_id'},
        'items': {'model': Item, 'expected_headers': ['item_code', 'name_th', 'price_opd', 'price_ipd', 'price_foreign_opd', 'price_foreign_ipd', 'price_staff'], 'pk_field': 'item_code'}
    }
    
    if request.method == 'POST':
        target_table = request.form.get('target_table')
        if 'csv_file' not in request.files or not request.files['csv_file'].filename:
            flash('No file selected for upload.', 'error')
            return redirect(request.url)
            
        file = request.files['csv_file']
        if not file.filename.endswith('.csv'):
            flash('Invalid file type. Please upload a .csv file.', 'error')
            return redirect(request.url)

        if target_table not in MODEL_MAP:
            flash(f'Invalid target table selected: {target_table}', 'error')
            return redirect(request.url)

        model_info = MODEL_MAP[target_table]
        Model = model_info['model']
        pk_field = model_info['pk_field'] # ดึงชื่อ Primary Key field
        expected_headers = set(model_info['expected_headers'])

        try:
            df = pd.read_csv(file)
            
            # ทำความสะอาดชื่อ Header โดยตัดช่องว่างหน้า-หลังออก
            df.columns = df.columns.str.strip()
            csv_headers = set(df.columns)

            if csv_headers != expected_headers:
                missing = expected_headers - csv_headers
                extra = csv_headers - expected_headers
                error_msg = "CSV headers do not match. "
                if missing: error_msg += f"Missing: {', '.join(missing)}. "
                if extra: error_msg += f"Extra: {', '.join(extra)}."
                flash(error_msg, 'error')
                return redirect(request.url)

            added_count = 0
            updated_count = 0
            
            for index, row in df.iterrows():
                data_dict = row.to_dict()
                
                # ถ้าเป็นตาราง items ให้แปลงคอลัมน์ราคาเป็นตัวเลข และถ้าแปลงไม่ได้ให้เป็น 0
                if target_table == 'items':
                    price_columns = ['price_opd', 'price_ipd', 'price_foreign_opd', 'price_foreign_ipd', 'price_staff']
                    for col in price_columns:
                        data_dict[col] = pd.to_numeric(data_dict.get(col), errors='coerce').fillna(0)

                pk_value = data_dict.get(pk_field)
                if pk_value is None:
                    # หากไม่มี PK, อาจข้ามหรือแจ้ง Error ขึ้นอยู่กับ Business Logic
                    print(f"Skipping row {index+1}: Primary key '{pk_field}' is missing.")
                    continue # ข้ามแถวนี้ไปเลย หรือจะ flash error ก็ได้

                # ตรวจสอบว่ามี Record นี้อยู่แล้วหรือไม่
                existing_record = db.session.get(Model, pk_value) # ใช้ db.session.get เพื่อค้นหาด้วย PK

                if existing_record:
                    # ถ้ามีอยู่แล้ว ให้อัปเดตข้อมูล
                    for key, value in data_dict.items():
                        if key != pk_field: # ไม่อัปเดต Primary Key
                            setattr(existing_record, key, value)
                    updated_count += 1
                else:
                    # ถ้ายังไม่มี ให้สร้าง Record ใหม่
                    new_record = Model(**data_dict)
                    db.session.add(new_record)
                    added_count += 1

            db.session.commit()
            flash(f'Import completed: {added_count} records added, {updated_count} records updated in "{target_table}" table!', 'success')

        except IntegrityError as e:
            db.session.rollback()
            # อาจจะระบุข้อความเฉพาะเจาะจงมากขึ้น หาก IntegrityError ไม่ใช่เรื่อง PK ซ้ำ (เช่น Foreign Key error)
            flash(f'Database Error (Integrity): Ensure all foreign key references exist and data is valid. Details: {e.orig}', 'error')
        except Exception as e:
            db.session.rollback()
            import traceback
            traceback.print_exc()
            flash(f'An unexpected error occurred: {str(e)}', 'error')
            
        return redirect(request.url)

    # ... (ส่วน Get Request ของ import_page เหมือนเดิม) ...
    # ส่งข้อมูล Header ไปให้ Template แสดงเป็นตัวอย่าง
    import json
    expected_headers_json = json.dumps({k: v['expected_headers'] for k, v in MODEL_MAP.items()})
    return render_template('import.html', expected_headers_json=expected_headers_json)

@main_bp.route('/download-template/<target_table>')
@login_required
def download_template(target_table):
    EXPECTED_HEADERS = {
        'staff': ['staff_id', 'name_th', 'name_en', 'staff_role'],
        'items': ['item_code', 'name_th', 'price_opd', 'price_ipd', 'price_foreign_opd', 'price_foreign_ipd', 'price_staff']
    }
    if target_table not in EXPECTED_HEADERS:
        return "Invalid table", 404
    header_row = ",".join(EXPECTED_HEADERS[target_table])
    return Response(
        header_row,
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename=template_{target_table}.csv"}
    )

# สร้าง Decorator สำหรับตรวจสอบ AJAX Request
def ajax_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # ตรวจสอบว่ามี Header 'X-Requested-With' และมีค่าเป็น 'XMLHttpRequest' หรือไม่
        if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
            # ถ้าไม่มี ให้ส่ง Error 403 Forbidden (ห้ามเข้าถึง)
            return jsonify(message="Forbidden: Direct access is not allowed."), 403
        return f(*args, **kwargs)
    return decorated_function

# --- 5. Route สำหรับ API ต่างๆ ---
@main_bp.route('/api/initial-data')
@ajax_required
def get_initial_data():
    try:
        items = Item.query.all()
        staff = Staff.query.all()
        items_list = [item.to_dict() for item in items]
        users_list = [s.to_dict() for s in staff]
        return jsonify({'products': items_list, 'users': users_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main_bp.route('/api/transaction-history')
@ajax_required
def get_transactions():
    try:
        transactions = Transaction.query.order_by(Transaction.transaction_date.desc()).all()
        history_list = [t.to_dict() for t in transactions]
        return jsonify(history_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- 6. Route สำหรับบันทึก Transaction (สำคัญ) ---
@main_bp.route('/api/save-transaction', methods=['POST'])
def save_transaction_to_db():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'Invalid data provided.'}), 400

    try:
        doctor_id = data.get('doctor_id') or None
        consultant_id = data.get('consultant_id') or None


            
        new_transaction = Transaction(
            transaction_id=data.get('transaction_id'),
            hn=data.get('patient_hn'),
            patient_fname=data.get('fname'),
            patient_lname=data.get('lname'),
            patient_gender=data.get('gender'),
            # patient_dob=datetime.strptime(data['patient_dob'], '%Y-%m-%d').date() if data.get('patient_dob') else None,
            patient_age=data.get('patient_age'),
            transaction_date=datetime.fromisoformat(data['date'].replace('Z', '+00:00')),
            patient_type=data.get('type'),
            total_amount=float(data.get('total', 0)),
            deposit_amount=float(data.get('deposit_amount', 0)),
            outstanding_balance=float(data.get('outstanding_balance', 0)),
            payment_method=data.get('payment_method'),
            review_status=data.get('review_status'),
            comment=data.get('comment'),
            doctor_id=doctor_id,
            consultant_id=consultant_id,
            created_by_user_id=current_user.user_id if current_user.is_authenticated else None
        )

        # จัดการบันทึกลายเซ็น (ตาม Requirement ล่าสุดคือของ Consultant)
        signature_b64 = data.get('consultant_signature_b64')
        if signature_b64:
            filename = save_signature_file(signature_b64, new_transaction.transaction_id)
            new_transaction.consultant_signature_filename = filename

        patient_sig_b64 = data.get('patient_signature_b64')
        if patient_sig_b64:
            filename = save_signature_file(patient_sig_b64, new_transaction.transaction_id)
            new_transaction.patient_signature_filename = filename
            
        db.session.add(new_transaction)
        
        # บันทึกรายการสินค้าในตะกร้า
        if 'cartItems' in data and data['cartItems']:
            for item_data in data['cartItems']:
                transaction_item = TransactionItem(
                    transaction_id=new_transaction.transaction_id,
                    item_code=item_data.get('itemcode'),
                    quantity=int(item_data.get('quantity', 1)),
                    price_per_unit=float(item_data.get('price', 0))
                )
                db.session.add(transaction_item)
        
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Transaction saved successfully.'})

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500
    
@main_bp.route('/edit/<transaction_id>')
@login_required
def edit_page(transaction_id):
    """แสดงหน้าสำหรับแก้ไข Transaction"""
    # ตรวจสอบสิทธิ์ Admin/Super Admin
    if not current_user.role or current_user.role.role_name not in ['admin', 'super admin']:
        flash('Permission Denied. You must be an Administrator to access this page.', 'error')
        return redirect(url_for('main.index'))
    
    # ตรวจสอบว่า transaction นี้มีอยู่จริงหรือไม่
    transaction = db.session.get(Transaction, transaction_id)
    if not transaction:
        flash(f'Transaction with ID {transaction_id} not found.', 'error')
        return redirect(url_for('main.index'))
        
    return render_template('edit.html', transaction_id=transaction_id)