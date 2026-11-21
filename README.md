# Guía de Bioquímica Dental

**Ábrela aquí:** <https://miguelin777.github.io/guia-bioquimica-dental/>

Guía de estudio interactiva hecha a partir de 233 páginas de apuntes y diapositivas de **bioquímica para odontología**. Sirve para leer cada tema resumido, practicar con preguntas tipo examen y repasar con tarjetas de memoria en el momento justo antes de olvidarlas.

## Qué incluye

| | |
|---|---|
| **11 temas** | β-oxidación · Carbohidratos y glucólisis · Aminoácidos y proteínas · Enzimas · Ciclo de la urea · Respiración celular · Ácidos nucleicos · Saliva y caries · Digestión · Vitaminas · Tejidos dentarios |
| **582 preguntas** | Opción múltiple, verdadero o falso, completar, ordenar y relacionar, con explicación y página de los apuntes |
| **439 tarjetas** | Repaso espaciado: las que fallas regresan pronto, las que dominas tardan días |
| **12 rutas animadas** | Ciclo de la urea, Krebs, glucólisis, β-oxidación, cadena respiratoria, digestión, caries, placa y más, paso a paso |
| **76 figuras** | Los esquemas y tablas de los apuntes, ampliables |

Además: simulacro de examen con reloj y calificación sobre 10, «Mis errores», «Repaso de hoy», «Lo esencial» de todo el curso en una página, buscador, modo tapar términos y avisos de los puntos donde los apuntes difieren de los libros.

Cada tema lleva el color de la tinción de laboratorio que lo revela (Sudán III para lípidos, PAS para glucógeno, Coomassie para proteínas…).

## Cómo usarla

Abre `index.html` desde un servidor local (la página carga `contenido.json` con `fetch`, así que no funciona con doble clic):

```bash
python -m http.server 5196
```

y entra a <http://localhost:5196>. Tu avance se guarda en el navegador.

La versión publicada en Claude además sincroniza el avance entre dispositivos y trae un tutor con IA.

## Estructura

```
src/            código fuente de la app
  head.html       título, fuentes
  body.html       barra superior y navegación
  style.css       estilos (fondo blanco, colores por tema, animaciones)
  app.js          lógica: lectura, quiz, tarjetas, rutas, simulacro, progreso
assemble.py     arma index.html (página completa) y artifact.html (para Claude)
build.py        une el contenido de fuente/ en contenido.json y genera fig/ desde el PDF
fuente/         contenido por temas (agente*.json), correcciones (revision_*.json) y rutas (rutas_*.json)
contenido.json  todo el contenido ya unido y validado
fig/            páginas de los apuntes usadas como figuras
```

## Cómo modificarla

- **Diseño o funciones:** edita `src/` y corre `python assemble.py`.
- **Contenido:** edita los JSON de `fuente/` y corre `python build.py <ruta-al-pdf>` (necesita PyMuPDF para regenerar las figuras); luego `python assemble.py`.

## Sobre el contenido

Las respuestas siguen lo que dicen los apuntes, porque es lo que se evalúa. Cuando los apuntes contradicen a los libros de texto (por ejemplo, B3 y B5 intercambiadas en la página 46 o los porcentajes del cemento y la pulpa), la guía lo avisa en la sección «Ojo con los apuntes» de cada tema.
