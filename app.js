const STORAGE_KEY = "planificadorAcademicoData";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const initialData = {
  periodos: [],
  turnos: [],
  docentes: [],
  aulas: [],
  clases: [],
};

const forms = {
  periodo: document.getElementById("periodo-form"),
  turno: document.getElementById("turno-form"),
  docente: document.getElementById("docente-form"),
  aula: document.getElementById("aula-form"),
  csv: document.getElementById("csv-form"),
};

const mensajes = {
  periodo: document.getElementById("periodo-msg"),
  turno: document.getElementById("turno-msg"),
  docente: document.getElementById("docente-msg"),
  aula: document.getElementById("aula-msg"),
  csv: document.getElementById("csv-msg"),
};

const clasesBody = document.getElementById("clases-body");
const diasContainer = document.getElementById("dias-container");

const readData = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return structuredClone(initialData);
  }

  try {
    const parsed = JSON.parse(data);
    return {
      ...structuredClone(initialData),
      ...parsed,
    };
  } catch {
    return structuredClone(initialData);
  }
};

const writeData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const showMessage = (key, text, kind = "ok") => {
  const node = mensajes[key];
  node.textContent = text;
  node.className = `mensaje ${kind}`;
};

const uid = () => crypto.randomUUID();

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
      if (!event.target.checked) {
        input.value = "";
      }
    });
  });
};

const parseCSV = (raw) => {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return rows.map((line, index) => {
    const [nombre, especialidad, tipo, credito] = line.split(",").map((cell) => cell.trim());

    if (!nombre || !especialidad || !tipo || !credito) {
      throw new Error(`Línea ${index + 1}: faltan columnas.`);
    }

    const creditNum = Number(credito);
    if (Number.isNaN(creditNum) || creditNum <= 0) {
      throw new Error(`Línea ${index + 1}: crédito inválido.`);
    }

    return {
      id: uid(),
      nombre,
      especialidad,
      tipo,
      credito: creditNum,
      docenteId: "",
      aulaId: "",
    };
  });
};

const buildOptions = (items, emptyLabel) => {
  const options = [`<option value="">${emptyLabel}</option>`];
  items.forEach((item) => {
    options.push(`<option value="${item.id}">${item.nombre}</option>`);
  });
  return options.join("");
};

const renderClases = () => {
  const data = readData();

  if (data.clases.length === 0) {
    clasesBody.innerHTML = '<tr><td colspan="6" class="sin-registros">No hay clases cargadas.</td></tr>';
    return;
  }

  const docentesOptions = buildOptions(data.docentes, "Sin asignar");
  const aulasOptions = buildOptions(data.aulas, "Sin asignar");

  clasesBody.innerHTML = data.clases
    .map(
      (clase) => `
        <tr>
          <td>${clase.nombre}</td>
          <td>${clase.especialidad}</td>
          <td>${clase.tipo}</td>
          <td>${clase.credito}</td>
          <td>
            <select data-class-id="${clase.id}" data-field="docenteId">${docentesOptions}</select>
          </td>
          <td>
            <select data-class-id="${clase.id}" data-field="aulaId">${aulasOptions}</select>
          </td>
        </tr>
      `
    )
    .join("");

  data.clases.forEach((clase) => {
    const docenteSelect = clasesBody.querySelector(`select[data-class-id="${clase.id}"][data-field="docenteId"]`);
    const aulaSelect = clasesBody.querySelector(`select[data-class-id="${clase.id}"][data-field="aulaId"]`);
    if (docenteSelect) {
      docenteSelect.value = clase.docenteId || "";
    }
    if (aulaSelect) {
      aulaSelect.value = clase.aulaId || "";
    }
  });

  clasesBody.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", (event) => {
      const classId = event.target.dataset.classId;
      const field = event.target.dataset.field;
      const updated = readData();
      const targetClass = updated.clases.find((clase) => clase.id === classId);
      if (!targetClass) {
        return;
      }
      targetClass[field] = event.target.value;
      writeData(updated);
    });
  });
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

    if (!enabled) {
      return [];
    }

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
    writeData(data);
    renderClases();
    showMessage("csv", `${clases.length} clases importadas correctamente.`);
  } catch (error) {
    showMessage("csv", error.message, "error");
  }
});

renderDiasInputs();
renderClases();
