// hooks/use-chat-websocket.ts

import { useEffect } from "react";

import { chatService } from "@/services/chatService";
import type { WsFrame } from "@/types/chat";

const attachChatSocket = (
  onFrame: (frame: WsFrame) => void,
  onOpen?: (send: (data: unknown) => void) => void,
) => {
  let cancelled = false;
  let socket: WebSocket | null = null;

  const send = (data: unknown) => {
    try {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    } catch {
      // ignore send errors
    }
  };

  void (async () => {
    const url = await chatService.getWebSocketUrl();
    if (cancelled) {
      return;
    }

    socket = new WebSocket(url);
    socket.onopen = () => {
      try {
        onOpen?.(send);
      } catch {
        // ignore
      }
    };
    socket.onmessage = (event) => {
      try {
        onFrame(JSON.parse(event.data) as WsFrame);
      } catch {
        // Ignore malformed frames.
      }
    };
  })();

  return () => {
    cancelled = true;
    socket?.close();
  };
};

export function useChatWebSocket(
  onFrame: (frame: WsFrame) => void,
  onOpen?: (send: (data: unknown) => void) => void,
) {
  useEffect(() => attachChatSocket(onFrame, onOpen), [onFrame, onOpen]);
}

export function useChatListener(
  onFrame: (frame: WsFrame) => void,
  onOpen?: (send: (data: unknown) => void) => void,
) {
  useEffect(() => attachChatSocket(onFrame, onOpen), [onFrame, onOpen]);
}
