"""
Cálculo de horas extra y recargos por turnos · Colombia 2026

Reglas legales aplicadas (Ley 2466 de 2025 - reforma laboral):
- Horario nocturno: 7:00 p.m. a 6:00 a.m. (antes 9:00 p.m., cambió el 25-dic-2025)
- Recargo nocturno: 35% (sin cambios)
- Recargo dominical/festivo: 80% hasta el 30-jun-2026, 90% desde el 1-jul-2026
  (100% desde el 1-jul-2027)
- Hora extra diurna: +25% | Hora extra nocturna: +75%
- Divisor mensual de la hora ordinaria: 220 horas hasta el 14-jul-2026,
  210 horas desde el 15-jul-2026 (jornada semanal de 42 horas)

IMPORTANTE: el "recargo" (nocturno o dominical/festivo) es un valor que se
SUMA al salario mensual, porque las horas dentro de tu horario ordinario ya
están pagadas por el salario fijo. En cambio, la "hora extra" es tiempo que
tu salario NO cubre, así que se paga el 100% del valor de la hora más su
recargo (125%, 175%, etc.) — es plata completamente nueva.

Por defecto este cálculo asume que, si trabajas domingo o festivo, tu
empleador te da un descanso compensatorio en la semana (el escenario más
común en turnos rotativos), así que domingo/festivo solo suma el recargo.
Si NO te dan ese descanso, la ley te da derecho a un pago adicional
(Art. 180 CST): el día se paga completo (100% de la hora + el recargo),
como si fuera un día extra de trabajo. Activa `sin_descanso_compensatorio`
para ese caso.
"""

from datetime import date, datetime, time, timedelta

# ---- Festivos oficiales de Colombia ----
# Formato: (mes, día). Añade el año que necesites cuando cambie el calendario.
FESTIVOS = {
    2026: {
        (1, 1),   # Año Nuevo
        (1, 12),  # Reyes Magos
        (3, 23),  # San José
        (4, 2),   # Jueves Santo
        (4, 3),   # Viernes Santo
        (5, 1),   # Día del Trabajo
        (5, 18),  # Ascensión del Señor
        (6, 8),   # Corpus Christi
        (6, 15),  # Sagrado Corazón de Jesús
        (6, 29),  # San Pedro y San Pablo
        (7, 13),  # Virgen de Chiquinquirá (nuevo festivo, Ley 2578 de 2026)
        (7, 20),  # Independencia
        (8, 7),   # Batalla de Boyacá
        (8, 17),  # Asunción de la Virgen
        (10, 12), # Día de la Raza
        (11, 2),  # Todos los Santos
        (11, 16), # Independencia de Cartagena
        (12, 8),  # Inmaculada Concepción
        (12, 25), # Navidad
    },
}

HORA_INICIO_DIURNO = time(6, 0)
HORA_INICIO_NOCTURNO = time(19, 0)

R_NOCTURNO = 0.35
R_EXTRA_DIURNA = 0.25
R_EXTRA_NOCTURNA = 0.75


def festivos_del_anio(anio):
    """Lista de fechas festivas (objetos date) para un año soportado."""
    dias = FESTIVOS.get(anio, set())
    return sorted(date(anio, m, d) for (m, d) in dias)


def es_festivo(fecha):
    return (fecha.month, fecha.day) in FESTIVOS.get(fecha.year, set())


def es_domingo(fecha):
    return fecha.weekday() == 6


def es_dia_especial(fecha):
    """Domingo o festivo: aplica recargo dominical/festivo."""
    return es_domingo(fecha) or es_festivo(fecha)


def tarifa_dominical(fecha):
    """Porcentaje de recargo dominical/festivo vigente en la fecha dada."""
    if fecha < date(2025, 7, 1):
        return 0.75
    if fecha < date(2026, 7, 1):
        return 0.80
    if fecha < date(2027, 7, 1):
        return 0.90
    return 1.00


def divisor_mensual(fecha):
    """Horas mensuales usadas para calcular el valor de la hora ordinaria."""
    if fecha < date(2026, 7, 15):
        return 220
    return 210


def valor_hora(salario, fecha):
    return salario / divisor_mensual(fecha)


def _parse_hora(s):
    h, m = s.split(":")
    return time(int(h), int(m))


def _partir_en_franjas(fecha_str, inicio_str, fin_str, almuerzo_min=0):
    """
    Divide un turno en franjas atómicas cortadas en medianoche, 06:00 y 19:00,
    quitando el bloque de almuerzo (centrado en la mitad del turno).

    Devuelve una lista de dicts: {fecha, inicio, fin, nocturna, horas}
    ordenada cronológicamente.
    """
    fecha_turno = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    hora_inicio = _parse_hora(inicio_str)
    hora_fin = _parse_hora(fin_str)

    dt_inicio = datetime.combine(fecha_turno, hora_inicio)
    dt_fin = datetime.combine(fecha_turno, hora_fin)
    if dt_fin <= dt_inicio:
        dt_fin += timedelta(days=1)  # el turno cruza la medianoche

    # Quitar el bloque de almuerzo, centrado en la mitad del turno
    intervalos = [(dt_inicio, dt_fin)]
    if almuerzo_min > 0:
        punto_medio = dt_inicio + (dt_fin - dt_inicio) / 2
        media_pausa = timedelta(minutes=almuerzo_min / 2)
        pausa_ini = punto_medio - media_pausa
        pausa_fin = punto_medio + media_pausa
        nuevos = []
        for a, b in intervalos:
            if pausa_fin <= a or pausa_ini >= b:
                nuevos.append((a, b))
            else:
                if pausa_ini > a:
                    nuevos.append((a, pausa_ini))
                if pausa_fin < b:
                    nuevos.append((pausa_fin, b))
        intervalos = nuevos

    # Cortar cada intervalo en medianoche / 06:00 / 19:00
    puntos_corte = set()
    for a, b in intervalos:
        puntos_corte.add(a)
        puntos_corte.add(b)
        d = a.date()
        while d <= b.date():
            for hh in (0, 6, 19):
                p = datetime.combine(d, time(hh, 0))
                if a < p < b:
                    puntos_corte.add(p)
            d += timedelta(days=1)

    puntos = sorted(puntos_corte)
    franjas = []
    for a, b in zip(puntos, puntos[1:]):
        # ¿este sub-intervalo cae dentro de alguno de los intervalos válidos (sin almuerzo)?
        valido = any(a >= ia and b <= ib for ia, ib in intervalos)
        if not valido or a >= b:
            continue
        nocturna = not (HORA_INICIO_DIURNO <= a.time() < HORA_INICIO_NOCTURNO)
        franjas.append({
            "fecha": a.date(),
            "inicio": a,
            "fin": b,
            "nocturna": nocturna,
            "horas": (b - a).total_seconds() / 3600,
        })
    return franjas


def _clasificar_turno(fecha_str, inicio_str, fin_str, almuerzo_min, jornada_ordinaria):
    """
    Procesa un turno completo y devuelve una lista de piezas clasificadas:
    {fecha, nocturna, especial, tipo_especial, ordinaria(bool), horas}
    """
    franjas = _partir_en_franjas(fecha_str, inicio_str, fin_str, almuerzo_min)

    piezas = []
    acumulado = 0.0
    for f in franjas:
        horas = f["horas"]
        restante_ordinario = max(jornada_ordinaria - acumulado, 0)

        def _agregar(h, ordinaria):
            if h <= 0:
                return
            especial = es_dia_especial(f["fecha"])
            tipo = None
            if especial:
                tipo = "domingo" if es_domingo(f["fecha"]) else "festivo"
            piezas.append({
                "fecha": f["fecha"],
                "nocturna": f["nocturna"],
                "especial": especial,
                "tipo_especial": tipo,
                "ordinaria": ordinaria,
                "horas": h,
            })

        if horas <= restante_ordinario:
            _agregar(horas, True)
        else:
            _agregar(restante_ordinario, True)
            _agregar(horas - restante_ordinario, False)
        acumulado += horas

    return piezas


def calcular_mes(salario, turnos, jornada_ordinaria=8.0, sin_descanso_compensatorio=False,
                  forzar_tarifa_julio=False):
    """
    Calcula los recargos y horas extra de un conjunto de turnos en un mes.

    turnos: lista de dicts {fecha: "YYYY-MM-DD", inicio: "HH:MM", fin: "HH:MM",
                             almuerzo: minutos (opcional, default 0)}
    sin_descanso_compensatorio: si es True, las horas ordinarias trabajadas en
        domingo/festivo se pagan como día completo (100% de la hora + el
        recargo) en vez de solo el recargo — ver Art. 180 CST.
    forzar_tarifa_julio: si es True, usa la tarifa dominical/festiva vigente
        desde el 1-jul-2026 (90%) para todas las fechas del mes, sin importar
        la fecha real de cada turno. Sirve para simular "¿cómo se vería este
        mes con los recargos nuevos?". No afecta el divisor mensual de la
        hora (220/210), que sigue la fecha real.
    """
    tarifa_julio_2026 = tarifa_dominical(date(2026, 7, 1))
    categorias = {
        "recargo_nocturno": {"horas": 0.0, "valor": 0.0},
        "recargo_dominical": {"horas": 0.0, "valor": 0.0},
        "recargo_nocturno_dominical": {"horas": 0.0, "valor": 0.0},
        "extra_diurna": {"horas": 0.0, "valor": 0.0},
        "extra_nocturna": {"horas": 0.0, "valor": 0.0},
        "extra_diurna_dominical": {"horas": 0.0, "valor": 0.0},
        "extra_nocturna_dominical": {"horas": 0.0, "valor": 0.0},
    }

    por_dia = {}   # fecha (date) -> {horas_ordinarias, horas_extra, valor, especial, tipo_especial}
    advertencias = []
    domingos_trabajados = set()
    festivos_trabajados = set()
    horas_totales = 0.0
    horas_extra_totales = 0.0

    for t in turnos:
        almuerzo = t.get("almuerzo", 0) or 0
        piezas = _clasificar_turno(t["fecha"], t["inicio"], t["fin"], almuerzo, jornada_ordinaria)

        extra_del_turno = 0.0
        for p in piezas:
            vh = valor_hora(salario, p["fecha"])
            h = p["horas"]
            horas_totales += h

            if p["ordinaria"]:
                if not p["especial"]:
                    if p["nocturna"]:
                        categorias["recargo_nocturno"]["horas"] += h
                        categorias["recargo_nocturno"]["valor"] += h * vh * R_NOCTURNO
                    # diurna ordinaria sin recargo: ya pagada por el salario
                else:
                    td = tarifa_julio_2026 if forzar_tarifa_julio else tarifa_dominical(p["fecha"])
                    base = 1.0 if sin_descanso_compensatorio else 0.0
                    if p["nocturna"]:
                        categorias["recargo_nocturno_dominical"]["horas"] += h
                        categorias["recargo_nocturno_dominical"]["valor"] += h * vh * (base + R_NOCTURNO + td)
                    else:
                        categorias["recargo_dominical"]["horas"] += h
                        categorias["recargo_dominical"]["valor"] += h * vh * (base + td)
            else:
                extra_del_turno += h
                horas_extra_totales += h
                if not p["especial"]:
                    if p["nocturna"]:
                        categorias["extra_nocturna"]["horas"] += h
                        categorias["extra_nocturna"]["valor"] += h * vh * (1 + R_EXTRA_NOCTURNA)
                    else:
                        categorias["extra_diurna"]["horas"] += h
                        categorias["extra_diurna"]["valor"] += h * vh * (1 + R_EXTRA_DIURNA)
                else:
                    td = tarifa_julio_2026 if forzar_tarifa_julio else tarifa_dominical(p["fecha"])
                    if p["nocturna"]:
                        categorias["extra_nocturna_dominical"]["horas"] += h
                        categorias["extra_nocturna_dominical"]["valor"] += h * vh * (1 + R_EXTRA_NOCTURNA + td)
                    else:
                        categorias["extra_diurna_dominical"]["horas"] += h
                        categorias["extra_diurna_dominical"]["valor"] += h * vh * (1 + R_EXTRA_DIURNA + td)

            if p["especial"]:
                if p["tipo_especial"] == "domingo":
                    domingos_trabajados.add(p["fecha"])
                else:
                    festivos_trabajados.add(p["fecha"])

            dia = por_dia.setdefault(p["fecha"], {
                "fecha": p["fecha"].isoformat(),
                "especial": p["especial"],
                "tipo_especial": p["tipo_especial"],
                "horas_ordinarias": 0.0,
                "horas_extra": 0.0,
            })
            if p["ordinaria"]:
                dia["horas_ordinarias"] += h
            else:
                dia["horas_extra"] += h

        if extra_del_turno > 2:
            advertencias.append(
                f"El {t['fecha']} tienes {extra_del_turno:.1f} horas extra: "
                f"supera el máximo legal de 2 horas extra diarias (Art. 22, Ley 2466 de 2025)."
            )

    total_recargos = round(sum(c["valor"] for c in categorias.values()))
    for c in categorias.values():
        c["horas"] = round(c["horas"], 2)
        c["valor"] = round(c["valor"])

    resumen = {
        "dias_trabajados": len(por_dia),
        "horas_totales": round(horas_totales, 2),
        "horas_extra_totales": round(horas_extra_totales, 2),
        "domingos_trabajados": len(domingos_trabajados),
        "festivos_trabajados": len(festivos_trabajados),
        "advertencias": advertencias,
    }

    return {
        "resumen": resumen,
        "categorias": categorias,
        "total_recargos": total_recargos,
        "por_dia": sorted(por_dia.values(), key=lambda d: d["fecha"]),
    }
