import { buildReceiptPdf, getReceiptData, receiptNo } from "@/lib/receipt";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReceiptData(Number(id));
  if (!data) return new Response("Recibo no encontrado", { status: 404 });
  const pdf = await buildReceiptPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-${receiptNo(data.payment.receiptNumber)}.pdf"`,
    },
  });
}
