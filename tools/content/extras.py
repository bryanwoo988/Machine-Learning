"""The hormone comparison table and the essay-question review.
Writes data/hormones.json and data/essays.json. Run: python3 tools/content/extras.py"""
import json, sys
sys.path.insert(0, 'tools/content')
from build import T, DATA, tidy

COLS = [
 ("chem", T("化学本质", "Chemistry", "Kimia")),
 ("made", T("合成（关键酶）", "Synthesis (key enzyme)", "Sintesis (enzim utama)")),
 ("move", T("运输", "Transport", "Pengangkutan")),
 ("receptor", T("受体", "Receptor", "Reseptor")),
 ("does", T("主要作用", "Main effects", "Kesan utama")),
 ("tools", T("常用处理 / 抑制剂", "Applied compounds / inhibitors", "Sebatian / perencat")),
]

ROWS = [
 ("auxin", 18, T("生长素", "Auxin", "Auksin"), {
  "chem": T("吲哚化合物，主要是 IAA", "Indoles, chiefly IAA", "Indol, terutamanya IAA"),
  "made": T("色氨酸依赖与不依赖途径；茎尖、幼叶", "Tryptophan-dependent and -independent routes; shoot apex, young leaves", "Laluan bergantung dan tidak bergantung triptofan; apeks pucuk, daun muda"),
  "move": T("细胞到细胞的极性运输（AUX1 进、PIN 出）", "Cell-to-cell polar transport (AUX1 in, PIN out)", "Pengangkutan berkutub sel ke sel (AUX1 masuk, PIN keluar)"),
  "receptor": T("TIR1（SCF 的 F-box）→ AUX/IAA 降解 → ARF", "TIR1 (F-box of SCF) → AUX/IAA destroyed → ARF", "TIR1 (F-box SCF) → AUX/IAA dimusnahkan → ARF"),
  "does": T("细胞伸长（酸生长）、向性、顶端优势、维管分化、不定根", "Cell elongation (acid growth), tropisms, apical dominance, vascular differentiation, adventitious roots", "Pemanjangan sel (pertumbuhan asid), tropisme, dominasi apeks, pembezaan vaskular, akar adventitis"),
  "tools": T("NAA、IBA、2,4-D；运输抑制剂 TIBA、NPA", "NAA, IBA, 2,4-D; transport inhibitors TIBA, NPA", "NAA, IBA, 2,4-D; perencat pengangkutan TIBA, NPA")}),
 ("ga", 19, T("赤霉素", "Gibberellins", "Giberelin"), {
  "chem": T("二萜（C₁₉/C₂₀），活性的有 GA₁、GA₃、GA₄", "Diterpenes (C₁₉/C₂₀); active GA₁, GA₃, GA₄", "Diterpena (C₁₉/C₂₀); aktif GA₁, GA₃, GA₄"),
  "made": T("GGPP → 内根-贝壳杉烯 → GA₁₂；种子、幼叶、根尖", "GGPP → ent-kaurene → GA₁₂; seeds, young leaves, root tips", "GGPP → ent-kaurena → GA₁₂; biji, daun muda, hujung akar"),
  "move": T("韧皮部（源–库），无极性", "Phloem (source–sink), not polar", "Floem (sumber–sinki), tidak berkutub"),
  "receptor": T("GID1 → DELLA 被 SCF^SLY1/GID2 降解", "GID1 → DELLA destroyed via SCF^SLY1/GID2", "GID1 → DELLA dimusnahkan melalui SCF^SLY1/GID2"),
  "does": T("节间伸长、抽薹、种子萌发（α-淀粉酶）、果实发育", "Internode elongation, bolting, germination (α-amylase), fruit growth", "Pemanjangan ruas, pembentukan batang bunga, percambahan (α-amilase), pertumbuhan buah"),
  "tools": T("GA₃；合成抑制剂 CCC、AMO-1618、Phosfon D、嘧啶醇、BX-112", "GA₃; synthesis inhibitors CCC, AMO-1618, Phosfon D, ancymidol, BX-112", "GA₃; perencat sintesis CCC, AMO-1618, Phosfon D, ansimidol, BX-112")}),
 ("ck", 20, T("细胞分裂素", "Cytokinins", "Sitokinin"), {
  "chem": T("N⁶ 取代腺嘌呤：玉米素、iP；合成的激动素、BA", "N⁶-substituted adenines: zeatin, iP; synthetic kinetin, BA", "Adenina tertukar ganti N⁶: zeatin, iP; kinetin sintetik, BA"),
  "made": T("IPT（限速）把异戊烯基接到 AMP；主要在根尖", "IPT (rate-limiting) adds isopentenyl to AMP; mainly root tips", "IPT (pengehad kadar) menambah isopentenil kepada AMP; terutamanya hujung akar"),
  "move": T("木质部往上", "Up in the xylem", "Naik dalam xilem"),
  "receptor": T("CRE1/AHK4、AHK2、AHK3 双组分 → AHP → B 型 ARR", "CRE1/AHK4, AHK2, AHK3 two-component → AHP → type-B ARR", "CRE1/AHK4, AHK2, AHK3 dua komponen → AHP → ARR jenis B"),
  "does": T("与生长素一起促进分裂、组织培养长芽、延缓衰老、养分吸引、维持分生组织", "Division with auxin, shoots in culture, delays senescence, attracts nutrients, maintains meristems", "Pembahagian bersama auksin, pucuk dalam kultur, melambatkan penuaan, menarik nutrien, mengekalkan meristem"),
  "tools": T("BA、激动素；CKX 降解", "BA, kinetin; degraded by CKX", "BA, kinetin; diuraikan oleh CKX")}),
 ("aba", 21, T("脱落酸", "Abscisic acid", "Asid absisik"), {
  "chem": T("C₁₅ 倍半萜，只有一种", "A single C₁₅ sesquiterpene", "Satu seskuiterpena C₁₅"),
  "made": T("紫黄质经 NCED 切成黄氧素 → ABA；成熟叶、保卫细胞、维管组织", "Violaxanthin cut by NCED to xanthoxin → ABA; mature leaves, guard cells, vascular tissue", "Violaxantin dipotong oleh NCED kepada xantoksin → ABA; daun matang, sel pengawal, tisu vaskular"),
  "move": T("移动性高；根经木质部送到叶（干旱信号）", "Highly mobile; root to shoot in xylem (drought signal)", "Sangat mudah bergerak; akar ke pucuk dalam xilem (isyarat kemarau)"),
  "receptor": T("PYR/PYL/RCAR → 抑制 PP2C → SnRK2 活化", "PYR/PYL/RCAR → PP2C inhibited → SnRK2 active", "PYR/PYL/RCAR → PP2C direncat → SnRK2 aktif"),
  "does": T("气孔关闭、种子休眠、防止胎萌、逆境耐受", "Stomatal closure, seed dormancy, preventing vivipary, stress tolerance", "Penutupan stoma, dorman biji, mencegah viviparti, toleransi tekanan"),
  "tools": T("代谢成红花菜豆酸、二氢红花菜豆酸", "Inactivated to phaseic and dihydrophaseic acid", "Dinyahaktifkan kepada asid faseik dan dihidrofaseik")}),
 ("eth", 22, T("乙烯", "Ethylene", "Etilena"), {
  "chem": T("气体 C₂H₄", "The gas C₂H₄", "Gas C₂H₄"),
  "made": T("Met → SAM（SAM 合成酶）→ ACC（ACC 合成酶，限速）→ 乙烯（ACC 氧化酶）；Yang 循环", "Met → SAM (SAM synthetase) → ACC (ACC synthase, rate-limiting) → ethylene (ACC oxidase); Yang cycle", "Met → SAM (SAM sintetase) → ACC (ACC sintase, pengehad kadar) → etilena (ACC oksidase); kitaran Yang"),
  "move": T("气体扩散", "Diffuses as a gas", "Meresap sebagai gas"),
  "receptor": T("ETR1 等（内质网，含铜）；无乙烯时经 CTR1 抑制反应", "ETR1 family (ER, copper); represses via CTR1 when ethylene is absent", "Keluarga ETR1 (RE, kuprum); menindas melalui CTR1 apabila etilena tiada"),
  "does": T("果实成熟（跃变）、衰老、三重反应、偏上生长、脱落", "Ripening (climacteric), senescence, triple response, epinasty, abscission", "Pemasakan (klimakterik), penuaan, tindak balas tiga serangkai, epinasti, keguguran"),
  "tools": T("乙烯利（放出乙烯）", "Ethephon (releases ethylene)", "Etefon (membebaskan etilena)")}),
 ("br", 23, T("油菜素甾醇", "Brassinosteroids", "Brasinosteroid"), {
  "chem": T("植物甾醇激素，主要是油菜素内酯", "Plant steroid hormones, chiefly brassinolide", "Hormon steroid tumbuhan, terutamanya brasinolida"),
  "made": T("鲨烯 → 环阿屯醇 → 菜油甾醇 → 油菜素内酯", "Squalene → cycloartenol → campesterol → brassinolide", "Skualena → sikloartenol → kampesterol → brasinolida"),
  "move": T("大多就地作用", "Mostly act where made", "Kebanyakannya bertindak di tempat dibuat"),
  "receptor": T("质膜 BRI1 + BAK1 → BIN2 被抑制 → BZR1 进核", "Plasma-membrane BRI1 + BAK1 → BIN2 inhibited → BZR1 to nucleus", "BRI1 + BAK1 membran plasma → BIN2 direncat → BZR1 ke nukleus"),
  "does": T("茎和花粉管伸长、细胞分裂、萌发、维管分化；抑制根伸长", "Stem and pollen-tube elongation, division, germination, vascular differentiation; inhibits root elongation", "Pemanjangan batang dan tiub debunga, pembahagian, percambahan, pembezaan vaskular; merencat pemanjangan akar"),
  "tools": T("合成抑制剂芸苔素唑（Brz）", "Synthesis inhibitor brassinazole (Brz)", "Perencat sintesis brasinazol (Brz)")}),
]

hormones = {
 "first": T("激素", "Hormone", "Hormon"),
 "intro": T("一页看完六大激素：怎么合成、怎么运、谁接收、做什么。点激素名字可以跳到那一章。",
            "The six hormones on one page: how they are made and moved, what receives them and what they do. Tap a name to open its chapter.",
            "Enam hormon dalam satu halaman: bagaimana ia dibuat dan diangkut, apa yang menerimanya dan apa yang dilakukannya. Ketik nama untuk membuka babnya."),
 "src": "Hopkins & Hüner 2009, chs 18–21; lecture notes",
 "cols": [{"key": k, "label": lab} for k, lab in COLS],
 "rows": [{"id": i, "chapter": ch, "name": n, "cells": c} for i, ch, n, c in ROWS],
}

def E(i, ch, q, points, tip=None):
    e = {"id": i, "chapter": ch, "q": T(*q), "points": [T(*p) for p in points]}
    if tip:
        e["tip"] = T(*tip)
    return e

ESSAYS = [
 E("receptors", 23, ("说明生长素、赤霉素、ABA、乙烯和油菜素甾醇的受体。", "Describe the receptors for auxin, GA, ABA, ethylene and brassinosteroid.", "Terangkan reseptor auksin, GA, ABA, etilena dan brasinosteroid."),
   [("生长素：TIR1，可溶性核内受体，是 SCF 复合体的 F-box；生长素像分子胶使 TIR1 结合 AUX/IAA，后者被泛素化、经 26S 蛋白酶体降解，ARF 启动基因。", "Auxin: TIR1, a soluble nuclear receptor and the F-box of an SCF complex; auxin glues TIR1 to AUX/IAA, which is ubiquitinated and destroyed by the 26S proteasome so ARF can activate genes.", "Auksin: TIR1, reseptor nukleus larut dan F-box kompleks SCF; auksin melekatkan TIR1 pada AUX/IAA, yang diubikuitinkan dan dimusnahkan proteasom 26S supaya ARF boleh mengaktifkan gen."),
    ("赤霉素：GID1，可溶性核内受体；GA–GID1 结合 DELLA，DELLA 经 SCF^SLY1/GID2 被降解（去抑制）。", "GA: GID1, a soluble nuclear receptor; GA–GID1 binds DELLA, which is destroyed via SCF^SLY1/GID2 (de-repression).", "GA: GID1, reseptor nukleus larut; GA–GID1 terikat pada DELLA, yang dimusnahkan melalui SCF^SLY1/GID2 (penyahtindasan)."),
    ("ABA：PYR/PYL/RCAR 可溶性受体；结合 ABA 后抑制 PP2C 磷酸酶，SnRK2 激酶活化，磷酸化离子通道与转录因子。", "ABA: soluble PYR/PYL/RCAR receptors; ABA-bound, they inhibit PP2C phosphatases, activating SnRK2 kinases that phosphorylate ion channels and transcription factors.", "ABA: reseptor larut PYR/PYL/RCAR; terikat ABA, ia merencat fosfatase PP2C, mengaktifkan kinase SnRK2 yang memfosforilkan saluran ion dan faktor transkripsi."),
    ("乙烯：ETR1 家族，内质网膜上的双组分组氨酸激酶类受体，需要铜；没有乙烯时受体与 CTR1 主动抑制反应，乙烯结合使其失活（反向逻辑）。", "Ethylene: the ETR1 family, two-component histidine-kinase-like receptors in the ER membrane needing copper; without ethylene the receptor and CTR1 actively repress the response, and ethylene binding switches them off (reverse logic).", "Etilena: keluarga ETR1, reseptor dua komponen seperti histidina kinase dalam membran RE yang memerlukan kuprum; tanpa etilena reseptor dan CTR1 secara aktif menindas tindak balas, dan pengikatan etilena mematikannya (logik terbalik)."),
    ("油菜素甾醇：质膜上的 BRI1（LRR 受体激酶）与 BAK1；BR 结合使 BKI1 脱离、BRI1–BAK1 磷酸化，BIN2 被抑制，BZR1/BES1 去磷酸化进核。", "Brassinosteroid: BRI1 (an LRR receptor kinase) with BAK1 at the plasma membrane; BR releases BKI1, BRI1–BAK1 phosphorylate, BIN2 is inhibited and BZR1/BES1 are dephosphorylated and enter the nucleus.", "Brasinosteroid: BRI1 (kinase reseptor LRR) bersama BAK1 di membran plasma; BR melepaskan BKI1, BRI1–BAK1 berfosforil, BIN2 direncat dan BZR1/BES1 dinyahfosforil dan masuk ke nukleus.")],
   ("画一张五栏对照表，最后一句点出“去抑制”是共同主题。", "Draw a five-column comparison and finish with the common theme: de-repression.", "Lukis jadual perbandingan lima lajur dan akhiri dengan tema bersama: penyahtindasan.")),
 E("scf", 18, ("说明 SCF 复合体的组成与功能。", "Outline the SCF complex and its function.", "Terangkan kompleks SCF dan fungsinya."),
   [("SCF 是一种 E3 泛素连接酶，由 Skp1、Cullin 和 F-box 蛋白组成。", "SCF is an E3 ubiquitin ligase made of Skp1, Cullin and an F-box protein.", "SCF ialah ligase ubikuitin E3 daripada Skp1, Cullin dan protein F-box."),
    ("F-box 蛋白决定要降解哪个目标蛋白（例如 TIR1 认 AUX/IAA，SLY1/GID2 认 DELLA）。", "The F-box protein chooses the target (TIR1 recognises AUX/IAA; SLY1/GID2 recognises DELLA).", "Protein F-box memilih sasaran (TIR1 mengenal AUX/IAA; SLY1/GID2 mengenal DELLA)."),
    ("目标蛋白被多聚泛素化，送到 26S 蛋白酶体降解。", "The target is polyubiquitinated and sent to the 26S proteasome for destruction.", "Sasaran dipoliubikuitinkan dan dihantar ke proteasom 26S untuk dimusnahkan."),
    ("功能：移除转录抑制者，使激素响应基因去抑制——生长素和赤霉素信号的核心。", "Function: removing transcriptional repressors so hormone-response genes are de-repressed — the core of auxin and GA signalling.", "Fungsi: membuang penindas transkripsi supaya gen tindak balas hormon dinyahtindas — teras pengisyaratan auksin dan GA.")]),
 E("ga-pathway", 19, ("画出并说明赤霉素的信号途径与生理功能。", "Outline the GA signalling pathway and the biological functions of GA.", "Lakarkan laluan isyarat GA dan fungsi biologi GA."),
   [("合成：GGPP → 内根-贝壳杉烯 → GA₁₂-7-醛 → GA₁₂ → 活性 GA（GA₁、GA₄）；C-2 羟基化失活。", "Synthesis: GGPP → ent-kaurene → GA₁₂-7-aldehyde → GA₁₂ → active GA (GA₁, GA₄); inactivated by C-2 hydroxylation.", "Sintesis: GGPP → ent-kaurena → GA₁₂-7-aldehid → GA₁₂ → GA aktif (GA₁, GA₄); dinyahaktifkan melalui penghidroksilan C-2."),
    ("信号：GA + GID1 → 结合 DELLA → SCF^SLY1/GID2 → 26S 蛋白酶体降解 DELLA → 基因去抑制。", "Signalling: GA + GID1 → binds DELLA → SCF^SLY1/GID2 → 26S proteasome destroys DELLA → genes de-repressed.", "Isyarat: GA + GID1 → terikat DELLA → SCF^SLY1/GID2 → proteasom 26S memusnahkan DELLA → gen dinyahtindas."),
    ("证据：slr1（DELLA 坏掉）一直伸长；gai（DELLA 无法被降解）矮小且不敏感。", "Evidence: slr1 (broken DELLA) grows constantly; gai (undegradable DELLA) is dwarf and insensitive.", "Bukti: slr1 (DELLA rosak) tumbuh berterusan; gai (DELLA tidak boleh diuraikan) kerdil dan tidak sensitif."),
    ("功能：节间伸长、抽薹、谷粒萌发诱导糊粉层 α-淀粉酶、果实发育（无籽葡萄）、制麦芽。", "Functions: internode elongation, bolting, α-amylase induction in the aleurone at germination, fruit growth (seedless grapes), malting.", "Fungsi: pemanjangan ruas, pembentukan batang bunga, aruhan α-amilase dalam aleuron semasa percambahan, pertumbuhan buah (anggur tanpa biji), pemaltan.")],
   ("一定要画图并配文字说明。", "Draw the diagram and describe it in words.", "Lukis rajah dan terangkan dalam perkataan.")),
 E("polar-auxin", 18, ("说明生长素极性运输的机制。", "Describe the mechanism of polar auxin transport.", "Terangkan mekanisme pengangkutan auksin berkutub."),
   [("茎中向基、细胞到细胞；属于载体介导的二次主动运输，证据来自 TIBA、NPA 等抑制剂。", "Basipetal and cell-to-cell in shoots; carrier-mediated secondary active transport, shown by inhibitors such as TIBA and NPA.", "Basipetal dan sel ke sel dalam pucuk; pengangkutan aktif sekunder diantara pembawa, ditunjukkan oleh perencat seperti TIBA dan NPA."),
    ("化学渗透模型：质膜 H⁺-ATP 酶使细胞壁偏酸；约 80 % IAA 为 IAA⁻。", "Chemiosmotic model: the plasma-membrane H⁺-ATPase keeps the wall acidic; about 80 % of IAA is IAA⁻.", "Model kemiosmosis: H⁺-ATPase membran plasma mengekalkan dinding berasid; kira-kira 80 % IAA ialah IAA⁻."),
    ("细胞顶端：IAA⁻ 经 AUX1 与 H⁺ 同向运入；IAAH 扩散进入。", "Cell top: IAA⁻ enters with H⁺ through AUX1; IAAH diffuses in.", "Atas sel: IAA⁻ masuk bersama H⁺ melalui AUX1; IAAH meresap masuk."),
    ("细胞质 pH ≈ 7：IAAH 解离被困（阴离子陷阱）。", "Cytosol at pH ≈ 7: IAAH dissociates and is trapped (anion trap).", "Sitosol pada pH ≈ 7: IAAH terurai dan terperangkap (perangkap anion)."),
    ("细胞基部：IAA⁻ 只能经 PIN 外排载体出去——PIN 的不对称分布决定方向。", "Cell base: IAA⁻ leaves only through PIN efflux carriers — their asymmetric placement sets the direction.", "Pangkal sel: IAA⁻ keluar hanya melalui pembawa efluks PIN — penempatannya yang tidak simetri menentukan arah.")]),
 E("inhibitors", 19, ("说明研究生长素和赤霉素时使用的抑制剂。", "Describe the inhibitors used in studying auxin and GA.", "Terangkan perencat yang digunakan dalam mengkaji auksin dan GA."),
   [("生长素运输抑制剂（植物向性素）：TIBA、NPA、形态素——阻断极性运输，可解除顶端优势。", "Auxin-transport inhibitors (phytotropins): TIBA, NPA, morphactin — block polar transport and can release apical dominance.", "Perencat pengangkutan auksin (fitotropin): TIBA, NPA, morfaktin — menyekat pengangkutan berkutub dan boleh membebaskan dominasi apeks."),
    ("赤霉素合成抑制剂：AMO-1618、CCC、Phosfon D（阻断内根-贝壳杉烯合成）；嘧啶醇（阻断贝壳杉烯氧化）——可被 GA₂₀ 或 GA₃ 逆转。", "GA synthesis inhibitors: AMO-1618, CCC, Phosfon D (block ent-kaurene formation); ancymidol (blocks kaurene oxidation) — reversed by GA₂₀ or GA₃.", "Perencat sintesis GA: AMO-1618, CCC, Phosfon D (menyekat pembentukan ent-kaurena); ansimidol (menyekat pengoksidaan kaurena) — diterbalikkan oleh GA₂₀ atau GA₃."),
    ("BX-112 阻断 GA₂₀ → GA₁，只有 GA₁ 本身能逆转。", "BX-112 blocks GA₂₀ → GA₁; only GA₁ itself reverses it.", "BX-112 menyekat GA₂₀ → GA₁; hanya GA₁ sendiri membalikkannya.")]),
 E("triple-photomorph", 24, ("分别定义并说明光形态建成与三重反应。", "Define and describe photomorphogenesis and the triple response.", "Takrif dan terangkan fotomorfogenesis dan tindak balas tiga serangkai."),
   [("光形态建成：光（质与量）对发育的调控；黄化苗照光后去黄化——下胚轴停止伸长、弯钩伸直、叶展开、变绿；受体是光敏色素、隐花色素、向光素、UV-B 受体。", "Photomorphogenesis: control of development by light quality and quantity; etiolated seedlings de-etiolate in light — hypocotyl stops, hook straightens, leaves open and green; receptors are phytochromes, cryptochromes, phototropins and the UV-B receptor.", "Fotomorfogenesis: kawalan perkembangan oleh kualiti dan kuantiti cahaya; anak benih etiolasi nyah-etiolasi dalam cahaya — hipokotil berhenti, cangkuk lurus, daun terbuka dan menghijau; reseptornya fitokrom, kriptokrom, fototropin dan reseptor UV-B."),
    ("三重反应：乙烯对黑暗中双子叶幼苗的效应——下胚轴（与根）伸长受抑制、下胚轴横向膨大、顶钩弯曲加剧。", "Triple response: ethylene's effect on dark-grown dicot seedlings — inhibited hypocotyl (and root) elongation, radial swelling of the hypocotyl, exaggerated apical hook.", "Tindak balas tiga serangkai: kesan etilena pada anak benih dikotiledon dalam gelap — pemanjangan hipokotil (dan akar) direncat, hipokotil membengkak jejarian, cangkuk apeks berlebihan."),
    ("三重反应筛选出 etr1（不敏感）、ctr1（组成型三重反应）等突变体，解开乙烯信号途径。", "Screening for it yielded etr1 (insensitive) and ctr1 (constitutive) mutants that revealed the ethylene pathway.", "Penyaringannya menghasilkan mutan etr1 (tidak sensitif) dan ctr1 (konstitutif) yang mendedahkan laluan etilena.")]),
 E("avena", 18, ("说明燕麦弯曲试验。", "Describe the Avena curvature test.", "Terangkan ujian lengkungan Avena."),
   [("Went（1928）：切下燕麦胚芽鞘尖端放在琼脂块上，让生长素扩散进去。", "Went (1928): oat coleoptile tips are stood on agar blocks so auxin diffuses into them.", "Went (1928): hujung koleoptil oat diletakkan di atas blok agar supaya auksin meresap ke dalamnya."),
    ("把琼脂块偏放在去顶的胚芽鞘一侧（在黑暗中），下方那侧细胞伸长较多，胚芽鞘弯曲。", "The block is placed off-centre on a decapitated coleoptile (in the dark); cells below it elongate more and the coleoptile bends.", "Blok diletakkan tidak sejajar pada koleoptil yang dipotong (dalam gelap); sel di bawahnya memanjang lebih dan koleoptil membengkok."),
    ("弯曲角度与琼脂中的生长素量成正比——第一个生长素的定量测定法，也证实尖端产生调节物质。", "The angle is proportional to the auxin in the agar — the first quantitative bioassay for auxin, confirming the tip makes a regulator.", "Sudutnya berkadar dengan auksin dalam agar — bioasai kuantitatif pertama untuk auksin, mengesahkan hujung membuat pengawal atur.")]),
 E("phy-cry", 24, ("比较光敏色素与隐花色素的结构与功能。", "Compare the structure and function of phytochrome and cryptochrome.", "Bandingkan struktur dan fungsi fitokrom dan kriptokrom."),
   [("光敏色素：吸收红光/远红光；色素团光敏色素胆素（开链四吡咯）；Pr ⇌ Pfr 光可逆，Pfr 活性；N 端光感应域、C 端类组氨酸激酶调节域；Pfr 进核、使 PIF 降解。", "Phytochrome: absorbs red/far-red; chromophore phytochromobilin (open-chain tetrapyrrole); Pr ⇌ Pfr photoreversible, Pfr active; N-terminal photosensory and C-terminal histidine-kinase-like regulatory domains; Pfr enters the nucleus and destroys PIFs.", "Fitokrom: menyerap merah/merah jauh; kromofor fitokromobilin (tetrapirol rantai terbuka); Pr ⇌ Pfr boleh berbalik, Pfr aktif; domain fotoderia hujung-N dan domain pengawal atur seperti histidina kinase hujung-C; Pfr masuk nukleus dan memusnahkan PIF."),
    ("隐花色素：吸收蓝光/UV-A；色素团 FAD 和蝶呤；N 端光裂合酶相关域；位于核内，与 COP1 互作解除抑制；不可逆。", "Cryptochrome: absorbs blue/UV-A; chromophores FAD and pterin; N-terminal photolyase-related domain; nuclear, interacts with COP1 to lift repression; not reversible.", "Kriptokrom: menyerap biru/UV-A; kromofor FAD dan pterin; domain berkaitan fotoliase hujung-N; di nukleus, berinteraksi dengan COP1 untuk mengangkat penindasan; tidak boleh berbalik."),
    ("功能：光敏色素管萌发、去黄化、避荫、光周期；隐花色素抑制下胚轴伸长、花青素、开花时间（CRY2）；两者合作完成去黄化。", "Functions: phytochrome — germination, de-etiolation, shade avoidance, photoperiodism; cryptochrome — hypocotyl inhibition, anthocyanin, flowering time (CRY2); they cooperate in de-etiolation.", "Fungsi: fitokrom — percambahan, nyah-etiolasi, pengelakan teduhan, fotoperiodisme; kriptokrom — perencatan hipokotil, antosianin, masa berbunga (CRY2); kedua-duanya bekerjasama dalam nyah-etiolasi.")]),
 E("ethylene-enzymes", 22, ("说明乙烯合成途径中的三个关键酶。", "Describe three key enzymes in the ethylene biosynthesis pathway.", "Terangkan tiga enzim utama dalam laluan biosintesis etilena."),
   [("SAM 合成酶：甲硫氨酸 + ATP → S-腺苷甲硫氨酸（SAM）。", "SAM synthetase: methionine + ATP → S-adenosylmethionine (SAM).", "SAM sintetase: metionina + ATP → S-adenosilmetionina (SAM)."),
    ("ACC 合成酶（ACS）：SAM → ACC，限速；生长素、伤害、逆境、乙烯自催化在转录层次诱导。", "ACC synthase (ACS): SAM → ACC, rate-limiting; induced transcriptionally by auxin, wounding, stress and ethylene itself.", "ACC sintase (ACS): SAM → ACC, pengehad kadar; diaruh secara transkripsi oleh auksin, luka, tekanan dan etilena sendiri."),
    ("ACC 氧化酶（ACO）：ACC + O₂ → 乙烯。副产物经 Yang 循环回收成甲硫氨酸。", "ACC oxidase (ACO): ACC + O₂ → ethylene. The by-product is recycled to methionine by the Yang cycle.", "ACC oksidase (ACO): ACC + O₂ → etilena. Hasil sampingan dikitar semula kepada metionina oleh kitaran Yang.")],
   ("最好把路径画出来。", "Draw the pathway.", "Lukis laluannya.")),
 E("flowering-temp", 27, ("说明受温度控制的开花途径。", "Describe the flowering pathway under temperature control.", "Terangkan laluan pembungaan di bawah kawalan suhu."),
   [("春化：冬性一年生和二年生植物需经低温才开花；由茎顶端感受，效果与时间成正比。", "Vernalisation: winter annuals and biennials need cold to flower; perceived by the shoot apex; effect proportional to duration.", "Pemvernalan: tumbuhan semusim musim sejuk dan dwimusim memerlukan sejuk untuk berbunga; dikesan oleh apeks pucuk; kesan berkadar dengan tempoh."),
    ("禾谷类：无低温时 VRN2 抑制 VRN3（FT）；低温诱导 VRN1，VRN1 抑制 VRN2，VRN3 被释放而诱导开花。", "Cereals: without cold, VRN2 represses VRN3 (FT); cold induces VRN1, which represses VRN2, releasing VRN3 to induce flowering.", "Bijirin: tanpa sejuk, VRN2 menindas VRN3 (FT); sejuk mengaruh VRN1, yang menindas VRN2, membebaskan VRN3 untuk mengaruh pembungaan."),
    ("拟南芥：FLC 抑制 FT；低温经 VRN 复合体使 FLC 沉默，FT 表达后经韧皮部到顶端，启动 LFY、AP1 等。", "Arabidopsis: FLC represses FT; cold silences FLC via the VRN complex, so FT is made, travels in the phloem and switches on LFY, AP1 and others at the apex.", "Arabidopsis: FLC menindas FT; sejuk menyenyapkan FLC melalui kompleks VRN, jadi FT dibuat, bergerak dalam floem dan menghidupkan LFY, AP1 dan lain-lain di apeks.")]),
 E("grafting", 27, ("说明嫁接实验怎样证明成花信号存在。", "Describe how grafting experiments demonstrate a flowering signal.", "Terangkan bagaimana eksperimen cantuman menunjukkan isyarat pembungaan."),
   [("叶片感受光周期：诱导过的叶子嫁接到未诱导的植株，受体开花；离体紫苏叶经短日处理再接回，长日下也开花。", "Leaves perceive photoperiod: an induced leaf grafted to an uninduced plant makes it flower; detached Perilla leaves given short days and grafted back induce flowering in long days.", "Daun mengesan fotoperiod: daun yang diaruh dicantum pada tumbuhan tidak diaruh menjadikannya berbunga; daun Perilla yang dipotong, diberi hari pendek dan dicantum semula mengaruh pembungaan dalam hari panjang."),
    ("苍耳串联靠接：只诱导第一株，整串开花——信号可跨嫁接口一株传一株。", "Xanthium chain grafts: induce only the first and all flower — the signal crosses graft unions plant to plant.", "Cantuman rantai Xanthium: aruh hanya yang pertama dan semuanya berbunga — isyarat merentasi sambungan cantuman dari tumbuhan ke tumbuhan."),
    ("烟草（短日）× 天仙子（长日）：任一方在自己的诱导条件下，都能让对方在“错误”的光周期下开花——信号在生理上相同（Chailakhyan 称为成花素）。", "Tobacco (SD) × henbane (LD): either partner under its inductive conditions makes the other flower in the ‘wrong’ photoperiod — the signal is physiologically equivalent (Chailakhyan’s florigen).", "Tembakau (HP) × henbane (HPj): mana-mana pasangan dalam keadaan aruhannya menjadikan yang lain berbunga dalam fotoperiod ‘salah’ — isyaratnya setara secara fisiologi (florigen Chailakhyan)."),
    ("今天认为成花素是 FT 蛋白：CO 在叶脉伴胞诱导 FT，FT 经韧皮部移动。", "Today florigen is taken to be FT protein, induced by CO in leaf companion cells and moving in the phloem.", "Kini florigen dianggap protein FT, diaruh oleh CO dalam sel rakan daun dan bergerak dalam floem.")]),
 E("water-potential", 1, ("说明水势及其组成，并解释水在细胞间怎样移动。", "Explain water potential and its components, and how water moves between cells.", "Terangkan keupayaan air dan komponennya, dan bagaimana air bergerak antara sel."),
   [("Ψ = Ψp + Ψs（+ Ψm）；纯水在常压下 Ψ = 0。", "Ψ = Ψp + Ψs (+ Ψm); pure water at atmospheric pressure has Ψ = 0.", "Ψ = Ψp + Ψs (+ Ψm); air tulen pada tekanan atmosfera mempunyai Ψ = 0."),
    ("Ψs = −CiRT，总是 ≤ 0；Ψp 在活细胞中是正的膨压，木质部中可为负。", "Ψs = −CiRT, always ≤ 0; Ψp is positive turgor in living cells and can be negative in xylem.", "Ψs = −CiRT, sentiasa ≤ 0; Ψp ialah turgor positif dalam sel hidup dan boleh negatif dalam xilem."),
    ("水从 Ψ 高流向 Ψ 低；方向只看总 Ψ。", "Water flows from high to low Ψ; only total Ψ decides direction.", "Air mengalir dari Ψ tinggi ke rendah; hanya Ψ jumlah menentukan arah."),
    ("高渗溶液 → 质壁分离；初始质壁分离时 Ψ = Ψs。水通道蛋白只加快速度。", "Hypertonic solution → plasmolysis; at incipient plasmolysis Ψ = Ψs. Aquaporins only speed things up.", "Larutan hipertonik → plasmolisis; pada plasmolisis permulaan Ψ = Ψs. Akuaporin hanya mempercepat.")]),
 E("c4-cam", 15, ("比较 C₃、C₄ 与 CAM 光合作用。", "Compare C₃, C₄ and CAM photosynthesis.", "Bandingkan fotosintesis C₃, C₄ dan CAM."),
   [("C₃：rubisco 直接固定，第一个产物 3-PGA；光呼吸明显；3 ATP + 2 NADPH/CO₂。", "C₃: rubisco fixes directly; first product 3-PGA; significant photorespiration; 3 ATP + 2 NADPH per CO₂.", "C₃: rubisco mengikat terus; hasil pertama 3-PGA; fotorespirasi ketara; 3 ATP + 2 NADPH per CO₂."),
    ("C₄：PEP 羧化酶在叶肉细胞固定成 OAA，四碳酸运到维管束鞘脱羧给 rubisco（空间分隔、花环结构）；光呼吸极少、WUE 高、最适温度高；5 ATP + 2 NADPH/CO₂；PPDK 怕冷。", "C₄: PEPcase fixes into OAA in mesophyll; the C₄ acid is decarboxylated for rubisco in the bundle sheath (spatial separation, Kranz anatomy); little photorespiration, high WUE, high temperature optimum; 5 ATP + 2 NADPH per CO₂; PPDK is cold-labile.", "C₄: PEPcase mengikat menjadi OAA dalam mesofil; asid C₄ dinyahkarboksil untuk rubisco dalam seludang berkas (pemisahan ruang, anatomi Kranz); sedikit fotorespirasi, WUE tinggi, suhu optimum tinggi; 5 ATP + 2 NADPH per CO₂; PPDK labil sejuk."),
    ("CAM：夜里开气孔、PEP 羧化酶固定成苹果酸存在液泡；白天关气孔脱羧给卡尔文循环（时间分隔、同一细胞）；最省水但长得慢。", "CAM: stomata open at night, PEPcase fixes CO₂ into malate stored in the vacuole; by day, stomata shut, it is decarboxylated for the Calvin cycle (temporal separation, same cell); most water-thrifty but slow-growing.", "CAM: stoma terbuka pada waktu malam, PEPcase mengikat CO₂ menjadi malat yang disimpan dalam vakuol; pada siang hari, stoma tertutup, ia dinyahkarboksil untuk kitaran Calvin (pemisahan masa, sel sama); paling jimat air tetapi tumbuh perlahan.")]),
 E("z-scheme", 7, ("画出并说明光合电子传递（Z 形图）与光合磷酸化。", "Draw and explain photosynthetic electron transport (the Z-scheme) and photophosphorylation.", "Lukis dan terangkan pengangkutan elektron fotosintetik (skema Z) dan fotofosforilasi."),
   [("H₂O →（OEC，Mn₄）P680 → Pheo → QA → PQ（QB 位点）→ 细胞色素 b₆f → PC → P700 → A₀ → FeS → Fd → FNR → NADPH。", "H₂O → (OEC, Mn₄) P680 → Pheo → QA → PQ (QB site) → cytochrome b₆f → PC → P700 → A₀ → FeS → Fd → FNR → NADPH.", "H₂O → (OEC, Mn₄) P680 → Pheo → QA → PQ (tapak QB) → sitokrom b₆f → PC → P700 → A₀ → FeS → Fd → FNR → NADPH."),
    ("每个 O₂ 需 4 e⁻、8 个光子；非循环每 2 e⁻ 送 6 H⁺ 进腔（水 2、Q 循环 4），3 H⁺/ATP。", "Each O₂ needs 4 e⁻ and 8 photons; non-cyclic flow moves 6 H⁺ per 2 e⁻ into the lumen (2 from water, 4 from the Q-cycle); 3 H⁺ per ATP.", "Setiap O₂ memerlukan 4 e⁻ dan 8 foton; aliran tak berkitar memindahkan 6 H⁺ bagi setiap 2 e⁻ ke lumen (2 daripada air, 4 daripada kitaran Q); 3 H⁺ setiap ATP."),
    ("循环电子传递只产 ATP；DCMU 阻断 QB，百草枯在 PSI 抢电子。", "Cyclic flow makes only ATP; DCMU blocks QB, paraquat steals electrons at PSI.", "Aliran berkitar hanya membuat ATP; DCMU menyekat QB, parakuat mencuri elektron di PSI.")]),
]

(DATA / "hormones.json").write_text(json.dumps(tidy(hormones), ensure_ascii=False, indent=1) + "\n")
(DATA / "essays.json").write_text(json.dumps(tidy(ESSAYS), ensure_ascii=False, indent=1) + "\n")
print(f"hormones: {len(ROWS)} rows; essays: {len(ESSAYS)}")
