"""
Cálculo de nómina · Colombia 2026

Valores oficiales:
- SMMLV y auxilio de transporte: Decretos 1469 y 1470 de 2025
- UVT: Resolución DIAN 000238 de 2025
"""

# ---- Constantes oficiales 2026 ----
SMMLV = 1_750_905      # Salario mínimo mensual legal vigente
AUXILIO = 249_095      # Auxilio de transporte
UVT = 52_374           # Unidad de Valor Tributario

TOPE_AUXILIO = 2 * SMMLV   # El auxilio aplica hasta 2 SMMLV
T_SALUD = 0.04             # Aporte salud (empleado)
T_PENSION = 0.04           # Aporte pensión (empleado)


def redondear(valor):
    """Redondea a peso, mitad hacia arriba (como se usa en nómina)."""
    return int(valor + 0.5) if valor >= 0 else -int(-valor + 0.5)


def fondo_solidaridad(salario):
    """Fondo de Solidaridad Pensional. Aplica desde 4 SMMLV con tarifa escalonada."""
    n = salario / SMMLV
    if n < 4:
        tarifa = 0.0
    elif n < 16:
        tarifa = 0.010
    elif n < 17:
        tarifa = 0.012
    elif n < 18:
        tarifa = 0.014
    elif n < 19:
        tarifa = 0.016
    elif n < 20:
        tarifa = 0.018
    else:
        tarifa = 0.020
    return {"valor": redondear(salario * tarifa), "tarifa": tarifa}


def impuesto_renta(base_uvt):
    """Tabla del artículo 383 del Estatuto Tributario (rangos mensuales en UVT)."""
    if base_uvt <= 95:
        uvt = 0
    elif base_uvt <= 150:
        uvt = (base_uvt - 95) * 0.19
    elif base_uvt <= 360:
        uvt = (base_uvt - 150) * 0.28 + 10
    elif base_uvt <= 640:
        uvt = (base_uvt - 360) * 0.33 + 69
    elif base_uvt <= 945:
        uvt = (base_uvt - 640) * 0.35 + 162
    elif base_uvt <= 2300:
        uvt = (base_uvt - 945) * 0.37 + 268
    else:
        uvt = (base_uvt - 2300) * 0.39 + 770
    return redondear(uvt * UVT)


def retencion_fuente(salario, aportes_obligatorios):
    """Retención en la fuente por salarios (procedimiento 1, simplificado)."""
    subtotal = salario - aportes_obligatorios
    limite_exenta = (790 / 12) * UVT              # 25% renta exenta, tope 790 UVT/año
    renta_exenta = min(subtotal * 0.25, limite_exenta)
    base = max(subtotal - renta_exenta, 0)
    return impuesto_renta(base / UVT)


def calcular(salario, auxilio=True, retencion=False, arl=0.00522, recargos=0, pago_extra=0):
    """Calcula la nómina completa a partir del salario mensual.

    `recargos` es el valor adicional por horas extra y recargos (nocturnos,
    dominicales/festivos) del módulo de turnos. Es salario, así que entra en
    el devengado y en la base de aportes (salud, pensión, FSP, retención),
    pero no afecta el tope de 2 SMMLV para el auxilio de transporte.

    `pago_extra` es un ingreso no constitutivo de salario (p. ej. una
    compensación de seguro): se suma al devengado y al neto, pero NO entra
    en la base de aportes (salud, pensión, FSP, retención).
    """
    salario = max(int(salario), 0)
    recargos = max(int(recargos), 0)
    pago_extra = max(int(pago_extra), 0)
    recibe_auxilio = bool(auxilio) and salario <= TOPE_AUXILIO
    aux = AUXILIO if recibe_auxilio else 0

    base_aportes = salario + recargos
    salud = redondear(base_aportes * T_SALUD)
    pension = redondear(base_aportes * T_PENSION)
    fsp = fondo_solidaridad(base_aportes)

    rete = 0
    if retencion:
        rete = retencion_fuente(base_aportes, salud + pension + fsp["valor"])

    devengado = salario + recargos + aux + pago_extra
    deducciones = salud + pension + fsp["valor"] + rete
    neto = devengado - deducciones

    # Costo para el empleador
    # (base prestaciones = salario + recargos + auxilio; base seguridad social = salario + recargos)
    base_prest = salario + recargos + aux
    empleador = {
        "salud": redondear(base_aportes * 0.085),
        "pension": redondear(base_aportes * 0.12),
        "arl": redondear(base_aportes * arl),
        "caja": redondear(base_aportes * 0.04),
        "cesantias": redondear(base_prest * 0.0833),
        "intereses": redondear(base_prest * 0.01),
        "prima": redondear(base_prest * 0.0833),
        "vacaciones": redondear(base_aportes * 0.0417),
    }
    empleador["total"] = devengado + sum(empleador.values())

    return {
        "salario": salario,
        "recargos": recargos,
        "pago_extra": pago_extra,
        "auxilio": aux,
        "recibe_auxilio": recibe_auxilio,
        "salud": salud,
        "pension": pension,
        "fsp": fsp,
        "rete": rete,
        "devengado": devengado,
        "deducciones": deducciones,
        "neto": neto,
        "empleador": empleador,
        "arl_tarifa": arl,
    }


def calcular_prima(meses):
    """Prima de servicios de un semestre (Art. 306 CST, Ley 1788 de 2016).

    Por cada mes: (salario + recargos + auxilio de transporte) x días
    trabajados / 360. El auxilio de transporte SÍ hace parte de la base de
    la prima (aunque no de la de salud/pensión). Los pagos no constitutivos
    de salario (`pago_extra`) NO entran.

    `meses`: lista de dicts {mes, salario, recargos, recibe_auxilio,
    dias_trabajados (0-30)}.
    """
    detalle = []
    total = 0.0
    for m in meses:
        salario = max(int(m.get("salario", 0) or 0), 0)
        recargos = max(int(m.get("recargos", 0) or 0), 0)
        dias = max(min(float(m.get("dias_trabajados", 30) or 0), 30), 0)
        recibe_auxilio = bool(m.get("recibe_auxilio", True)) and (salario + recargos) <= TOPE_AUXILIO
        aux = AUXILIO if recibe_auxilio else 0
        base = salario + recargos + aux
        valor = base * dias / 360

        detalle.append({
            "mes": m.get("mes", ""),
            "base": base,
            "auxilio": aux,
            "dias_trabajados": dias,
            "valor": redondear(valor),
        })
        total += valor

    return {"detalle": detalle, "total": redondear(total)}
