import React from 'react';
import {
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle2,
  CircleAlert,
  CirclePlus,
  Clock3,
  CreditCard,
  FileImage,
  FileText,
  Info,
  List,
  Receipt,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
};

const iconMap: Record<string, React.ElementType> = {
  'add-circle': CirclePlus,
  'arrow-back': ArrowLeft,
  camera: Camera,
  card: CreditCard,
  cash: Wallet,
  'checkmark-circle': CheckCircle2,
  close: X,
  'document-text': FileText,
  image: FileImage,
  'information-circle': Info,
  library: List,
  list: List,
  notifications: Bell,
  receipt: Receipt,
  'shield-checkmark': ShieldCheck,
  time: Clock3,
  trash: Trash2,
  wallet: Wallet,
  'radio-button-on': List,
  'alert-circle': CircleAlert,
};

export function Ionicons({ name, size = 20, color = '#000' }: IconProps) {
  const Icon = iconMap[name] || List;
  return <Icon size={size} color={color} />;
}
