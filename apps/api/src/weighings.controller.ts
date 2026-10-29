import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { FirstWeighingInput, VoidWeighingInput } from "@mine-erp/contracts";
import { type Actor, AuthGuard, CurrentActor } from "./auth.ts";
import { ApiError } from "./http.ts";
import { WeighingsService } from "./weighings.service.ts";

@Controller("weighings")
@UseGuards(AuthGuard)
export class WeighingsController {
  constructor(private readonly weighings: WeighingsService) {}

  @Get()
  async list() {
    return { data: await this.weighings.list() };
  }

  @Post()
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

  @Post(":id/second")
  async second(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentActor() actor: Actor,
  ) {
    return { data: await this.weighings.second(id, actor) };
  }

  @Post(":id/void")
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
