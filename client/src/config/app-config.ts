// App configuration - separated from code for easy modification
export const APP_CONFIG = {
  // API endpoints
  api: {
    baseUrl: '/api',
    endpoints: {
      auth: {
        login: '/api/auth/login',
        getUser: '/api/user'
      },
      subjects: '/api/subjects',
      chat: {
        sessions: '/api/chat/sessions',
        messages: '/api/chat/messages',
        send: '/api/chat/send'
      }
    }
  },

  // App constants
  app: {
    name: 'AI Học tập',
    description: 'Cùng bạn chinh phục kỳ thi Đánh giá năng lực 2025',
    tagline: 'Chỉ cần 1 phút, thức chuyển trò ngay',
    examDate: '2025-06-26', // Exam date
  },



  // Default themes and settings
  defaults: {
    theme: 'light',
    gptModel: 'gpt-4o'
  }
};