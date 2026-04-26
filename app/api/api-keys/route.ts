import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { CreateApiKeySchema } from "@/lib/api-validation";
import { ZodError } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const apiKeys = await listApiKeys(session.user.id);
    return NextResponse.json({ data: apiKeys });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = CreateApiKeySchema.parse(body);
    const apiKey = await createApiKey(session.user.id, name);

    return NextResponse.json(
      {
        data: {
          id: apiKey.id,
          name: apiKey.name,
          is_active: apiKey.is_active,
          created_at: apiKey.created_at,
          updated_at: apiKey.updated_at,
          last_used_at: apiKey.last_used_at,
          plaintext: apiKey.plaintext,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation Error",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}
