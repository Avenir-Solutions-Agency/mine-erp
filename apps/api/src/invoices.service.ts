import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { InvoiceDto } from "@mine-erp/contracts";
import {
  assignByHandwriting,
  fillerToString,
  invoiceStoragePath,
  toFiller,
} from "@mine-erp/domain/invoices";
import type { Actor } from "./auth.ts";
import { InvoiceExtractor } from "./extract.ts";
import { ApiError } from "./http.ts";
import { type InvoiceRow, InvoicesRepository } from "./invoices.repository.ts";
import { Storage } from "./storage.ts";

/** Detects the type from the first bytes; the client's Content-Type is not trusted. */
export function sniffType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-")
    return { mime: "application/pdf", ext: "pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: "image/png", ext: "png" };
  return null;
}

export function toDto(i: InvoiceRow): InvoiceDto {
  return {
    id: i.id,
    supplier: i.supplier,
    supplierTaxNumber: i.supplierTaxNumber,
    number: i.number,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    paymentMethod: i.paymentMethod,
    category: i.category,
    currency: i.currency,
    net: fillerToString(i.net),
    vat: fillerToString(i.vat),
    gross: fillerToString(i.gross),
    handwriting: i.handwriting,
    warning: i.warning,
    status: i.status,
    costCarrier: i.costCarrier,
    fileName: i.fileName,
    createdAt: i.createdAt.toISOString(),
    lines: i.lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: fillerToString(l.unitPrice),
      net: fillerToString(l.net),
      vatRate: l.vatRate,
      gross: fillerToString(l.gross),
    })),
  };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repo: InvoicesRepository,
    private readonly extractor: InvoiceExtractor,
    private readonly storage: Storage,
  ) {}

  async upload(
    file: { buffer: Buffer; originalname: string },
    actor: Actor,
  ): Promise<InvoiceDto> {
    const type = sniffType(file.buffer);
    if (!type)
      throw new ApiError(
        422,
        "unsupported_file",
        "Csak PDF, JPG vagy PNG tölthető fel.",
      );
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    if (await this.repo.idBySha(sha256))
      throw new ApiError(409, "duplicate", "Ez a számla már fel van töltve.");

    const {
      result: x,
      model,
      promptVersion,
    } = await this.extractor
      .extract(file.buffer, file.originalname, type.mime)
      .catch(() => {
        throw new ApiError(
          502,
          "extraction_failed",
          "A számla kiolvasása nem sikerült, próbálja újra.",
        );
      });
    const carriers = (await this.repo.carriers()).map((c) => c.name);
    const decision = x
      ? assignByHandwriting({
          handwriting: x.handwriting,
          issueDate: x.issueDate,
          gross: x.gross,
          carriers,
        })
      : {
          status: "needs_review" as const,
          costCarrier: null,
          warning: "Az AI nem tudta kiolvasni a számlát.",
        };

    const filePath = invoiceStoragePath(x?.issueDate ?? null, sha256, type.ext);
    await this.storage.upload(filePath, file.buffer, type.mime);
    const id = await this.repo.create(
      {
        supplier: x?.supplier ?? null,
        supplierTaxNumber: x?.supplierTaxNumber ?? null,
        number: x?.number ?? null,
        issueDate: x?.issueDate ?? null,
        dueDate: x?.dueDate ?? null,
        paymentMethod: x?.paymentMethod ?? null,
        category: x?.category ?? null,
        currency: x?.currency ?? "HUF",
        net: toFiller(x?.net ?? null),
        vat: toFiller(x?.vat ?? null),
        gross: toFiller(x?.gross ?? null),
        handwriting: x?.handwriting ?? null,
        warning: decision.warning,
        status: decision.status,
        costCarrier: decision.costCarrier,
        fileSha256: sha256,
        filePath,
        fileName: file.originalname.slice(0, 200),
        fileMime: type.mime,
        extraction: { model, promptVersion, result: x },
      },
      (x?.lines ?? []).map((l, position) => ({
        position,
        name: l.name,
        quantity: l.quantity == null ? null : String(l.quantity),
        unit: l.unit,
        unitPrice: toFiller(l.unitPrice),
        net: toFiller(l.net),
        vatRate: l.vatRate == null ? null : Math.round(l.vatRate),
        gross: toFiller(l.gross),
      })),
      actor,
    );
    return (await this.get(id))!;
  }

  async list(): Promise<InvoiceDto[]> {
    return (await this.repo.list(200)).map(toDto);
  }

  async get(id: string): Promise<InvoiceDto | null> {
    const [row] = await this.repo.list(1, [id]);
    return row ? toDto(row) : null;
  }

  async fileUrl(id: string): Promise<string> {
    const [row] = await this.repo.list(1, [id]);
    if (!row) throw new ApiError(404, "not_found", "A számla nem található.");
    return this.storage.signedUrl(row.filePath);
  }

  carriers() {
    return this.repo.carriers();
  }

  /** The carrier must exist in master data; the client's text is not trusted. */
  async assign(
    id: string,
    costCarrier: string | null,
    actor: Actor,
  ): Promise<InvoiceDto> {
    if (
      costCarrier &&
      !(await this.repo.carriers()).some((c) => c.name === costCarrier)
    )
      throw new ApiError(422, "unknown_carrier", "Ismeretlen költségviselő.");
    if (!(await this.repo.assign(id, costCarrier, actor)))
      throw new ApiError(404, "not_found", "A számla nem található.");
    return (await this.get(id))!;
  }
}
