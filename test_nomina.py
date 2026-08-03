"""Pruebas del cálculo de nómina. Ejecuta:  python -m pytest  (o)  python test_nomina.py"""

import nomina


def test_salario_minimo():
    r = nomina.calcular(1_750_905)
    assert r["auxilio"] == 249_095          # recibe auxilio
    assert r["salud"] == 70_036
    assert r["pension"] == 70_036
    assert r["fsp"]["valor"] == 0           # no aplica bajo 4 SMMLV
    assert r["devengado"] == 2_000_000
    assert r["neto"] == 1_859_928


def test_auxilio_no_aplica_sobre_2_smmlv():
    r = nomina.calcular(4_000_000)
    assert r["auxilio"] == 0
    assert r["recibe_auxilio"] is False


def test_fondo_solidaridad_desde_4_smmlv():
    r = nomina.calcular(7_003_620)          # exactamente 4 SMMLV
    assert r["fsp"]["tarifa"] == 0.010
    assert r["fsp"]["valor"] == 70_036


def test_retencion_solo_en_bases_altas():
    bajo = nomina.calcular(3_000_000, retencion=True)
    assert bajo["rete"] == 0
    alto = nomina.calcular(10_000_000, retencion=True)
    assert alto["rete"] > 0


def test_neto_nunca_supera_devengado():
    for s in (0, 1_300_000, 2_500_000, 6_000_000, 15_000_000):
        r = nomina.calcular(s, retencion=True)
        assert 0 <= r["neto"] <= r["devengado"]


def test_recargos_entran_en_devengado_y_en_ibc():
    """Los recargos deben sumar al devengado y a la base de salud/pensión."""
    r = nomina.calcular(2_000_000, auxilio=True, recargos=200_000)
    assert r["devengado"] == 2_000_000 + 200_000 + 249_095
    assert r["salud"] == round((2_000_000 + 200_000) * 0.04)
    assert r["pension"] == round((2_000_000 + 200_000) * 0.04)


def test_pago_extra_no_entra_en_ibc():
    """El pago extra (no salarial) suma al devengado y al neto, pero no a salud/pensión/FSP/retención."""
    sin_extra = nomina.calcular(2_000_000, auxilio=True, retencion=True)
    con_extra = nomina.calcular(2_000_000, auxilio=True, retencion=True, pago_extra=300_000)
    assert con_extra["pago_extra"] == 300_000
    assert con_extra["devengado"] == sin_extra["devengado"] + 300_000
    assert con_extra["salud"] == sin_extra["salud"]
    assert con_extra["pension"] == sin_extra["pension"]
    assert con_extra["rete"] == sin_extra["rete"]
    assert con_extra["neto"] == sin_extra["neto"] + 300_000


def test_prima_semestre_completo_salario_constante():
    """6 meses de 30 días con el mismo salario -> prima = 15 días de salario (medio mes)."""
    meses = [
        {"mes": f"m{i}", "salario": 2_000_000, "recargos": 0, "recibe_auxilio": False, "dias_trabajados": 30}
        for i in range(6)
    ]
    r = nomina.calcular_prima(meses)
    assert r["total"] == 1_000_000  # (2_000_000 * 180) / 360


def test_prima_incluye_auxilio_pero_respeta_tope():
    r = nomina.calcular_prima([
        {"mes": "m1", "salario": 1_750_905, "recargos": 0, "recibe_auxilio": True, "dias_trabajados": 30},
    ])
    esperado = round((1_750_905 + 249_095) * 30 / 360)
    assert r["detalle"][0]["auxilio"] == 249_095
    assert r["total"] == esperado

    # Con salario que ya supera 2 SMMLV, el auxilio no debe aplicar aunque se pida.
    r2 = nomina.calcular_prima([
        {"mes": "m1", "salario": 5_000_000, "recargos": 0, "recibe_auxilio": True, "dias_trabajados": 30},
    ])
    assert r2["detalle"][0]["auxilio"] == 0


def test_prima_prorratea_dias_trabajados():
    r = nomina.calcular_prima([
        {"mes": "m1", "salario": 2_000_000, "recargos": 0, "recibe_auxilio": False, "dias_trabajados": 15},
    ])
    assert r["total"] == round(2_000_000 * 15 / 360)


if __name__ == "__main__":
    for nombre, fn in list(globals().items()):
        if nombre.startswith("test_"):
            fn()
            print(f"OK  {nombre}")
    print("\nTodas las pruebas pasaron.")
