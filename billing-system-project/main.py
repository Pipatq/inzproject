# /main.py
# This file is the main entrypoint for Gunicorn.
# It is located in the project root, OUTSIDE the 'app' package.
from app import create_app

# The 'app' variable is what Gunicorn looks for.
app = create_app()

# This part is for direct execution (e.g., python main.py), not used by Gunicorn.
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
