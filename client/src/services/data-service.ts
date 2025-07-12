// Data service layer - handles all data operations
import { apiRequest } from "@/lib/queryClient";
import { APP_CONFIG } from "@/config/app-config";
import { MOCK_SUBJECTS, MOCK_CHAT_SESSIONS } from "@/data/mock-data";

export class DataService {


  static async firebaseLogin(email: string, name: string, avatar: string, firebaseUid: string) {
    try {
      const response = await apiRequest("POST", APP_CONFIG.api.endpoints.auth.login, {
        email,
        name,
        avatar,
        firebaseUid,
      });
      return await response.json();
    } catch (error) {
      console.error("Firebase login error:", error);
      throw error;
    }
  }

  // Subject services
  static async getSubjects() {
    try {
      const response = await fetch(APP_CONFIG.api.endpoints.subjects);
      return await response.json();
    } catch (error) {
      console.error("Failed to get subjects, using mock data:", error);
      return { subjects: MOCK_SUBJECTS };
    }
  }

  // Chat services
  static async getChatSessions(userId?: number) {
    try {
      let url = APP_CONFIG.api.endpoints.chat.sessions;
      if (userId) {
        url += `/${userId}`;
      }
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Failed to get chat sessions, using mock data:", error);
      return { sessions: MOCK_CHAT_SESSIONS };
    }
  }

  static async createChatSession(sessionData: any) {
    try {
      const response = await apiRequest("POST", APP_CONFIG.api.endpoints.chat.sessions, sessionData);
      return await response.json();
    } catch (error) {
      console.error("Failed to create chat session:", error);
      throw error;
    }
  }

  static async getChatMessages(sessionId: number) {
    try {
      const response = await fetch(`${APP_CONFIG.api.endpoints.chat.messages}/${sessionId}`);
      return await response.json();
    } catch (error) {
      console.error("Failed to get chat messages:", error);
      return { messages: [] };
    }
  }

  static async sendChatMessage(messageData: any) {
    try {
      const response = await apiRequest("POST", APP_CONFIG.api.endpoints.chat.send, messageData);
      return await response.json();
    } catch (error) {
      console.error("Failed to send chat message:", error);
      throw error;
    }
  }

  static async deleteChatSession(sessionId: number) {
    try {
      const response = await apiRequest("DELETE", `/api/chat/sessions/${sessionId}`, {});
      return await response.json();
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      throw error;
    }
  }

}