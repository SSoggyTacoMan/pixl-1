// Link-preview card for /shop/<id>: public item data only (lib/og/cards.ts).
import { OG_SIZE, pngResponse, shopItemCard } from "@/lib/og/cards";

export const alt = "A Pixl shop item";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return pngResponse(await shopItemCard(id));
}
