"use client";

import { useActionState, useState } from "react";
import { ETIQUETA_ROL, DESCRIPCION_ROL, ROLES } from "@/lib/roles";
import {
  cambiarUsuario,
  guardarConfiguracion,
  guardarParametros,
  type EstadoConfig,
} from "./acciones";
import type { Configuracion, ParametrosCalculo, UsuarioPanel } from "@/lib/datos/configuracion";

const claseCampo =
  "mt-1.5 w-full rounded-md border border-gris-300 px-3 py-2.5 text-base text-gris-900 outline-none focus:border-primario focus:ring-2 focus:ring-primario/30";

function Mensaje({ estado }: { estado: EstadoConfig }) {
  if (!estado.error && !estado.ok) return null;
  const esError = Boolean(estado.error);
  return (
    <p
      role={esError ? "alert" : "status"}
      className={`mt-3 rounded-md border px-3 py-2 text-sm font-medium text-gris-900 ${
        esError ? "border-acento" : "border-secundario"
      }`}
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

function Numero({
  nombre,
  etiqueta,
  valor,
  ayuda,
  min,
  max,
}: {
  nombre: string;
  etiqueta: string;
  valor: number;
  ayuda: string;
  min: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gris-800">{etiqueta}</span>
      <input
        type="number"
        name={nombre}
        defaultValue={valor}
        min={min}
        max={max}
        step={1}
        required
        className={claseCampo}
      />
      <span className="mt-1 block text-xs text-gris-500">{ayuda}</span>
    </label>
  );
}

/*
  Umbrales del semaforo, identidad y visibilidad de costos.

  El interruptor de costos publicos no es un ajuste mas, y por eso va aparte y
  con su propio aviso: encendido, cualquiera que escanee el QR de una maquina
  con su telefono ve lo que costo cada mantencion. No hay login que lo frene,
  porque el proposito de la ficha publica es justamente no tener login.
*/
export function FormularioGenerales({ config }: { config: Configuracion }) {
  const [estado, accion, pendiente] = useActionState<EstadoConfig, FormData>(
    guardarConfiguracion,
    {},
  );
  const [publico, setPublico] = useState(config.mostrar_costos_publico);

  return (
    <form action={accion} className="rounded-lg border border-gris-200 p-4 sm:p-5">
      <h2 className="text-sm font-bold tracking-widest text-gris-500 uppercase">
        Alertas e identidad
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Numero
          nombre="dias_alerta_proxima"
          etiqueta="Avisar como próxima"
          valor={config.dias_alerta_proxima}
          min={1}
          ayuda="Días antes del vencimiento en que un plan empieza a aparecer como próxima."
        />
        <Numero
          nombre="dias_alerta_critica"
          etiqueta="Avisar como crítica"
          valor={config.dias_alerta_critica}
          min={0}
          ayuda="Días antes del vencimiento en que pasa a crítica. Tiene que ser menor que el anterior."
        />
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Nombre de la organización</span>
          <input
            name="nombre_organizacion"
            defaultValue={config.nombre_organizacion}
            className={claseCampo}
          />
          <span className="mt-1 block text-xs text-gris-500">
            Aparece en la ficha pública que ve quien escanea un QR.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gris-800">Moneda</span>
          <input
            name="moneda"
            defaultValue={config.moneda}
            maxLength={3}
            className={`${claseCampo} uppercase`}
          />
          <span className="mt-1 block text-xs text-gris-500">
            Código de tres letras. Los montos se muestran con formato chileno.
          </span>
        </label>
      </div>

      <div className="mt-5 rounded-md border border-gris-300 p-4" data-tour="config-costos">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="mostrar_costos_publico"
            value="1"
            checked={publico}
            onChange={(e) => setPublico(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-primario)]"
          />
          <span>
            <span className="text-sm font-semibold text-gris-900">
              Mostrar los costos en la ficha pública
            </span>
            <span className="mt-1 block text-sm text-gris-600">
              La ficha pública se abre escaneando el QR de la máquina, sin usuario
              ni contraseña. Encendido, el monto de cada mantención queda a la
              vista de cualquiera que tenga el código delante, incluidos
              contratistas y visitas.
            </span>
          </span>
        </label>

        {publico && !config.mostrar_costos_publico ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-acento px-3 py-2 text-sm font-medium text-gris-900"
          >
            <svg
              viewBox="0 0 16 16"
              className="mt-0.5 size-4 shrink-0 fill-acento"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="7" />
              <rect x="7" y="4" width="2" height="5" rx="1" fill="var(--color-blanco)" />
              <rect x="7" y="10.5" width="2" height="2" rx="1" fill="var(--color-blanco)" />
            </svg>
            Estás por publicar los costos. Al guardar quedan visibles de inmediato
            en todas las fichas, también en las etiquetas ya impresas.
          </p>
        ) : null}
      </div>

      <Mensaje estado={estado} />

      <button
        type="submit"
        disabled={pendiente}
        className="mt-4 rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pendiente ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}

/*
  Parametros del calculo de uso. Son los que deciden cuando la aplicacion se
  atreve a proyectar una fecha a partir del horometro y cuando dice que no le
  alcanzan los datos. Se tocan poco, asi que van plegados: abiertos empujarian
  lo que si se usa todos los dias hacia abajo.
*/
export function FormularioParametros({ parametros }: { parametros: ParametrosCalculo }) {
  const [estado, accion, pendiente] = useActionState<EstadoConfig, FormData>(guardarParametros, {});

  return (
    <details className="rounded-lg border border-gris-200">
      <summary className="cursor-pointer p-4 text-sm font-bold tracking-widest text-gris-500 uppercase marker:text-primario sm:p-5">
        Parámetros de cálculo
      </summary>

      <form action={accion} className="border-t border-gris-100 p-4 sm:p-5">
        <p className="max-w-prose text-sm text-gris-600">
          Con estos números la aplicación decide si tiene datos suficientes para
          estimar cuánto uso acumula una máquina por día. Si no le alcanzan, el
          plan queda como sin línea base en vez de inventar una proyección.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Numero
            nombre="ventana_tasa_uso_dias"
            etiqueta="Ventana de lecturas"
            valor={parametros.ventana_tasa_uso_dias}
            min={30}
            max={1095}
            ayuda="Días hacia atrás que se miran para calcular el uso diario. Entre 30 y 1095."
          />
          <Numero
            nombre="min_lecturas_tasa"
            etiqueta="Lecturas mínimas"
            valor={parametros.min_lecturas_tasa}
            min={2}
            ayuda="Cuántas lecturas de horómetro se exigen antes de proyectar. Mínimo 2."
          />
          <Numero
            nombre="min_span_tasa_dias"
            etiqueta="Días mínimos entre lecturas"
            valor={parametros.min_span_tasa_dias}
            min={1}
            ayuda="Separación mínima entre la primera y la última lectura. Mínimo 1."
          />
          <Numero
            nombre="historial_publico_limite"
            etiqueta="Historial en la ficha pública"
            valor={parametros.historial_publico_limite}
            min={1}
            max={500}
            ayuda="Cuántas mantenciones muestra el QR. Entre 1 y 500."
          />
        </div>

        <Mensaje estado={estado} />

        <button
          type="submit"
          disabled={pendiente}
          className="mt-4 rounded-md bg-primario px-4 py-2.5 text-sm font-semibold text-blanco transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pendiente ? "Guardando..." : "Guardar parámetros"}
        </button>
      </form>
    </details>
  );
}

function FilaUsuario({ usuario, esUnoMismo }: { usuario: UsuarioPanel; esUnoMismo: boolean }) {
  const [estado, accion, pendiente] = useActionState<EstadoConfig, FormData>(cambiarUsuario, {});

  return (
    <li className="border-b border-gris-100 p-4 last:border-0">
      <form action={accion} className="space-y-3">
        <input type="hidden" name="id" value={usuario.id} />

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-gris-900">
            {usuario.nombre || usuario.email || "Sin nombre registrado"}
          </span>
          {esUnoMismo ? (
            <span className="rounded border border-primario px-1.5 py-0.5 text-xs font-bold text-primario">
              Eres tú
            </span>
          ) : null}
          {!usuario.activo ? (
            <span className="rounded bg-gris-200 px-1.5 py-0.5 text-xs font-bold tracking-wide text-gris-700 uppercase">
              Deshabilitado
            </span>
          ) : null}
          {usuario.email && usuario.nombre ? (
            <span className="text-sm text-gris-500">{usuario.email}</span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,14rem)_auto_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-gris-500 uppercase">Rol</span>
            <select name="rol" defaultValue={usuario.rol} className={claseCampo}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETA_ROL[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 sm:pb-3">
            <input
              type="checkbox"
              name="activo"
              value="1"
              defaultChecked={usuario.activo}
              className="size-5 accent-[var(--color-primario)]"
            />
            <span className="text-sm font-semibold text-gris-800">Cuenta habilitada</span>
          </label>

          <button
            type="submit"
            disabled={pendiente}
            className="rounded-md border border-gris-300 px-4 py-2.5 text-sm font-semibold text-gris-800 transition-colors hover:border-gris-500 disabled:opacity-60 sm:mb-1"
          >
            {pendiente ? "Guardando..." : "Aplicar"}
          </button>
        </div>

        <p className="text-xs text-gris-500">{DESCRIPCION_ROL[usuario.rol]}</p>

        <Mensaje estado={estado} />
      </form>
    </li>
  );
}

export function ListaUsuarios({
  usuarios,
  idPropio,
}: {
  usuarios: UsuarioPanel[];
  idPropio: string;
}) {
  return (
    <ul className="rounded-lg border border-gris-200">
      {usuarios.map((u) => (
        <FilaUsuario key={u.id} usuario={u} esUnoMismo={u.id === idPropio} />
      ))}
    </ul>
  );
}
