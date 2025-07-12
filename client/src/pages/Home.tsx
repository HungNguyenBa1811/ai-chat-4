import { useState, useEffect } from "react";
import { onAuthStateChange } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import ChatInterface from "@/components/ChatInterface";
import VideoLayout from "@/components/VideoLayout";
import SidebarLayout from "@/components/SidebarLayout";
import { useToast } from "@/hooks/use-toast";
import { DataService } from "@/services/data-service";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<{ type: 'dashboard' | 'chat' | 'video', subject?: any, sessionId?: number }>({ type: 'dashboard' });
  const [subjects, setSubjects] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Login or create user in our database
          const response = await apiRequest("POST", "/api/auth/login", {
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email,
            avatar: firebaseUser.photoURL,
            firebaseUid: firebaseUser.uid
          });
          
          const data = await response.json();
          setUser({ ...firebaseUser, ...data.user });
          
          // Load subjects data
          const subjectsData = await DataService.getSubjects();
          setSubjects(subjectsData.subjects || []);
        } catch (error) {
          console.error("Database login error:", error);
          toast({
            title: "Lỗi đăng nhập",
            description: "Không thể kết nối với cơ sở dữ liệu",
            variant: "destructive",
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleLogin = async (user: any) => {
    // Handle Firebase login
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email: user.email,
        name: user.displayName || user.email,
        avatar: user.photoURL,
        firebaseUid: user.uid
      });
      
      const data = await response.json();
      setUser({ ...user, ...data.user });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Đăng nhập thất bại",
        description: "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Show chat interface
  if (currentView.type === 'chat' && currentView.subject && currentView.sessionId) {
    return (
      <SidebarLayout 
        user={user} 
        onLogout={handleLogout} 
        onGoHome={() => setCurrentView({ type: 'dashboard' })}
        onNavigateToChat={(subjectId, sessionId) => {
          const subject = subjects.find(s => s.id === subjectId) || { id: subjectId, name: 'Unknown Subject' };
          setCurrentView({ type: 'chat', subject, sessionId });
        }}
      >
        <ChatInterface
          subject={currentView.subject}
          user={user}
          sessionId={currentView.sessionId}
          onBack={() => setCurrentView({ type: 'dashboard' })}
        />
      </SidebarLayout>
    );
  }

  // Show video interface
  if (currentView.type === 'video' && currentView.subject) {
    return (
      <SidebarLayout 
        user={user} 
        onLogout={handleLogout} 
        onGoHome={() => setCurrentView({ type: 'dashboard' })}
        onNavigateToChat={(subjectId, sessionId) => {
          const subject = subjects.find(s => s.id === subjectId) || { id: subjectId, name: 'Unknown Subject' };
          setCurrentView({ type: 'chat', subject, sessionId });
        }}
      >
        <VideoLayout
          subjectId={currentView.subject.id}
          onBack={() => setCurrentView({ type: 'dashboard' })}
        />
      </SidebarLayout>
    );
  }





  // Show dashboard
  return <Dashboard user={user} onLogout={handleLogout} onSelectView={(type, subject, sessionId) => {
    setCurrentView({ type, subject, sessionId });
  }} />;
}
