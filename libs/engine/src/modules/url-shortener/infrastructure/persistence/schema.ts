import { pgTable, text, bigint } from "drizzle-orm/pg-core";

export const shortenedUrls = pgTable("shortened_urls", {
  code: text("code").primaryKey(),
  clickCount: bigint("click_count", { mode: "number" }).notNull().default(0),
  destination: text("destination").notNull(),
});
