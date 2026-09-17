FROM python:3.12-slim

WORKDIR /app

# Libs natives requises par WeasyPrint (rendu PDF, #533) : sans elles
# `import weasyprint` échoue au chargement (Pango/GObject introuvables).
RUN apt-get update && apt-get install --no-install-recommends -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --upgrade pip

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
