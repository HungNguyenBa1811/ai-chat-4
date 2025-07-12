import { 
  Calculator, 
  BookOpen, 
  MessageCircle, 
  Clock, 
  Globe, 
  Dna, 
  Zap, 
  TestTube 
} from "lucide-react";

interface SubjectIconProps {
  iconName: string;
  className?: string;
}

const iconMap: Record<string, any> = {
  Calculator,
  BookOpen,
  MessageCircle,
  Clock,
  Globe,
  Dna,
  Zap,
  Flask: TestTube, // Use TestTube for Flask (Chemistry)
  TestTube, // Direct mapping as well
};

export default function SubjectIcon({ iconName, className = "w-6 h-6" }: SubjectIconProps) {
  // Handle the Flask special case
  const actualIconName = iconName === 'Flask' ? 'TestTube' : iconName;
  const IconComponent = iconMap[actualIconName];
  
  if (!IconComponent) {
    console.warn(`Icon "${iconName}" not found, using fallback BookOpen`);
    return <BookOpen className={className} />;
  }

  return <IconComponent className={className} />;
}