import { z } from "zod";
const GetFocusRoomResponse = z.object({
  id: z.string(),
  name: z.string(),
}).and(z.object({
  participants: z.array(z.string())
}));

const r = { id: "1", name: "test", participants: ["A", "B"], extra: "drop me" };
console.log("Parsed:", GetFocusRoomResponse.parse(r));
