import { describe, expect, test } from "vitest";
import { romajiToReading, romajiWordToHiragana, UNKNOWN_READING } from "./romaji";

describe("romajiWordToHiragana", () => {
  test.each([
    ["kaigi", "かいぎ"],
    ["Hajimeru", "はじめる"],
    ["choudo", "ちょうど"],
    ["shuppatsu", "しゅっぱつ"],
    ["tsuzuku", "つずく"],
    ["jyuubun", "じゅうぶん"],
    ["kaijyou", "かいじょう"],
    ["kanojyo", "かのじょ"],
    ["hikkoshi", "ひっこし"],
    ["hatsubai", "はつばい"],
    ["fu", "ふ"],
    ["chuushi", "ちゅうし"],
    ["ryouri", "りょうり"],
    ["otoshimasu", "おとします"],
  ])("%s -> %s", (romaji, kana) => {
    expect(romajiWordToHiragana(romaji)).toBe(kana);
  });

  test("ejaan Nihon-shiki yang lazim (si, ti, tu, hu, zi, sya, tya)", () => {
    expect(romajiWordToHiragana("site")).toBe("して");
    expect(romajiWordToHiragana("tikara")).toBe("ちから");
    expect(romajiWordToHiragana("tuzuku")).toBe("つずく");
    expect(romajiWordToHiragana("huru")).toBe("ふる");
    expect(romajiWordToHiragana("syukudai")).toBe("しゅくだい");
    expect(romajiWordToHiragana("tyotto")).toBe("ちょっと");
  });

  test("ん: akhir kata, sebelum konsonan, n' + vokal, dan nn", () => {
    expect(romajiWordToHiragana("hon")).toBe("ほん");
    expect(romajiWordToHiragana("kanpai")).toBe("かんぱい");
    expect(romajiWordToHiragana("zan’gyou")).toBe("ざんぎょう");
    expect(romajiWordToHiragana("tai'ou")).toBe("たいおう");
    expect(romajiWordToHiragana("kin'en")).toBe("きんえん");
    expect(romajiWordToHiragana("konnichiwa")).toBe("こんにちわ");
    expect(romajiWordToHiragana("shinnen")).toBe("しんねん");
    expect(romajiWordToHiragana("nyuuin")).toBe("にゅういん");
  });

  test("konsonan ganda -> っ (termasuk tch)", () => {
    expect(romajiWordToHiragana("kitte")).toBe("きって");
    expect(romajiWordToHiragana("zasshi")).toBe("ざっし");
    expect(romajiWordToHiragana("matchi")).toBe("まっち");
  });

  test("vokal bermakron menjadi vokal + ー", () => {
    expect(romajiWordToHiragana("supōtsu")).toBe("すぽーつ");
    expect(romajiWordToHiragana("rūru")).toBe("るーる");
    expect(romajiWordToHiragana("kēki")).toBe("けーき");
    expect(romajiWordToHiragana("Howaitobōdo")).toBe("ほわいとぼーど");
    expect(romajiWordToHiragana("pasuwādo")).toBe("ぱすわーど");
  });

  test("ejaan yang melenceng (paswādo tanpa u) tidak ditebak: null", () => {
    expect(romajiWordToHiragana("paswādo")).toBeNull();
  });

  test("bunyi serapan (fa, fi, je, che)", () => {
    expect(romajiWordToHiragana("purojekuto")).toBe("ぷろじぇくと");
    expect(romajiWordToHiragana("fain")).toBe("ふぁいん");
    expect(romajiWordToHiragana("chekku")).toBe("ちぇっく");
  });

  test("bukan romaji -> null (huruf yang tak ada di Jepang, atau kosong)", () => {
    expect(romajiWordToHiragana("check")).toBeNull();
    expect(romajiWordToHiragana("TV")).toBeNull();
    expect(romajiWordToHiragana("lamp")).toBeNull();
    expect(romajiWordToHiragana("")).toBeNull();
    expect(romajiWordToHiragana("'")).toBeNull();
  });
});

describe("romajiToReading", () => {
  test("kata dirapatkan, spasi hilang", () => {
    expect(romajiToReading("Kaigi ga hajimete iru tokoro desu")).toBe("かいぎがはじめているところです");
  });

  test("koma, titik, tanda seru dan tanya dipertahankan sebagai 、。！？ (jangkar penyelarasan)", () => {
    expect(romajiToReading("Choudo ima, kaigi ga hajimarimasu.")).toBe("ちょうどいま、かいぎがはじまります。");
    expect(romajiToReading("Ame desu ka? Hai!")).toBe("あめですか？はい！");
    // Tanda baca beruntun hanya sekali.
    expect(romajiToReading("Hai,, desu..")).toBe("はい、です。");
  });

  test("tanda baca lain (kurung, tanda kutip, garis miring) dibuang", () => {
    expect(romajiToReading('(sore) "kaigi" / desu')).toBe("それかいぎです");
  });

  test("kata yang bukan romaji jadi penanda tak-dikenal, beruntun digabung satu", () => {
    expect(romajiToReading("Check in ga gogo sanji kara")).toBe(`${UNKNOWN_READING}いんがごごさんじから`);
    expect(romajiToReading("TV wo miru")).toBe(`${UNKNOWN_READING}をみる`);
  });

  test("huruf lebar penuh dibakukan (NFKC) dan apostrof melengkung dikenali", () => {
    expect(romajiToReading("Ｋａｉｇｉ")).toBe("かいぎ");
    expect(romajiToReading("Tai’ou suru")).toBe("たいおうする");
  });
});
