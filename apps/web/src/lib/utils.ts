import { createCn } from "cn/config";

// The demo type tokens (globals.css @theme) are font sizes; without this, cn drops them next to a text colour.
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: ["h1", "h2", "control", "label"] }] },
  },
});
