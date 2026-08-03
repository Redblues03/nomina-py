"""Servidor web de Mi Nómina (Flask)."""

from flask import Flask, jsonify, request, send_from_directory

import nomina
import turnos

app = Flask(__name__, static_folder="static", static_url_path="")


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/calcular", methods=["POST"])
def api_calcular():
    data = request.get_json(silent=True) or {}
    try:
        salario = int(float(data.get("salario", 0) or 0))
    except (TypeError, ValueError):
        salario = 0
    try:
        recargos = int(float(data.get("recargos", 0) or 0))
    except (TypeError, ValueError):
        recargos = 0
    try:
        pago_extra = int(float(data.get("pago_extra", 0) or 0))
    except (TypeError, ValueError):
        pago_extra = 0

    resultado = nomina.calcular(
        salario=salario,
        auxilio=bool(data.get("auxilio", True)),
        retencion=bool(data.get("retencion", False)),
        arl=float(data.get("arl", 0.00522)),
        recargos=recargos,
        pago_extra=pago_extra,
    )
    return jsonify(resultado)


@app.route("/api/turnos/calcular", methods=["POST"])
def api_turnos_calcular():
    data = request.get_json(silent=True) or {}
    try:
        salario = int(float(data.get("salario", 0) or 0))
    except (TypeError, ValueError):
        salario = 0

    try:
        jornada = float(data.get("jornada_ordinaria", 8.0) or 8.0)
    except (TypeError, ValueError):
        jornada = 8.0

    lista_turnos = data.get("turnos", []) or []
    turnos_validos = []
    for t in lista_turnos:
        if not t.get("fecha") or not t.get("inicio") or not t.get("fin"):
            continue
        turnos_validos.append({
            "fecha": t["fecha"],
            "inicio": t["inicio"],
            "fin": t["fin"],
            "almuerzo": int(t.get("almuerzo", 0) or 0),
        })

    sin_descanso = bool(data.get("sin_descanso_compensatorio", False))

    resultado = turnos.calcular_mes(
        salario, turnos_validos, jornada_ordinaria=jornada,
        sin_descanso_compensatorio=sin_descanso,
    )
    return jsonify(resultado)


@app.route("/api/prima/calcular", methods=["POST"])
def api_prima_calcular():
    data = request.get_json(silent=True) or {}
    meses_in = data.get("meses", []) or []

    meses = []
    for m in meses_in:
        try:
            salario = int(float(m.get("salario", 0) or 0))
        except (TypeError, ValueError):
            salario = 0
        try:
            recargos = int(float(m.get("recargos", 0) or 0))
        except (TypeError, ValueError):
            recargos = 0
        try:
            dias = float(m.get("dias_trabajados", 30) or 0)
        except (TypeError, ValueError):
            dias = 30.0
        meses.append({
            "mes": m.get("mes", ""),
            "salario": salario,
            "recargos": recargos,
            "recibe_auxilio": bool(m.get("recibe_auxilio", True)),
            "dias_trabajados": dias,
        })

    resultado = nomina.calcular_prima(meses)
    return jsonify(resultado)


@app.route("/api/festivos")
def api_festivos():
    try:
        anio = int(request.args.get("anio", 2026))
    except (TypeError, ValueError):
        anio = 2026
    dias = turnos.festivos_del_anio(anio)
    return jsonify({"anio": anio, "festivos": [d.isoformat() for d in dias]})


@app.route("/api/salud")
def salud():
    return jsonify({"estado": "ok"})


if __name__ == "__main__":
    # Solo para desarrollo. En Docker se usa gunicorn (ver Dockerfile).
    app.run(host="0.0.0.0", port=8080, debug=True)
