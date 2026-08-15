// ─── Shared TypeScript types for the Fnashha Expo app ───────────────────────

export interface AppUser {
  id: number;
  fullName: string;
  mobile: string;
  email?: string | null;
  role: 'customer' | 'technician' | 'admin' | 'super_admin';
  status: 'active' | 'pending' | 'suspended' | 'banned' | 'rejected' | 'deleted';
  profileImage?: string | null;
  referralCode?: string | null;
  technicianProfile?: TechnicianProfile | null;
  permissions?: string[];
}

export interface TechnicianProfile {
  id: number;
  userId: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  pointsBalance: number;
  reservedPoints: number;
  yearsOfExperience?: number | null;
  primaryAreaId?: number | null;
  rejectionReason?: string | null;
  averageRating?: number | string | null;
  totalRatings?: number | null;
}

export interface Service {
  id: number;
  name: string;
  nameAr: string;
  icon?: string | null;
  image?: string | null;
  isActive: boolean;
  displayOrder: number;
  iconSize?: number | null;
  iconShape?: string | null;
}

export interface Governorate {
  id: number;
  name: string;
  nameAr: string;
}

export interface Area {
  id: number;
  name: string;
  nameAr: string;
  governorateId: number;
}

export interface Banner {
  id: number;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  videoUrl?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  showIn?: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface CmsSetting {
  key: string;
  value: string;
  updatedAt?: string | null;
}

export type RequestStatus =
  | 'pending'
  | 'offers_received'
  | 'technician_selected'
  | 'in_progress'
  | 'waiting_approval'
  | 'price_change_requested'
  | 'completed'
  | 'cancelled'
  | 'cancelled_by_customer'
  | 'cancelled_by_technician'
  | 'cancelled_by_admin';

export interface ServiceRequest {
  id: number;
  customerId: number;
  serviceId: number;
  selectedTechnicianId?: number | null;
  status: RequestStatus;
  fullName: string;
  mobile: string;
  governorateId: number;
  areaId: number;
  address: string;
  description?: string | null;
  images?: string[];
  audioUrl?: string | null;
  agreedPrice?: string | number | null;
  customerPayableAmount?: string | number | null;
  hasDiscount?: boolean;
  hasCoinRedemption?: boolean;
  cancelReason?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  // joined fields
  service?: Service;
  governorate?: Governorate;
  area?: Area;
  offers?: Offer[];
  customer?: Partial<AppUser>;
  selectedTechnician?: Partial<AppUser>;
  unreadMessages?: number;
}

export interface Offer {
  id: number;
  requestId: number;
  technicianId: number;
  price: string | number;
  spareParts?: string | number | null;
  notes?: string | null;
  status: 'pending' | 'selected' | 'rejected' | 'withdrawn';
  reservedPoints?: number | null;
  createdAt: string;
  technician?: Partial<AppUser>;
}

export interface Message {
  id: number;
  requestId: number;
  senderId: number;
  content?: string | null;
  type: 'text' | 'image';
  imageUrl?: string | null;
  isRead: boolean;
  /** True once the recipient's device has fetched this message. Set by PATCH deliver-all. */
  isDelivered: boolean;
  createdAt: string;
  sender?: Partial<AppUser>;
}

export interface Conversation {
  requestId: number;
  request?: Partial<ServiceRequest>;
  lastMessage?: Message | null;
  unreadCount: number;
  otherUser?: Partial<AppUser>;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  relatedId?: number | null;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  userId: number;
  subject: string;
  message: string;
  images?: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  adminUnread?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  replies?: TicketReply[];
}

export interface TicketReply {
  id: number;
  ticketId: number;
  senderId: number;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface LoyaltyWallet {
  availableCoins: number;
  pendingCoins: number;
  reservedCoins: number;
  lifetimeEarned: number;
  lifetimeUsed: number;
  approximateDiscountValue: number;
  coinName: string;
  coinNameEn: string;
  coinRedeemX: number;
  coinRedeemY: number;
  nextExpiration: string | null;
}

export interface CoinTransaction {
  id: number;
  walletId: number;
  userId: number;
  amount: number;
  type: string;
  description?: string | null;
  balanceAfter: number;
  sourceType?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface PointTransaction {
  id: number;
  technicianId: number;
  amount: number;
  type: 'credit' | 'debit' | 'commission' | 'release';
  description?: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface PointsBalance {
  balance: number;
  reservedPoints: number;
  available: number;
}

export interface Rating {
  id: number;
  requestId: number;
  technicianId: number;
  customerId: number;
  stars: number;
  review?: string | null;
  createdAt: string;
  customer?: {
    id: number;
    fullName: string;
    profileImage?: string | null;
  } | null;
  service?: {
    id?: number;
    name?: string | null;
    nameAr?: string | null;
  } | null;
}

export interface PriceAdjustment {
  id: number;
  requestId: number;
  technicianId?: number;
  initiatedBy: 'technician' | 'admin';
  oldPrice?: string | number | null;
  oldSpareParts?: string | number | null;
  newPrice: string | number;
  newSpareParts?: string | number | null;
  newDescription?: string | null;
  supportingImage?: string | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decisionDate?: string | null;
  createdAt: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  user: AppUser;
  accessToken: string;
  refreshToken: string;
}
