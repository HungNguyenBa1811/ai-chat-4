import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import VideoPlayer from './VideoPlayer';
import VideoChatInterface from './VideoChatInterface';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Volume2, Maximize2, Minimize2 } from 'lucide-react';

interface VideoLayoutProps {
  subjectId: number;
  onBack: () => void;
}

interface Video {
  id: number;
  title: string;
  fileName: string;
  filePath: string;
  duration: number;
  createdAt: string;
}

export default function VideoLayout({ subjectId, onBack }: VideoLayoutProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch videos for this subject
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['/api/videos/subject', subjectId],
    queryFn: async () => {
      const response = await fetch(`/api/videos/subject/${subjectId}`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json();
      return data.videos || [];
    }
  });

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Đang tải videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>
        <h2 className="text-2xl font-bold">Videos học tập</h2>
      </div>

      {selectedVideo ? (
        <div className={`flex gap-6 h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-black p-4' : ''}`}>
          {/* Video Player Section - 60% */}
          <div className={`${isFullscreen ? 'w-full' : 'w-3/5'} flex flex-col`}>
            <Card className="h-full p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold truncate">{selectedVideo.title}</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <VideoPlayer
                src={`/api/videos/stream/${selectedVideo.id}`}
                className="w-full h-full"
              />
            </Card>
          </div>

          {/* Chat Interface Section - 40% */}
          {!isFullscreen && (
            <>
              <Separator orientation="vertical" />
              <div className="w-2/5 flex flex-col">
                <VideoChatInterface
                  subjectId={subjectId}
                  videoId={selectedVideo.id}
                  className="h-full"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        /* Video Selection Grid */
        <div className="flex-1">
          {videos.length === 0 ? (
            <Card className="p-8 text-center">
              <Play className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">Chưa có video nào</h3>
              <p className="text-gray-500">
                Hiện tại chưa có video học tập cho môn này. 
                Videos sẽ được thêm vào thông qua hệ thống WebDAV sync.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video: Video) => (
                <Card
                  key={video.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                  onClick={() => handleVideoSelect(video)}
                >
                  <div className="p-4">
                    {/* Video Thumbnail Placeholder */}
                    <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
                      <Play className="h-12 w-12 text-gray-400" />
                    </div>
                    
                    {/* Video Info */}
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                      {video.title}
                    </h3>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Volume2 className="h-4 w-4" />
                        {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                      </span>
                      <span>
                        {new Date(video.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}