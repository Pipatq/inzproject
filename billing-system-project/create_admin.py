# /create_admin.py
import sys
from app import create_app
from app.models import db, User, Role
from app.extensions import bcrypt

app = create_app()

def set_password(password):
    """Hashes the password."""
    return bcrypt.generate_password_hash(password).decode('utf-8')

def create_user(username, password, full_name, role_name):
    """Creates a new user with a specified role."""
    with app.app_context():
        # ตรวจสอบว่ามี Role นี้อยู่หรือไม่, ถ้าไม่มีให้สร้าง
        role = Role.query.filter_by(role_name=role_name).first()
        if not role:
            print(f"Role '{role_name}' not found. Creating it...")
            role = Role(role_name=role_name)
            db.session.add(role)
            db.session.commit()
            print(f"Role '{role_name}' created.")

        # ตรวจสอบว่ามี username นี้แล้วหรือยัง
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"Error: Username '{username}' already exists.")
            return

        # สร้างผู้ใช้ใหม่
        hashed_password = set_password(password)
        new_user = User(
            username=username,
            password_hash=hashed_password,
            full_name=full_name,
            role_id=role.role_id,
            is_active=True
        )
        db.session.add(new_user)
        db.session.commit()
        print(f"Successfully created user '{username}' with role '{role_name}'.")

if __name__ == '__main__':
    # ตรวจสอบว่ามีการส่ง argument มาครบหรือไม่
    # รูปแบบการใช้งาน: python create_admin.py <username> <password> <"Full Name"> <Role>
    if len(sys.argv) != 5:
        print('Usage: python create_admin.py <username> <password> "<Full Name>" <RoleName>')
        print('Example: python create_admin.py admin1 pass123 "Admin One" "Admin"')
        sys.exit(1)

    # รับค่าจาก command line
    script_name, username, password, full_name, role_name = sys.argv
    create_user(username, password, full_name, role_name)
