# Mi Nómina · Colombia 2026 (Python)

Calculadora de salario neto para Colombia con los valores oficiales de 2026. El cálculo se hace en **Python (Flask)** y corre dentro de Docker, así que **la misma imagen funciona igual en Windows y en Ubuntu**. Puedes usarla desde el navegador o instalarla como app de escritorio (PWA).

---

## ¿Qué calcula?

- **Devengado:** salario básico + auxilio de transporte (si aplica, hasta 2 SMMLV) + recargos y horas extra (si usas el calendario de turnos).
- **Deducciones del empleado:** salud (4%), pensión (4%), Fondo de Solidaridad Pensional (desde 4 SMMLV) y retención en la fuente estimada (opcional).
- **Neto a pagar:** lo que realmente recibes.
- **Costo para el empleador (opcional):** aportes patronales y prestaciones sociales.
- **Turnos rotativos:** un calendario mensual donde marcas qué días trabajaste y en qué horario. La app identifica automáticamente domingos y festivos, y calcula recargo nocturno, recargo dominical/festivo y horas extra con las tarifas exactas vigentes en cada fecha de 2026.
- **Desprendible descargable:** el botón "Descargar PDF" genera el desprendible como un PDF real (texto seleccionable, no una imagen) armado en el servidor. También puedes descargarlo como imagen PNG.

Valores oficiales usados (Colombia 2026):

| Concepto | Valor |
|---|---|
| Salario mínimo (SMMLV) | $1.750.905 |
| Auxilio de transporte | $249.095 |
| UVT | $52.374 |
| Horario nocturno | 7:00 p.m. – 6:00 a.m. |
| Recargo nocturno | 35% |
| Recargo dominical/festivo | 80% (hasta 30-jun-2026) → 90% (desde 1-jul-2026) |
| Hora extra diurna / nocturna | +25% / +75% |
| Divisor mensual (hora ordinaria) | 220 h (hasta 14-jul-2026) → 210 h (desde 15-jul-2026) |

> Es una herramienta de estimación. No reemplaza tu desprendible oficial ni una asesoría contable.

### Sobre los turnos y recargos

- El calendario ya trae los **19 festivos oficiales de Colombia 2026** (Ley Emiliani) y detecta domingos automáticamente.
- Define tus turnos habituales (Mañana, Tarde, Noche, o los que uses) en "Mis turnos", con su hora de inicio, fin y minutos de almuerzo — el almuerzo se descuenta como tiempo no trabajado.
- Haz clic en cada día del calendario para asignarle uno de tus turnos, o un horario personalizado.
- El cálculo asume que, si trabajas domingo o festivo, tu empleador te da un **descanso compensatorio** en la semana (el escenario más común en turnos rotativos). Si no te dan ese descanso, la ley puede darte derecho a un pago adicional (Art. 180 CST) que este estimado no incluye.
- Las horas que superen tu jornada ordinaria (configurable, por defecto 8h por turno) se pagan como horas extra al valor completo de la hora, no solo el recargo.
- Tus turnos y plantillas se guardan automáticamente en tu navegador (localStorage), mes por mes.
- El botón **"Agregar este valor a mi nómina"** suma el total de recargos al desprendible principal (afecta el devengado y la base de salud/pensión, igual que en la vida real).

---

## Cómo funciona por dentro

- `nomina.py` → toda la lógica de cálculo en Python (funciones puras, fáciles de probar).
- `app.py` → servidor web con Flask. Sirve la página y expone la API `POST /api/calcular`.
- `pdf_nomina.py` → arma el desprendible en PDF (con [ReportLab](https://www.reportlab.com/)) a partir del resultado del cálculo. Se descarga vía `POST /api/nomina/pdf`.
- `static/` → la interfaz (HTML, CSS y un poco de JavaScript que solo pide el cálculo al backend y lo muestra).
- `test_nomina.py` → pruebas del cálculo.

El navegador nunca calcula: manda el salario a Python, Python responde con los números y la página los pinta.

---

## Requisitos

- **Windows:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Ubuntu:** [Docker Engine](https://docs.docker.com/engine/install/ubuntu/) (incluye `docker compose`)

Comprueba la instalación con:

```bash
docker --version
```

---

## Cómo levantarla con Docker

Desde la carpeta del proyecto (donde está `docker-compose.yml`):

```bash
docker compose up -d --build
```

Abre en tu navegador:

**http://localhost:9090**

Para detenerla:

```bash
docker compose down
```

> El mismo comando funciona idéntico en Windows y en Ubuntu.

---

## Instalarla como app de escritorio (opcional)

Con la app abierta en Chrome o Edge:

1. En la barra de direcciones aparece un ícono de **instalar**, o entra al menú `⋮` → **Instalar Mi Nómina**.
2. Acéptalo. Queda con su ícono y abre en su **propia ventana**, como una app de escritorio. Por debajo sigue siendo el mismo contenedor Docker.

---

## Correrla sin Docker (opcional, para desarrollo)

Si quieres probarla directo con Python en tu equipo:

```bash
pip install -r requirements.txt
python app.py
```

Y abre http://localhost:8080 (`python app.py` usa ese puerto directamente, sin pasar por el mapeo de Docker). Para correr las pruebas:

```bash
python test_nomina.py
python test_turnos.py
```

---

## Usarla en tus dos equipos

**Opción A — Construir en cada equipo (lo más simple).**
Copia la carpeta a cada máquina y corre `docker compose up -d --build`. No importa que una sea Windows y la otra Ubuntu.

**Opción B — Construir una vez y copiar la imagen.**

```bash
docker compose build
docker save mi-nomina:2026 -o mi-nomina.tar
```

Lleva `mi-nomina.tar` al otro equipo y cárgala:

```bash
docker load -i mi-nomina.tar
docker run -d -p 9090:8080 --name mi-nomina mi-nomina:2026
```

> Ambos equipos deben tener la misma arquitectura de procesador (casi siempre x86-64). Si alguno fuera ARM, usa la Opción A.

---

## Cambiar el puerto

El puerto por defecto es el 9090. Si lo necesitas cambiar (por ejemplo porque
otra app ya lo usa), edita `docker-compose.yml`:

```yaml
    ports:
      - "8088:8080"   # ahora sería http://localhost:8088
```

Y reconstruye con `docker compose up -d --build`.

---

## Usarla desde otros equipos de tu red (varios usuarios)

Como el cálculo corre en el servidor pero **todo lo que guardas (turnos,
plantillas, historial de la prima) se queda en el navegador de cada quien**
(no hay base de datos ni login en el servidor), varias personas pueden usar
la misma instalación sin que sus datos se crucen: cada una entra desde su
propio dispositivo y su información queda solo en su propio navegador.

1. Levanta la app en un equipo de la red (los pasos de arriba).
2. Averigua la IP de ese equipo en la red local: en Windows, `ipconfig` y
   busca "Dirección IPv4" (ej. `192.168.1.50`).
3. Si Windows bloquea el puerto, agrega una regla de entrada en el Firewall
   de Windows Defender para el puerto 9090 (TCP).
4. Los demás usuarios, conectados a la misma red, entran desde su navegador a
   `http://192.168.1.50:9090` (cambia la IP por la real de tu equipo).

> Si dos personas comparten el mismo computador y el mismo perfil de
> navegador, sí verían los datos de la otra — el aislamiento es por
> navegador, no por persona. Usa perfiles de navegador distintos si eso pasa.

---

## Estructura del proyecto

```
nomina-py/
├─ app.py                   # servidor Flask + API
├─ nomina.py                # cálculo de nómina (salario, deducciones, neto)
├─ turnos.py                # cálculo de horas extra y recargos por turnos
├─ test_nomina.py           # pruebas de nomina.py
├─ test_turnos.py           # pruebas de turnos.py
├─ requirements.txt         # dependencias Python
├─ Dockerfile               # imagen basada en python:3.12-slim
├─ docker-compose.yml       # levanta todo con un comando
├─ .dockerignore
├─ README.md
└─ static/                  # interfaz (PWA)
   ├─ index.html
   ├─ styles.css
   ├─ app.js
   ├─ manifest.webmanifest
   ├─ service-worker.js
   └─ icons/
```

## Actualizar los valores cada año

Cuando cambien el salario mínimo, el auxilio de transporte o la UVT, edita las tres constantes al inicio de `nomina.py`:

```python
SMMLV   = 1_750_905   # salario mínimo
AUXILIO = 249_095     # auxilio de transporte
UVT     = 52_374      # UVT del año
```

Para actualizar los **festivos** del próximo año, añade un nuevo bloque en el diccionario `FESTIVOS` al inicio de `turnos.py`:

```python
FESTIVOS = {
    2026: { ... },
    2027: {
        (1, 1),   # Año Nuevo
        # ... añade aquí las fechas de 2027
    },
}
```

Luego reconstruye: `docker compose up -d --build`.

## Notas de despliegue
   App versionada con Git y desplegada al server vía GitHub.