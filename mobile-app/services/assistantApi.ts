import { apiClient } from "./apiClient";
import EventSource from "react-native-sse";

export interface SuggestedProduct {
  id: number;
  name: string;
  description: string;
  thumbnail: string;
  price: number;
  stock: number;
  rating: number;
  reviewCount: number;
  brand: string;
  sellerName: string;
}

export interface AssistantAction {
  type: string;
  label: string;
  targetId: string;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  suggestedProducts: SuggestedProduct[];
  actions: AssistantAction[];
}

export interface ChatStreamResponse {
  conversationId: string;
  textChunk: string;
  suggestedProducts?: SuggestedProduct[];
  actions?: AssistantAction[];
  isDone: boolean;
}

export async function sendAssistantMessage(
  message: string,
  conversationId?: string,
): Promise<ChatResponse> {
  const response = await apiClient.post<ChatResponse>("/assistant/chat", {
    message,
    conversationId,
  });
  return response;
}

export async function sendAssistantMessageStream(
  message: string,
  conversationId: string | undefined,
  onChunk: (text: string) => void,
  onDone: (
    suggestedProducts: SuggestedProduct[] | undefined,
    actions: AssistantAction[] | undefined,
  ) => void,
  onError: (error: any) => void,
) {
  const token = await apiClient.getToken();
  const baseUrl = apiClient.getBaseUrl();
  let closed = false;
  let hasMeaningfulChunk = false;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const es = new EventSource(`${baseUrl}/assistant/chat/stream`, {
    headers,
    method: "POST",
    body: JSON.stringify({ message, conversationId }),
    lineEndingCharacter: "\n",
  });

  const closeStream = () => {
    if (!closed) {
      closed = true;
      es.close();
    }
  };

  const fallbackToSingleResponse = async (streamError: any) => {
    try {
      const fallback = await sendAssistantMessage(message, conversationId);
      if (fallback.answer) {
        onChunk(fallback.answer);
      }
      onDone(fallback.suggestedProducts, fallback.actions);
    } catch (fallbackError) {
      onError(fallbackError || streamError);
    }
  };

  es.addEventListener("message", (event) => {
    if (closed) {
      return;
    }
    if (event.data) {
      try {
        const data: ChatStreamResponse = JSON.parse(event.data);
        if (data.textChunk) {
          if (!data.textChunk.startsWith("⏳")) {
            hasMeaningfulChunk = true;
          }
          onChunk(data.textChunk);
        }
        if (data.isDone) {
          onDone(data.suggestedProducts, data.actions);
          closeStream();
        }
      } catch (err) {
        console.error("Error parsing stream chunk", err);
      }
    }
  });

  es.addEventListener("error", async (event) => {
    if (closed) {
      return;
    }
    closeStream();
    if (!hasMeaningfulChunk) {
      await fallbackToSingleResponse(event);
      return;
    }
    onError(event);
  });
}
