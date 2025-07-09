# /app/api_routes.py
from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
from sqlalchemy.exc import IntegrityError
# from datetime import datetime
from datetime import datetime, timedelta
import jwt 

# --- START: UPDATED CODE ---
# สมมติว่า bcrypt ถูกกำหนดไว้ใน extensions และ import เข้ามา
from .extensions import db, bcrypt 
from .models import db, Item, Staff, User, Transaction, TransactionItem, Role, LogEntry,TransactionVersion
import json
from functools import wraps
# --- END: UPDATED CODE ---

api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- START: UPDATED CODE ---
# เพิ่ม 'users' กลับเข้ามาใน MODEL_MAP
MODEL_MAP = {
    'items': {'model': Item, 'pk': 'item_code'},
    'staff': {'model': Staff, 'pk': 'staff_id'},
    'users': {'model': User, 'pk': 'user_id'},
    'transactions': {'model': Transaction, 'pk': 'transaction_id'},
    'logs': {'model': LogEntry, 'pk': 'log_id'}
}
# --- END: UPDATED CODE ---

# --- API Endpoints for CRUD Page ---
@api_bp.route('/auth/login', methods=['POST'])
def superadmin_login():
    """
    Endpoint สำหรับ File App เพื่อยืนยันตัวตน Superadmin และขอ JWT
    """
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400

    # 1. ค้นหาผู้ใช้
    user = User.query.filter_by(username=data['username']).first()

    # 2. ตรวจสอบรหัสผ่าน
    if not user or not bcrypt.check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Invalid credentials'}), 401

    # 3. ตรวจสอบสถานะการใช้งาน
    if not user.is_active:
        return jsonify({'message': 'Account is inactive'}), 403

    # 4. ตรวจสอบ Role (สำคัญที่สุด)
    if not user.role or user.role.role_name != 'super admin':
        return jsonify({'message': 'Permission denied. Superadmin access required.'}), 403

    # 5. ถ้าทุกอย่างถูกต้อง สร้าง JWT
    try:
        payload = {
            'exp': datetime.utcnow() + timedelta(hours=2), # Token หมดอายุใน 2 ชั่วโมง
            'iat': datetime.utcnow(), # เวลาที่สร้าง Token
            'sub': user.user_id,      # Subject คือ user ID
            'role': user.role.role_name # ใส่ Role ใน Token เพื่อให้ File App ตรวจสอบได้
        }
        token = jwt.encode(
            payload,
            current_app.config['SECRET_KEY'], # ใช้ Secret Key เดียวกันกับ Flask App
            algorithm='HS256'
        )
        return jsonify({'token': token})

    except Exception as e:
        return jsonify({'message': f'Error generating token: {str(e)}'}), 500


@api_bp.route('/roles', methods=['GET'])
@login_required
def get_roles():
    """
    Endpoint สำหรับดึงข้อมูล Role ทั้งหมด (เพื่อให้ Super Admin เลือก)
    """
    if not current_user.role or current_user.role.role_name != 'super admin':
        return jsonify({'message': 'Permission denied.'}), 403
    try:
        roles = Role.query.all()
        return jsonify([{'role_id': r.role_id, 'role_name': r.role_name} for r in roles])
    except Exception as e:
        return jsonify({'message': f'Error fetching roles: {str(e)}'}), 500


@api_bp.route('/<table>', methods=['GET'])
@login_required
def get_all_records(table):
    if table not in MODEL_MAP:
        return jsonify({'message': f"Table '{table}' not found."}), 404
    
    # Super admin เห็นทุกตาราง, Admin ไม่เห็น Users
    if table == 'users' and current_user.role.role_name != 'super admin':
        return jsonify({'message': 'Permission denied.'}), 403

    model_info = MODEL_MAP[table]
    Model = model_info['model']
    
    try:
        if table == 'transactions':
            records = Model.query.order_by(Model.transaction_date.desc()).all()
        else:
            records = Model.query.all()
        return jsonify([record.to_dict_for_crud() for record in records])
    except Exception as e:
        return jsonify({'message': f'Error fetching data for {table}: {str(e)}'}), 500
@api_bp.route('/<table>', methods=['POST'])
@login_required
def create_record(table):
    if table not in MODEL_MAP:
        return jsonify({'message': f"Table '{table}' not found."}), 404

    role = current_user.role.role_name
    
    if table == 'users':
        if role != 'super admin':
            return jsonify({'message': 'Permission denied.'}), 403
    elif table in ['items', 'staff']:
        if role not in ['super admin', 'admin']:
            return jsonify({'message': 'Permission denied.'}), 403
    else:
        return jsonify({'message': 'This action is not allowed.'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'message': 'Invalid data provided.'}), 400

    # --- START: ส่วนที่เพิ่มเข้ามาเพื่อแก้ไข Error ---
    model_info = MODEL_MAP[table]
    Model = model_info['model']
    pk_field = model_info['pk']  # <-- กำหนดค่าให้ pk_field ตรงนี้
    # --- END: ส่วนที่เพิ่มเข้ามา ---
    
    if table == 'users':
        if 'password' in data and data['password']:
            data['password_hash'] = bcrypt.generate_password_hash(data['password']).decode('utf-8')
            del data['password']
        else:
            return jsonify({'message': 'Password is required.'}), 400
    
    if 'role_name' in data:
        del data['role_name']

    # แปลง is_active สำหรับ User Model (ถ้ามี)
    if table == 'users' and 'is_active' in data:
        data['is_active'] = data['is_active'] == '1'

    new_record = Model(**data)
    
    try:
        db.session.add(new_record)
        
        # เราต้อง flush session ก่อนเพื่อให้ new_record ได้รับค่า Primary Key จาก Database
        db.session.flush() 
        
        # ตอนนี้ pk_field ถูกต้องแล้ว และ new_record ก็มีค่า PK แล้ว
        pk_value = getattr(new_record, pk_field)
        add_log_entry(f"Created record with ID '{pk_value}' in table '{table}'.")
        
        db.session.commit()
        return jsonify(new_record.to_dict_for_crud()), 201
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'message': f'Data integrity error. A record with a primary key you are trying to import might already exist. Details: {str(e.orig)}'}), 409
    except Exception as e:
        db.session.rollback()
        # ทำให้เห็น Error ที่แท้จริงใน Console ของ Flask
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Error creating record: {str(e)}'}), 500

@api_bp.route('/<table>/<path:record_id>', methods=['PUT'])
@login_required
def update_record(table, record_id):
    if table not in MODEL_MAP:
        return jsonify({'message': f"Table '{table}' not found."}), 404

    role = current_user.role.role_name

    # --- START: PERMISSION CHECK ---
    if table == 'users':
        if role != 'super admin':
            return jsonify({'message': 'Permission denied.'}), 403
    elif table in ['items', 'staff']:
        if role not in ['super admin', 'admin']:
            return jsonify({'message': 'Permission denied.'}), 403
    else:
        return jsonify({'message': 'This action is not allowed.'}), 403
    # --- END: PERMISSION CHECK ---
        
    data = request.get_json()
    model_info = MODEL_MAP[table]
    Model = model_info['model']
    pk_field = model_info['pk']

    if isinstance(getattr(Model, pk_field).type, db.Integer):
        record_id = int(record_id)

    record = db.session.get(Model, record_id)
    if not record:
        return jsonify({'message': 'Record not found.'}), 404

    # --- START: PASSWORD HASHING ---
    if table == 'users':
        if 'password' in data and data['password']:
            data['password_hash'] = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        # ไม่ว่าจะส่ง password มาหรือไม่ ก็ลบ key นี้ออกจาก data ที่จะ update
        if 'password' in data:
            del data['password']
    # --- END: PASSWORD HASHING ---
    
    if 'role_name' in data:
        del data['role_name']

    for key, value in data.items():
        if key != pk_field:
            setattr(record, key, value)
            
    try:
        add_log_entry(f"Updated record with ID '{record_id}' in table '{table}'.")
        db.session.commit()
        return jsonify(record.to_dict_for_crud())
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error updating record: {str(e)}'}), 500

@api_bp.route('/<table>/<path:record_id>', methods=['DELETE'])
@login_required
def delete_record(table, record_id):
    if table not in MODEL_MAP:
        return jsonify({'message': f"Table '{table}' not found."}), 404
        
    role = current_user.role.role_name
    
    # --- START: PERMISSION CHECK (ส่วนที่แก้ไข) ---
    if table == 'users':
        if role != 'super admin':
            return jsonify({'message': 'Permission denied.'}), 403
    elif table in ['items', 'staff', 'transactions']:
        if role not in ['super admin', 'admin']:
            # --- เพิ่มบรรทัดนี้เข้าไป ---
            return jsonify({'message': 'Permission denied.'}), 403
    else:
        # สำหรับตารางอื่นๆ เช่น logs จะไม่อนุญาตให้ลบผ่าน API นี้
        return jsonify({'message': 'This action is not allowed for this table.'}), 403
    # --- END: PERMISSION CHECK ---
        
    model_info = MODEL_MAP[table]
    Model = model_info['model']
    pk_field = model_info['pk']

    if isinstance(getattr(Model, pk_field).type, db.Integer):
        record_id = int(record_id)
    
    if table == 'users' and current_user.user_id == record_id:
        return jsonify({'message': 'You cannot delete your own account.'}), 403

    record = db.session.get(Model, record_id)
    if not record:
        return jsonify({'message': 'Record not found.'}), 404
        
    try:
        add_log_entry(f"Deleted record with ID '{record_id}' from table '{table}'.")
        db.session.delete(record)
        db.session.commit()
        return jsonify({'message': f'Record deleted successfully.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error deleting record: {str(e)}'}), 500

def add_log_entry(action_description):
    """ฟังก์ชันสำหรับสร้างและเพิ่ม Log Entry ใหม่ลงใน session"""
    try:
        log = LogEntry(
            user_id=current_user.user_id,
            action=action_description
        )
        db.session.add(log)
    except Exception as e:
        print(f"Error adding log entry: {e}")

def ajax_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # ตรวจสอบว่ามี Header 'X-Requested-With' และมีค่าเป็น 'XMLHttpRequest' หรือไม่
        if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
            # ถ้าไม่มี ให้ส่ง Error 403 Forbidden (ห้ามเข้าถึง)
            return jsonify(message="Forbidden: Direct access is not allowed."), 403
        return f(*args, **kwargs)
    return decorated_function

@api_bp.route('/transaction/<transaction_id>', methods=['GET'])
@login_required
@ajax_required
def get_transaction_details(transaction_id):
    """API สำหรับดึงข้อมูล Transaction ฉบับเต็มเพื่อนำไปแก้ไข"""
    if not current_user.role or current_user.role.role_name not in ['admin', 'super admin']:
        return jsonify({'message': 'Permission denied.'}), 403

    transaction = db.session.get(Transaction, transaction_id)
    if not transaction:
        return jsonify({'message': 'Transaction not found.'}), 404
        
    return jsonify(transaction.to_dict())


@api_bp.route('/transaction/<transaction_id>', methods=['PUT'])
@login_required
def update_transaction(transaction_id):
    """API สำหรับบันทึกการแก้ไข Transaction"""
    if not current_user.role or current_user.role.role_name not in ['admin', 'super admin']:
        return jsonify({'message': 'Permission denied.'}), 403

    txn_to_update = db.session.get(Transaction, transaction_id)
    if not txn_to_update:
        return jsonify({'message': 'Transaction not found.'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'message': 'Invalid data provided.'}), 400

    try:
        # --- 1. บันทึกประวัติเวอร์ชัน (Versioning) ---
        latest_version_num = db.session.query(db.func.max(TransactionVersion.version_number)).filter_by(transaction_id=transaction_id).scalar() or 0
        
        new_version = TransactionVersion(
            transaction_id=transaction_id,
            version_number=latest_version_num + 1,
            # Snapshot คือข้อมูล "ณ ปัจจุบัน" ก่อนที่จะเริ่มแก้ไข
            transaction_snapshot=json.dumps(txn_to_update.to_dict()),
            change_reason=data.get('change_reason', 'No reason provided.'),
            created_by_user_id=current_user.user_id
        )
        db.session.add(new_version)
        
        # --- 2. อัปเดตข้อมูล Transaction หลัก ---
        txn_to_update.hn = data.get('patient_hn')
        txn_to_update.patient_fname = data.get('fname')
        txn_to_update.patient_lname = data.get('lname')
        txn_to_update.patient_gender = data.get('gender')
        # txn_to_update.patient_dob = datetime.strptime(data['patient_dob'], '%Y-%m-%d').date() if data.get('patient_dob') else None
        txn_to_update.patient_type = data.get('type')
        txn_to_update.doctor_id = data.get('doctor_id') or None
        txn_to_update.consultant_id = data.get('consultant_id') or None
        
        txn_to_update.total_amount = float(data.get('total', 0))
        txn_to_update.deposit_amount = float(data.get('deposit_amount', 0))
        txn_to_update.outstanding_balance = float(data.get('outstanding_balance', 0))
        txn_to_update.payment_method = data.get('payment_method')
        txn_to_update.review_status = data.get('review_status')
        txn_to_update.comment = data.get('comment')
        
        # --- 3. จัดการลายเซ็น ---
        # ใช้ helper function `save_signature_file` จาก routes.py
        # หมายเหตุ: การเรียกใช้ helper จาก blueprint อื่นอาจต้องมีการ refactor เล็กน้อย
        # แต่เพื่อความง่าย จะสมมติว่าฟังก์ชันนี้สามารถเรียกใช้ได้
        from .routes import save_signature_file

        if data.get('consultant_signature_b64'):
            filename = save_signature_file(data['consultant_signature_b64'], transaction_id)
            if filename:
                txn_to_update.consultant_signature_filename = filename
        
        if data.get('patient_signature_b64'):
            filename = save_signature_file(data['patient_signature_b64'], transaction_id)
            if filename:
                txn_to_update.patient_signature_filename = filename

        # --- 4. อัปเดตรายการ Items ---
        # ลบรายการเก่าทั้งหมด แล้วสร้างใหม่จากข้อมูลที่ส่งมา
        TransactionItem.query.filter_by(transaction_id=transaction_id).delete()
        if 'cartItems' in data and data['cartItems']:
            for item_data in data['cartItems']:
                transaction_item = TransactionItem(
                    transaction_id=transaction_id,
                    item_code=item_data.get('itemcode'),
                    quantity=int(item_data.get('quantity', 1)),
                    price_per_unit=float(item_data.get('price', 0))
                )
                db.session.add(transaction_item)

        # --- 5. Commit & Return ---
        add_log_entry(f"Updated transaction '{transaction_id}'. Reason: {data.get('change_reason')}")
        db.session.commit()
        
        # ส่งข้อมูลที่อัปเดตแล้วกลับไปให้ Frontend
        return jsonify(txn_to_update.to_dict())

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Error updating transaction: {str(e)}'}), 500
    
@api_bp.route('/transaction/<transaction_id>/versions', methods=['GET'])
@login_required
def get_transaction_versions(transaction_id):
    """
    API สำหรับดึงประวัติเวอร์ชันทั้งหมดของ Transaction หนึ่งๆ
    """
    # ตรวจสอบสิทธิ์ผู้ใช้
    if not current_user.role or current_user.role.role_name not in ['admin', 'super admin']:
        return jsonify({'message': 'Permission denied.'}), 403

    # ค้นหาทุกเวอร์ชันของ transaction_id ที่ระบุ, เรียงจากเวอร์ชันล่าสุดไปเก่าสุด
    versions = TransactionVersion.query.filter_by(
        transaction_id=transaction_id
    ).order_by(db.desc(TransactionVersion.version_number)).all()

    # ส่งข้อมูลกลับไปในรูปแบบ JSON list
    return jsonify([v.to_dict() for v in versions])

# ... The rest of the file (initial-data, get_transactions, save-transaction) remains the same ...