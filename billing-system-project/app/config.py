# # /app/config.py
# import os

# # No need for load_dotenv() here, Docker Compose injects the environment variables.

# class Config:
#     """Base configuration class."""
#     SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'default-secret-key-for-dev')
#     SQLALCHEMY_TRACK_MODIFICATIONS = False

#     # Get DB settings from environment variables
#     DB_USER = os.getenv('DB_USER')
#     DB_PASSWORD = os.getenv('DB_PASSWORD') # This can be an empty string
#     DB_HOST = os.getenv('DB_HOST')
#     DB_PORT = os.getenv('DB_PORT')
#     DB_NAME = os.getenv('DB_NAME')

#     # --- THIS IS THE FIX ---
#     # We now check for required variables, but allow DB_PASSWORD to be empty.
#     # The check verifies that the variable *exists*, even if it's an empty string.
#     required_vars = [DB_USER, DB_HOST, DB_PORT, DB_NAME]
#     if not all(var is not None for var in required_vars):
#         raise ValueError("Database configuration error: One of the required DB_* variables (USER, HOST, PORT, NAME) is missing in the .env file.")

#     # Create the Database URI for SQLAlchemy
#     SQLALCHEMY_DATABASE_URI = (
#         f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
#     )
# /app/config.py
import os

class Config:
    """Base configuration class."""
    # --- THIS IS THE FIX ---
    # Tell Flask that it's running under the /billing prefix behind a proxy.
    # This will make url_for() generate correct URLs like /billing/crud
    APPLICATION_ROOT = '/billing'

    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'default-secret-key-for-dev')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Get DB settings from environment variables
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = os.getenv('DB_PORT')
    DB_NAME = os.getenv('DB_NAME')

    # This check is now correct and allows for an empty password
    required_vars = [DB_USER, DB_HOST, DB_PORT, DB_NAME]
    if not all(var is not None for var in required_vars) or DB_PASSWORD is None:
        raise ValueError("Database configuration error: One of the required DB_* variables is missing in the .env file.")

    # Create the Database URI for SQLAlchemy
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
