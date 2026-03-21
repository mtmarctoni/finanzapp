import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  streamText,
  stepCountIs,
  type UIMessage,
  convertToModelMessages,
} from "ai";
import { aiModel } from "@/lib/ai/config";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  createFinanceEntryTool,
  getRecentEntriesTool,
  getSpendingByCategoryTool,
  getTotalByPeriodTool,
} from "@/lib/ai/tools";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { messages } = body as { messages: UIMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return new Response("Se requiere un array de 'messages'.", {
        status: 400,
      });
    }

    const tools = {
      createFinanceEntry: createFinanceEntryTool(userId),
      getRecentEntries: getRecentEntriesTool(userId),
      getSpendingByCategory: getSpendingByCategoryTool(userId),
      getTotalByPeriod: getTotalByPeriodTool(userId),
    };

    const modelMessages = await convertToModelMessages(messages, { tools });

    const result = streamText({
      model: aiModel,
      system: CHAT_SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("chat route error:", error);
    return new Response("Error interno del servidor.", { status: 500 });
  }
}
