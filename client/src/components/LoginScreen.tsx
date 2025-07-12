import { useState } from "react";
import { signInWithGoogle } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, LogIn } from "lucide-react";
import { DataService } from "@/services/data-service";
import { APP_CONFIG } from "@/config/app-config";

interface LoginScreenProps {
  onLogin: (user: any) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onLogin(user);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Đăng nhập thất bại",
        description: "Vui lòng thử lại sau",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md mx-4 shadow-xl border-0 bg-white dark:bg-gray-800">
        <CardContent className="p-8">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{APP_CONFIG.app.name}</h1>
            <p className="text-gray-600 dark:text-gray-300">{APP_CONFIG.app.tagline}</p>
          </div>
          
          {/* Login Button */}
          <div className="space-y-6">
            <Button 
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <LogIn className="w-5 h-5" />
              <span>{isLoading ? "Đang đăng nhập..." : "Đăng nhập với Gmail"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}