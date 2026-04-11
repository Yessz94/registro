const STORAGE_KEY = "planificadorAcademicoData";
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const initialData = {
  periodos: [],
  turnos: [],
  docentes: [],
  aulas: [],
  clases: [],
  horario: null,
};

const forms = {
  periodo: document.getElementById("periodo-form"),
  turno: document.getElementById("turno-form"),
  docente: document.getElementById("docente-form"),
  aula: document.getElementById("aula-form"),
  csv: document.getElementById("csv-form"),
  horario: document.getElementById("horario-form"),
};

const mensajes = {
  periodo: document.getElementById("periodo-msg"),
  turno: document.getElementById("turno-msg"),
  docente: document.getElementById("docente-msg"),
  aula: document.getElementById("aula-msg"),
  csv: document.getElementById("csv-msg"),
  horario: document.getElementById("horario-msg"),
};

const clasesBody = document.getElementById("clases-body");
const diasContainer = document.getElementById("dias-container");
const turnoSelect = document.getElementById("turno-select");
const horarioBody = document.getElementById("horario-body");

const readData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return structuredClone(initialData);

  try {
    return { ...structuredClone(initialData), ...JSON.parse(data) };
  } catch {
    return structuredClone(initialData);
  }
};

const writeData = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const showMessage = (key, text, kind = "ok") => {
  const node = mensajes[key];
  node.textContent = text;
  node.className = `mensaje ${kind}`;
};

const uid = () => crypto.randomUUID();

const toMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const toHHMM = (minutes) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const renderDiasInputs = () => {
  diasContainer.innerHTML = DIAS.map(
    (dia) => `
      <label class="dia-item">
        <input type="checkbox" name="dia-${dia}" value="${dia}">
        <span>${dia}</span>
        <input type="number" min="1" max="8" name="periodos-${dia}" placeholder="periodos" disabled>
      </label>
    `
  ).join("");

  diasContainer.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const input = event.target.parentElement.querySelector("input[type=number]");
      input.disabled = !event.target.checked;
      if (!event.target.checked) input.value = "";
    });
  });
};

const parseCSV = (raw) => {
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  return rows.map((line, index) => {
    const [nombre, especialidad, tipo, credito] = line.split(",").map((cell) => cell.trim());
    if (!nombre || !especialidad || !tipo || !credito) {
      throw new Error(`Línea ${index + 1}: faltan columnas.`);
    }

    const creditNum = Number(credito);
    if (!Number.isFinite(creditNum) || creditNum <= 0) {
      throw new Error(`Línea ${index + 1}: crédito inválido.`);
    }

    return { id: uid(), nombre, especialidad, tipo, credito: creditNum, docenteId: "", aulaId: "" };
  });
};

const buildOptions = (items, emptyLabel) => {
  const options = [`<option value="">${emptyLabel}</option>`];
  items.forEach((item) => options.push(`<option value="${item.id}">${item.nombre}</option>`));
  return options.join("");
};

const buildSlots = (turno) => {
  const entrada = toMinutes(turno.horaEntrada);
  const salida = toMinutes(turno.horaSalida);
  const almInicio = toMinutes(turno.almuerzoInicio);
  const almFin = toMinutes(turno.almuerzoFin);
  const bloque = turno.minBloque;

  if (!Number.isFinite(entrada) || !Number.isFinite(salida) || salida <= entrada) {
    throw new Error("Horario del turno inválido.");
  }

  const slots = [];

  turno.diasHabiles.forEach(({ dia, periodos }) => {
    let pointer = entrada;

    for (let i = 1; i <= periodos; i += 1) {
      if (Number.isFinite(almInicio) && Number.isFinite(almFin) && pointer >= almInicio && pointer < almFin) {
        pointer = almFin;
      }

      const end = pointer + bloque;
      if (end > salida) {
        throw new Error(`No alcanza el horario del turno para ${dia}.`);
      }

      slots.push({
        slotKey: `${dia}-${i}`,
        dia,
        bloque: i,
        start: pointer,
        end,
      });

      pointer = end;
    }
  });

  return slots;
};

const generateSchedule = (turnoId) => {
  const data = readData();
  const turno = data.turnos.find((item) => item.id === turnoId);
  if (!turno) throw new Error("Selecciona un turno válido.");

  const clasesAsignadas = data.clases.filter((clase) => clase.docenteId && clase.aulaId);
  if (clasesAsignadas.length === 0) {
    throw new Error("Debes asignar docente y aula a las clases antes de generar horario.");
  }

  const slots = buildSlots(turno);
  const classesByNeed = clasesAsignadas
    .map((clase) => ({
      ...clase,
      bloquesNecesarios: Math.max(1, Math.ceil(clase.credito / turno.creditosBloque)),
    }))
    .sort((a, b) => b.bloquesNecesarios - a.bloquesNecesarios);

  const teacherBusy = new Set();
  const roomBusy = new Set();
  const asignaciones = [];
  const sinEspacio = [];

  classesByNeed.forEach((clase) => {
    let pendientes = clase.bloquesNecesarios;

    for (const slot of slots) {
      if (pendientes === 0) break;

      const teacherKey = `${clase.docenteId}|${slot.slotKey}`;
      const roomKey = `${clase.aulaId}|${slot.slotKey}`;

      if (teacherBusy.has(teacherKey) || roomBusy.has(roomKey)) continue;

      teacherBusy.add(teacherKey);
      roomBusy.add(roomKey);
      asignaciones.push({ classId: clase.id, ...slot });
      pendientes -= 1;
    }

    if (pendientes > 0) sinEspacio.push(clase.nombre);
  });

  if (sinEspacio.length > 0) {
    throw new Error(`No hay suficientes bloques para: ${sinEspacio.join(", ")}.`);
  }

  data.horario = { turnoId, asignaciones };
  writeData(data);
  return asignaciones.length;
};

const renderTurnoOptions = () => {
  const data = readData();

  if (data.turnos.length === 0) {
    turnoSelect.innerHTML = '<option value="">Primero registra un turno</option>';
    return;
  }

  turnoSelect.innerHTML = [
    '<option value="">Selecciona un turno</option>',
    ...data.turnos.map((turno) => `<option value="${turno.id}">${turno.nombre}</option>`),
  ].join("");

  if (data.horario?.turnoId) {
    turnoSelect.value = data.horario.turnoId;
  }
};

const renderClases = () => {
  const data = readData();

  if (data.clases.length === 0) {
    clasesBody.innerHTML = '<tr><td colspan="6" class="sin-registros">No hay clases cargadas.</td></tr>';
    return;
  }

  const docentesOptions = buildOptions(data.docentes, "Sin asignar");
  const aulasOptions = buildOptions(data.aulas, "Sin asignar");

  clasesBody.innerHTML = data.clases.map((clase) => `
      <tr>
        <td>${clase.nombre}</td>
        <td>${clase.especialidad}</td>
        <td>${clase.tipo}</td>
        <td>${clase.credito}</td>
        <td><select data-class-id="${clase.id}" data-field="docenteId">${docentesOptions}</select></td>
        <td><select data-class-id="${clase.id}" data-field="aulaId">${aulasOptions}</select></td>
      </tr>
    `).join("");

  data.clases.forEach((clase) => {
    const docenteSelect = clasesBody.querySelector(`select[data-class-id="${clase.id}"][data-field="docenteId"]`);
    const aulaSelect = clasesBody.querySelector(`select[data-class-id="${clase.id}"][data-field="aulaId"]`);
    if (docenteSelect) docenteSelect.value = clase.docenteId || "";
    if (aulaSelect) aulaSelect.value = clase.aulaId || "";
  });

  clasesBody.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", (event) => {
      const classId = event.target.dataset.classId;
      const field = event.target.dataset.field;
      const updated = readData();
      const targetClass = updated.clases.find((clase) => clase.id === classId);
      if (!targetClass) return;
      targetClass[field] = event.target.value;
      updated.horario = null;
      writeData(updated);
      renderHorario();
    });
  });
};

const renderHorario = () => {
  const data = readData();
  if (!data.horario || data.horario.asignaciones.length === 0) {
    horarioBody.innerHTML = '<tr><td colspan="4" class="sin-registros">Aún no se ha generado horario.</td></tr>';
    return;
  }

  const classMap = new Map(data.clases.map((clase) => [clase.id, clase]));
  const docenteMap = new Map(data.docentes.map((docente) => [docente.id, docente]));
  const aulaMap = new Map(data.aulas.map((aula) => [aula.id, aula]));

  const rows = [...data.horario.asignaciones].sort((a, b) => {
    const dayDiff = DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia);
    if (dayDiff !== 0) return dayDiff;
    return a.bloque - b.bloque;
  });

  horarioBody.innerHTML = rows.map((item) => {
    const clase = classMap.get(item.classId);
    const docente = docenteMap.get(clase?.docenteId);
    const aula = aulaMap.get(clase?.aulaId);

    return `
      <tr>
        <td>${item.dia}</td>
        <td>${item.bloque}</td>
        <td>${toHHMM(item.start)} - ${toHHMM(item.end)}</td>
        <td><strong>${clase?.nombre || "Clase"}</strong><br>${docente?.nombre || "Sin docente"} · ${aula?.nombre || "Sin aula"}</td>
      </tr>
    `;
  }).join("");
};

forms.periodo.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(forms.periodo);
  const nombre = String(formData.get("nombre") || "").trim();
  const fechaInicio = String(formData.get("fechaInicio") || "");
  const fechaFin = String(formData.get("fechaFin") || "");
  const anio = Number(formData.get("anio"));

  if (fechaInicio > fechaFin) {
    showMessage("periodo", "La fecha de inicio no puede ser mayor a la fecha fin.", "error");
    return;
  }

  const data = readData();
  data.periodos.push({ id: uid(), nombre, fechaInicio, fechaFin, anio });
  writeData(data);
  forms.periodo.reset();
  showMessage("periodo", "Periodo guardado correctamente.");
});

forms.turno.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(forms.turno);

  const diasHabiles = DIAS.flatMap((dia) => {
    const enabled = formData.get(`dia-${dia}`);
    const periodos = Number(formData.get(`periodos-${dia}`));
    if (!enabled) return [];
    return [{ dia, periodos }];
  }).filter((item) => Number.isFinite(item.periodos) && item.periodos > 0);

  if (diasHabiles.length === 0) {
    showMessage("turno", "Selecciona al menos un día hábil con periodos válidos.", "error");
    return;
  }

  const data = readData();
  data.turnos.push({
    id: uid(),
    nombre: String(formData.get("nombre") || "").trim(),
    minBloque: Number(formData.get("minBloque")),
    creditosBloque: Number(formData.get("creditosBloque")),
    horaEntrada: String(formData.get("horaEntrada") || ""),
    horaSalida: String(formData.get("horaSalida") || ""),
    almuerzoInicio: String(formData.get("almuerzoInicio") || ""),
    almuerzoFin: String(formData.get("almuerzoFin") || ""),
    diasHabiles,
  });

  writeData(data);
  forms.turno.reset();
  renderDiasInputs();
  renderTurnoOptions();
  showMessage("turno", "Turno guardado correctamente.");
});

forms.docente.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(forms.docente);
  const data = readData();

  data.docentes.push({
    id: uid(),
    nombre: String(formData.get("nombre") || "").trim(),
    especialidad: String(formData.get("especialidad") || "").trim(),
  });

  writeData(data);
  forms.docente.reset();
  renderClases();
  showMessage("docente", "Docente guardado correctamente.");
});

forms.aula.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(forms.aula);
  const data = readData();

  data.aulas.push({
    id: uid(),
    nombre: String(formData.get("nombre") || "").trim(),
    tipo: String(formData.get("tipo") || "").trim(),
  });

  writeData(data);
  forms.aula.reset();
  renderClases();
  showMessage("aula", "Aula guardada correctamente.");
});

forms.csv.addEventListener("submit", (event) => {
  event.preventDefault();
  const raw = String(new FormData(forms.csv).get("csv") || "");

  try {
    const clases = parseCSV(raw);
    const data = readData();
    data.clases = clases;
    data.horario = null;
    writeData(data);
    renderClases();
    renderHorario();
    showMessage("csv", `${clases.length} clases importadas correctamente.`);
  } catch (error) {
    showMessage("csv", error.message, "error");
  }
});

forms.horario.addEventListener("submit", (event) => {
  event.preventDefault();
  const turnoId = String(new FormData(forms.horario).get("turnoId") || "");

  try {
    const bloques = generateSchedule(turnoId);
    renderHorario();
    showMessage("horario", `Horario generado correctamente con ${bloques} bloques sin conflicto de maestro.`);
  } catch (error) {
    showMessage("horario", error.message, "error");
  }
});

renderDiasInputs();
renderTurnoOptions();
renderClases();
renderHorario();
