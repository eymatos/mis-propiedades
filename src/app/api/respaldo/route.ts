import { buildBackup, buildPaymentsCsv } from "@/lib/backup";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("formato");
  const today = todayISO();
  if (format === "csv") {
    return new Response(await buildPaymentsCsv(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pagos-${today}.csv"`,
      },
    });
  }
  return new Response(JSON.stringify(await buildBackup(), null, 1), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="respaldo-${today}.json"`,
    },
  });
}
