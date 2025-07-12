import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Palette, Bot, LogOut } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

export default function SettingsModal({ onClose, user, onLogout }: SettingsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState("light");
  const [gptModel, setGptModel] = useState("gpt-4o");

  const { data: settings } = useQuery({
    queryKey: ["/api/settings", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/settings/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings?.settings) {
      setTheme(settings.settings.theme || "light");
      setGptModel(settings.settings.gptModel || "gpt-4o");
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/settings/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Cập nhật thành công",
        description: "Cài đặt đã được lưu",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật cài đặt",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({ theme, gptModel });
    
    // Apply theme immediately to DOM and save to localStorage
    const root = document.documentElement;
    localStorage.setItem('app-theme', theme);
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Cài đặt</DialogTitle>
          <DialogDescription>
            Quản lý tài khoản và tùy chỉnh giao diện theo sở thích của bạn
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="account" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">
              <User className="w-4 h-4 mr-2" />
              Tài khoản
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4 mr-2" />
              Giao diện
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Bot className="w-4 h-4 mr-2" />
              AI Model
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-6 space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4 mb-6">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
                    <AvatarFallback>{user?.displayName?.[0] || user?.email?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{user?.displayName || user?.name || "Người dùng"}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{user?.email}</p>

                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={onLogout}
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Đăng xuất
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6 space-y-4">
            <Card>
              <CardContent className="p-6">
                <Label className="text-base font-semibold mb-4 block">Chế độ giao diện</Label>
                <RadioGroup value={theme} onValueChange={setTheme}>
                  <div className="flex items-center space-x-2 mb-3">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="cursor-pointer">
                      Sáng
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="cursor-pointer">
                      Tối
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system" className="cursor-pointer">
                      Theo hệ thống
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-6 space-y-4">
            <Card>
              <CardContent className="p-6">
                <Label className="text-base font-semibold mb-4 block">Model AI</Label>
                <RadioGroup value={gptModel} onValueChange={setGptModel}>
                  <div className="flex items-center space-x-2 mb-3">
                    <RadioGroupItem value="gpt-4o" id="gpt-4o" />
                    <Label htmlFor="gpt-4o" className="cursor-pointer">
                      GPT-4o (Khuyên dùng - Nhanh và thông minh)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 mb-3">
                    <RadioGroupItem value="gpt-4" id="gpt-4" />
                    <Label htmlFor="gpt-4" className="cursor-pointer">
                      GPT-4 (Chậm hơn nhưng chi tiết)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gpt-3.5-turbo" id="gpt-3.5-turbo" />
                    <Label htmlFor="gpt-3.5-turbo" className="cursor-pointer">
                      GPT-3.5 Turbo (Nhanh nhất, độ chính xác thấp hơn)
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}