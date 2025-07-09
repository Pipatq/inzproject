# /app/auth_routes.py
from flask import request, jsonify, redirect, url_for
from flask_login import LoginManager, login_user, logout_user, login_required
from flask import Blueprint
from .models import User, LogEntry # <--- เพิ่ม LogEntry
from .extensions import db, bcrypt, login_manager 

auth_bp = Blueprint('auth', __name__)


# Redirect ไปหน้าแรกถ้ายังไม่ login และพยายามเข้าหน้าที่ต้องห้าม
login_manager.login_view = 'main.index'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def check_password(password_hash, password):
    return bcrypt.check_password_hash(password_hash, password)


@auth_bp.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'status': 'error', 'message': 'Missing username or password'}), 400

    # --- บรรทัดที่หายไปคือบรรทัดนี้ครับ ---
    # ค้นหาผู้ใช้จาก username ที่ส่งมาในฐานข้อมูล
    user = User.query.filter_by(username=data['username']).first()
    # ------------------------------------

    # บรรทัดที่ 44 ที่เกิด Error คือบรรทัดนี้ ซึ่งตอนนี้จะทำงานได้ถูกต้อง
    if user and check_password(user.password_hash, data['password']):
        if user.is_active:
            login_user(user, remember=True)
            
            # บันทึก Log การ Login
            try:
                log = LogEntry(user_id=user.user_id, action=f"User '{user.username}' logged in.")
                db.session.add(log)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(f"Failed to log login event: {e}")

            return jsonify({
                'status': 'success',
                'redirect_url': url_for('main.crud_page')
            })
        else:
            return jsonify({'status': 'error', 'message': 'Account is inactive.'}), 403
    
    return jsonify({'status': 'error', 'message': 'Invalid username or password.'}), 401


@auth_bp.route('/logout')
@login_required
def logout_api():
    # --- START: บันทึก Log การ Logout ---
    try:
        log = LogEntry(user_id=current_user.user_id, action=f"User '{current_user.username}' logged out.")
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Failed to log logout event: {e}")
    # --- END: บันทึก Log ---

    logout_user()
    # return redirect(url_for('main.index'))
    return redirect('/billing/')