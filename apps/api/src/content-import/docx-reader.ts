import { strFromU8, unzipSync } from "fflate";

/** Pembaca teks berkas Word (.docx) -- cukup untuk template konten pengajar (paragraf teks biasa), TANPA dependensi
 * pengurai XML: .docx adalah zip, isinya `word/document.xml`, dan bentuk paragrafnya teratur (`<w:p>` berisi `<w:r>` berisi
 * `<w:t>`). Yang dibaca hanya TEKS; gaya, daftar bernomor, tabel, dan gambar diabaikan (tabel tetap terbaca sebagai paragraf
 * sel-selnya berurutan, tanpa batas sel). Teks furigana Word (`<w:rt>`) dibuang -- yang diambil huruf dasarnya. Teks yang
 * dihapus lewat "lacak perubahan" (`<w:delText>`) tidak ikut, yang disisipkan (`<w:ins>`) ikut. */

const DOCUMENT_PART = "word/document.xml";

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return XML_ENTITIES[body] ?? whole;
  });
}

// Satu paragraf: `<w:p>`/`<w:p ...>` sampai `</w:p>`, atau paragraf kosong swa-tutup `<w:p/>` (BUKAN `<w:pPr>`/`<w:pStyle>`:
// setelah `<w:p` wajib spasi, `/`, atau `>`).
const PARAGRAPH_RE = /<w:p(?:\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
// Isi paragraf yang membawa teks: teks, tab, dan jeda baris (jeda halaman pun jadi baris baru -- cukup untuk keperluan ini).
const TEXT_TOKEN_RE = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>|<w:cr\s*\/>/g;
const RUBY_TEXT_RE = /<w:rt>[\s\S]*?<\/w:rt>/g;

export class DocxReadError extends Error {}

/** Daftar paragraf (teks mentah: tab = "\t", jeda baris = "\n"), berurutan sesuai dokumen. Paragraf kosong ikut dikembalikan
 * sebagai "" -- penyaringannya urusan pemanggil. */
export function readDocxParagraphs(docx: Uint8Array): string[] {
  let parts: Record<string, Uint8Array>;
  try {
    parts = unzipSync(docx, { filter: (file) => file.name === DOCUMENT_PART });
  } catch (error) {
    throw new DocxReadError(`Bukan berkas .docx yang valid (gagal membuka zip): ${error instanceof Error ? error.message : String(error)}`);
  }
  const documentXml = parts[DOCUMENT_PART];
  if (!documentXml) throw new DocxReadError(`Bukan berkas .docx yang valid: ${DOCUMENT_PART} tidak ditemukan.`);

  const xml = strFromU8(documentXml);
  const paragraphs: string[] = [];
  for (const match of xml.matchAll(PARAGRAPH_RE)) {
    const body = (match[1] ?? "").replace(RUBY_TEXT_RE, "");
    let text = "";
    for (const token of body.matchAll(TEXT_TOKEN_RE)) {
      if (token[1] !== undefined) text += decodeXmlEntities(token[1]);
      else if (token[0].startsWith("<w:tab")) text += "\t";
      else text += "\n";
    }
    paragraphs.push(text);
  }
  return paragraphs;
}
