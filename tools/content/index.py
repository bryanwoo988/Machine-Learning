"""Course outline: stages and chapters. Writes data/index.json and the base
data/sources.json. Run once before the chapter scripts:
    python3 tools/content/index.py
Re-running resets every chapter to "not ready" — chapter scripts mark them ready."""
import json, sys
sys.path.insert(0, 'tools/content')
from build import T, DATA

STAGES = [
 (1, "I", T("水与矿质营养", "Water and mineral nutrition", "Air dan nutrien mineral"),
  T("细胞怎样吸水、水怎样从根爬到叶、根怎样挑选养分，以及植物到底需要哪些元素。",
    "How cells take up water, how water climbs from root to leaf, how roots choose their nutrients, and which elements a plant really needs.",
    "Bagaimana sel menyerap air, bagaimana air naik dari akar ke daun, bagaimana akar memilih nutrien, dan unsur apa yang benar-benar diperlukan tumbuhan."),
  [(1, T("植物细胞与水", "Plant cells and water", "Sel tumbuhan dan air")),
   (2, T("整株植物的水分关系", "Whole-plant water relations", "Hubungan air seluruh tumbuhan")),
   (3, T("根、土壤与养分吸收", "Roots, soils and nutrient uptake", "Akar, tanah dan pengambilan nutrien")),
   (4, T("植物与无机营养", "Plants and inorganic nutrients", "Tumbuhan dan nutrien tak organik"))]),
 (2, "I", T("能量、光合作用与呼吸", "Energy, photosynthesis and respiration", "Tenaga, fotosintesis dan respirasi"),
  T("ATP 和氧化还原、阳光的双重角色、光反应与碳反应、糖怎样运输，以及呼吸怎样把能量拿回来。",
    "ATP and redox, the two roles of sunlight, the light and carbon reactions, how sugar is moved, and how respiration gets the energy back.",
    "ATP dan redoks, dua peranan cahaya matahari, tindak balas cahaya dan karbon, bagaimana gula diangkut, dan bagaimana respirasi mendapatkan semula tenaga."),
  [(5, T("生物能量学与 ATP", "Bioenergetics and ATP", "Bioenergetik dan ATP")),
   (6, T("阳光的双重角色", "The dual role of sunlight", "Dua peranan cahaya matahari")),
   (7, T("光反应：捕捉光能", "The light reactions: harvesting light", "Tindak balas cahaya: menuai tenaga cahaya")),
   (8, T("碳反应：固定二氧化碳", "The carbon reactions: fixing CO₂", "Tindak balas karbon: mengikat CO₂")),
   (9, T("光合产物的分配与运输", "Allocation and translocation of photoassimilates", "Peruntukan dan translokasi fotoasimilat")),
   (10, T("细胞呼吸", "Cellular respiration", "Respirasi sel"))]),
 (3, "II", T("氮、生产力与逆境", "Nitrogen, productivity and stress", "Nitrogen, produktiviti dan tekanan"),
  T("氮从空气走进蛋白质的路、产量从哪里来，以及植物怎样面对强光、干旱、冷热与病虫害。",
    "How nitrogen gets from the air into protein, where yield comes from, and how plants cope with excess light, drought, heat, cold and pests.",
    "Bagaimana nitrogen bergerak dari udara ke dalam protein, dari mana datangnya hasil, dan bagaimana tumbuhan menghadapi cahaya berlebihan, kemarau, panas, sejuk dan perosak."),
  [(11, T("氮同化", "Nitrogen assimilation", "Asimilasi nitrogen")),
   (12, T("碳、氮与植物生产力", "Carbon, nitrogen and plant productivity", "Karbon, nitrogen dan produktiviti tumbuhan")),
   (13, T("植物对环境逆境的反应", "Responses to environmental stress", "Tindak balas terhadap tekanan persekitaran")),
   (14, T("对逆境的驯化", "Acclimation to environmental stress", "Penyesuaian terhadap tekanan persekitaran")),
   (15, T("对环境的适应", "Adaptations to the environment", "Adaptasi kepada persekitaran"))]),
 (4, "II–III", T("发育与植物激素", "Development and plant hormones", "Perkembangan dan hormon tumbuhan"),
  T("从种子到成株、细胞怎样长大和接收信号，再逐一认识生长素、赤霉素、细胞分裂素、脱落酸、乙烯和油菜素甾醇。",
    "From seed to adult plant, how cells grow and receive signals, then the hormones one by one: auxin, gibberellins, cytokinins, abscisic acid, ethylene and brassinosteroids.",
    "Daripada biji benih hingga tumbuhan dewasa, bagaimana sel membesar dan menerima isyarat, kemudian hormon satu demi satu: auksin, giberelin, sitokinin, asid absisik, etilena dan brasinosteroid."),
  [(16, T("发育概论", "Development: an overview", "Perkembangan: gambaran keseluruhan")),
   (17, T("细胞的生长、分裂与信号传导", "Cell growth, division and signalling", "Pertumbuhan, pembahagian dan pengisyaratan sel")),
   (18, T("生长素", "Auxins", "Auksin")),
   (19, T("赤霉素", "Gibberellins", "Giberelin")),
   (20, T("细胞分裂素", "Cytokinins", "Sitokinin")),
   (21, T("脱落酸", "Abscisic acid", "Asid absisik")),
   (22, T("乙烯", "Ethylene", "Etilena")),
   (23, T("油菜素甾醇", "Brassinosteroids", "Brasinosteroid"))]),
 (5, "III", T("光、运动与开花", "Light, movement and flowering", "Cahaya, pergerakan dan pembungaan"),
  T("光敏色素和隐花色素怎样“看”光、植物怎样弯向光和重力、怎样量日长，以及开花的信号和次生代谢物。",
    "How phytochromes and cryptochromes ‘see’ light, how plants bend towards light and gravity, how they measure day length, the flowering signal, and secondary metabolites.",
    "Bagaimana fitokrom dan kriptokrom ‘melihat’ cahaya, bagaimana tumbuhan membengkok ke arah cahaya dan graviti, bagaimana ia mengukur panjang hari, isyarat pembungaan, dan metabolit sekunder."),
  [(24, T("光形态建成", "Photomorphogenesis", "Fotomorfogenesis")),
   (25, T("向性与感性运动", "Tropisms and nastic movements", "Tropisme dan gerakan nastik")),
   (26, T("光周期与生物钟", "Photoperiodism and the biological clock", "Fotoperiodisme dan jam biologi")),
   (27, T("开花与果实", "Flowering and fruit", "Pembungaan dan buah")),
   (28, T("次生代谢物", "Secondary metabolites", "Metabolit sekunder"))]),
]

index = {"app": T("植物生理学", "Plant Physiology", "Fisiologi Tumbuhan"), "stages": [], "chapters": []}
for n, exam, title, blurb, chs in STAGES:
    index["stages"].append({"n": n, "exam": exam, "title": title, "blurb": blurb, "chapters": [f"ch{c:02d}" for c, _ in chs]})
    for c, t in chs:
        index["chapters"].append({"id": f"ch{c:02d}", "num": c, "stage": n, "title": t, "ready": False})

DATA.mkdir(exist_ok=True)
(DATA / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n")

SOURCES = [
 {"id": "HH", "short": "Hopkins & Hüner 2009",
  "title": "Introduction to Plant Physiology, 4th edition (W. G. Hopkins & N. P. A. Hüner)",
  "publisher": "John Wiley & Sons, 2009", "url": "", "accessed": ""},
 {"id": "LEC", "short": "Lecture notes",
  "title": "Plant Physiology course lecture slides, Midterm I–III units (Chapters 1–25, 27)",
  "publisher": "University course notes", "url": "", "accessed": ""},
]
existing = {s["id"]: s for s in json.loads((DATA / "sources.json").read_text())} if (DATA / "sources.json").exists() else {}
existing.update({s["id"]: s for s in SOURCES})
(DATA / "sources.json").write_text(json.dumps(sorted(existing.values(), key=lambda s: s["id"]), ensure_ascii=False, indent=1) + "\n")
print(len(index["chapters"]), "chapters in", len(index["stages"]), "stages")
