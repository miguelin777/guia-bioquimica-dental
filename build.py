"""Une los JSON de los agentes en contenido.json, valida y genera las figuras.

Uso:  python build.py [ruta_al_pdf]
Lee fuente/agente*.json (copias de los resultados de los agentes).
"""
import json, re, sys, os, glob, random

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTE = os.path.join(AQUI, "fuente")
FIG = os.path.join(AQUI, "fig")
PDF = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\sopor\Downloads\Regla1.pdf"

ORDEN = ["betaox", "carbohidratos", "proteinas", "enzimas", "urea", "respiracion",
         "nucleicos", "saliva", "digestion", "vitaminas", "dentarios"]
CORTO = {"betaox": "β-oxidación", "carbohidratos": "Carbohidratos", "proteinas": "Proteínas",
         "enzimas": "Enzimas", "urea": "Ciclo de la urea", "respiracion": "Respiración celular",
         "nucleicos": "Ácidos nucleicos", "saliva": "Saliva y caries", "digestion": "Digestión",
         "vitaminas": "Vitaminas", "dentarios": "Tejidos dentarios"}

avisos = []
def aviso(m): avisos.append(m)

temas = {}
for f in sorted(glob.glob(os.path.join(FUENTE, "agente*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    for t in d["temas"]:
        temas[t["id"]] = t

# ---- parches de los revisores (revision_*.json) ----
idx = {}
for t in temas.values():
    for k in ("preguntas", "tarjetas"):
        for x in t.get(k, []):
            idx[x.get("id")] = (t, k, x)
borrar = set(); n_ed = 0
for f in sorted(glob.glob(os.path.join(FUENTE, "revision_*.json"))):
    for c in json.load(open(f, encoding="utf-8")).get("cambios", []):
        if c.get("id") not in idx:
            aviso("parche a id inexistente: %s" % c.get("id")); continue
        t, k, x = idx[c["id"]]
        if c.get("accion") == "eliminar":
            borrar.add(c["id"])
        else:
            x.update(c.get("campos") or {}); n_ed += 1
for t in temas.values():
    for k in ("preguntas", "tarjetas"):
        t[k] = [x for x in t.get(k, []) if x.get("id") not in borrar]
print("parches: %d editados, %d eliminados" % (n_ed, len(borrar)))

# ---- secciones fuera de lugar en los apuntes: se mueven a su tema ----
MOVER = {"respiracion-7": ("digestion", "Notas de clase: el sistema digestivo")}
for sid, (dest, titulo) in MOVER.items():
    for t in list(temas.values()):
        sec = next((s for s in t.get("secciones", []) if s.get("id") == sid), None)
        if not sec or t["id"] == dest:
            continue
        sec["titulo"] = titulo
        t["secciones"].remove(sec); temas[dest]["secciones"].append(sec)
        for k in ("preguntas", "tarjetas"):
            mv = [x for x in t.get(k, []) if x.get("seccion") == sid]
            t[k] = [x for x in t.get(k, []) if x.get("seccion") != sid]
            temas[dest].setdefault(k, []).extend(mv)
        print("movida", sid, "->", dest)

faltan = [i for i in ORDEN if i not in temas]
if faltan:
    sys.exit("Faltan temas: %s" % faltan)

ids_vistos = set()
def uid(x, pref):
    base = x or pref
    n, k = base, 2
    while n in ids_vistos:
        n = "%s-%d" % (base, k); k += 1
    ids_vistos.add(n)
    return n

figuras = set()
salida = []
for tid in ORDEN:
    t = temas[tid]
    t["corto"] = CORTO[tid]
    for k in ["secciones", "tarjetas", "preguntas", "glosario", "imprescindibles", "alertas", "figuras"]:
        t.setdefault(k, [])
    secs = {}
    for s in t["secciones"]:
        s["id"] = uid(s.get("id"), tid + "-s")
        secs[s["id"]] = s
        limpios = []
        for b in s.get("bloques", []):
            tp = b.get("tipo")
            if tp == "figura":
                try:
                    b["pagina"] = int(b["pagina"])
                except Exception:
                    aviso("figura sin página en %s" % s["id"]); continue
                figuras.add(b["pagina"])
            if tp == "tabla":
                cols = b.get("columnas") or []
                filas = [[str(c) for c in r] for r in (b.get("filas") or [])]
                n = max([len(cols)] + [len(r) for r in filas]) if (cols or filas) else 0
                b["columnas"] = cols + [""] * (n - len(cols))
                b["filas"] = [r + [""] * (n - len(r)) for r in filas]
            if tp == "lista":
                b["items"] = [str(x) for x in b.get("items", [])]
            if tp == "pasos":
                b["items"] = [x if isinstance(x, dict) else {"nombre": str(x)} for x in b.get("items", [])]
            limpios.append(b)
        s["bloques"] = limpios
    primera = t["secciones"][0]["id"]

    # figuras listadas pero no colocadas en ningún bloque -> al final de su sección
    puestas = {b["pagina"] for s in t["secciones"] for b in s["bloques"] if b.get("tipo") == "figura"}
    for fg in t["figuras"]:
        try:
            p = int(fg.get("pagina"))
        except Exception:
            continue
        if p in puestas:
            continue
        sid = fg.get("seccion") if fg.get("seccion") in secs else primera
        secs[sid]["bloques"].append({"tipo": "figura", "pagina": p, "pie": fg.get("pie", "")})
        figuras.add(p); puestas.add(p)
    del t["figuras"]

    tarjetas = []
    for c in t["tarjetas"]:
        if not c.get("frente") or not c.get("reverso"):
            aviso("tarjeta vacía en %s" % tid); continue
        c["id"] = uid(c.get("id"), tid + "-t")
        if c.get("seccion") not in secs:
            c["seccion"] = primera
        tarjetas.append(c)
    t["tarjetas"] = tarjetas

    preguntas = []
    for q in t["preguntas"]:
        tp = q.get("tipo")
        ok = True
        if not q.get("enunciado"):
            ok = False
        elif tp == "opcion":
            op = q.get("opciones") or []
            ok = 3 <= len(op) <= 5 and isinstance(q.get("correcta"), int) and 0 <= q["correcta"] < len(op) and len(set(map(str, op))) == len(op)
        elif tp == "vf":
            c = q.get("correcta")
            if isinstance(c, str):
                c = c.strip().lower() in ("true", "verdadero", "v", "1")
            q["correcta"] = bool(c)
        elif tp == "completar":
            r = q.get("respuestas") or ([q["respuesta"]] if q.get("respuesta") else [])
            q["respuestas"] = [str(x) for x in r if str(x).strip()]
            ok = bool(q["respuestas"])
            q["enunciado"] = re.sub(r"_{3,}", "___", q["enunciado"])
            if q["enunciado"].count("___") != 1:
                aviso("completar sin un solo ___: %s" % q.get("id"))
        elif tp == "ordenar":
            it = q.get("items") or []
            ok = 3 <= len(it) <= 9 and len(set(it)) == len(it)
        elif tp == "relacionar":
            pr = q.get("pares") or []
            ok = 3 <= len(pr) <= 8 and all(isinstance(p, list) and len(p) == 2 for p in pr) \
                and len({p[0] for p in pr}) == len(pr) and len({p[1] for p in pr}) == len(pr)
        else:
            ok = False
        if not ok:
            aviso("pregunta descartada %s (%s)" % (q.get("id"), tp)); continue
        q["id"] = uid(q.get("id"), tid + "-q")
        if q.get("seccion") not in secs:
            q["seccion"] = primera
        try:
            q["dificultad"] = max(1, min(3, int(q.get("dificultad", 1))))
        except Exception:
            q["dificultad"] = 1
        if q.get("figura"):
            try:
                q["figura"] = int(q["figura"]); figuras.add(q["figura"])
            except Exception:
                q.pop("figura")
        for k in ("pagina",):
            if k in q:
                try: q[k] = int(q[k])
                except Exception: q.pop(k)
        preguntas.append(q)
    t["preguntas"] = preguntas
    t.pop("emoji", None)
    salida.append(t)

# ---- figuras: render a buena resolución ----
import fitz
os.makedirs(FIG, exist_ok=True)
doc = fitz.open(PDF)
dims = {}
for p in sorted(figuras):
    if not 1 <= p <= doc.page_count:
        aviso("figura fuera de rango: %s" % p); continue
    pg = doc[p - 1]
    z = 2.0 if pg.rect.height < 500 else 1.75
    pix = pg.get_pixmap(matrix=fitz.Matrix(z, z))
    pix.save(os.path.join(FIG, "p%03d.jpg" % p), jpg_quality=78)
    dims[p] = [pix.width, pix.height]
# borra figuras que ya no se usan
for f in glob.glob(os.path.join(FIG, "p*.jpg")):
    n = int(os.path.basename(f)[1:4])
    if n not in dims:
        os.remove(f)

# ---- rutas animadas ----
secs_ok = {s["id"]: t["id"] for t in salida for s in t["secciones"]}
rutas = []
for f in sorted(glob.glob(os.path.join(FUENTE, "rutas_*.json"))):
    for r in json.load(open(f, encoding="utf-8")).get("rutas", []):
        if r.get("tema") not in temas or not isinstance(r.get("pasos"), list) or len(r["pasos"]) < 2:
            aviso("ruta descartada %s" % r.get("id")); continue
        if r.get("seccion") not in secs_ok or secs_ok[r["seccion"]] != r["tema"]:
            cand = [s["id"] for s in temas[r["tema"]]["secciones"]]
            aviso("ruta %s: sección %s no existe, uso %s" % (r.get("id"), r.get("seccion"), cand[0]))
            r["seccion"] = cand[0]
        r["id"] = re.sub(r"[^a-z0-9-]", "", str(r.get("id", "r")).lower()) or "r%d" % len(rutas)
        for p in r["pasos"]:
            p["entra"] = [str(v) for v in (p.get("entra") or [])]
            p["sale"] = [str(v) for v in (p.get("sale") or [])]
        rutas.append(r)

out = {"generado": "2026-11-21", "fuente": "Regla1.pdf (233 págs.)", "figs": dims, "temas": salida, "rutas": rutas}
json.dump(out, open(os.path.join(AQUI, "contenido.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

tot_q = sum(len(t["preguntas"]) for t in salida)
tot_c = sum(len(t["tarjetas"]) for t in salida)
print("temas", len(salida), "preguntas", tot_q, "tarjetas", tot_c, "figuras", len(dims))
for t in salida:
    tipos = {}
    for q in t["preguntas"]:
        tipos[q["tipo"]] = tipos.get(q["tipo"], 0) + 1
    print(" ", t["id"], len(t["secciones"]), "secc", len(t["tarjetas"]), "tarj", len(t["preguntas"]), "preg", tipos, len(t["alertas"]), "alertas")
print("rutas", [(r["id"], r["forma"], len(r["pasos"])) for r in rutas])
print("contenido.json KB", os.path.getsize(os.path.join(AQUI, "contenido.json")) // 1024)
print("fig MB", round(sum(os.path.getsize(f) for f in glob.glob(os.path.join(FIG, "*.jpg"))) / 1e6, 1))
print("AVISOS:", len(avisos))
for a in avisos:
    print("  -", a)
