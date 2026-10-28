import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isRequestAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

// Entrega al navegador un permiso temporal para subir el archivo directo a Vercel Blob
// (así no aplica el límite de 4.5 MB de las funciones).
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await isRequestAuthenticated(req))) throw new Error("No has iniciado sesión.");
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 50 * 1024 * 1024,
        };
      },
      // El registro del documento lo hace el navegador al terminar (/api/documentos/registrar).
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
