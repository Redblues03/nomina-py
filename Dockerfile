# Imagen de Python. La misma imagen corre igual en Windows y en Ubuntu.
FROM python:3.12-slim

WORKDIR /app

# Instala dependencias primero (mejor uso de la caché de Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto de la app
COPY . .

EXPOSE 8080

# Servidor de producción (gunicorn) sirviendo la app Flask
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "app:app"]
