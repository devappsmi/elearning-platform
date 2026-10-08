import { strToU8, zipSync } from "fflate";
import { describe, expect, test } from "vitest";
import { DocxReadError, readDocxParagraphs } from "./docx-reader";

function docx(bodyXml: string, extraParts: Record<string, string> = {}): Uint8Array {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;
  const files: Record<string, Uint8Array> = { "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(document) };
  for (const [name, content] of Object.entries(extraParts)) files[name] = strToU8(content);
  return zipSync(files);
}

const run = (text: string): string => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;

describe("readDocxParagraphs", () => {
  test("membaca teks tiap paragraf berurutan, menyambung run dalam satu paragraf", () => {
    const xml = `<w:p>${run("Kaigi ga ")}${run("hajimarimasu")}</w:p><w:p><w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr>${run("会議が始まります")}</w:p>`;
    expect(readDocxParagraphs(docx(xml))).toEqual(["Kaigi ga hajimarimasu", "会議が始まります"]);
  });

  test("tab menjadi \\t, jeda baris menjadi \\n", () => {
    const xml = `<w:p>${run("N4")}<w:r><w:tab/></w:r>${run("Unit 3")}<w:r><w:br/></w:r>${run("baris dua")}<w:r><w:br w:type="page"/></w:r></w:p>`;
    expect(readDocxParagraphs(docx(xml))).toEqual(["N4\tUnit 3\nbaris dua\n"]);
  });

  test("entitas XML (&amp; &lt; &#x...; &#...;) didekode", () => {
    const xml = `<w:p>${run("A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos; &#x3042; &#12356;")}</w:p>`;
    expect(readDocxParagraphs(docx(xml))).toEqual([`A & B <c> "d" 'e' あ い`]);
  });

  test("paragraf kosong (termasuk swa-tutup) tetap dikembalikan sebagai string kosong, tanpa menelan paragraf sesudahnya", () => {
    const xml = `<w:p/><w:p w:rsidR="00A1"/><w:p>${run("isi")}</w:p><w:p><w:pPr/></w:p>`;
    expect(readDocxParagraphs(docx(xml))).toEqual(["", "", "isi", ""]);
  });

  test("teks furigana (<w:rt>) dan teks yang dihapus lewat lacak perubahan tidak ikut; teks sisipan ikut", () => {
    const xml =
      `<w:p><w:r><w:ruby><w:rt><w:r><w:t>かいぎ</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>会議</w:t></w:r></w:rubyBase></w:ruby></w:r>` +
      `<w:del><w:r><w:delText>dihapus</w:delText></w:r></w:del><w:ins><w:r><w:t>disisipkan</w:t></w:r></w:ins></w:p>`;
    expect(readDocxParagraphs(docx(xml))).toEqual(["会議disisipkan"]);
  });

  test("simbol Word (angka lingkaran) yang disimpan sebagai mc:AlternateContent terbaca dari teks cadangannya", () => {
    const xml =
      `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="w16se"><w16se:symEx w16se:font="MS Gothic" w16se:char="2460"/></mc:Choice>` +
      `<mc:Fallback><w:t>①</w:t></mc:Fallback></mc:AlternateContent></w:r>${run(" ・ Hajimeru")}</w:p>`;
    expect(readDocxParagraphs(docx(xml))).toEqual(["① ・ Hajimeru"]);
  });

  test("bukan zip -> DocxReadError yang jelas", () => {
    expect(() => readDocxParagraphs(strToU8("bukan zip"))).toThrow(DocxReadError);
  });

  test("zip tanpa word/document.xml -> DocxReadError yang menyebut berkasnya", () => {
    const zip = zipSync({ "readme.txt": strToU8("halo") });
    expect(() => readDocxParagraphs(zip)).toThrow(/word\/document\.xml tidak ditemukan/);
  });
});
