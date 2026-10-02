import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Cake,
  Calendar,
  Car,
  Dog,
  Gift,
  GraduationCap,
  Heart,
  House,
  MapPin,
  Music,
  PartyPopper,
  Phone,
  Plane,
  ShoppingCart,
  Star,
  Stethoscope,
  Sun,
  Ticket,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Icon as IconKey } from "../../core/entry-type";

const ICONS: Record<IconKey, LucideIcon> = {
  calendar: Calendar,
  cake: Cake,
  plane: Plane,
  stethoscope: Stethoscope,
  ticket: Ticket,
  bike: Bike,
  party: PartyPopper,
  school: GraduationCap,
  briefcase: Briefcase,
  car: Car,
  home: House,
  heart: Heart,
  music: Music,
  utensils: Utensils,
  baby: Baby,
  dog: Dog,
  gift: Gift,
  star: Star,
  sun: Sun,
  book: BookOpen,
  cart: ShoppingCart,
  phone: Phone,
  trophy: Trophy,
  pin: MapPin,
};

/** One of the app's fixed line icons, by key. */
export function Icon({ name, size = 18 }: { name: string | null | undefined; size?: number }) {
  const Component = ICONS[name as IconKey] ?? Calendar;
  return <Component aria-hidden size={size} strokeWidth={1.75} />;
}
