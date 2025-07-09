# Dockerfile for Billing System (Production Ready)

# 1. Start from the official Python image
FROM python:3.12.1-slim-bookworm

# 2. Set the working directory
WORKDIR /app

# 3. Create a non-root user for security
RUN addgroup --system app && adduser --system --group app

# 4. Copy requirements and install dependencies first for caching
COPY --chown=app:app requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the entire project context as the non-root user
COPY --chown=app:app . .

# 6. Switch to the non-root user
USER app

# 7. Expose the internal port
EXPOSE 5000

# 8. The command to run the application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"]