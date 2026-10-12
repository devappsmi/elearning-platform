import { describe, expect, test } from "vitest";
import { alignReading, readingOfRange, readingText, toHiragana } from "./reading-align";
import { romajiToReading } from "./romaji";

const align = (jp: string, romaji: string) => alignReading(jp, romajiToReading(romaji));
const kana = (jp: string, romaji: string): string | null => {
  const segments = align(jp, romaji);
  return segments ? readingText(segments) : null;
};

describe("toHiragana", () => {
  test("katakana -> hiragana; hiragana, kanji, dan ー tidak berubah", () => {
    expect(toHiragana("ホワイトボード漢字ひら")).toBe("ほわいとぼーど漢字ひら");
  });
});

describe("alignReading", () => {
  test("kanji mengambil bacaannya, kana tetap kana asli", () => {
    const segments = align("会議が始めている", "kaigi ga hajimete iru");
    expect(segments?.map((s) => [s.jp, s.reading])).toEqual([
      ["会議", "かいぎ"],
      ["が", "が"],
      ["始", "はじ"],
      ["め", "め"],
      ["て", "て"],
      ["い", "い"],
      ["る", "る"],
    ]);
    expect(readingText(segments ?? [])).toBe("かいぎがはじめている");
  });

  test("は dibaca わ, を dibaca お, へ dibaca え: partikel tetap tertulis seperti di tulisan Jepang", () => {
    expect(kana("彼は店へ行って、水を飲む", "kare wa mise e itte, mizu o nomu")).toBe("かれはみせへいって、みずをのむ");
    expect(kana("これはペンです", "kore wa pen desu")).toBe("これはペンです");
  });

  test("tanda baca Jepang berpasangan dengan koma/titik romaji sebagai jangkar (memisahkan kanji bersebelahan)", () => {
    expect(kana("今、会議が始まります。", "Ima, kaigi ga hajimarimasu.")).toBe("いま、かいぎがはじまります。");
  });

  test("tanda baca hanya di salah satu sisi tidak menggagalkan penyelarasan", () => {
    expect(kana("雨が降ります", "Ame ga furimasu.")).toBe("あめがふります");
    expect(kana("雨が降ります。", "Ame ga furimasu")).toBe("あめがふります。");
  });

  test("katakana tetap katakana; ー boleh cocok dengan vokal panjang romaji", () => {
    expect(kana("ケーキが好きです", "kēki ga suki desu")).toBe("ケーキがすきです");
    expect(kana("ケーキが好きです", "keeki ga suki desu")).toBe("ケーキがすきです");
  });

  test("づ/ず dan ぢ/じ dianggap sama karena romaji tidak membedakannya", () => {
    expect(kana("続く", "tsuzuku")).toBe("つずく");
    expect(kana("つづく", "tsuzuku")).toBe("つづく");
  });

  test("kata asing di romaji (bukan romaji) mewakili deretan katakana", () => {
    expect(kana("チェックインが午後三時から", "Check in ga gogo sanji kara")).toBe("チェックインがごごさんじから");
  });

  test("angka ikut sebagai deretan kanji", () => {
    expect(kana("５日までに", "itsuka made ni")).toBe("いつかまでに");
  });

  test("romaji yang tak cocok dengan kana di tulisan Jepang -> null (salah ketik terdeteksi, tak ditebak)", () => {
    expect(align("高くて", "takakuite")).toBeNull();
    expect(align("イベントは", "ibentou wa")).toBeNull();
  });

  test("bacaan yang kurang atau berlebih -> null", () => {
    expect(align("会議が始まる", "kaigi ga")).toBeNull();
    expect(align("会議が", "kaigi ga hajimaru")).toBeNull();
  });

  test("kanji tanpa bacaan sama sekali -> null", () => {
    expect(align("会議が", "ga")).toBeNull();
  });
});

describe("readingOfRange", () => {
  const jp = "ちょうど今、会議が始めているところです。";
  const segments = align(jp, "Choudo ima, kaigi ga hajimete iru tokoro desu.") ?? [];

  test("bacaan untuk potongan yang jatuh di batas segmen", () => {
    expect(readingOfRange(segments, 0, jp.indexOf("、") + 1)).toBe("ちょうどいま、");
    const start = jp.indexOf("会議");
    expect(readingOfRange(segments, start, start + 3)).toBe("かいぎが");
    expect(readingOfRange(segments, jp.indexOf("ところ"), jp.length)).toBe("ところです。");
  });

  test("batas yang memotong satu deretan kanji -> null (bacaan deretan kanji tak bisa dibelah)", () => {
    const run = align("毎日残業が", "mainichi zan’gyou ga") ?? [];
    expect(readingOfRange(run, 0, 2)).toBeNull();
    expect(readingOfRange(run, 0, 4)).toBe("まいにちざんぎょう");
  });
});
