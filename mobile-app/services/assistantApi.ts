import { apiClient } from './apiClient';

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

export async function sendAssistantMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    const response = await apiClient.post<ChatResponse>('/assistant/chat', {
        message,
        conversationId,
    });
    return response;
}
