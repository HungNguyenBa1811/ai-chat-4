import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FolderOpen, CloudDownload, Loader2 } from "lucide-react";

interface WebDAVUploadProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: any[];
}

export default function WebDAVUpload({ isOpen, onClose, subjects }: WebDAVUploadProps) {
  const [webdavUrl, setWebdavUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [docType, setDocType] = useState<"theory" | "exercise">("theory");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (files: FileList) => {
    if (!selectedSubject || files.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn môn học và file để upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", files[0]);
    formData.append("subjectId", selectedSubject);
    formData.append("docType", docType);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      toast({
        title: "Thành công",
        description: "Tài liệu đã được upload và xử lý thành công",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Lỗi upload",
        description: "Không thể upload tài liệu. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleWebDAVSync = async () => {
    if (!webdavUrl || !username || !password || !folderPath || !selectedSubject) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/documents/webdav-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webdavUrl,
          username,
          password,
          folderPath,
          subjectId: selectedSubject,
          docType,
        })
      });
      
      if (!response.ok) {
        throw new Error("WebDAV sync failed");
      }
      
      const data = await response.json();
      
      console.log('WebDAV sync response:', data);

      if (data.failed && data.failed.length > 0) {
        toast({
          title: "Hoàn tất với lỗi",
          description: data.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Thành công",
          description: data.message || "Đã đồng bộ tài liệu từ WebDAV",
        });
      }
      onClose();
    } catch (error) {
      console.error('WebDAV sync error:', error);
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kết nối với WebDAV server. Kiểm tra console để xem chi tiết.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Thêm tài liệu học tập
          </DialogTitle>
          <DialogDescription>
            Upload file PDF hoặc đồng bộ tài liệu từ WebDAV/Nextcloud
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="webdav">WebDAV/Nextcloud</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Môn học</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn môn học" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="docType">Loại tài liệu</Label>
                <Select value={docType} onValueChange={(value: "theory" | "exercise") => setDocType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Lý thuyết</SelectItem>
                    <SelectItem value="exercise">Bài tập</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !selectedSubject}
                  className="w-full"
                  size="lg"
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Chọn file PDF để upload
                </Button>
              </div>

              <p className="text-sm text-gray-500">
                File PDF sẽ được xử lý bằng OCR và tự động phân tích nội dung
              </p>
            </div>
          </TabsContent>

          <TabsContent value="webdav" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="webdavUrl">WebDAV URL (Nextcloud)</Label>
                <Input
                  id="webdavUrl"
                  placeholder="https://nextcloud.example.com/remote.php/dav/files/username/"
                  value={webdavUrl}
                  onChange={(e) => setWebdavUrl(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Username Nextcloud"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password Nextcloud"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="folderPath">Thư mục</Label>
                <Input
                  id="folderPath"
                  placeholder="ly/Lý thuyết về mạch điện"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tên thư mục sẽ được dùng để xác định môn học và loại tài liệu
                </p>
              </div>

              <div>
                <Label htmlFor="subject">Môn học mặc định</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn môn học" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Hỗ trợ các định dạng: PDF, DOC, DOCX, TXT, MD, MP4, AVI, MOV, MKV
              </p>
              
              <Button
                onClick={handleWebDAVSync}
                disabled={isUploading}
                className="w-full"
                size="lg"
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CloudDownload className="mr-2 h-4 w-4" />
                )}
                Đồng bộ từ WebDAV
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}