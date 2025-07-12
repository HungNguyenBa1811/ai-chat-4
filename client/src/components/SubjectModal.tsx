import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataService } from "@/services/data-service";
import { useToast } from "@/hooks/use-toast";
import SubjectIcon from "./SubjectIcon";
import { MessageCircle, Video, Plus, BookOpen, Calendar } from "lucide-react";
import type { Subject } from "@/lib/openai";

interface SubjectModalProps {
  subject: Subject;
  onClose: () => void;
  user: any;
  onNavigate?: (type: 'chat' | 'video', sessionId?: number) => void;
}

export default function SubjectModal({ subject, onClose, user, onNavigate }: SubjectModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ["chat-sessions", user?.id],
    queryFn: () => DataService.getChatSessions(user?.id),
    enabled: !!user?.id,
  });

  const createSessionMutation = useMutation({
    mutationFn: () => DataService.createChatSession({
      userId: user.id,
      subjectId: subject.id,
      title: `${subject.name} - Phiên mới`,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      if (onNavigate && data.session) {
        onNavigate('chat', data.session.id);
      }
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể tạo phiên chat mới",
        variant: "destructive",
      });
    },
  });

  const subjectSessions = sessions?.sessions?.filter((s: any) => s.subjectId === subject.id) || [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className={`bg-gradient-to-br ${subject.color} p-3 rounded-xl`}>
              <SubjectIcon iconName={subject.icon} className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl">{subject.name}</span>
          </DialogTitle>
          <DialogDescription>
            Bắt đầu học tập với AI trợ giảng hoặc xem video bài giảng
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="qa" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qa">
              <MessageCircle className="w-4 h-4 mr-2" />
              Hỏi đáp AI
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="w-4 h-4 mr-2" />
              Video bài giảng
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qa" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2 flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                    AI trợ giảng thông minh
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Chatbot AI được huấn luyện chuyên sâu về {subject.name}. Hỏi bất cứ điều gì!
                  </p>
                  <Button 
                    onClick={() => createSessionMutation.mutate()}
                    disabled={createSessionMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {createSessionMutation.isPending ? "Đang tạo..." : "Bắt đầu phiên chat mới"}
                  </Button>
                </CardContent>
              </Card>

              {subjectSessions.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Các phiên chat gần đây
                  </h4>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {subjectSessions.map((session: any) => (
                        <Card 
                          key={session.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => onNavigate?.('chat', session.id)}
                        >
                          <CardContent className="p-4">
                            <h5 className="font-medium truncate">{session.title}</h5>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(session.createdAt).toLocaleDateString('vi-VN')}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2 flex items-center">
                  <Video className="w-5 h-5 mr-2 text-purple-600" />
                  Video bài giảng chất lượng cao
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Xem video giảng dạy từ các thầy cô hàng đầu về {subject.name}
                </p>
                <Button 
                  onClick={() => onNavigate?.('video')}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Xem video bài giảng
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}