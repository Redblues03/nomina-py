"""Genera el desprendible de pago en PDF a partir de un resultado de nomina.calcular()."""

import io
from datetime import date

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

AZUL = HexColor("#16323d")
DORADO = HexColor("#f2e6c9")
GRIS_TEXTO = HexColor("#587079")
LINEA = HexColor("#d4dbde")
VERDE_FONDO = HexColor("#d8ede5")
VERDE_TEXTO = HexColor("#157a5b")

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _pesos(valor):
    return "$" + f"{round(valor):,}".replace(",", ".")


def _fecha_larga(d):
    return f"{MESES[d.month - 1].capitalize()} de {d.year}"


def generar_pdf(resultado, retencion_aplicada, fecha=None):
    """Arma el PDF del desprendible. Devuelve los bytes del archivo."""
    r = resultado
    fecha = fecha or date.today()

    filas = [("Salario básico", _pesos(r["salario"]), False)]
    if r["recargos"] > 0:
        filas.append(("Recargos y horas extra", _pesos(r["recargos"]), False))
    if r["recibe_auxilio"]:
        filas.append(("Auxilio de transporte", _pesos(r["auxilio"]), False))
    if r["pago_extra"] > 0:
        filas.append(("Otros ingresos (no salarial)", _pesos(r["pago_extra"]), False))
    filas.append(("Total devengado", _pesos(r["devengado"]), True))
    filas.append(("__sep__", "", False))
    filas.append(("Salud (4%)", "−" + _pesos(r["salud"]), False))
    filas.append(("Pensión (4%)", "−" + _pesos(r["pension"]), False))
    if r["fsp"]["valor"] > 0:
        filas.append(("Fondo de solidaridad", "−" + _pesos(r["fsp"]["valor"]), False))
    if retencion_aplicada:
        filas.append(("Retención en la fuente", "−" + _pesos(r["rete"]), False))
    filas.append(("Total deducciones", "−" + _pesos(r["deducciones"]), True))

    ancho, _ = letter
    alto_fila = 24
    margen_sup = 150
    margen_inf = 140
    alto = margen_sup + len(filas) * alto_fila + margen_inf

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(ancho, alto))

    # Encabezado
    c.setFillColor(AZUL)
    c.rect(0, alto - 78, ancho, 78, fill=1, stroke=0)
    c.setFillColor(DORADO)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(36, alto - 34, "Mi Nómina")
    c.setFillColor(HexColor("#c9d6da"))
    c.setFont("Helvetica", 11)
    c.drawString(36, alto - 54, f"Desprendible estimado · {_fecha_larga(fecha)}")

    # Filas
    y = alto - 78 - 42
    for etiqueta, valor, es_total in filas:
        if etiqueta == "__sep__":
            c.setStrokeColor(LINEA)
            c.line(36, y + 8, ancho - 36, y + 8)
            y -= alto_fila
            continue
        c.setFillColor(AZUL)
        c.setFont("Helvetica-Bold" if es_total else "Helvetica", 11)
        c.drawString(36, y, etiqueta)
        c.drawRightString(ancho - 36, y, valor)
        y -= alto_fila

    # Neto a pagar
    caja_y = y - 8
    c.setFillColor(VERDE_FONDO)
    c.rect(32, caja_y - 46, ancho - 64, 46, fill=1, stroke=0)
    c.setFillColor(VERDE_TEXTO)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, caja_y - 18, "NETO A PAGAR")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(48, caja_y - 38, _pesos(r["neto"]))

    # Pie de página
    c.setFillColor(GRIS_TEXTO)
    c.setFont("Helvetica", 8)
    c.drawString(
        36, 24,
        "Estimado con valores oficiales de Colombia 2026. No reemplaza tu desprendible oficial.",
    )

    c.showPage()
    c.save()
    return buffer.getvalue()
