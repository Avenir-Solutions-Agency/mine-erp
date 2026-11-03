import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { FirstWeighingInput, VoidWeighingInput } from "@mine-erp/contracts";
import {
  type Actor,
  AuthGuard,
  CurrentActor,
  Access,
  read,
  write,
} from "./auth.ts";
import { ApiError } from "./http.ts";
import { WeighingsService } from "./weighings.service.ts";

@Controller("weighings")
@UseGuards(AuthGuard)
export class WeighingsController {
  constructor(private readonly weighings: WeighingsService) {}

  @Get()
  @Access(read("scale"))
  async list() {
    return { data: await this.weighings.list() };
  }

  @Post()
  @Access(write("scale"))
  async first(@Body() body: unknown, @CurrentActor() actor: Actor) {
    const input = FirstWeighingInput.safeParse(body);
    if (!input.success)
      throw new ApiError(
        400,
        "invalid_input",
        "Hibás adatok (rendszám kötelező).",
      );
    return { data: await this.weighings.first(input.data, actor) };
  }

  @Get(":id/ticket")
  @Access(read("scale", "transport"))
  async ticket(@Param("id", new ParseUUIDPipe()) id: string) {
    const { number, pdf } = await this.weighings.ticket(id);
    return new StreamableFile(pdf, {
      type: "application/pdf",
      disposition: `inline; filename="${number}.pdf"`,
    });
  }

  @Post(":id/second")
  @Access(write("scale"))
  async second(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return { data: await this.weighings.second(id, actor) };
  }

  @Post(":id/void")
  @Access(write("scale"))
  async void(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    const input = VoidWeighingInput.safeParse(body);
    if (!input.success)
      throw new ApiError(400, "invalid_input", "A sztornóhoz indoklás kell.");
    return { data: await this.weighings.void(id, input.data.reason, actor) };
  }
}
