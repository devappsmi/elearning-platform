import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { createValidationPipe } from "./validation";
import { AdminLoginDto, AdminRefreshDto } from "../admin-auth/dto/admin-auth.dto";
import { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from "../admin-classes/dto/class.dto";
import { CreateInvitationDto, ListInvitationsQueryDto } from "../admin-invitations/dto/invitation.dto";
import { ListStudentsQueryDto, UpdateStudentDto } from "../admin-students/dto/update-student.dto";
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto, ValidateInvitationDto } from "../auth/dto/auth.dto";
import { SearchDictionaryQueryDto } from "../dictionary/dto/search-dictionary.dto";
import { ReviewFlashcardDto } from "../flashcards/dto/review-flashcard.dto";
import { AnswerEventDto, SubmitAttemptDto } from "../lessons/dto/submit-attempt.dto";
import { SubmitScenarioAttemptDto } from "../scenarios/dto/submit-scenario-attempt.dto";
import { UpdateMeDto } from "../users/dto/update-me.dto";

// Kontrak setiap DTO request terhadap pipe GLOBAL (docs/PLAN.md bagian 6e).
// Sebelum pipe itu dinyalakan, tak satu pun aturan di bawah ini pernah
// dijalankan -- jadi ini sekaligus tes pertama untuk dekorator DTO itu sendiri.
//
// Payload yang diharapkan LOLOS disusun persis seperti yang dikirim frontend
// (rujukan file di tiap blok), supaya DTO yang terlalu ketat -- yang akan
// memecahkan UI -- ketahuan di sini, bukan di browser. Tipe TypeScript dari
// api-client menjamin BENTUK; tes ini menjamin BATAS NILAI (enum, panjang,
// bilangan bulat) dan penolakan field tak dikenal.
//
// `metatype` diberikan manual: vitest (esbuild) tidak menghasilkan
// `design:paramtypes` yang di runtime sungguhan mengisinya dari tipe parameter.

const pipe = createValidationPipe();

type Kind = "body" | "query";

function validate<T extends object>(metatype: new () => T, value: unknown, type: Kind = "body"): Promise<T> {
  return pipe.transform(value, { type, metatype }) as Promise<T>;
}

/** Pesan validasi (JSON) dari penolakan 400; gagal kalau ternyata lolos. */
async function rejected(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return JSON.stringify((error as BadRequestException).getResponse());
  }
  throw new Error("Validasi seharusnya menolak payload ini, tapi lolos");
}

// ------------------------------------------------------------------ auth ----

describe("auth DTO", () => {
  const registerBody = { token: "tok-undangan", name: "Budi Santoso", password: "Abcdef12" };

  describe("RegisterDto", () => {
    it("payload sah lolos", async () => {
      await expect(validate(RegisterDto, registerBody)).resolves.toMatchObject(registerBody);
    });

    it("nama dipangkas dari spasi tepi", async () => {
      const dto = await validate(RegisterDto, { ...registerBody, name: "  Budi  " });

      expect(dto.name).toBe("Budi");
    });

    it.each(["", "   ", "\n\t "])("nama kosong/spasi saja (%j) ditolak", async (name) => {
      expect(await rejected(validate(RegisterDto, { ...registerBody, name }))).toContain("name");
    });

    // AC AUTH-02: min. 8 karakter, huruf + angka. Sebelum pipe menyala, register
    // dengan password "a" sukses (201) dan bisa login -- dibuktikan lewat API hidup.
    // Dua aturan berbeda dengan pesan berbeda: `@MinLength(8)` (pesan bawaan,
    // memuat nama field) dan `@Matches` huruf+angka (pesan Indonesia kustom).
    it.each([
      ["satu karakter", "a", "password must be longer"],
      ["tujuh karakter", "abcde12", "password must be longer"],
      ["tanpa angka", "abcdefgh", "Password harus mengandung huruf dan angka"],
      ["tanpa huruf", "12345678", "Password harus mengandung huruf dan angka"],
      ["kosong", "", "password must be longer"],
    ])("password %s ditolak", async (_label, password, message) => {
      expect(await rejected(validate(RegisterDto, { ...registerBody, password }))).toContain(message);
    });

    it("pesan penolakan kebijakan password berbahasa Indonesia", async () => {
      expect(await rejected(validate(RegisterDto, { ...registerBody, password: "abcdefgh" }))).toContain("Password harus mengandung huruf dan angka");
    });

    it.each(["abcdefg1", "Password 1", "kata sandi ke-2"])("password sah (%j) lolos, spasi TIDAK dipangkas", async (password) => {
      const dto = await validate(RegisterDto, { ...registerBody, password });

      expect(dto.password).toBe(password);
    });

    it("password dengan spasi tepi tidak diubah", async () => {
      const dto = await validate(RegisterDto, { ...registerBody, password: "  abcdefg1  " });

      expect(dto.password).toBe("  abcdefg1  ");
    });

    // classId + email HARUS berasal dari Invitation yang divalidasi server
    // (docs/PLAN.md bagian 4), bukan dari body.
    it.each(["classId", "email", "status", "institutionId"])("field %s di body ditolak (tidak boleh dari client)", async (field) => {
      expect(await rejected(validate(RegisterDto, { ...registerBody, [field]: "apa-saja" }))).toContain(field);
    });

    it("token wajib", async () => {
      expect(await rejected(validate(RegisterDto, { name: "Budi", password: "Abcdef12" }))).toContain("token");
    });
  });

  describe("ResetPasswordDto", () => {
    it("payload sah lolos", async () => {
      await expect(validate(ResetPasswordDto, { token: "t", password: "Abcdef12" })).resolves.toBeDefined();
    });

    it.each([
      ["a", "password must be longer"],
      ["abcde12", "password must be longer"],
      ["abcdefgh", "Password harus mengandung huruf dan angka"],
      ["12345678", "Password harus mengandung huruf dan angka"],
    ])("password lemah (%j) ditolak", async (password, message) => {
      expect(await rejected(validate(ResetPasswordDto, { token: "t", password }))).toContain(message);
    });
  });

  describe("LoginDto (persis body LoginPage murid/admin)", () => {
    it("payload sah lolos", async () => {
      await expect(validate(LoginDto, { email: "e2e-student@example.com", password: "NewPassword456" })).resolves.toBeDefined();
    });

    it("email tidak valid ditolak", async () => {
      expect(await rejected(validate(LoginDto, { email: "bukan-email", password: "x" }))).toContain("email");
    });

    it("password wajib string", async () => {
      expect(await rejected(validate(LoginDto, { email: "a@example.com" }))).toContain("password");
      expect(await rejected(validate(LoginDto, { email: "a@example.com", password: 12345678 }))).toContain("password");
    });

    it("field tak dikenal ditolak", async () => {
      expect(await rejected(validate(LoginDto, { email: "a@example.com", password: "x", role: "admin" }))).toContain("role");
    });
  });

  it("RefreshDto: refreshToken wajib string", async () => {
    await expect(validate(RefreshDto, { refreshToken: "abc" })).resolves.toBeDefined();
    expect(await rejected(validate(RefreshDto, {}))).toContain("refreshToken");
    expect(await rejected(validate(RefreshDto, { refreshToken: 42 }))).toContain("refreshToken");
  });

  it("ForgotPasswordDto: email harus valid", async () => {
    await expect(validate(ForgotPasswordDto, { email: "a@example.com" })).resolves.toBeDefined();
    expect(await rejected(validate(ForgotPasswordDto, { email: "bukan-email" }))).toContain("email");
  });

  it("ValidateInvitationDto: token wajib string", async () => {
    await expect(validate(ValidateInvitationDto, { token: "abc" })).resolves.toBeDefined();
    expect(await rejected(validate(ValidateInvitationDto, {}))).toContain("token");
  });
});

// ----------------------------------------------------------------- users ----

// Rujukan: apps/student/src/pages/ProfilePage.tsx -> PATCH /me { name, dailyXpGoal }
describe("UpdateMeDto", () => {
  it("payload ProfilePage lolos", async () => {
    await expect(validate(UpdateMeDto, { name: "Budi", dailyXpGoal: 30 })).resolves.toMatchObject({ name: "Budi", dailyXpGoal: 30 });
  });

  it.each([10, 30, 50])("dailyXpGoal %i lolos", async (dailyXpGoal) => {
    await expect(validate(UpdateMeDto, { dailyXpGoal })).resolves.toMatchObject({ dailyXpGoal });
  });

  // Sebelum pipe menyala: PATCH /me {"dailyXpGoal":999} -> 200 dan tersimpan;
  // {"dailyXpGoal":"banyak"} -> 500.
  it.each([999, 0, 20, -10, 30.5, "30", "banyak"])("dailyXpGoal %j ditolak", async (dailyXpGoal) => {
    expect(await rejected(validate(UpdateMeDto, { dailyXpGoal }))).toContain("dailyXpGoal");
  });

  it("nama dipangkas; nama kosong/spasi saja ditolak", async () => {
    expect((await validate(UpdateMeDto, { name: "  Budi  " })).name).toBe("Budi");
    expect(await rejected(validate(UpdateMeDto, { name: "" }))).toContain("name");
    expect(await rejected(validate(UpdateMeDto, { name: "   " }))).toContain("name");
  });

  it("body kosong lolos (semua field opsional)", async () => {
    await expect(validate(UpdateMeDto, {})).resolves.toBeDefined();
  });

  it("avatarUrl harus URL; skema berbahaya ditolak", async () => {
    await expect(validate(UpdateMeDto, { avatarUrl: "https://example.com/a.png" })).resolves.toBeDefined();
    expect(await rejected(validate(UpdateMeDto, { avatarUrl: "bukan url" }))).toContain("avatarUrl");
    expect(await rejected(validate(UpdateMeDto, { avatarUrl: "javascript:alert(1)" }))).toContain("avatarUrl");
  });

  // MASS ASSIGNMENT -- dibuktikan sungguhan sebelum perbaikan: murid memindahkan
  // dirinya ke kelas lain dan mengganti emailnya tanpa verifikasi lewat PATCH /me.
  it.each(["classId", "email", "status", "passwordHash", "id", "lastActiveAt", "createdAt", "institutionId"])(
    "kolom internal %s TIDAK bisa dikirim lewat PATCH /me",
    async (field) => {
      expect(await rejected(validate(UpdateMeDto, { name: "Budi", [field]: "nilai-penyerang" }))).toContain(field);
    },
  );
});

// ----------------------------------------------------------------- admin ----

describe("admin DTO", () => {
  it("AdminLoginDto / AdminRefreshDto", async () => {
    await expect(validate(AdminLoginDto, { email: "e2e-admin@example.com", password: "AdminPass123" })).resolves.toBeDefined();
    expect(await rejected(validate(AdminLoginDto, { email: "bukan-email", password: "x" }))).toContain("email");
    await expect(validate(AdminRefreshDto, { refreshToken: "abc" })).resolves.toBeDefined();
    expect(await rejected(validate(AdminRefreshDto, {}))).toContain("refreshToken");
  });

  // Rujukan: apps/admin/src/pages/AdminClassesPage.tsx -> POST /admin/classes { name, description|undefined }
  describe("CreateClassDto", () => {
    it("payload AdminClassesPage lolos (dengan dan tanpa deskripsi)", async () => {
      await expect(validate(CreateClassDto, { name: "Kelas A", description: "Pagi" })).resolves.toBeDefined();
      await expect(validate(CreateClassDto, { name: "Kelas A" })).resolves.toBeDefined();
    });

    it("nama dipangkas; kosong/spasi saja ditolak; wajib ada", async () => {
      expect((await validate(CreateClassDto, { name: "  Kelas A " })).name).toBe("Kelas A");
      expect(await rejected(validate(CreateClassDto, { name: "   " }))).toContain("name");
      expect(await rejected(validate(CreateClassDto, {}))).toContain("name");
    });

    it("status tidak bisa dikirim saat membuat kelas (arsip punya endpoint sendiri)", async () => {
      expect(await rejected(validate(CreateClassDto, { name: "A", status: "ARCHIVED" }))).toContain("status");
    });
  });

  it("UpdateClassDto: kosong lolos, nama kosong ditolak, nama dipangkas", async () => {
    await expect(validate(UpdateClassDto, {})).resolves.toBeDefined();
    expect(await rejected(validate(UpdateClassDto, { name: "  " }))).toContain("name");
    expect((await validate(UpdateClassDto, { name: " Baru " })).name).toBe("Baru");
  });

  describe("ListClassesQueryDto (query string)", () => {
    it("status yang dikenal atau tanpa status lolos", async () => {
      await expect(validate(ListClassesQueryDto, {}, "query")).resolves.toBeDefined();
      await expect(validate(ListClassesQueryDto, { status: "ACTIVE" }, "query")).resolves.toBeDefined();
      await expect(validate(ListClassesQueryDto, { status: "ARCHIVED" }, "query")).resolves.toBeDefined();
    });

    it("status tak dikenal ditolak; string kosong juga (frontend mengirim `|| undefined`, bukan '')", async () => {
      expect(await rejected(validate(ListClassesQueryDto, { status: "DELETED" }, "query"))).toContain("status");
      expect(await rejected(validate(ListClassesQueryDto, { status: "" }, "query"))).toContain("status");
    });

    it("parameter query tak dikenal ditolak", async () => {
      expect(await rejected(validate(ListClassesQueryDto, { page: "2" }, "query"))).toContain("page");
    });
  });

  // Rujukan: apps/admin/src/pages/AdminInvitationsPage.tsx -> POST /admin/invitations { name, email, classId }
  describe("CreateInvitationDto", () => {
    const body = { name: "Murid Baru", email: "murid@example.com", classId: "kelas-1" };

    it("payload AdminInvitationsPage lolos", async () => {
      await expect(validate(CreateInvitationDto, body)).resolves.toMatchObject(body);
    });

    // Sebelum pipe menyala: tanpa `name` -> 500 (`Argument name is missing` dari Prisma).
    it.each(["name", "email", "classId"])("field wajib %s tidak boleh hilang (400, bukan 500)", async (field) => {
      const withoutField = Object.fromEntries(Object.entries(body).filter(([key]) => key !== field));

      expect(await rejected(validate(CreateInvitationDto, withoutField))).toContain(field);
    });

    it("email tidak valid ditolak; nama dipangkas dan tidak boleh spasi saja", async () => {
      expect(await rejected(validate(CreateInvitationDto, { ...body, email: "bukan-email" }))).toContain("email");
      expect((await validate(CreateInvitationDto, { ...body, name: "  Murid  " })).name).toBe("Murid");
      expect(await rejected(validate(CreateInvitationDto, { ...body, name: "  " }))).toContain("name");
    });

    it("token/status tidak bisa dikirim dari client", async () => {
      expect(await rejected(validate(CreateInvitationDto, { ...body, status: "ACCEPTED" }))).toContain("status");
      expect(await rejected(validate(CreateInvitationDto, { ...body, tokenHash: "x" }))).toContain("tokenHash");
    });
  });

  it("ListInvitationsQueryDto: filter status/classId", async () => {
    await expect(validate(ListInvitationsQueryDto, {}, "query")).resolves.toBeDefined();
    await expect(validate(ListInvitationsQueryDto, { status: "PENDING", classId: "kelas-1" }, "query")).resolves.toBeDefined();
    for (const status of ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]) {
      await expect(validate(ListInvitationsQueryDto, { status }, "query")).resolves.toBeDefined();
    }
    expect(await rejected(validate(ListInvitationsQueryDto, { status: "DIHAPUS" }, "query"))).toContain("status");
  });

  // Rujukan: AdminStudentDetailPage.tsx -> PATCH /admin/students/:id { classId } atau { status }
  describe("UpdateStudentDto", () => {
    it("payload AdminStudentDetailPage lolos", async () => {
      await expect(validate(UpdateStudentDto, { classId: "kelas-2" })).resolves.toBeDefined();
      await expect(validate(UpdateStudentDto, { status: "INACTIVE" })).resolves.toBeDefined();
      await expect(validate(UpdateStudentDto, { status: "ACTIVE" })).resolves.toBeDefined();
    });

    it("status di luar ACTIVE/INACTIVE ditolak", async () => {
      expect(await rejected(validate(UpdateStudentDto, { status: "DELETED" }))).toContain("status");
    });

    it.each(["email", "passwordHash", "name", "dailyXpGoal"])("kolom %s tidak bisa diubah lewat endpoint ini", async (field) => {
      expect(await rejected(validate(UpdateStudentDto, { classId: "kelas-2", [field]: "x" }))).toContain(field);
    });
  });

  it("ListStudentsQueryDto: filter classId saja", async () => {
    await expect(validate(ListStudentsQueryDto, { classId: "kelas-1" }, "query")).resolves.toBeDefined();
    expect(await rejected(validate(ListStudentsQueryDto, { classId: "kelas-1", status: "ACTIVE" }, "query"))).toContain("status");
  });
});

// --------------------------------------------------------------- learning ----

// Rujukan: apps/student/src/pages/LessonPage.tsx -> events { ref, kind:"choose", choiceText }
// dan { ref, kind:"assemble", tokens }.
describe("SubmitAttemptDto", () => {
  const choose = { ref: "l1_e1", kind: "choose", choiceText: "あ" };
  const assemble = { ref: "l1_e2", kind: "assemble", tokens: ["わたし", "は", "デヴ", "です"] };

  it("event choose + assemble persis seperti LessonPage lolos, menjadi instance bersarang", async () => {
    const dto = await validate(SubmitAttemptDto, { answers: [choose, assemble] });

    expect(dto.answers[0]).toBeInstanceOf(AnswerEventDto);
    expect(dto.answers).toHaveLength(2);
    expect(dto.answers[1]).toMatchObject({ ref: "l1_e2", kind: "assemble", tokens: assemble.tokens });
  });

  it("daftar jawaban kosong lolos DTO (service yang menolak 'belum semua dijawab')", async () => {
    await expect(validate(SubmitAttemptDto, { answers: [] })).resolves.toBeDefined();
  });

  it("answers wajib berupa array", async () => {
    expect(await rejected(validate(SubmitAttemptDto, {}))).toContain("answers");
    expect(await rejected(validate(SubmitAttemptDto, { answers: "choose" }))).toContain("answers");
  });

  it("kind hanya choose/assemble ('speak' sudah dihapus dari sistem)", async () => {
    expect(await rejected(validate(SubmitAttemptDto, { answers: [{ ref: "x", kind: "speak" }] }))).toContain("kind");
  });

  it("ref wajib string; choiceText/tokens harus bertipe benar", async () => {
    expect(await rejected(validate(SubmitAttemptDto, { answers: [{ kind: "choose", choiceText: "あ" }] }))).toContain("ref");
    expect(await rejected(validate(SubmitAttemptDto, { answers: [{ ref: "x", kind: "choose", choiceText: 5 }] }))).toContain("choiceText");
    expect(await rejected(validate(SubmitAttemptDto, { answers: [{ ref: "x", kind: "assemble", tokens: "abc" }] }))).toContain("tokens");
    expect(await rejected(validate(SubmitAttemptDto, { answers: [{ ref: "x", kind: "assemble", tokens: ["a", 2] }] }))).toContain("tokens");
  });

  // Penilaian SEPENUHNYA di server; client tidak boleh menyelipkan skor/flag benar.
  it.each(["correct", "score", "isCorrect", "stars", "xp"])("client tidak bisa menyelipkan %s di dalam event", async (field) => {
    expect(await rejected(validate(SubmitAttemptDto, { answers: [{ ...choose, [field]: true }] }))).toContain(field);
  });

  it.each(["score", "stars", "xp", "passed"])("client tidak bisa menyelipkan %s di level atas", async (field) => {
    expect(await rejected(validate(SubmitAttemptDto, { answers: [choose], [field]: 100 }))).toContain(field);
  });
});

// Rujukan: apps/student/src/pages/ConversationPage.tsx ->
// { mode: "TEST"|"PRACTICE", events: [{ lineIndex, optionIndex }], durationSec: Math.round(...) }
describe("SubmitScenarioAttemptDto", () => {
  const body = { mode: "TEST", events: [{ lineIndex: 1, optionIndex: 0 }, { lineIndex: 3, optionIndex: 2 }], durationSec: 42 };

  it("payload ConversationPage lolos", async () => {
    await expect(validate(SubmitScenarioAttemptDto, body)).resolves.toMatchObject(body);
    await expect(validate(SubmitScenarioAttemptDto, { ...body, mode: "PRACTICE" })).resolves.toBeDefined();
  });

  it("mode harus huruf besar PRACTICE/TEST", async () => {
    expect(await rejected(validate(SubmitScenarioAttemptDto, { ...body, mode: "practice" }))).toContain("mode");
    expect(await rejected(validate(SubmitScenarioAttemptDto, { ...body, mode: "EXAM" }))).toContain("mode");
  });

  it.each([1.5, -1, "42", null, undefined])("durationSec %j ditolak (harus bilangan bulat >= 0)", async (durationSec) => {
    expect(await rejected(validate(SubmitScenarioAttemptDto, { ...body, durationSec }))).toContain("durationSec");
  });

  it("durationSec 0 lolos", async () => {
    await expect(validate(SubmitScenarioAttemptDto, { ...body, durationSec: 0 })).resolves.toBeDefined();
  });

  it.each([
    ["lineIndex negatif", { lineIndex: -1, optionIndex: 0 }, "lineIndex"],
    ["lineIndex desimal", { lineIndex: 0.5, optionIndex: 0 }, "lineIndex"],
    ["optionIndex negatif", { lineIndex: 0, optionIndex: -1 }, "optionIndex"],
    ["optionIndex string", { lineIndex: 0, optionIndex: "1" }, "optionIndex"],
    ["field ekstra correct", { lineIndex: 0, optionIndex: 0, correct: true }, "correct"],
  ])("event %s ditolak", async (_label, event, field) => {
    expect(await rejected(validate(SubmitScenarioAttemptDto, { ...body, events: [event] }))).toContain(field);
  });

  it("events wajib array; skor tidak bisa dikirim dari client", async () => {
    expect(await rejected(validate(SubmitScenarioAttemptDto, { mode: "TEST", durationSec: 1 }))).toContain("events");
    expect(await rejected(validate(SubmitScenarioAttemptDto, { ...body, score: 100 }))).toContain("score");
  });
});

// Rujukan: apps/student/src/pages/FlashcardsPage.tsx -> POST /flashcards/review { itemId, correct }
describe("ReviewFlashcardDto", () => {
  it("payload FlashcardsPage lolos", async () => {
    await expect(validate(ReviewFlashcardDto, { itemId: "k_sha", correct: true })).resolves.toMatchObject({ itemId: "k_sha", correct: true });
    await expect(validate(ReviewFlashcardDto, { itemId: "k_sha", correct: false })).resolves.toBeDefined();
  });

  it("correct harus boolean sungguhan (bukan string 'true')", async () => {
    expect(await rejected(validate(ReviewFlashcardDto, { itemId: "k_sha", correct: "true" }))).toContain("correct");
    expect(await rejected(validate(ReviewFlashcardDto, { itemId: "k_sha", correct: 1 }))).toContain("correct");
  });

  it("itemId wajib; field tak dikenal ditolak", async () => {
    expect(await rejected(validate(ReviewFlashcardDto, { correct: true }))).toContain("itemId");
    expect(await rejected(validate(ReviewFlashcardDto, { itemId: "k_sha", correct: true, srsStage: 5 }))).toContain("srsStage");
  });
});

// Rujukan: apps/student/src/pages/KamusPage.tsx -> GET /dictionary?q=<trimmed, tidak pernah kosong>
describe("SearchDictionaryQueryDto (query string)", () => {
  it("q terisi lolos", async () => {
    await expect(validate(SearchDictionaryQueryDto, { q: "a" }, "query")).resolves.toMatchObject({ q: "a" });
  });

  it("q wajib dan tidak boleh kosong", async () => {
    expect(await rejected(validate(SearchDictionaryQueryDto, {}, "query"))).toContain("q");
    expect(await rejected(validate(SearchDictionaryQueryDto, { q: "" }, "query"))).toContain("q");
  });

  it("parameter query tak dikenal ditolak", async () => {
    expect(await rejected(validate(SearchDictionaryQueryDto, { q: "a", limit: "5" }, "query"))).toContain("limit");
  });
});
