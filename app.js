const STORAGE_KEY = "usuariosRegistrados";

const form = document.getElementById("registro-form");
const usuariosBody = document.getElementById("usuarios-body");
const mensaje = document.getElementById("mensaje");

const readUsuarios = () => {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  try {
    const usuarios = JSON.parse(data);
    return Array.isArray(usuarios) ? usuarios : [];
  } catch {
    return [];
  }
};

const writeUsuarios = (usuarios) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usuarios));
};

const pintarUsuarios = () => {
  const usuarios = readUsuarios();

  if (usuarios.length === 0) {
    usuariosBody.innerHTML = `
      <tr>
        <td colspan="3" class="sin-registros">Aún no hay usuarios registrados.</td>
      </tr>
    `;
    return;
  }

  usuariosBody.innerHTML = usuarios
    .map(
      (usuario, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${usuario.nombre}</td>
          <td>${usuario.correo}</td>
        </tr>
      `
    )
    .join("");
};

const mostrarMensaje = (texto, tipo) => {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;
};

const existeCorreo = (correo) => {
  const usuarios = readUsuarios();
  return usuarios.some((usuario) => usuario.correo.toLowerCase() === correo.toLowerCase());
};

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const nombre = String(formData.get("nombre") || "").trim();
  const correo = String(formData.get("correo") || "").trim();
  const contrasena = String(formData.get("contrasena") || "").trim();

  if (!nombre || !correo || !contrasena) {
    mostrarMensaje("Todos los campos son obligatorios.", "error");
    return;
  }

  if (contrasena.length < 6) {
    mostrarMensaje("La contraseña debe tener al menos 6 caracteres.", "error");
    return;
  }

  if (existeCorreo(correo)) {
    mostrarMensaje("Ese correo ya fue registrado.", "error");
    return;
  }

  const usuarios = readUsuarios();

  usuarios.push({
    nombre,
    correo,
    contrasena,
    creadoEn: new Date().toISOString(),
  });

  writeUsuarios(usuarios);
  form.reset();
  pintarUsuarios();
  mostrarMensaje("Usuario registrado correctamente.", "ok");
});

pintarUsuarios();
