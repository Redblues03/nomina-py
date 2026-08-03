"""Pruebas del cálculo de horas extra y recargos. Ejecuta: python test_turnos.py"""

import turnos


def test_festivos_2026_completos():
    festivos = turnos.festivos_del_anio(2026)
    assert len(festivos) == 19
    assert turnos.es_festivo(__import__("datetime").date(2026, 7, 20))   # Independencia
    assert turnos.es_festivo(__import__("datetime").date(2026, 12, 25))  # Navidad
    assert not turnos.es_festivo(__import__("datetime").date(2026, 7, 21))


def test_tarifa_dominical_cambia_en_julio_2026():
    from datetime import date
    assert turnos.tarifa_dominical(date(2026, 6, 30)) == 0.80
    assert turnos.tarifa_dominical(date(2026, 7, 1)) == 0.90


def test_divisor_cambia_15_julio_2026():
    from datetime import date
    assert turnos.divisor_mensual(date(2026, 7, 14)) == 220
    assert turnos.divisor_mensual(date(2026, 7, 15)) == 210


def test_turno_diurno_simple_sin_recargo():
    """Turno 06:00-15:00 con 1h de almuerzo = 8h diurnas ordinarias, entre semana: sin recargo."""
    r = turnos.calcular_mes(
        salario=2_000_000,
        turnos=[{"fecha": "2026-03-02", "inicio": "06:00", "fin": "15:00", "almuerzo": 60}],
    )
    assert r["resumen"]["horas_totales"] == 8.0
    assert r["resumen"]["horas_extra_totales"] == 0.0
    assert r["total_recargos"] == 0  # todo diurno, ordinario, entre semana: ya pagado por el salario


def test_turno_nocturno_genera_recargo():
    """Turno 22:00-06:00 (8h) entre semana: todo nocturno, recargo 35%."""
    salario = 2_000_000
    r = turnos.calcular_mes(
        salario=salario,
        turnos=[{"fecha": "2026-03-02", "inicio": "22:00", "fin": "06:00", "almuerzo": 0}],
    )
    vh = salario / 220
    esperado = round(8 * vh * 0.35)
    assert r["categorias"]["recargo_nocturno"]["horas"] == 8.0
    assert r["total_recargos"] == esperado


def test_turno_domingo_genera_recargo_dominical():
    """1 de marzo de 2026 es domingo. Turno diurno 06:00-15:00 con almuerzo."""
    salario = 2_000_000
    r = turnos.calcular_mes(
        salario=salario,
        turnos=[{"fecha": "2026-03-01", "inicio": "06:00", "fin": "15:00", "almuerzo": 60}],
    )
    vh = salario / 220
    esperado = round(8 * vh * 0.80)
    assert r["categorias"]["recargo_dominical"]["horas"] == 8.0
    assert r["total_recargos"] == esperado
    assert r["resumen"]["domingos_trabajados"] == 1


def test_domingo_sin_descanso_compensatorio_paga_dia_completo():
    """Sin descanso compensatorio (Art. 180 CST): domingo/festivo paga 100% de la hora + recargo."""
    salario = 2_000_000
    r = turnos.calcular_mes(
        salario=salario,
        turnos=[{"fecha": "2026-03-01", "inicio": "06:00", "fin": "15:00", "almuerzo": 60}],
        sin_descanso_compensatorio=True,
    )
    vh = salario / 220
    esperado = round(8 * vh * (1 + 0.80))
    assert r["categorias"]["recargo_dominical"]["horas"] == 8.0
    assert r["total_recargos"] == esperado


def test_horas_extra_diurnas_pagan_valor_completo():
    """Turno de 10 horas seguidas diurno (sin almuerzo), jornada ordinaria 8h -> 2h extra."""
    salario = 2_000_000
    r = turnos.calcular_mes(
        salario=salario,
        turnos=[{"fecha": "2026-03-02", "inicio": "06:00", "fin": "16:00", "almuerzo": 0}],
        jornada_ordinaria=8.0,
    )
    vh = salario / 220
    esperado = round(2 * vh * 1.25)
    assert r["categorias"]["extra_diurna"]["horas"] == 2.0
    assert r["categorias"]["extra_diurna"]["valor"] == esperado
    assert len(r["resumen"]["advertencias"]) == 0  # 2h extra está en el límite legal


def test_advertencia_supera_2_horas_extra():
    salario = 2_000_000
    r = turnos.calcular_mes(
        salario=salario,
        turnos=[{"fecha": "2026-03-02", "inicio": "06:00", "fin": "17:00", "almuerzo": 0}],
        jornada_ordinaria=8.0,
    )
    assert len(r["resumen"]["advertencias"]) == 1


def test_turno_cruza_medianoche_dia_correcto():
    """Turno sábado 22:00 a domingo 06:00: las horas después de medianoche son del domingo."""
    salario = 2_000_000
    r = turnos.calcular_mes(
        salario=salario,
        # 2026-02-28 es sábado
        turnos=[{"fecha": "2026-02-28", "inicio": "22:00", "fin": "06:00", "almuerzo": 0}],
    )
    dias = {d["fecha"]: d for d in r["por_dia"]}
    assert dias["2026-02-28"]["especial"] is False       # sábado, no especial
    assert dias["2026-03-01"]["especial"] is True         # domingo
    assert dias["2026-02-28"]["horas_ordinarias"] == 2.0  # 22:00-24:00
    assert dias["2026-03-01"]["horas_ordinarias"] == 6.0  # 00:00-06:00
    # Solo las horas del domingo (nocturnas + especiales) deben generar recargo nocturno-dominical
    assert r["categorias"]["recargo_nocturno_dominical"]["horas"] == 6.0
    assert r["categorias"]["recargo_nocturno"]["horas"] == 2.0  # las del sábado


def test_almuerzo_se_descuenta_del_medio():
    """Turno 06:00-15:00 (9h) con 60 min de almuerzo -> 8h netas trabajadas."""
    r = turnos.calcular_mes(
        salario=2_000_000,
        turnos=[{"fecha": "2026-03-02", "inicio": "06:00", "fin": "15:00", "almuerzo": 60}],
    )
    assert r["resumen"]["horas_totales"] == 8.0


def test_tarifas_julio_2026_valores_conocidos():
    """Verifica los valores citados en fuentes oficiales para el SMMLV 2026."""
    smmlv = 1_750_905
    # Antes del 15 de julio: hora ordinaria = smmlv/220 ≈ 7959
    vh_h1 = turnos.valor_hora(smmlv, __import__("datetime").date(2026, 6, 1))
    assert round(vh_h1) == 7959
    # Desde el 15 de julio: hora ordinaria = smmlv/210 ≈ 8338
    vh_h2 = turnos.valor_hora(smmlv, __import__("datetime").date(2026, 8, 1))
    assert round(vh_h2) == 8338


if __name__ == "__main__":
    for nombre, fn in list(globals().items()):
        if nombre.startswith("test_"):
            fn()
            print(f"OK  {nombre}")
    print("\nTodas las pruebas pasaron.")
