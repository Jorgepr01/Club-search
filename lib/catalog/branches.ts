import type { Branch, BranchId } from "@/lib/types";

// Ramas del árbol de intereses. Es una agrupación editorial del equipo para navegar
// el catálogo; no forma parte de los datos oficiales de cada club.
export const BRANCHES: Branch[] = [
  {
    id: "programacion",
    name: "Programación y datos",
    blurb: "Software, web, apps, inteligencia artificial y código abierto.",
    color: "#2E5BD6",
    ink: "#FFFFFF",
  },
  {
    id: "robotica",
    name: "Robótica y electrónica",
    blurb: "Circuitos, IoT, mecatrónica y automatización.",
    color: "#C93A2C",
    ink: "#FFFFFF",
  },
  {
    id: "tierra",
    name: "Ingeniería civil y de la tierra",
    blurb: "Construcción, geología, petróleo, minería, agua y mapas.",
    color: "#3D7A38",
    ink: "#FFFFFF",
  },
  {
    id: "industria",
    name: "Industria y producción",
    blurb: "Mecánica, procesos industriales, alimentos y logística.",
    color: "#F0A030",
    ink: "#1C1A3A",
  },
  {
    id: "arte",
    name: "Arte, cine y diseño",
    blurb: "Ilustración, animación, fotografía, cine y diseño de productos.",
    color: "#F2A7BC",
    ink: "#1C1A3A",
  },
  {
    id: "cultura",
    name: "Cultura e identidad",
    blurb: "Expresión cultural, cultura asiática y arqueología.",
    color: "#7FD3C0",
    ink: "#1C1A3A",
  },
  {
    id: "comunidad",
    name: "Debate, liderazgo y comunidad",
    blurb: "Oratoria, representación estudiantil y servicio.",
    color: "#6A4FC9",
    ink: "#FFFFFF",
  },
  {
    id: "otras",
    name: "Otras organizaciones",
    blurb: "Organizaciones cuya categoría aún no está agrupada.",
    color: "#5F5B78",
    ink: "#FFFFFF",
  },
];

export const BRANCH_BY_ID = Object.fromEntries(BRANCHES.map((b) => [b.id, b])) as Record<
  BranchId,
  Branch
>;

// Categoría del catálogo -> ramas. Una categoría nueva sin entrada cae en "otras".
export const CATEGORY_BRANCHES: Record<string, BranchId[]> = {
  cultura: ["cultura"],
  social_religioso: ["comunidad"],
  debate_oratoria: ["comunidad"],
  ingenieria_mecanica: ["industria"],
  ingenieria_industrial: ["industria"],
  software_web_movil_data_science: ["programacion"],
  ingenieria_civil: ["tierra"],
  ingenieria_alimentos: ["industria"],
  logistica_transporte: ["industria"],
  tecnologia: ["programacion", "robotica"],
  mecatronica_iot: ["robotica", "industria"],
  software_hardware_libre: ["programacion"],
  geologia_petroleo: ["tierra"],
  iot_web_movil: ["programacion", "robotica"],
  cultura_asiatica: ["cultura"],
  ilustracion_animacion_guion: ["arte"],
  arqueologia_antropologia: ["cultura"],
  sig_teledeteccion: ["tierra", "programacion"],
  representacion_estudiantil: ["comunidad"],
  ingenieria_electrica_electronica: ["robotica"],
  inteligencia_artificial_datos: ["programacion"],
  electronica_robotica: ["robotica", "programacion"],
  ingenieria_petroleos: ["tierra"],
  cemento_hormigon: ["tierra"],
  mineria: ["tierra"],
  ingenieria_hidroambiental: ["tierra"],
  cine: ["arte"],
  diseno_productos: ["arte", "industria"],
  fotografia_audiovisual: ["arte"],
};
