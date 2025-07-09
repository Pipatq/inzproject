# # /app/__init__.py
# from flask import Flask
# from .config import Config
# from .extensions import db, bcrypt, login_manager
# from .routes import main_bp
# from .auth_routes import auth_bp
# from .api_routes import api_bp

# def create_app(config_class=Config):
#     """Application Factory Function"""
#     app = Flask(__name__)
#     app.config.from_object(config_class)

#     # Initialize extensions with the app
#     db.init_app(app)
#     bcrypt.init_app(app)
#     login_manager.init_app(app)

#     # Register Blueprints to organize routes
#     app.register_blueprint(main_bp)
#     app.register_blueprint(auth_bp)
#     app.register_blueprint(api_bp)

#     # --- DEBUGGING STEP ---
#     # We are temporarily commenting out db.create_all() to isolate the problem.
#     # If the app starts with this line commented, we know the issue is in the
#     # database models or the connection during table creation.
#     #
#     # with app.app_context():
#     #     db.create_all()

#     return app
# /app/__init__.py
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix # 👈 1. Import ProxyFix
from .config import Config
from .extensions import db, bcrypt, login_manager
from .routes import main_bp
from .auth_routes import auth_bp
from .api_routes import api_bp

def create_app(config_class=Config):
    """Application Factory Function"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 👈 2. Apply the middleware to the app
    # This tells Flask to trust the headers sent by our Nginx proxy.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)

    # Register Blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    with app.app_context():
        # You can uncomment this after the first successful run
        # db.create_all()
        pass

    return app
