# Garmin sync service. Works on Fly.io, Railway, Render, Cloud Run, any Docker host.
# garminconnect needs Python 3.12+.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# ONE worker on purpose: pending MFA logins live in process memory.
# Most hosts inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
