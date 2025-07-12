import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// Removed ScrollArea import to prevent unwanted overflow-y-auto classes
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  GraduationCap, 
  Settings, 
  Home, 
  MessageCircle,
  Upload,
  X
} from "lucide-react";
import SubjectModal from "./SubjectModal";
import SettingsModal from "./SettingsModal";
import WebDAVUpload from "./WebDAVUpload";
import SubjectIcon from "./SubjectIcon";
import { logout } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { DataService } from "@/services/data-service";
import { APP_CONFIG } from "@/config/app-config";
import type { Subject, ChatSession } from "@/lib/openai";

interface DashboardProps {
  user: any;
  onLogout: () => void;
  onSelectView?: (type: 'chat' | 'video', subject?: Subject, sessionId?: number) => void;
}

export default function Dashboard({ user, onLogout, onSelectView }: DashboardProps) {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWebDAVOpen, setIsWebDAVOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 888, hours: 88, minutes: 88 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => DataService.getSubjects(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: chatSessions } = useQuery({
    queryKey: ["chat-sessions", user?.id],
    queryFn: () => DataService.getChatSessions(user?.id),
    enabled: !!user?.id,
  });

  const deleteChatMutation = useMutation({
    mutationFn: (sessionId: number) => DataService.deleteChatSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      toast({
        title: "Đã xóa",
        description: "Cuộc trò chuyện đã được xóa",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa cuộc trò chuyện",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const updateCountdown = () => {
      const examDate = new Date(APP_CONFIG.app.examDate);
      const now = new Date();
      const timeDiff = examDate.getTime() - now.getTime();
      
      if (timeDiff > 0) {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ days, hours, minutes });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      toast({
        title: "Đăng xuất thất bại",
        description: "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-primary rounded-xl p-2 w-10 h-10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">AI Học tập</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Học thông minh</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Home className="w-4 h-4 mr-3 text-primary" />
              Trang chủ
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setIsWebDAVOpen(true)}
            >
              <Upload className="w-4 h-4 mr-3 text-primary" />
              Thêm tài liệu WebDAV
            </Button>

          </div>

          <Separator className="my-4" />

          {/* Chat History */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 px-3">Lịch sử chat</h3>
            <div className="h-[300px] overflow-hidden">
              <div className="space-y-1">
                {chatSessions?.sessions?.slice(0, 5).map((session: any) => (
                  <div key={session.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Button 
                      variant="ghost"
                      className="flex-1 justify-start text-gray-700 dark:text-gray-300 hover:bg-transparent p-0 h-auto min-w-0"
                      onClick={() => {
                        // Find the subject for this session
                        const subject = subjects?.subjects?.find((s: any) => s.id === session.subjectId);
                        if (subject && onSelectView) {
                          onSelectView('chat', subject, session.id);
                        }
                      }}
                    >
                      <MessageCircle className="w-3 h-3 mr-2 text-blue-500 flex-shrink-0" />
                      <span className="truncate text-sm">{session.title}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md bg-gray-50 dark:bg-gray-700 border border-red-200 dark:border-red-800 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Bạn có chắc muốn xóa cuộc trò chuyện này?')) {
                          deleteChatMutation.mutate(session.id);
                        }
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {(!chatSessions?.sessions || chatSessions.sessions.length === 0) && (
                  <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-500">
                    Chưa có lịch sử chat
                  </p>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
              <AvatarFallback>{user?.displayName?.[0] || user?.email?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Học sinh
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="w-4 h-4 mr-3 text-primary" />
            Cài đặt
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Chuẩn bị cho kì thi Đánh giá năng lực
            </p>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Welcome Banner */}
          <Card className="bg-gradient-to-r from-primary to-indigo-500 dark:from-blue-600 dark:to-indigo-600 text-white mb-6">
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold mb-2">Chào mừng đến với AI học tập</h2>
              <p className="text-blue-100 dark:text-blue-200">{APP_CONFIG.app.description}</p>
              <div className="mt-4">
                <div className="text-sm text-blue-200 dark:text-blue-300 mb-2">THỜI GIAN CÒN LẠI</div>
                <div className="flex justify-center space-x-4 text-lg font-bold">
                  <div>
                    <div className="text-2xl">{timeLeft.days}</div>
                    <div className="text-xs text-blue-200 dark:text-blue-300">ngày</div>
                  </div>
                  <div>
                    <div className="text-2xl">{timeLeft.hours.toString().padStart(2, '0')}</div>
                    <div className="text-xs text-blue-200 dark:text-blue-300">giờ</div>
                  </div>
                  <div>
                    <div className="text-2xl">{timeLeft.minutes.toString().padStart(2, '0')}</div>
                    <div className="text-xs text-blue-200 dark:text-blue-300">phút</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subject Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="w-12 h-12 rounded-xl mb-4" />
                    <Skeleton className="h-4 mb-2" />
                    <Skeleton className="h-3" />
                  </CardContent>
                </Card>
              ))
            ) : (
              subjects?.subjects?.map((subject: Subject) => (
                <Card 
                  key={subject.id}
                  className={`bg-gradient-to-br ${subject.color} cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
                  onClick={() => setSelectedSubject(subject)}
                >
                  <CardContent className="p-6 text-white">
                    <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-4">
                      <SubjectIcon iconName={subject.icon} className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{subject.name}</h3>
                    <p className="text-white/80 text-sm">{subject.description}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {selectedSubject && (
        <SubjectModal 
          subject={selectedSubject} 
          onClose={() => setSelectedSubject(null)}
          user={user}
          onNavigate={(type, sessionId) => {
            if (onSelectView) {
              onSelectView(type, selectedSubject, sessionId);
            }
            setSelectedSubject(null);
          }}
        />
      )}
      
      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {isWebDAVOpen && (
        <WebDAVUpload
          isOpen={isWebDAVOpen}
          onClose={() => setIsWebDAVOpen(false)}
          subjects={subjects?.subjects || []}
        />
      )}
    </div>
  );
}