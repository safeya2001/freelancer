export type Language = 'ar' | 'en';
export type UserRole = 'client' | 'freelancer' | 'admin' | 'super_admin' | 'finance_admin' | 'support_admin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'banned';
export type JordanCity = 'amman' | 'irbid' | 'zarqa' | 'aqaba' | 'madaba' | 'salt' | 'karak' | 'jerash' | 'other';

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  preferred_language: Language;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
}

export interface Profile {
  user_id: string;
  full_name_en: string;
  full_name_ar?: string;
  professional_title_en?: string;
  professional_title_ar?: string;
  bio_en?: string;
  bio_ar?: string;
  avatar_url?: string;
  city?: JordanCity;
  company_name?: string;
  hourly_rate?: number;
  availability?: boolean;
  identity_verified?: 'unverified' | 'pending' | 'verified' | 'rejected';
  avg_rating?: number;
  review_count?: number;
  total_earned?: number;
  total_spent?: number;
  total_jobs_done?: number;
}

export interface FullProfile extends User, Profile {
  skills: Skill[];
  portfolio: PortfolioItem[];
  education: Education[];
  certifications: Certification[];
}

export interface Skill {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  level?: string;
}

export interface Category {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  icon?: string;
}

export interface PortfolioItem {
  id: string;
  title_en: string;
  title_ar?: string;
  description_en?: string;
  image_urls?: string[];
  project_url?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree?: string;
  field?: string;
  start_year?: number;
  end_year?: number;
}

export interface Certification {
  id: string;
  name: string;
  issuing_org?: string;
  issue_date?: string;
  credential_url?: string;
}

export interface GigPackage {
  id: string;
  package_type: 'basic' | 'standard' | 'premium';
  name_en: string;
  name_ar?: string;
  description_en?: string;
  price: number;
  delivery_days: number;
  revisions: number;
  features?: { label_en: string; label_ar: string; included: boolean }[];
}

export interface Gig {
  id: string;
  freelancer_id: string;
  category_id: string;
  title_en: string;
  title_ar?: string;
  description_en: string;
  description_ar?: string;
  slug?: string;
  price?: number;
  delivery_days: number;
  gallery_urls?: string[];
  requirements_en?: string;
  status: 'active' | 'paused' | 'deleted';
  avg_rating: number;
  review_count: number;
  orders_count: number;
  views_count: number;
  created_at: string;
  // joined fields
  freelancer_name_en?: string;
  freelancer_name_ar?: string;
  freelancer_avatar?: string;
  freelancer_city?: JordanCity;
  category_name_en?: string;
  category_name_ar?: string;
  packages?: GigPackage[];
  skills?: Skill[];
  reviews?: Review[];
  basic_price?: number;
  standard_price?: number;
  premium_price?: number;
}

export interface Project {
  id: string;
  client_id: string;
  category_id?: string;
  title_en: string;
  title_ar?: string;
  description_en: string;
  description_ar?: string;
  budget_type: 'fixed' | 'hourly';
  budget_min?: number;
  budget_max?: number;
  deadline?: string;
  preferred_city?: JordanCity;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'closed';
  proposals_count: number;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  created_at: string;
  // joined fields from backend
  client_name?: string;
  client_name_ar?: string;
  client_avatar?: string;
  client_city?: string;
  client_rating?: number;
  client_total_orders?: number;
  client_total_spent?: number;
  client_last_seen?: string;
  company_name?: string;
  category_name_en?: string;
  category_name_ar?: string;
  skills?: Skill[];
}

export interface Proposal {
  id: string;
  project_id: string;
  freelancer_id: string;
  cover_letter_en: string;
  proposed_budget: number;
  delivery_days: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  // joined
  freelancer_name?: string;
  freelancer_avatar?: string;
  avg_rating?: number;
  review_count?: number;
  project_title?: string;
}

export interface Milestone {
  id: string;
  contract_id: string;
  title_en: string;
  title_ar?: string;
  amount: number;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'revision_requested' | 'disputed';
  delivery_urls?: string[];
  delivery_note_en?: string;
  sort_order: number;
}

export interface Contract {
  id: string;
  project_id?: string;
  client_id: string;
  freelancer_id: string;
  title_en: string;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  freelancer_amount: number;
  status: 'active' | 'completed' | 'cancelled' | 'disputed';
  milestones?: Milestone[];
  chat_room_id?: string;
  client_name?: string;
  freelancer_name?: string;
}

export interface Order {
  id: string;
  gig_id: string;
  client_id: string;
  freelancer_id: string;
  price: number;
  commission_amount: number;
  freelancer_amount: number;
  delivery_days: number;
  deadline?: string;
  status: 'pending' | 'in_progress' | 'delivered' | 'revision_requested' | 'completed' | 'cancelled' | 'disputed';
  gig_title?: string;
  gallery_urls?: string[];
  client_name?: string;
  freelancer_name?: string;
  chat_room_id?: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  body?: string;
  file_urls?: string[];
  file_names?: string[];
  read_by?: string[];
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface ChatRoom {
  id: string;
  order_id?: string;
  contract_id?: string;
  proposal_id?: string;
  /** 'interview' | 'contract' | 'order' */
  context_type?: string;
  /** Project title, gig title, etc. */
  context_title?: string;
  client_name?: string;
  freelancer_name?: string;
  client_avatar?: string;
  freelancer_avatar?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'release' | 'refund' | 'commission' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  stripe_payment_intent_id?: string;
  description_en?: string;
  description_ar?: string;
  created_at: string;
}

export interface Review {
  id: string;
  overall_rating: number;
  communication?: number;
  quality?: number;
  timeliness?: number;
  comment_en?: string;
  comment_ar?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title_en: string;
  title_ar: string;
  body_en?: string;
  body_ar?: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface Wallet {
  balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}
