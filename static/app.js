"use strict";

/* El cálculo se hace en el backend de Python (/api/calcular).
   Este archivo solo lee los campos, pide el cálculo y muestra el resultado. */

const fmt = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0,
});
const pesos = (n) => fmt.format(Math.round(n || 0));

const SMMLV = 1750905;
const TOPE_AUXILIO = 2 * SMMLV;
let recargosAplicados = 0;

const $ = (id) => document.getElementById(id);
const el = {
  salario: $("salario"), auxilio: $("auxilio"), retencion: $("retencion"),
  empleador: $("empleador"), arl: $("arl"), arlField: $("arlField"),
  auxilioNota: $("auxilioNota"), pagoExtra: $("pagoExtra"),
  rSalario: $("rSalario"), rAux: $("rAux"), rowAux: $("rowAux"), rDevengado: $("rDevengado"),
  rowExtra: $("rowExtra"), rExtra: $("rExtra"),
  rowRecargos: $("rowRecargos"), rRecargos: $("rRecargos"),
  rSalud: $("rSalud"), rPension: $("rPension"),
  rowFsp: $("rowFsp"), rFsp: $("rFsp"), fspPct: $("fspPct"),
  rowRete: $("rowRete"), rRete: $("rRete"),
  rDeducciones: $("rDeducciones"), rNeto: $("rNeto"),
  barNet: $("barNet"), barDed: $("barDed"), pctNet: $("pctNet"), pctDed: $("pctDed"),
  employerBlock: $("employerBlock"),
  eSalud: $("eSalud"), ePension: $("ePension"), eArl: $("eArl"), eArlPct: $("eArlPct"),
  eCaja: $("eCaja"), eCes: $("eCes"), eInt: $("eInt"), ePrima: $("ePrima"),
  eVac: $("eVac"), eTotal: $("eTotal"),
};

/* Da formato a un campo de dinero mientras se escribe (separadores de miles) */
function leerMonto(inputEl) {
  const digits = inputEl.value.replace(/\D/g, "");
  const n = digits ? parseInt(digits, 10) : 0;
  inputEl.value = digits ? n.toLocaleString("es-CO") : "";
  return n;
}
function leerSalario() { return leerMonto(el.salario); }

async function pedirCalculo(salario, pagoExtra) {
  const resp = await fetch("api/calcular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salario,
      auxilio: el.auxilio.checked,
      retencion: el.retencion.checked,
      arl: parseFloat(el.arl.value),
      recargos: recargosAplicados,
      pago_extra: pagoExtra,
    }),
  });
  if (!resp.ok) throw new Error("No se pudo calcular");
  return resp.json();
}

function pintar(r) {
  window.__ultimoResultado = r;
  el.rSalario.textContent = pesos(r.salario);

  el.rowRecargos.hidden = !(r.recargos > 0);
  el.rRecargos.textContent = pesos(r.recargos);

  el.rowAux.hidden = !r.recibe_auxilio;
  el.rAux.textContent = pesos(r.auxilio);

  el.rowExtra.hidden = !(r.pago_extra > 0);
  el.rExtra.textContent = pesos(r.pago_extra);

  el.rDevengado.textContent = pesos(r.devengado);

  el.rSalud.textContent = "−" + pesos(r.salud);
  el.rPension.textContent = "−" + pesos(r.pension);

  el.rowFsp.hidden = r.fsp.valor <= 0;
  el.fspPct.textContent = "(" + (r.fsp.tarifa * 100).toFixed(1).replace(".", ",") + "%)";
  el.rFsp.textContent = "−" + pesos(r.fsp.valor);

  el.rowRete.hidden = !el.retencion.checked;
  el.rRete.textContent = "−" + pesos(r.rete);

  el.rDeducciones.textContent = "−" + pesos(r.deducciones);
  el.rNeto.textContent = pesos(r.neto);

  const base = r.devengado || 1;
  const pctNet = Math.round((r.neto / base) * 100);
  const pctDed = 100 - pctNet;
  el.barNet.style.width = pctNet + "%";
  el.barDed.style.width = pctDed + "%";
  el.pctNet.textContent = pctNet + "%";
  el.pctDed.textContent = pctDed + "%";

  el.employerBlock.hidden = !el.empleador.checked;
  el.arlField.hidden = !el.empleador.checked;
  if (el.empleador.checked) {
    const e = r.empleador;
    el.eSalud.textContent = pesos(e.salud);
    el.ePension.textContent = pesos(e.pension);
    el.eArlPct.textContent = "(" + (r.arl_tarifa * 100).toFixed(3).replace(".", ",") + "%)";
    el.eArl.textContent = pesos(e.arl);
    el.eCaja.textContent = pesos(e.caja);
    el.eCes.textContent = pesos(e.cesantias);
    el.eInt.textContent = pesos(e.intereses);
    el.ePrima.textContent = pesos(e.prima);
    el.eVac.textContent = pesos(e.vacaciones);
    el.eTotal.textContent = pesos(e.total);
  }
}

let timer = null;
async function actualizar() {
  const salario = leerSalario();
  const pagoExtra = leerMonto(el.pagoExtra);

  const superaTope = salario > TOPE_AUXILIO;
  el.auxilioNota.textContent = superaTope
    ? "No aplica: tu salario supera 2 salarios mínimos."
    : "Aplica hasta 2 salarios mínimos.";

  try {
    const r = await pedirCalculo(salario, pagoExtra);
    pintar(r);
  } catch (e) {
    el.rNeto.textContent = "Error";
  }
}

/* Pequeño retardo para no llamar al backend en cada tecla */
function actualizarDebounced() {
  clearTimeout(timer);
  timer = setTimeout(actualizar, 120);
}

["input", "change"].forEach((ev) => {
  document.addEventListener(ev, (e) => {
    if (["salario", "auxilio", "retencion", "empleador", "arl", "pagoExtra"].includes(e.target.id)) {
      actualizarDebounced();
    }
  });
});

actualizar();

/* ==========================================================
   Modo claro / oscuro
   ========================================================== */
const LS_TEMA = "mi-nomina:tema";
const btnTema = $("btnTema");
const metaThemeColor = document.querySelector('meta[name="theme-color"]');

function aplicarEstadoBotonTema() {
  const esOscuro = document.documentElement.dataset.theme === "dark";
  btnTema.setAttribute("aria-pressed", String(esOscuro));
  btnTema.setAttribute("aria-label", esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  if (metaThemeColor) metaThemeColor.setAttribute("content", esOscuro ? "#0b1a20" : "#16323d");
}
aplicarEstadoBotonTema();

btnTema.addEventListener("click", () => {
  const actual = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  localStorage.setItem(LS_TEMA, nuevo);
  aplicarEstadoBotonTema();
});

/* Service worker para instalación como app y carga rápida del shell */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

/* ==========================================================
   Descargar el desprendible como imagen (canvas, sin librerías)
   ========================================================== */
function fechaLargaCapitalizada(d) {
  const etiqueta = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

function descargarImagenNomina() {
  const r = window.__ultimoResultado;
  if (!r) return;

  const filas = [];
  filas.push(["Salario básico", pesos(r.salario), false]);
  if (r.recargos > 0) filas.push(["Recargos y horas extra", pesos(r.recargos), false]);
  if (r.recibe_auxilio) filas.push(["Auxilio de transporte", pesos(r.auxilio), false]);
  if (r.pago_extra > 0) filas.push(["Otros ingresos (no salarial)", pesos(r.pago_extra), false]);
  filas.push(["Total devengado", pesos(r.devengado), true]);
  filas.push(["__sep__"]);
  filas.push(["Salud (4%)", "−" + pesos(r.salud), false]);
  filas.push(["Pensión (4%)", "−" + pesos(r.pension), false]);
  if (r.fsp.valor > 0) filas.push(["Fondo de solidaridad", "−" + pesos(r.fsp.valor), false]);
  if (el.retencion.checked) filas.push(["Retención en la fuente", "−" + pesos(r.rete), false]);
  filas.push(["Total deducciones", "−" + pesos(r.deducciones), true]);

  const ancho = 640;
  const filaAltura = 34;
  const margenSup = 130;
  const margenInf = 150;
  const alto = margenSup + filas.length * filaAltura + margenInf;

  const escala = 2; // resolución más nítida
  const canvas = document.createElement("canvas");
  canvas.width = ancho * escala;
  canvas.height = alto * escala;
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);

  ctx.fillStyle = "#16323d";
  ctx.fillRect(0, 0, ancho, 88);
  ctx.fillStyle = "#f2e6c9";
  ctx.font = "700 22px -apple-system, Segoe UI, Arial, sans-serif";
  ctx.fillText("Mi Nómina", 28, 40);
  ctx.fillStyle = "#c9d6da";
  ctx.font = "400 14px -apple-system, Segoe UI, Arial, sans-serif";
  ctx.fillText(`Desprendible estimado · ${fechaLargaCapitalizada(new Date())}`, 28, 64);

  let y = 118;
  filas.forEach((fila) => {
    if (fila[0] === "__sep__") {
      ctx.strokeStyle = "#d4dbde";
      ctx.beginPath();
      ctx.moveTo(28, y - filaAltura / 2 + 6);
      ctx.lineTo(ancho - 28, y - filaAltura / 2 + 6);
      ctx.stroke();
      return;
    }
    const [label, valor, esTotal] = fila;
    ctx.fillStyle = "#16323d";
    ctx.font = (esTotal ? "700 " : "400 ") + "15px -apple-system, Segoe UI, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, 28, y);
    ctx.textAlign = "right";
    ctx.fillText(valor, ancho - 28, y);
    y += filaAltura;
  });

  const netoY = y + 6;
  ctx.fillStyle = "#d8ede5";
  ctx.fillRect(24, netoY, ancho - 48, 62);
  ctx.fillStyle = "#157a5b";
  ctx.textAlign = "left";
  ctx.font = "700 12px -apple-system, Segoe UI, Arial, sans-serif";
  ctx.fillText("NETO A PAGAR", 40, netoY + 24);
  ctx.font = "700 26px -apple-system, Segoe UI, Arial, sans-serif";
  ctx.fillText(pesos(r.neto), 40, netoY + 50);

  ctx.fillStyle = "#587079";
  ctx.font = "400 11px -apple-system, Segoe UI, Arial, sans-serif";
  ctx.fillText(
    "Estimado con valores oficiales de Colombia 2026. No reemplaza tu desprendible oficial.",
    28, alto - 24
  );

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mi-nomina-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

$("btnDescargarImagen").addEventListener("click", descargarImagenNomina);

/* ==========================================================
   Descargar el desprendible como PDF (lo arma el backend)
   ========================================================== */
async function descargarPdfNomina() {
  const boton = $("btnDescargarPdf");
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Generando…";
  try {
    const resp = await fetch("api/nomina/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salario: leerSalario(),
        auxilio: el.auxilio.checked,
        retencion: el.retencion.checked,
        arl: parseFloat(el.arl.value),
        recargos: recargosAplicados,
        pago_extra: leerMonto(el.pagoExtra),
      }),
    });
    if (!resp.ok) throw new Error("No se pudo generar el PDF");
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mi-nomina-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("No se pudo generar el PDF. Intenta de nuevo.");
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

$("btnDescargarPdf").addEventListener("click", descargarPdfNomina);

/* ==========================================================
   Turnos y calendario
   ========================================================== */
const LS_PLANTILLAS = "mi-nomina:plantillas";
const LS_TURNOS = "mi-nomina:turnos"; // { "YYYY-MM": { "YYYY-MM-DD": {...} } }
const LS_JORNADA = "mi-nomina:jornada";
const LS_SIN_DESCANSO = "mi-nomina:sinDescanso";
const LS_RECARGOS_JULIO = "mi-nomina:recargosJulio";
const LS_PRIMA_REZAGO = "mi-nomina:primaRezago";
const LS_HISTORIAL = "mi-nomina:historial"; // { "YYYY-MM": { salario, recargos } }

const PLANTILLAS_DEFECTO = [
  { id: "manana", nombre: "Mañana", inicio: "06:00", fin: "15:00", almuerzo: 60, color: "#f2c14e" },
  { id: "tarde", nombre: "Tarde", inicio: "14:00", fin: "23:00", almuerzo: 60, color: "#4e9de0" },
  { id: "noche", nombre: "Noche", inicio: "22:00", fin: "07:00", almuerzo: 60, color: "#5a4ea0" },
];
const PALETA_COLORES = ["#f2c14e", "#4e9de0", "#5a4ea0", "#e0704e", "#4ea082", "#c14e8a"];
const COLOR_PERSONALIZADO = "#8a8f93";
const COLOR_INCAPACIDAD = "#4e7a9e";
const COLOR_PERMISO = "#8a5ea0";

let plantillas = cargarPlantillas();
let turnosPorMes = cargarTurnos();
let historialMensual = cargarHistorial();
let festivosCache = {}; // { 2026: Set("2026-01-01", ...) }
let mesActual = new Date();
mesActual.setDate(1);

/* Turno "activo" con el que se pintan los días al hacer clic */
let pincelActivo = null;
let arrastrando = false;
window.addEventListener("pointerup", () => { arrastrando = false; });

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(138,143,147,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function cargarPlantillas() {
  try {
    const guardado = localStorage.getItem(LS_PLANTILLAS);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* noop */ }
  return PLANTILLAS_DEFECTO.map((p) => ({ ...p }));
}
function guardarPlantillas() {
  try { localStorage.setItem(LS_PLANTILLAS, JSON.stringify(plantillas)); } catch (e) { /* noop */ }
}
function cargarTurnos() {
  try {
    const guardado = localStorage.getItem(LS_TURNOS);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* noop */ }
  return {};
}
function guardarTurnos() {
  try { localStorage.setItem(LS_TURNOS, JSON.stringify(turnosPorMes)); } catch (e) { /* noop */ }
}
function cargarHistorial() {
  try {
    const guardado = localStorage.getItem(LS_HISTORIAL);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* noop */ }
  return {};
}
function guardarHistorial() {
  try { localStorage.setItem(LS_HISTORIAL, JSON.stringify(historialMensual)); } catch (e) { /* noop */ }
}

function claveMes(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}
function fechaISO(anio, mes, dia) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

async function obtenerFestivos(anio) {
  if (festivosCache[anio]) return festivosCache[anio];
  try {
    const resp = await fetch(`api/festivos?anio=${anio}`);
    const data = await resp.json();
    festivosCache[anio] = new Set(data.festivos || []);
  } catch (e) {
    festivosCache[anio] = new Set();
  }
  return festivosCache[anio];
}

/* ---- Plantillas UI ---- */
function renderPlantillas() {
  const cont = $("plantillasLista");
  cont.innerHTML = "";
  plantillas.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "plantilla-row";
    row.innerHTML = `
      <input type="color" data-campo="color" value="${p.color || COLOR_PERSONALIZADO}" title="Color del turno" />
      <input type="text" data-campo="nombre" value="${p.nombre}" placeholder="Nombre del turno" />
      <input type="time" data-campo="inicio" value="${p.inicio}" />
      <input type="time" data-campo="fin" value="${p.fin}" />
      <input type="number" data-campo="almuerzo" value="${p.almuerzo}" min="0" max="180" step="5" title="Minutos de almuerzo" />
      <button type="button" class="plantilla-borrar" title="Eliminar turno" data-idx="${idx}">×</button>
    `;
    row.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        plantillas[idx][input.dataset.campo] = input.type === "number"
          ? parseInt(input.value, 10) || 0
          : input.value;
        guardarPlantillas();
        renderCalendario();
        renderPincel();
      });
    });
    row.querySelector(".plantilla-borrar").addEventListener("click", () => {
      plantillas.splice(idx, 1);
      guardarPlantillas();
      renderPlantillas();
      renderCalendario();
      renderPincel();
    });
    cont.appendChild(row);
  });
}

$("btnAgregarPlantilla").addEventListener("click", () => {
  plantillas.push({
    id: "turno" + Date.now(),
    nombre: "Nuevo turno",
    inicio: "06:00",
    fin: "14:00",
    almuerzo: 60,
    color: PALETA_COLORES[plantillas.length % PALETA_COLORES.length],
  });
  guardarPlantillas();
  renderPlantillas();
  renderPincel();
});

/* ---- Selector de turno activo (pincel) ---- */
function renderPincel() {
  const cont = $("pincelTurnos");
  if (!cont) return;

  const idsValidos = new Set(plantillas.map((p) => p.id));
  const especiales = new Set(["__custom__", "__borrar__", "__incapacidad__", "__permiso__"]);
  if (pincelActivo && !idsValidos.has(pincelActivo) && !especiales.has(pincelActivo)) {
    pincelActivo = null;
  }
  if (pincelActivo === null && plantillas.length) pincelActivo = plantillas[0].id;

  cont.innerHTML = "";

  plantillas.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pincel-chip" + (pincelActivo === p.id ? " activo" : "");
    btn.style.setProperty("--chip-color", p.color || COLOR_PERSONALIZADO);
    btn.innerHTML = `<i class="pincel-dot"></i>${p.nombre}`;
    btn.addEventListener("click", () => { pincelActivo = p.id; renderPincel(); });
    cont.appendChild(btn);
  });

  const btnIncapacidad = document.createElement("button");
  btnIncapacidad.type = "button";
  btnIncapacidad.className = "pincel-chip pincel-chip-incapacidad" + (pincelActivo === "__incapacidad__" ? " activo" : "");
  btnIncapacidad.innerHTML = `<i class="pincel-dot" style="--chip-color:${COLOR_INCAPACIDAD}"></i>Incapacidad`;
  btnIncapacidad.addEventListener("click", () => { pincelActivo = "__incapacidad__"; renderPincel(); });
  cont.appendChild(btnIncapacidad);

  const btnPermiso = document.createElement("button");
  btnPermiso.type = "button";
  btnPermiso.className = "pincel-chip pincel-chip-permiso" + (pincelActivo === "__permiso__" ? " activo" : "");
  btnPermiso.innerHTML = `<i class="pincel-dot" style="--chip-color:${COLOR_PERMISO}"></i>Permiso no remunerado`;
  btnPermiso.addEventListener("click", () => { pincelActivo = "__permiso__"; renderPincel(); });
  cont.appendChild(btnPermiso);

  const btnCustom = document.createElement("button");
  btnCustom.type = "button";
  btnCustom.className = "pincel-chip pincel-chip-custom" + (pincelActivo === "__custom__" ? " activo" : "");
  btnCustom.textContent = "Personalizado…";
  btnCustom.addEventListener("click", () => { pincelActivo = "__custom__"; renderPincel(); });
  cont.appendChild(btnCustom);

  const btnBorrar = document.createElement("button");
  btnBorrar.type = "button";
  btnBorrar.className = "pincel-chip pincel-chip-borrar" + (pincelActivo === "__borrar__" ? " activo" : "");
  btnBorrar.textContent = "✕ Libre";
  btnBorrar.addEventListener("click", () => { pincelActivo = "__borrar__"; renderPincel(); });
  cont.appendChild(btnBorrar);
}

/* ---- Calendario ---- */

/* Pinta (o repinta) el contenido visual de una celda según su asignación actual */
function pintarCeldaAsignacion(celda, asignado) {
  celda.classList.toggle("dia-asignada", !!asignado);

  let marca = celda.querySelector(".dia-marca");
  if (!marca) {
    marca = document.createElement("div");
    marca.className = "dia-marca";
    celda.appendChild(marca);
  }

  if (!asignado) {
    celda.style.background = "";
    celda.style.borderColor = "";
    marca.innerHTML = `<span class="dia-libre">Libre</span>`;
    return;
  }

  if (asignado.tipo === "custom") {
    celda.style.background = hexToRgba(COLOR_PERSONALIZADO, 0.16);
    celda.style.borderColor = COLOR_PERSONALIZADO;
    marca.innerHTML = `<span class="dia-check">✓</span><span class="dia-turno-nombre">${asignado.inicio}–${asignado.fin}</span>`;
    return;
  }

  if (asignado.tipo === "incapacidad" || asignado.tipo === "permiso") {
    const color = asignado.tipo === "incapacidad" ? COLOR_INCAPACIDAD : COLOR_PERMISO;
    const etiqueta = asignado.tipo === "incapacidad" ? "Incapacidad" : "Permiso";
    celda.style.background = hexToRgba(color, 0.16);
    celda.style.borderColor = color;
    marca.innerHTML = `<span class="dia-check" style="color:${color}">✓</span><span class="dia-turno-nombre">${etiqueta}</span>`;
    return;
  }

  const plantilla = plantillas.find((p) => p.id === asignado.plantillaId);
  const color = (plantilla && plantilla.color) || COLOR_PERSONALIZADO;
  celda.style.background = hexToRgba(color, 0.16);
  celda.style.borderColor = color;
  marca.innerHTML = `<span class="dia-check" style="color:${color}">✓</span><span class="dia-turno-nombre">${plantilla ? plantilla.nombre : "?"}</span>`;
}

function actualizarCeldaVisual(iso) {
  const celda = document.querySelector(`.dia-celda[data-iso="${iso}"]`);
  if (!celda) return;
  const clave = claveMes(mesActual);
  pintarCeldaAsignacion(celda, (turnosPorMes[clave] || {})[iso]);
}

/* Aplica el turno "pincel" activo al día indicado (asignar, borrar o abrir editor personalizado) */
function aplicarPincel(iso) {
  if (!pincelActivo) return;
  const clave = claveMes(mesActual);
  const turnosMes = turnosPorMes[clave] || (turnosPorMes[clave] = {});

  if (pincelActivo === "__borrar__") {
    if (!turnosMes[iso]) return;
    delete turnosMes[iso];
  } else if (pincelActivo === "__custom__") {
    abrirEditorDia(iso);
    return;
  } else if (pincelActivo === "__incapacidad__") {
    turnosMes[iso] = { tipo: "incapacidad" };
  } else if (pincelActivo === "__permiso__") {
    turnosMes[iso] = { tipo: "permiso" };
  } else {
    turnosMes[iso] = { tipo: "plantilla", plantillaId: pincelActivo };
  }

  guardarTurnos();
  actualizarCeldaVisual(iso);
  calcularTurnosMes();
}

function abrirEditorDia(iso) {
  const clave = claveMes(mesActual);
  const actual = (turnosPorMes[clave] || {})[iso];
  const fecha = new Date(iso + "T00:00:00");
  const etiqueta = fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  $("diaEditorFecha").textContent = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
  $("diaEditorInicio").value = actual && actual.tipo === "custom" ? actual.inicio : "06:00";
  $("diaEditorFin").value = actual && actual.tipo === "custom" ? actual.fin : "14:00";
  $("diaEditorAlmuerzo").value = actual && actual.tipo === "custom" ? actual.almuerzo : 60;
  $("diaEditor").dataset.iso = iso;
  $("diaEditor").hidden = false;
}

$("diaEditorCancelar").addEventListener("click", () => { $("diaEditor").hidden = true; });
$("diaEditorGuardar").addEventListener("click", () => {
  const iso = $("diaEditor").dataset.iso;
  const clave = claveMes(mesActual);
  const turnosMes = turnosPorMes[clave] || (turnosPorMes[clave] = {});
  turnosMes[iso] = {
    tipo: "custom",
    inicio: $("diaEditorInicio").value,
    fin: $("diaEditorFin").value,
    almuerzo: parseInt($("diaEditorAlmuerzo").value, 10) || 0,
  };
  guardarTurnos();
  actualizarCeldaVisual(iso);
  calcularTurnosMes();
  $("diaEditor").hidden = true;
});

async function renderCalendario() {
  renderPincel();
  $("diaEditor").hidden = true;
  actualizarNotaGuardadoMes();

  const anio = mesActual.getFullYear();
  const mes = mesActual.getMonth();
  const festivos = await obtenerFestivos(anio);

  const etiquetaMes = mesActual.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  $("mesLabel").textContent = etiquetaMes.charAt(0).toUpperCase() + etiquetaMes.slice(1);

  const primerDia = new Date(anio, mes, 1).getDay(); // 0=domingo
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const clave = claveMes(mesActual);
  const turnosMes = turnosPorMes[clave] || {};

  const grid = $("calendarioGrid");
  grid.innerHTML = "";

  for (let i = 0; i < primerDia; i++) {
    const vacio = document.createElement("div");
    vacio.className = "dia-celda fuera-de-mes";
    grid.appendChild(vacio);
  }

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const iso = fechaISO(anio, mes, dia);
    const fechaObj = new Date(anio, mes, dia);
    const esDomingo = fechaObj.getDay() === 0;
    const esFestivo = festivos.has(iso);

    const celda = document.createElement("button");
    celda.type = "button";
    celda.dataset.iso = iso;
    celda.className = "dia-celda" + (esDomingo ? " es-domingo" : "") + (esFestivo ? " es-festivo" : "");

    const numFila = document.createElement("div");
    numFila.className = "dia-num";
    numFila.innerHTML = `<span>${dia}</span>`;
    if (esFestivo) numFila.innerHTML += `<span class="dia-tag festivo">Festivo</span>`;
    else if (esDomingo) numFila.innerHTML += `<span class="dia-tag domingo">Dom</span>`;
    celda.appendChild(numFila);

    pintarCeldaAsignacion(celda, turnosMes[iso]);

    celda.addEventListener("pointerdown", () => {
      arrastrando = true;
      aplicarPincel(iso);
    });
    celda.addEventListener("pointerenter", () => {
      if (arrastrando && pincelActivo !== "__custom__") aplicarPincel(iso);
    });

    grid.appendChild(celda);
  }

  calcularTurnosMes();
}

$("mesAnterior").addEventListener("click", () => {
  mesActual.setMonth(mesActual.getMonth() - 1);
  renderCalendario();
});
$("mesSiguiente").addEventListener("click", () => {
  mesActual.setMonth(mesActual.getMonth() + 1);
  renderCalendario();
});

/* ---- Cálculo del mes ---- */
const NOMBRES_CATEGORIA = {
  recargo_nocturno: "Recargo nocturno (35%)",
  recargo_dominical: "Recargo dominical / festivo",
  recargo_nocturno_dominical: "Recargo nocturno + dominical / festivo",
  extra_diurna: "Hora extra diurna",
  extra_nocturna: "Hora extra nocturna",
  extra_diurna_dominical: "Hora extra diurna dominical / festiva",
  extra_nocturna_dominical: "Hora extra nocturna dominical / festiva",
};

let debounceTurnos = null;
function calcularTurnosMes() {
  clearTimeout(debounceTurnos);
  debounceTurnos = setTimeout(calcularTurnosMesInmediato, 150);
}

function actualizarDiasEspeciales(turnosMes) {
  const dias = Object.values(turnosMes);
  const incapacidad = dias.filter((t) => t.tipo === "incapacidad").length;
  const permiso = dias.filter((t) => t.tipo === "permiso").length;
  const nota = $("diasEspeciales");
  const partes = [];
  if (incapacidad > 0) partes.push(`${incapacidad} día${incapacidad > 1 ? "s" : ""} de incapacidad`);
  if (permiso > 0) partes.push(`${permiso} día${permiso > 1 ? "s" : ""} de permiso no remunerado`);
  nota.hidden = partes.length === 0;
  nota.textContent = partes.join(" · ");
}

async function calcularTurnosMesInmediato() {
  const clave = claveMes(mesActual);
  const turnosMes = turnosPorMes[clave] || {};
  const salario = parseInt(el.salario.value.replace(/\D/g, ""), 10) || 0;
  const jornada = parseFloat($("jornadaOrdinaria").value) || 8;

  actualizarDiasEspeciales(turnosMes);

  const lista = Object.entries(turnosMes).map(([fecha, t]) => {
    if (t.tipo === "custom") {
      return { fecha, inicio: t.inicio, fin: t.fin, almuerzo: t.almuerzo || 0 };
    }
    if (t.tipo === "incapacidad" || t.tipo === "permiso") return null;
    const plantilla = plantillas.find((p) => p.id === t.plantillaId);
    if (!plantilla) return null;
    return { fecha, inicio: plantilla.inicio, fin: plantilla.fin, almuerzo: plantilla.almuerzo || 0 };
  }).filter(Boolean);

  if (lista.length === 0) {
    pintarResumenTurnosVacio();
    return;
  }

  try {
    const resp = await fetch("api/turnos/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salario,
        jornada_ordinaria: jornada,
        turnos: lista,
        sin_descanso_compensatorio: $("sinDescanso").checked,
        forzar_tarifa_julio: $("recargosJulio").checked,
      }),
    });
    const data = await resp.json();
    pintarResumenTurnos(data);
  } catch (e) {
    pintarResumenTurnosVacio();
  }
}

function pintarResumenTurnosVacio() {
  $("resHoras").textContent = "0";
  $("resExtra").textContent = "0";
  $("resDomingos").textContent = "0";
  $("resFestivos").textContent = "0";
  $("turnosAdvertencias").innerHTML = "";
  $("tablaCategorias").querySelector("tbody").innerHTML = "";
  $("turnosTotalValor").textContent = pesos(0);
}

function pintarResumenTurnos(data) {
  const r = data.resumen;
  $("resHoras").textContent = r.horas_totales;
  $("resExtra").textContent = r.horas_extra_totales;
  $("resDomingos").textContent = r.domingos_trabajados;
  $("resFestivos").textContent = r.festivos_trabajados;

  $("turnosAdvertencias").innerHTML = (r.advertencias || [])
    .map((a) => `<div class="aviso">${a}</div>`).join("");

  const tbody = $("tablaCategorias").querySelector("tbody");
  tbody.innerHTML = "";
  Object.entries(data.categorias).forEach(([clave, val]) => {
    if (val.horas <= 0) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${NOMBRES_CATEGORIA[clave] || clave}</td><td>${val.horas} h</td><td>${pesos(val.valor)}</td>`;
    tbody.appendChild(tr);
  });

  $("turnosTotalValor").textContent = pesos(data.total_recargos);
  window.__ultimoTotalRecargos = data.total_recargos;
}

$("btnAplicarNomina").addEventListener("click", () => {
  recargosAplicados = window.__ultimoTotalRecargos || 0;
  const nota = $("turnosNotaAplicado");
  nota.hidden = false;
  nota.textContent = `Aplicado a tu nómina: ${pesos(recargosAplicados)}`;
  $("rowRecargos").hidden = recargosAplicados <= 0;
  actualizar();
});

/* ---- Historial mensual (para la prima) ---- */
function actualizarNotaGuardadoMes() {
  const clave = claveMes(mesActual);
  const guardado = historialMensual[clave];
  const nota = $("turnosNotaGuardado");
  if (!guardado) {
    nota.hidden = true;
    return;
  }
  nota.hidden = false;
  nota.textContent = `Guardado para este mes: salario ${pesos(guardado.salario)}, recargos ${pesos(guardado.recargos)}`;
}

$("btnGuardarMes").addEventListener("click", () => {
  const clave = claveMes(mesActual);
  const salario = parseInt(el.salario.value.replace(/\D/g, ""), 10) || 0;
  const recargos = window.__ultimoTotalRecargos || 0;
  historialMensual[clave] = { salario, recargos };
  guardarHistorial();
  actualizarNotaGuardadoMes();
});

$("btnLimpiarMes").addEventListener("click", () => {
  const clave = claveMes(mesActual);
  if (!turnosPorMes[clave] || Object.keys(turnosPorMes[clave]).length === 0) return;
  const ok = window.confirm("¿Borrar todos los días marcados este mes? Esta acción no se puede deshacer.");
  if (!ok) return;
  turnosPorMes[clave] = {};
  guardarTurnos();
  renderCalendario();
});

/* ==========================================================
   Prima de servicios
   ========================================================== */
const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatearInputMiles(e) {
  const input = e.target;
  const digits = input.value.replace(/\D/g, "");
  input.value = digits ? parseInt(digits, 10).toLocaleString("es-CO") : "";
}

function mesesDelSemestre(anio, semestre) {
  const inicio = semestre === "2" ? 6 : 0;
  const meses = [];
  for (let i = 0; i < 6; i++) {
    const mes = inicio + i; // 0-based
    meses.push({ mes, clave: `${anio}-${String(mes + 1).padStart(2, "0")}` });
  }
  return meses;
}

/* Dado "YYYY-MM", devuelve el "YYYY-MM" del mes calendario anterior */
function claveMesAnterior(clave) {
  const [anioStr, mesStr] = clave.split("-");
  const d = new Date(parseInt(anioStr, 10), parseInt(mesStr, 10) - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderTablaPrima() {
  const anio = parseInt($("primaAnio").value, 10) || new Date().getFullYear();
  const semestre = $("primaSemestre").value;
  const salarioActual = parseInt(el.salario.value.replace(/\D/g, ""), 10) || 0;

  $("primaResultado").hidden = true;

  const tbody = $("primaMeses");
  tbody.innerHTML = "";
  mesesDelSemestre(anio, semestre).forEach(({ mes, clave }) => {
    const tr = document.createElement("tr");
    tr.dataset.clave = clave;
    tr.innerHTML = `
      <td><span class="prima-mes-nombre">${MESES_NOMBRES[mes]}</span> <small class="prima-mes-origen"></small></td>
      <td><input type="text" inputmode="numeric" class="prima-input prima-input-salario" value="${salarioActual ? salarioActual.toLocaleString("es-CO") : ""}" /></td>
      <td><input type="text" inputmode="numeric" class="prima-input prima-input-recargos" value="0" /></td>
      <td class="prima-celda-auxilio"><input type="checkbox" class="prima-input-auxilio" ${el.auxilio.checked ? "checked" : ""} /></td>
      <td><input type="number" class="prima-input prima-input-dias" min="0" max="30" step="0.5" value="30" /></td>
    `;
    tr.querySelectorAll(".prima-input-salario, .prima-input-recargos").forEach((input) => {
      input.addEventListener("input", formatearInputMiles);
    });
    tbody.appendChild(tr);
  });

  actualizarOrigenMeses();
}

function actualizarOrigenMeses() {
  const conRezago = $("primaRezago").checked;
  $("primaMeses").querySelectorAll("tr").forEach((fila) => {
    const origen = fila.querySelector(".prima-mes-origen");
    if (!origen) return;
    if (!conRezago) {
      origen.textContent = "";
      return;
    }
    const [, mesStr] = claveMesAnterior(fila.dataset.clave).split("-");
    origen.textContent = `(turnos de ${MESES_NOMBRES[parseInt(mesStr, 10) - 1]})`;
  });
}

$("primaSemestre").addEventListener("change", renderTablaPrima);
$("primaAnio").addEventListener("change", renderTablaPrima);

$("btnPrimaAutocompletar").addEventListener("click", () => {
  const conRezago = $("primaRezago").checked;
  const filas = [...$("primaMeses").querySelectorAll("tr")];
  let encontrados = 0;

  filas.forEach((fila) => {
    const claveOrigen = conRezago ? claveMesAnterior(fila.dataset.clave) : fila.dataset.clave;
    const guardado = historialMensual[claveOrigen];
    if (!guardado) return;
    encontrados++;
    fila.querySelector(".prima-input-salario").value = guardado.salario
      ? guardado.salario.toLocaleString("es-CO") : "";
    fila.querySelector(".prima-input-recargos").value = (guardado.recargos || 0).toLocaleString("es-CO");
  });

  if (encontrados === 0) {
    window.alert(
      "No hay meses guardados todavía. Ve al panel de Turnos, calcula el mes que quieras y usa " +
      "\"Guardar el salario y los recargos de este mes para la prima\"."
    );
  }
});

$("btnCalcularPrima").addEventListener("click", async () => {
  const filas = [...$("primaMeses").querySelectorAll("tr")];
  const meses = filas.map((fila) => ({
    mes: fila.querySelector(".prima-mes-nombre").textContent,
    salario: parseInt(fila.querySelector(".prima-input-salario").value.replace(/\D/g, ""), 10) || 0,
    recargos: parseInt(fila.querySelector(".prima-input-recargos").value.replace(/\D/g, ""), 10) || 0,
    recibe_auxilio: fila.querySelector(".prima-input-auxilio").checked,
    dias_trabajados: parseFloat(fila.querySelector(".prima-input-dias").value) || 0,
  }));

  try {
    const resp = await fetch("api/prima/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meses }),
    });
    const data = await resp.json();
    pintarResultadoPrima(data);
  } catch (e) {
    /* noop */
  }
});

function pintarResultadoPrima(data) {
  $("primaResultado").hidden = false;
  $("primaTotalValor").textContent = pesos(data.total);
  const tbody = $("tablaPrimaDetalle").querySelector("tbody");
  tbody.innerHTML = "";
  data.detalle.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${d.mes}</td><td>${pesos(d.base)}</td><td>${d.dias_trabajados}</td><td>${pesos(d.valor)}</td>`;
    tbody.appendChild(tr);
  });
}

/* Inicialización */
renderPlantillas();
if (localStorage.getItem(LS_JORNADA)) {
  $("jornadaOrdinaria").value = localStorage.getItem(LS_JORNADA);
}
$("jornadaOrdinaria").addEventListener("change", () => {
  localStorage.setItem(LS_JORNADA, $("jornadaOrdinaria").value);
  calcularTurnosMes();
});
$("sinDescanso").checked = localStorage.getItem(LS_SIN_DESCANSO) === "1";
$("sinDescanso").addEventListener("change", () => {
  localStorage.setItem(LS_SIN_DESCANSO, $("sinDescanso").checked ? "1" : "0");
  calcularTurnosMes();
});
$("recargosJulio").checked = localStorage.getItem(LS_RECARGOS_JULIO) === "1";
$("recargosJulio").addEventListener("change", () => {
  localStorage.setItem(LS_RECARGOS_JULIO, $("recargosJulio").checked ? "1" : "0");
  calcularTurnosMes();
});
renderCalendario();

$("primaRezago").checked = localStorage.getItem(LS_PRIMA_REZAGO) !== "0";
$("primaRezago").addEventListener("change", () => {
  localStorage.setItem(LS_PRIMA_REZAGO, $("primaRezago").checked ? "1" : "0");
  actualizarOrigenMeses();
});

const hoyPrima = new Date();
$("primaAnio").value = hoyPrima.getFullYear();
$("primaSemestre").value = hoyPrima.getMonth() < 6 ? "1" : "2";
renderTablaPrima();
