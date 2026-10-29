import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AssignCarrierInput } from "@mine-erp/contracts";
import { type Actor, AuthGuard, CurrentActor, RateLimit } from "./auth.ts";
import { ApiError } from "./http.ts";
import { InvoicesService } from "./invoices.service.ts";

const uploads = new RateLimit(20, 60_000);

@Controller()
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get("invoices")
  async list() {
    return { data: await this.invoices.list() };
  }

  @Post("invoices")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentActor() actor: Actor,
  ) {
    uploads.check(actor.id);
    if (!file) throw new ApiError(400, "no_file", "Válasszon ki egy fájlt.");
    return { data: await this.invoices.upload(file, actor) };
  }

  @Get("invoices/:id/file")
  async file(@Param("id", new ParseUUIDPipe()) id: string) {
    return { data: { url: await this.invoices.fileUrl(id) } };
  }

  @Patch("invoices/:id/carrier")
  async assign(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = AssignCarrierInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "Hibás költségviselő.");
    return {
      data: await this.invoices.assign(id, input.data.costCarrier, actor),
    };
  }

  @Get("carriers")
  async carriers() {
    return { data: await this.invoices.carriers() };
  }
}
