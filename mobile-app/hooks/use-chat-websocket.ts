// hooks/use-chat-websocket.ts

import { useEffect, useCallback } from "react";
import { chatWs } from "@/services/chatService";
import type { WsFrame } from "@/types/chat";

/**
 * Hook kết nối WebSocket chat và lắng nghe event.
 * Tự động connect khi mount, disconnect khi unmount.
 */
export function useChatWebSocket(onFrame: (frame: WsFrame) => void) {
  useEffect(() => {
    chatWs.connect();
    const unsub = chatWs.addListener(onFrame);
    return () => {
      unsub();
      chatWs.disconnect();
    };
  }, []);
}

/** Hook chỉ lắng nghe – không tự connect (dùng trong màn conversation list) */
export function useChatListener(onFrame: (frame: WsFrame) => void) {
  useEffect(() => {
    const unsub = chatWs.addListener(onFrame);
    return unsub;
  }, [onFrame]);
}
