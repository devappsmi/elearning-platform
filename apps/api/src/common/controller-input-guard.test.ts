import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as classValidator from "class-validator";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

// Penjaga statis untuk kegagalan yang DIAM-DIAM (docs/PLAN.md bagian 6e):
// `ValidationPipe` hanya memvalidasi parameter yang bertipe CLASS ber-dekorator
// class-validator. `@Body() body: { name: string }`, `@Body() dto: SomeInterface`
// atau `@Body("name") name: string` LOLOS TANPA VALIDASI APA PUN -- tanpa error,
// tanpa peringatan, dan terlihat benar di kode. Audit ini membaca SEMUA
// controller dengan compiler TypeScript dan memastikan tiap `@Body()`/`@Query()`:
//   1. bertipe class DTO (bukan interface / tipe literal / any);
//   2. setiap properti DTO-nya punya minimal satu dekorator class-validator
//      (`whitelist` + `forbidNonWhitelisted` akan menolak field tanpa dekorator);
//   3. properti `@ValidateNested` bertipe class DTO juga dan punya `@Type`
//      (tanpa itu class-transformer tidak membuat instance dan validasi bersarang gagal).
// Kalau tes ini gagal untuk endpoint BARU: buat DTO class + dekoratornya, jangan
// dilonggarkan. Dekorator diperiksa lewat NAMA (semua ekspor class-validator).

const VALIDATOR_DECORATORS = new Set(Object.keys(classValidator));

function decoratorName(decorator: ts.Decorator): string | undefined {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) return expression.expression.text;
  if (ts.isIdentifier(expression)) return expression.text;
  return undefined;
}

function textOf(node: ts.Node): string {
  return node.getText(node.getSourceFile());
}

function elementTypeNode(node: ts.TypeNode): ts.TypeNode {
  if (ts.isArrayTypeNode(node)) return node.elementType;
  if (ts.isTypeReferenceNode(node) && textOf(node.typeName) === "Array" && node.typeArguments?.[0]) return node.typeArguments[0];
  return node;
}

export function auditControllerInputs(program: ts.Program, controllerFiles: readonly string[]): string[] {
  const checker = program.getTypeChecker();
  const violations: string[] = [];
  const audited = new Set<ts.ClassDeclaration>();

  const classOf = (type: ts.Type): ts.ClassDeclaration | undefined => type.getSymbol()?.declarations?.find(ts.isClassDeclaration);

  function auditClass(declaration: ts.ClassDeclaration, trail: string): void {
    if (audited.has(declaration)) return;
    audited.add(declaration);
    const className = declaration.name?.text ?? "(anonim)";

    for (const member of declaration.members) {
      if (!ts.isPropertyDeclaration(member)) continue;
      if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) continue;
      const property = textOf(member.name);
      const names = (ts.getDecorators(member) ?? []).map(decoratorName);

      if (!names.some((name) => name !== undefined && VALIDATOR_DECORATORS.has(name))) {
        violations.push(`${trail}: ${className}.${property} tidak punya dekorator class-validator (field ini akan ditolak pipe)`);
        continue;
      }
      if (!names.includes("ValidateNested")) continue;

      if (!names.includes("Type")) violations.push(`${trail}: ${className}.${property} pakai @ValidateNested tanpa @Type(() => ...)`);
      const nested = member.type ? classOf(checker.getTypeFromTypeNode(elementTypeNode(member.type))) : undefined;
      if (nested) auditClass(nested, `${trail} -> ${className}.${property}`);
      else violations.push(`${trail}: ${className}.${property} pakai @ValidateNested tapi tipenya bukan class DTO`);
    }
  }

  for (const file of controllerFiles) {
    const source = program.getSourceFile(file);
    if (!source) {
      violations.push(`${file}: tidak ditemukan oleh compiler`);
      continue;
    }
    for (const node of source.statements) {
      if (!ts.isClassDeclaration(node) || !(ts.getDecorators(node) ?? []).some((d) => decoratorName(d) === "Controller")) continue;
      const controller = node.name?.text ?? "(anonim)";

      for (const method of node.members.filter(ts.isMethodDeclaration)) {
        for (const parameter of method.parameters) {
          for (const decorator of ts.getDecorators(parameter) ?? []) {
            const kind = decoratorName(decorator);
            if (kind !== "Body" && kind !== "Query") continue;
            const where = `${controller}.${textOf(method.name)}`;

            if (ts.isCallExpression(decorator.expression) && decorator.expression.arguments.length > 0) {
              violations.push(`${where}: @${kind}("...") mengambil satu properti mentah -- tidak divalidasi, pakai DTO class`);
              continue;
            }
            const type = checker.getTypeAtLocation(parameter);
            const dto = classOf(type);
            if (!dto) {
              violations.push(`${where}: @${kind}() bertipe '${checker.typeToString(type)}', bukan class DTO -- tidak divalidasi`);
              continue;
            }
            auditClass(dto, where);
          }
        }
      }
    }
  }
  return violations;
}

// ------------------------------------------------------------ program ----

function controllersUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return controllersUnder(path);
    return entry.name.endsWith(".controller.ts") ? [path] : [];
  });
}

function realProgram(): { program: ts.Program; controllers: string[] } {
  const srcDir = resolve(__dirname, "..");
  const configPath = ts.findConfigFile(srcDir, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) throw new Error("tsconfig.json apps/api tidak ditemukan");
  const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, dirname(configPath));
  const controllers = controllersUnder(srcDir);
  return { program: ts.createProgram({ rootNames: controllers, options: { ...parsed.options, noEmit: true } }), controllers };
}

const FIXTURE_FILE = "/virtual/fixture.controller.ts";

/** Program dari satu file di memori -- fixture sengaja mandiri (dekorator
 * dideklarasikan lokal); audit membaca dekorator lewat NAMA, bukan asalnya. */
function fixtureProgram(body: string): { program: ts.Program; controllers: string[] } {
  const source = `
    declare function Controller(path?: string): ClassDecorator;
    declare function Post(path?: string): MethodDecorator;
    declare function Body(...args: unknown[]): ParameterDecorator;
    declare function Query(...args: unknown[]): ParameterDecorator;
    declare function IsString(): PropertyDecorator;
    declare function IsOptional(): PropertyDecorator;
    declare function ValidateNested(options?: unknown): PropertyDecorator;
    declare function Type(fn: () => unknown): PropertyDecorator;
    ${body}
  `;
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    experimentalDecorators: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...rest) =>
    name === FIXTURE_FILE ? ts.createSourceFile(name, source, languageVersion, true) : getSourceFile(name, languageVersion, ...rest);
  host.fileExists = (name) => name === FIXTURE_FILE || ts.sys.fileExists(name);
  host.readFile = (name) => (name === FIXTURE_FILE ? source : ts.sys.readFile(name));
  return { program: ts.createProgram({ rootNames: [FIXTURE_FILE], options, host }), controllers: [FIXTURE_FILE] };
}

const audit = (body: string) => {
  const { program, controllers } = fixtureProgram(body);
  return auditControllerInputs(program, controllers);
};

// -------------------------------------------------------------- tests ----

describe("auditControllerInputs (self-test: penjaga ini sendiri harus terbukti mendeteksi)", () => {
  const goodDto = `class GoodDto { @IsString() name!: string; @IsOptional() @IsString() note?: string; }`;

  it("controller dengan DTO class ber-dekorator -> tidak ada pelanggaran", () => {
    expect(audit(`${goodDto} @Controller("x") class C { @Post() a(@Body() dto: GoodDto) {} @Post() b(@Query() q: GoodDto) {} }`)).toEqual([]);
  });

  it("DTO bersarang lengkap (@ValidateNested + @Type + class) -> lolos", () => {
    const source = `
      class Item { @IsString() ref!: string; }
      class Outer { @ValidateNested() @Type(() => Item) items!: Item[]; }
      @Controller("x") class C { @Post() a(@Body() dto: Outer) {} }`;

    expect(audit(source)).toEqual([]);
  });

  it("@Body() bertipe literal inline -> dilaporkan", () => {
    const violations = audit(`@Controller("x") class C { @Post() a(@Body() body: { name: string }) {} }`);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("C.a");
    expect(violations[0]).toContain("bukan class DTO");
  });

  it("@Body() bertipe interface -> dilaporkan", () => {
    const violations = audit(`interface Payload { name: string } @Controller("x") class C { @Post() a(@Body() body: Payload) {} }`);

    expect(violations.join("\n")).toContain("bukan class DTO");
  });

  it("@Query() bertipe any -> dilaporkan", () => {
    expect(audit(`@Controller("x") class C { @Post() a(@Query() q: any) {} }`).join("\n")).toContain("bukan class DTO");
  });

  it('@Body("field") (ambil properti mentah) -> dilaporkan', () => {
    const violations = audit(`@Controller("x") class C { @Post() a(@Body("name") name: string) {} }`);

    expect(violations.join("\n")).toContain("properti mentah");
  });

  it("properti DTO tanpa dekorator class-validator -> dilaporkan dengan nama properti", () => {
    const violations = audit(`class Sloppy { @IsString() name!: string; forgotten!: string; } @Controller("x") class C { @Post() a(@Body() d: Sloppy) {} }`);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("Sloppy.forgotten");
  });

  it("dekorator non-validator (@Type saja) tidak dihitung sebagai validasi", () => {
    const violations = audit(`class D { @Type(() => String) name!: string; } @Controller("x") class C { @Post() a(@Body() d: D) {} }`);

    expect(violations.join("\n")).toContain("D.name");
  });

  it("@ValidateNested tanpa @Type -> dilaporkan", () => {
    const source = `
      class Item { @IsString() ref!: string; }
      class Outer { @ValidateNested() items!: Item[]; }
      @Controller("x") class C { @Post() a(@Body() dto: Outer) {} }`;

    expect(audit(source).join("\n")).toContain("tanpa @Type");
  });

  it("DTO di DALAM properti bersarang ikut diaudit", () => {
    const source = `
      class Item { @IsString() ref!: string; missing!: string; }
      class Outer { @ValidateNested() @Type(() => Item) items!: Item[]; }
      @Controller("x") class C { @Post() a(@Body() dto: Outer) {} }`;

    expect(audit(source).join("\n")).toContain("Item.missing");
  });

  it("@ValidateNested pada tipe yang bukan class -> dilaporkan", () => {
    const source = `
      interface Item { ref: string }
      class Outer { @ValidateNested() @Type(() => Object) items!: Item[]; }
      @Controller("x") class C { @Post() a(@Body() dto: Outer) {} }`;

    expect(audit(source).join("\n")).toContain("bukan class DTO");
  });

  it("properti static dan parameter non-Body/Query diabaikan", () => {
    const source = `
      declare function Param(name: string): ParameterDecorator;
      class D { static helper = 1; @IsString() name!: string; }
      @Controller("x") class C { @Post() a(@Param("id") id: string, @Body() d: D) {} }`;

    expect(audit(source)).toEqual([]);
  });

  it("class yang bukan @Controller diabaikan", () => {
    expect(audit(`class NotController { @Post() a(@Body() body: { x: 1 }) {} }`)).toEqual([]);
  });
});

describe("controller API sungguhan", () => {
  it("semua @Body()/@Query() bertipe class DTO yang seluruh propertinya berdekorator", { timeout: 120_000 }, () => {
    const { program, controllers } = realProgram();

    // Sanity: audit benar-benar menemukan controller (bukan lolos karena tidak melihat apa pun).
    expect(controllers.length).toBeGreaterThanOrEqual(10);

    expect(auditControllerInputs(program, controllers)).toEqual([]);
  });
});
