/**
 * VERIFIKASI SEMENTARA — pratinjau visual semua tipe slide (V3 renderer).
 * Menulis file HTML ke _ppt_sample/preview/ untuk screenshot manual.
 */
import { describe, it } from "vitest";
import { resolveSubjectTheme } from "@/lib/export/ppt-html/theme";
import { renderSlideToHtml, wrapHtmlForPreview } from "@/lib/export/ppt-html/slide-html";
import {
  PresentationModel,
  CoverSlide,
  HookStatementSlide,
  ObjectivesSlide,
  ContentSlide,
  CardsGridSlide,
  SplitColumnSlide,
  StoryConceptSlide,
  TakeawaySlide,
  ReflectionOrQuizSlide,
} from "@/lib/export/ppt/ppt-types";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const metadata = {
  title: "Peredaran Darah Manusia",
  schoolName: "SMP Negeri 1 Contoh",
  subjectName: "IPA",
  teacherName: "Bapak Guru",
  className: "VIII-B",
  dateFormatted: "12 September 2025",
};

function buildModel(subjectName: string): PresentationModel {
  const meta = { ...metadata, subjectName };
  const slides: PresentationModel["slides"] = [
    {
      id: "s1", type: "COVER", title: "Peredaran Darah: **Sungai Kehidupan** di Dalam Tubuh Kita",
      topic: "Memahami komponen darah, jantung, dan peredaran besar-kecil",
      schoolName: meta.schoolName, subjectName: meta.subjectName, teacherName: meta.teacherName,
      className: meta.className, dateFormatted: meta.dateFormatted,
      slideNumber: 1, totalSlides: 9,
    } as CoverSlide,
    {
      id: "s2", type: "HOOK_STATEMENT", title: "Pertanyaan Pemantik",
      statement: "Mengapa berhenti **5 detik** saja, jantungmu sudah memberi alarm?",
      supportingText: "Coba rasakan denyut nadimu sekarang. Berapa kali jantungmu berdetak sejak pagi tadi?",
      categoryLabel: "💡 PERTANYAAN PEMANTIK",
      slideNumber: 2, totalSlides: 9,
    } as HookStatementSlide,
    {
      id: "s3", type: "OBJECTIVES", title: "Tujuan Pembelajaran",
      objectives: [
        "Mengidentifikasi komponen penyusun darah manusia",
        "Menjelaskan alur peredaran darah besar dan kecil",
        "Menghubungkan gaya hidup sehat dengan kinerja jantung",
      ],
      categoryLabel: "🎯 CAPAIAN PEMBELAJARAN",
      slideNumber: 3, totalSlides: 9,
    } as ObjectivesSlide,
    {
      id: "s4", type: "CONTENT", title: "Komponen Penyusun Darah", sectionTitle: "Komponen Penyusun Darah",
      items: [
        { text: "**Plasma darah** (55%) — cairan pengangkut nutrisi dan sisa metabolisme", subpoints: ["90% air", "Zat terlarut: protein, garam, hormon"] },
        { text: "**Sel darah merah** (eritrosit) — pengangkut oksigen berkat hemoglobin", subpoints: ["Bentuk bikonkaf memperluas permukaan", "Hidup sekitar 120 hari"] },
        { text: "**Sel darah putih & keping darah** — pertahanan tubuh dan pembekuan", subpoints: ["Leukosit: melawan infeksi", "Trombosit: menutup luka"] },
      ],
      visualPrompt: "Diagram empat komponen darah: plasma, sel darah merah berbentuk cakram, sel darah putih berinti besar, dan keping darah kecil, dengan zoom-in pada hemoglobin",
      slideNumber: 4, totalSlides: 9,
    } as ContentSlide,
    {
      id: "s5", type: "CARDS_GRID", title: "Tiga Pilar Sistem Peredaran",
      cards: [
        { title: "Jantung", text: "Pompa otot tak pernah lelah yang menggerakkan seluruh darah tubuh." },
        { title: "Pembuluh Darah", text: "Jaringan jalan raya: arteri, vena, dan kapiler." },
        { title: "Darah", text: "Armada pengangkut oksigen, nutrisi, dan pertahanan tubuh." },
      ],
      categoryLabel: "🏛️ PILAR & ASPEK UTAMA",
      slideNumber: 5, totalSlides: 9,
    } as CardsGridSlide,
    {
      id: "s6", type: "SPLIT_COLUMN", title: "Perbandingan: Arteri vs Vena",
      leftColumnTitle: "Arteri", leftColumnItems: ["Membawa darah keluar jantung", "Dinding tebal & elastis", "Tekanan darah tinggi"],
      rightColumnTitle: "Vena", rightColumnItems: ["Membawa darah kembali ke jantung", "Dinding lebih tipis", "Ada katup satu arah"],
      categoryLabel: "⚖️ PERBANDINGAN & ANALISIS",
      slideNumber: 6, totalSlides: 9,
    } as SplitColumnSlide,
    {
      id: "s7", type: "STORY_CONCEPT", title: "Kisah Perjalanan Sel Darah Merah",
      coreMessage: "Satu sel darah merah menempuh perjalanan penuh mengelilingi tubuhmu hanya dalam **60 detik**.",
      supportingPoints: ["Berangkat dari jantung ke paru-paru mengambil oksigen", "Kembali ke jantung lalu diterjunkan ke seluruh tubuh", "Menyerahkan oksigen, mengambil CO2, dan kembali lagi"],
      categoryLabel: "📖 KISAH & HIKMAH",
      visualPrompt: "Peta perjalanan sel darah merah melingkar dari jantung ke paru-paru lalu ke seluruh tubuh dengan panah alur",
      slideNumber: 7, totalSlides: 9,
    } as StoryConceptSlide,
    {
      id: "s8", type: "REFLECTION_OR_QUIZ", title: "Kuis Cepat Pemahaman", sectionTitle: "Kuis Cepat", isQuiz: true,
      questions: ["Sebutkan tiga komponen darah dan tugas masing-masing!", "Mengapa dinding arteri lebih tebal daripada vena?", "Apa peran hemoglobin dalam peredaran darah?"],
      slideNumber: 8, totalSlides: 9,
    } as ReflectionOrQuizSlide,
    {
      id: "s9", type: "TAKEAWAY", title: "Rangkuman Inti", sectionTitle: "Rangkuman",
      takeaways: ["Darah terdiri atas plasma, eritrosit, leukosit, dan trombosit", "Peredaran besar mengalirkan darah ke seluruh tubuh, kecil ke paru-paru", "Gaya hidup sehat menjaga jantung bekerja optimal"],
      slideNumber: 9, totalSlides: 9,
    } as TakeawaySlide,
  ];
  return { metadata: meta, slides };
}

describe("Preview V3 slides", () => {
  it("menulis pratinjau HTML semua tipe slide", () => {
    const outDir = path.resolve(process.cwd(), "_ppt_sample/preview");
    mkdirSync(outDir, { recursive: true });

    for (const subject of ["IPA", "Matematika"]) {
      const theme = resolveSubjectTheme(subject);
      const model = buildModel(subject);
      // 1x transparent px as fake illustration data URL for image-path preview
      const fakeImage =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#065f46"/><circle cx="200" cy="160" r="90" fill="#f87171"/><circle cx="200" cy="280" r="60" fill="#60a5fa"/><path d="M60 200 Q200 40 340 200" stroke="#fbbf24" stroke-width="14" fill="none"/></svg>'
        );
      model.slides.forEach((slide, i) => {
        const useFake = slide.type === "CONTENT" && subject === "IPA";
        const html = wrapHtmlForPreview(renderSlideToHtml(slide, theme, model.metadata, useFake ? fakeImage : undefined));
        writeFileSync(path.join(outDir, `${subject.toLowerCase().replace(/\s/g, "")}-${String(i + 1).padStart(2, "0")}-${slide.type}.html`), html);
      });
    }
    console.log("Preview files written to _ppt_sample/preview/");
  });
});
