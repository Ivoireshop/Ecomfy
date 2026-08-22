import { LinkMetadata } from "../utils/linkScraper";

export type VisibilityType = "public" | "followers" | "private";

export type ReactionType = "like" | "love" | "fire" | "clap" | "custom";

export interface ConnectUsProfile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  website_url: string | null;
  is_verified: boolean;
  is_business: boolean;
  is_onboarded?: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  shop_id?: string | null;
  shop_slug?: string | null;
  shop_name?: string | null;
  show_shop_on_profile?: boolean;
  created_at: string;
}

export interface AttachedProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number | null;
  image_url?: string | null;
  category?: string | null;
  shop_slug?: string | null;
}

export interface ConnectUsPost {
  id: string;
  user_id: string;
  author: ConnectUsProfile;
  content: string;
  media_urls: string[];
  video_url?: string | null;
  link_preview?: LinkMetadata | null;
  attached_product?: AttachedProduct | null;
  attached_shop_id?: string | null;
  visibility: VisibilityType;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  user_reaction?: ReactionType | null;
  is_bookmarked?: boolean;
  comments?: ConnectUsComment[];
  created_at: string;
}

export interface ConnectUsReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface ConnectUsComment {
  id: string;
  post_id: string;
  user_id: string;
  authorName?: string;
  author?: ConnectUsProfile;
  parent_id?: string | null;
  content?: string;
  text?: string;
  date?: string;
  likes_count: number;
  user_liked?: boolean;
  replies?: ConnectUsComment[];
  created_at: string;
}

export interface ConnectUsNotification {
  id: string;
  user_id: string;
  actor_id: string;
  actor: ConnectUsProfile;
  type: "follow" | "like" | "comment" | "comment_reply" | "mention" | "product_sale" | "invite_request" | "invite_accepted" | "private_message";
  post_id?: string | null;
  post_summary?: string | null;
  message?: string | null;
  status?: "pending" | "accepted" | "declined";
  read: boolean;
  created_at: string;
}

export interface ConnectUsFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface ConnectUsPrivateMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  sender?: ConnectUsProfile;
  content: string;
  media_url?: string | null;
  status: "sent" | "delivered" | "read";
  created_at: string;
}

export interface ConnectUsConversation {
  id: string;
  participant_ids: string[];
  other_user: ConnectUsProfile;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  messages?: ConnectUsPrivateMessage[];
}

export interface ConnectUsStory {
  id: string;
  user_id: string;
  author: ConnectUsProfile;
  media_url: string;
  media_type: "image" | "video";
  caption?: string | null;
  created_at: string;
  expires_at: string;
  views_count: number;
  viewers?: string[];
}
