import { expect, test } from "vitest";
import { CustomerInput, ProductInput } from "./index.ts";

test("empty optional fields become null", () => {
  const input = { name: "Út Kft.", taxNumber: "", address: "" };

  const parsed = CustomerInput.parse(input);

  expect(parsed).toEqual({ name: "Út Kft.", taxNumber: null, address: null });
});

test("a malformed tax number or VTSZ is rejected", () => {
  const results = [
    CustomerInput.safeParse({ name: "Út Kft.", taxNumber: "123" }).success,
    ProductInput.safeParse({ name: "22/63", vtsz: "25a7" }).success,
    CustomerInput.safeParse({ name: "Út Kft.", taxNumber: "12345678-2-42" })
      .success,
    ProductInput.safeParse({ name: "22/63", vtsz: "2517" }).success,
  ];

  expect(results).toEqual([false, false, true, true]);
});
