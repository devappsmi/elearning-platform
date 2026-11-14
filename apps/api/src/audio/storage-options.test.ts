import { describe, expect, it } from "vitest";
import { createAudioStorage } from "./audio-storage";
import { LocalStorageService } from "./local-storage.service";
import { ObjectStorageService } from "./object-storage.service";
import { resolveStorageOptions, type StorageEnv } from "./storage-options";

const S3: StorageEnv = {
  S3_ENDPOINT: "http://storage:8333",
  S3_REGION: "us-east-1",
  S3_BUCKET: "audio-assets",
  S3_ACCESS_KEY_ID: "kunci",
  S3_SECRET_ACCESS_KEY: "rahasia",
};

describe("resolveStorageOptions -- driver local (bawaan)", () => {
  it("env kosong -> local, ./storage, dan alamat publik http://localhost:3001/media (pengembangan lokal)", () => {
    expect(resolveStorageOptions({})).toEqual({ driver: "local", localDir: "./storage", publicBaseUrl: "http://localhost:3001/media" });
  });

  it("alamat publik bawaan mengikuti PORT", () => {
    expect(resolveStorageOptions({ PORT: 4100 })).toMatchObject({ publicBaseUrl: "http://localhost:4100/media" });
    expect(resolveStorageOptions({ PORT: "4200" })).toMatchObject({ publicBaseUrl: "http://localhost:4200/media" });
  });

  it("memakai direktori dan alamat publik yang diberikan (garis miring akhir dibuang, spasi dipangkas)", () => {
    expect(resolveStorageOptions({ STORAGE_DRIVER: "local", STORAGE_LOCAL_DIR: " /data/media ", STORAGE_PUBLIC_BASE_URL: " https://app.contoh.id/media/// " })).toEqual({
      driver: "local",
      localDir: "/data/media",
      publicBaseUrl: "https://app.contoh.id/media",
    });
  });

  it("nilai kosong dari .env (`STORAGE_DRIVER=`) diperlakukan sebagai tidak diisi", () => {
    expect(resolveStorageOptions({ STORAGE_DRIVER: "", STORAGE_LOCAL_DIR: "", STORAGE_PUBLIC_BASE_URL: "" })).toMatchObject({ driver: "local", localDir: "./storage" });
  });

  it("variabel S3_* yang terisi tidak mengubah apa pun selama driver local", () => {
    expect(resolveStorageOptions({ ...S3 })).toMatchObject({ driver: "local" });
  });
});

describe("resolveStorageOptions -- driver s3 (untuk nanti)", () => {
  it("lengkap -> opsi s3; alamat publik opsional", () => {
    expect(resolveStorageOptions({ STORAGE_DRIVER: "s3", ...S3 })).toEqual({
      driver: "s3",
      endpoint: "http://storage:8333",
      region: "us-east-1",
      bucket: "audio-assets",
      accessKeyId: "kunci",
      secretAccessKey: "rahasia",
      publicBaseUrl: undefined,
    });
    expect(resolveStorageOptions({ STORAGE_DRIVER: "s3", ...S3, STORAGE_PUBLIC_BASE_URL: "https://cdn.contoh.id" })).toMatchObject({ publicBaseUrl: "https://cdn.contoh.id" });
  });

  it.each(["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const)("tanpa %s -> galat yang menyebut variabelnya", (name) => {
    expect(() => resolveStorageOptions({ STORAGE_DRIVER: "s3", ...S3, [name]: undefined })).toThrow(new RegExp(name));
    expect(() => resolveStorageOptions({ STORAGE_DRIVER: "s3", ...S3, [name]: "   " })).toThrow(new RegExp(name));
  });

  it("semua S3_* kosong -> galat menyebut kelimanya sekaligus", () => {
    expect(() => resolveStorageOptions({ STORAGE_DRIVER: "s3" })).toThrow(/S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY/);
  });
});

describe("resolveStorageOptions -- driver tak dikenal", () => {
  it("galat yang menyebut nilai dan pilihan yang sah", () => {
    expect(() => resolveStorageOptions({ STORAGE_DRIVER: "gcs" })).toThrow(/"gcs".*local, s3/);
  });
});

describe("createAudioStorage", () => {
  it("local -> LocalStorageService; s3 -> ObjectStorageService", () => {
    expect(createAudioStorage(resolveStorageOptions({}))).toBeInstanceOf(LocalStorageService);
    expect(createAudioStorage(resolveStorageOptions({ STORAGE_DRIVER: "s3", ...S3 }))).toBeInstanceOf(ObjectStorageService);
  });
});
