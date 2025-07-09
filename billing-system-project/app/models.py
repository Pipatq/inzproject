# /app/models.py
from .extensions import db, bcrypt
from flask_login import UserMixin
from datetime import datetime
from decimal import Decimal
from pytz import timezone 
import json

class Role(db.Model):
    __tablename__ = 'roles'
    role_id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(50), unique=True, nullable=False)

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    user_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255))
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'))
    is_active = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    role = db.relationship('Role')
    
    def get_id(self):
        return self.user_id
        
    def to_dict_for_crud(self):
        return {
            "user_id": self.user_id,
            "username": self.username,
            "full_name": self.full_name,
            "role_id": self.role_id,
            "role_name": self.role.role_name if self.role else 'N/A',
            "is_active": self.is_active
        }

class Staff(db.Model):
    __tablename__ = 'staff'
    staff_id = db.Column(db.String(50), primary_key=True)
    name_en = db.Column(db.String(255))
    name_th = db.Column(db.String(255), nullable=False)
    staff_role = db.Column(db.String(100))
    
    def to_dict(self):
        return {"id": self.staff_id, "name": self.name_th, "role": self.staff_role}

    def to_dict_for_crud(self):
        return {
            "staff_id": self.staff_id,
            "name_en": self.name_en,
            "name_th": self.name_th,
            "staff_role": self.staff_role
        }

class Item(db.Model):
    __tablename__ = 'items'
    item_code = db.Column(db.String(50), primary_key=True)
    name_th = db.Column(db.String(255), nullable=False)
    price_opd = db.Column(db.Numeric(10, 2), default=0.00)
    price_ipd = db.Column(db.Numeric(10, 2), default=0.00)
    price_foreign_opd = db.Column(db.Numeric(10, 2), default=0.00)
    price_foreign_ipd = db.Column(db.Numeric(10, 2), default=0.00)
    price_staff = db.Column(db.Numeric(10, 2), default=0.00)
    
    def to_dict(self):
        return {
            "itemcode": self.item_code, 
            "name": self.name_th, 
            "opd": float(self.price_opd), 
            "ipd": float(self.price_ipd), 
            "foreign_opd": float(self.price_foreign_opd), 
            "foreign_ipd": float(self.price_foreign_ipd), 
            "staff": float(self.price_staff)
        }

    def to_dict_for_crud(self):
        all_columns = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                all_columns[c.name] = value.isoformat()
            elif isinstance(value, Decimal):
                all_columns[c.name] = float(value)
            else:
                all_columns[c.name] = value
        return all_columns

class Transaction(db.Model):
    __tablename__ = 'transactions'
    transaction_id = db.Column(db.String(50), primary_key=True)
    hn = db.Column(db.String(50))
    patient_fname = db.Column(db.String(255))
    patient_lname = db.Column(db.String(255))
    patient_gender = db.Column(db.String(20))
    patient_age = db.Column(db.Integer, nullable=True) # Using patient_age now
    transaction_date = db.Column(db.DateTime, nullable=False)
    patient_type = db.Column(db.String(50))
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    deposit_amount = db.Column(db.Numeric(10, 2), default=0.00)
    outstanding_balance = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.String(50))
    review_status = db.Column(db.String(100))
    comment = db.Column(db.Text)
    doctor_id = db.Column(db.String(50), db.ForeignKey('staff.staff_id'))
    consultant_id = db.Column(db.String(50), db.ForeignKey('staff.staff_id'))
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    consultant_signature_filename = db.Column(db.String(255), nullable=True)
    patient_signature_filename = db.Column(db.String(255), nullable=True)
    
    doctor = db.relationship('Staff', foreign_keys=[doctor_id])
    consultant = db.relationship('Staff', foreign_keys=[consultant_id])
    created_by_user = db.relationship('User')
    items = db.relationship('TransactionItem', backref='transaction', cascade="all, delete-orphan")

    def to_dict(self):
        products_list = []
        for ti in self.items:
            products_list.append({
                "itemcode": ti.item_code,
                "name": ti.item.name_th,
                "price": float(ti.price_per_unit),
                "quantity": ti.quantity
            })

        transaction_date_iso = None
        if self.transaction_date:
            aware_datetime = self.transaction_date.replace(tzinfo=timezone('UTC')) if self.transaction_date.tzinfo is None else self.transaction_date.astimezone(timezone('UTC'))
            transaction_date_iso = aware_datetime.isoformat()

        return {
            "transaction_id": self.transaction_id, 
            "patient_hn": self.hn,
            "fname": self.patient_fname, 
            "lname": self.patient_lname, 
            "gender": self.patient_gender, 
            "patientAge": self.patient_age,
            "date": transaction_date_iso,
            "type": self.patient_type.lower() if self.patient_type else "", 
            "products_list": products_list,
            "total": float(self.total_amount), 
            "doctor_id": self.doctor_id,
            "doctor_name": self.doctor.name_th if self.doctor else "",
            "consultant_id": self.consultant_id,
            "consultant_name": self.consultant.name_th if self.consultant else "", 
            "deposit_amount": float(self.deposit_amount), 
            "outstanding_balance": float(self.outstanding_balance), 
            "payment_method": self.payment_method, 
            "review_status": self.review_status, 
            "comment": self.comment, 
            "created_by": self.created_by_user.full_name if self.created_by_user else "N/A",
            "consultant_signature_filename": self.consultant_signature_filename,
            "patient_signature_filename": self.patient_signature_filename
        }

    def to_dict_for_crud(self):
        return {
            "transaction_id": self.transaction_id,
            "patient_hn": self.hn,
            "patient_type": self.patient_type,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "patient_name": f"{self.patient_fname or ''} {self.patient_lname or ''}".strip(),
            "patientAge": self.patient_age,
            "doctor": self.doctor.name_th if self.doctor else "N/A",
            "consultant": self.consultant.name_th if self.consultant else "N/A",
            "total_amount": float(self.total_amount) if self.total_amount is not None else 0.0,
            "deposit_amount": float(self.deposit_amount) if self.deposit_amount is not None else 0.0,
            "payment_method": self.payment_method,
            "review_status": self.review_status,
            "comment": self.comment,
            "created_by": self.created_by_user.full_name if self.created_by_user else "N/A"
        }

class TransactionItem(db.Model):
    __tablename__ = 'transaction_items'
    transaction_item_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    transaction_id = db.Column(db.String(50), db.ForeignKey('transactions.transaction_id'), nullable=False)
    item_code = db.Column(db.String(50), db.ForeignKey('items.item_code'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    price_per_unit = db.Column(db.Numeric(10, 2), nullable=False)
    item = db.relationship('Item')

class LogEntry(db.Model):
    __tablename__ = 'log_entries'
    log_id = db.Column(db.Integer, primary_key=True)
    
    def current_time_bangkok():
        return datetime.now(timezone('Asia/Bangkok'))

    timestamp = db.Column(db.DateTime, nullable=False, default=current_time_bangkok)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=True)
    action = db.Column(db.Text, nullable=False)
    user = db.relationship('User')

    def to_dict_for_crud(self):
        return {
            "log_id": self.log_id,
            "timestamp": self.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            "user": self.user.username if self.user else "System",
            "action": self.action
        }
    
class TransactionVersion(db.Model):
    __tablename__ = 'transaction_versions'
    version_id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.String(50), db.ForeignKey('transactions.transaction_id', ondelete='CASCADE'), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False)
    transaction_snapshot = db.Column(db.Text, nullable=False)
    change_reason = db.Column(db.Text, nullable=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    
    transaction = db.relationship('Transaction')
    created_by_user = db.relationship('User')

    __table_args__ = (db.UniqueConstraint('transaction_id', 'version_number', name='_transaction_version_uc'),)

    def to_dict(self):
        return {
            "version_id": self.version_id,
            "transaction_id": self.transaction_id,
            "version_number": self.version_number,
            "created_at": self.created_at.replace(tzinfo=timezone('UTC')).astimezone(timezone('Asia/Bangkok')).strftime('%Y-%m-%d %H:%M:%S'),
            "created_by": self.created_by_user.username if self.created_by_user else "N/A",
            "change_reason": self.change_reason,
            "snapshot": json.loads(self.transaction_snapshot)
        }