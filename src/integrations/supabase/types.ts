export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          converted: boolean
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          items_count: number
          payment_method: string | null
          session_id: string
          shop_id: string
          total: number
          updated_at: string
        }
        Insert: {
          converted?: boolean
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          items_count?: number
          payment_method?: string | null
          session_id: string
          shop_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          converted?: boolean
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          items_count?: number
          payment_method?: string | null
          session_id?: string
          shop_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      academy_courses: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          duration: string | null
          id: string
          is_published: boolean
          level: string | null
          order_index: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_published?: boolean
          level?: string | null
          order_index?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_published?: boolean
          level?: string | null
          order_index?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      ad_accounts: {
        Row: {
          access_token: string
          account_id: string
          account_label: string | null
          created_at: string
          currency: string | null
          id: string
          is_active: boolean | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          provider: string
          shop_id: string
          token_expires_at: string | null
          token_expiry_notified_at: string | null
          total_spend: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_id: string
          account_label?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          provider: string
          shop_id: string
          token_expires_at?: string | null
          token_expiry_notified_at?: string | null
          total_spend?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string
          account_label?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          provider?: string
          shop_id?: string
          token_expires_at?: string | null
          token_expiry_notified_at?: string | null
          total_spend?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_daily: {
        Row: {
          ad_account_id: string
          amount: number
          created_at: string
          currency: string | null
          id: string
          raw: Json | null
          shop_id: string
          spend_date: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          raw?: Json | null
          shop_id: string
          spend_date: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          raw?: Json | null
          shop_id?: string
          spend_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_templates: {
        Row: {
          animation_preset: string
          animation_prompt_template: string
          category: string
          color_palette: Json | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          prompt_template: string
          recommended_duration: number | null
          recommended_platforms: string[] | null
          style_preset: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          animation_preset: string
          animation_prompt_template: string
          category: string
          color_palette?: Json | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          prompt_template: string
          recommended_duration?: number | null
          recommended_platforms?: string[] | null
          style_preset: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          animation_preset?: string
          animation_prompt_template?: string
          category?: string
          color_palette?: Json | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          prompt_template?: string
          recommended_duration?: number | null
          recommended_platforms?: string[] | null
          style_preset?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_daily_usage: {
        Row: {
          last_feature: string | null
          request_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          last_feature?: string | null
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          last_feature?: string | null
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          key_name: string
          last_used_at: string | null
          request_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          key_name?: string
          last_used_at?: string | null
          request_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key_name?: string
          last_used_at?: string | null
          request_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_incidents: {
        Row: {
          category: string
          created_at: string
          dedupe_key: string
          description: string | null
          detected_at: string
          id: string
          last_seen_at: string
          metadata: Json
          notified_at: string | null
          occurrence_count: number
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          dedupe_key: string
          description?: string | null
          detected_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          notified_at?: string | null
          occurrence_count?: number
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          dedupe_key?: string
          description?: string | null
          detected_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          notified_at?: string | null
          occurrence_count?: number
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_remediation_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          ip: string | null
          params: Json
          result: Json | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip?: string | null
          params?: Json
          result?: Json | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip?: string | null
          params?: Json
          result?: Json | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          published_at: string | null
          read_time_minutes: number | null
          showcase_site_id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name: string
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time_minutes?: number | null
          showcase_site_id: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          read_time_minutes?: number | null
          showcase_site_id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          number_of_participants: number | null
          phone: string | null
          service_name: string
          service_type: string
          showcase_site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          number_of_participants?: number | null
          phone?: string | null
          service_name: string
          service_type: string
          showcase_site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          number_of_participants?: number | null
          phone?: string | null
          service_name?: string
          service_type?: string
          showcase_site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          shop_id: string
          status: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          shop_id: string
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          shop_id?: string
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      community_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          reply_to_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reply_to_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          reply_to_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "community_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      community_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          is_support: boolean
          like_count: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_support?: boolean
          like_count?: number
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_support?: boolean
          like_count?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "community_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      community_topics: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_closed: boolean
          is_pinned: boolean
          last_activity_at: string
          like_count: number
          reply_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          like_count?: number
          reply_count?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_closed?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          like_count?: number
          reply_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string | null
          read_at: string | null
          showcase_site_id: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
          read_at?: string | null
          showcase_site_id: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
          read_at?: string | null
          showcase_site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      course_certificates: {
        Row: {
          certificate_number: string
          certificate_url: string
          completion_date: string
          course_id: string
          course_title: string
          created_at: string
          id: string
          student_name: string
          user_id: string
        }
        Insert: {
          certificate_number: string
          certificate_url: string
          completion_date?: string
          course_id: string
          course_title: string
          created_at?: string
          id?: string
          student_name: string
          user_id: string
        }
        Update: {
          certificate_number?: string
          certificate_url?: string
          completion_date?: string
          course_id?: string
          course_title?: string
          created_at?: string
          id?: string
          student_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_inquiries: {
        Row: {
          course_id: string
          created_at: string | null
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          showcase_site_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          showcase_site_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          showcase_site_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_inquiries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_inquiries_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_preview: boolean | null
          is_published: boolean | null
          module_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          is_published?: boolean | null
          module_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          is_published?: boolean | null
          module_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string | null
          currency: string
          description: string | null
          duration: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          level: string | null
          max_participants: number | null
          price: number
          short_description: string | null
          showcase_site_id: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          whatsapp_group_link: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          duration?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          level?: string | null
          max_participants?: number | null
          price?: number
          short_description?: string | null
          showcase_site_id?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          whatsapp_group_link?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          duration?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          level?: string | null
          max_participants?: number | null
          price?: number
          short_description?: string | null
          showcase_site_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          whatsapp_group_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          created_at: string
          credits_added: number
          id: string
          pack_price: number
          pack_size: number
          payment_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_added: number
          id?: string
          pack_price: number
          pack_size: number
          payment_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits_added?: number
          id?: string
          pack_price?: number
          pack_size?: number
          payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_providers: {
        Row: {
          base_price: number | null
          city: string | null
          company_name: string
          contact_email: string | null
          contact_phone: string
          coverage_areas: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_recommended: boolean
          is_verified: boolean
          logo_url: string | null
          slug: string | null
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          base_price?: number | null
          city?: string | null
          company_name: string
          contact_email?: string | null
          contact_phone: string
          coverage_areas?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          is_verified?: boolean
          logo_url?: string | null
          slug?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          base_price?: number | null
          city?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string
          coverage_areas?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          is_verified?: boolean
          logo_url?: string | null
          slug?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          fcm_token: string
          id: string
          last_used_at: string
          shop_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fcm_token: string
          id?: string
          last_used_at?: string
          shop_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fcm_token?: string
          id?: string
          last_used_at?: string
          shop_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reminders: {
        Row: {
          created_at: string
          id: string
          reminder_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          amount_paid: number | null
          course_id: string
          created_at: string | null
          id: string
          payment_method: string | null
          payment_proof_url: string | null
          payment_status: string
          showcase_site_id: string | null
          student_email: string
          student_name: string
          student_phone: string | null
          transaction_reference: string | null
          updated_at: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount_paid?: number | null
          course_id: string
          created_at?: string | null
          id?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string
          showcase_site_id?: string | null
          student_email: string
          student_name: string
          student_phone?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount_paid?: number | null
          course_id?: string
          created_at?: string | null
          id?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string
          showcase_site_id?: string | null
          student_email?: string
          student_name?: string
          student_phone?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          photo_url: string | null
          rating: number
          status: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          photo_url?: string | null
          rating: number
          status?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          photo_url?: string | null
          rating?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_details: Json | null
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_details?: Json | null
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_details?: Json | null
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_videos: {
        Row: {
          created_at: string
          id: string
          product_details: Json | null
          progress_percentage: number | null
          progress_step: string | null
          prompt: string
          status: string
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_details?: Json | null
          progress_percentage?: number | null
          progress_step?: string | null
          prompt: string
          status?: string
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string
          id?: string
          product_details?: Json | null
          progress_percentage?: number | null
          progress_step?: string | null
          prompt?: string
          status?: string
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      generation_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          image_url: string | null
          platform: string
          processing_time_ms: number | null
          product_details: Json | null
          prompt: string
          queue_position: number | null
          retry_count: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          platform: string
          processing_time_ms?: number | null
          product_details?: Json | null
          prompt: string
          queue_position?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          platform?: string
          processing_time_ms?: number | null
          product_details?: Json | null
          prompt?: string
          queue_position?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      image_cache: {
        Row: {
          access_count: number
          created_at: string
          id: string
          image_url: string
          last_accessed_at: string
          model: string
          platform: string | null
          prompt: string
          prompt_hash: string
          size: string | null
          user_id: string | null
        }
        Insert: {
          access_count?: number
          created_at?: string
          id?: string
          image_url: string
          last_accessed_at?: string
          model?: string
          platform?: string | null
          prompt: string
          prompt_hash: string
          size?: string | null
          user_id?: string | null
        }
        Update: {
          access_count?: number
          created_at?: string
          id?: string
          image_url?: string
          last_accessed_at?: string
          model?: string
          platform?: string | null
          prompt?: string
          prompt_hash?: string
          size?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      image_formats: {
        Row: {
          created_at: string
          format_name: string
          format_size: string
          id: string
          image_id: string
          image_url: string
          platform: string
        }
        Insert: {
          created_at?: string
          format_name: string
          format_size: string
          id?: string
          image_id: string
          image_url: string
          platform: string
        }
        Update: {
          created_at?: string
          format_name?: string
          format_size?: string
          id?: string
          image_id?: string
          image_url?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_formats_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "generated_images"
            referencedColumns: ["id"]
          },
        ]
      }
      module_contents: {
        Row: {
          content_order: number
          content_text: string | null
          content_type: string
          content_url: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          is_mandatory: boolean | null
          is_preview: boolean | null
          module_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content_order?: number
          content_text?: string | null
          content_type: string
          content_url?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_mandatory?: boolean | null
          is_preview?: boolean | null
          module_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content_order?: number
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_mandatory?: boolean | null
          is_preview?: boolean | null
          module_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_contents_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string
          product_image_url: string | null
          product_name: string
          quantity: number
          selected_variants: Json | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id: string
          product_image_url?: string | null
          product_name: string
          quantity?: number
          selected_variants?: Json | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          selected_variants?: Json | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          commission_amount: number
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_country: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_provider_id: string | null
          delivery_transferred_at: string | null
          id: string
          is_read: boolean | null
          notes: string | null
          order_number: string
          order_status: string
          payment_method: string
          payment_status: string
          products_summary: string | null
          shop_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_provider_id?: string | null
          delivery_transferred_at?: string | null
          id?: string
          is_read?: boolean | null
          notes?: string | null
          order_number: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          products_summary?: string | null
          shop_id: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_country?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_provider_id?: string | null
          delivery_transferred_at?: string | null
          id?: string
          is_read?: boolean | null
          notes?: string | null
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          products_summary?: string | null
          shop_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_provider_id_fkey"
            columns: ["delivery_provider_id"]
            isOneToOne: false
            referencedRelation: "delivery_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          payment_url: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          payment_url: string
          provider: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          payment_url?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          payment_method: string
          status: string
          subscription_id: string | null
          transaction_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          payment_method: string
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          payment_method?: string
          status?: string
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ai_analyses: {
        Row: {
          conversion_rate: number
          created_at: string
          diagnosis: string | null
          framework: string
          id: string
          orders_count: number
          product_id: string | null
          raw_markdown: string | null
          recommendations: Json
          rewritten_copy: Json | null
          shop_id: string
          visitors_count: number
        }
        Insert: {
          conversion_rate?: number
          created_at?: string
          diagnosis?: string | null
          framework?: string
          id?: string
          orders_count?: number
          product_id?: string | null
          raw_markdown?: string | null
          recommendations?: Json
          rewritten_copy?: Json | null
          shop_id: string
          visitors_count?: number
        }
        Update: {
          conversion_rate?: number
          created_at?: string
          diagnosis?: string | null
          framework?: string
          id?: string
          orders_count?: number
          product_id?: string | null
          raw_markdown?: string | null
          recommendations?: Json
          rewritten_copy?: Json | null
          shop_id?: string
          visitors_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ai_analyses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ai_analyses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ai_analyses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          product_id: string | null
          rating: number
          reviewer_email: string | null
          reviewer_name: string
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          product_id?: string | null
          rating: number
          reviewer_email?: string | null
          reviewer_name: string
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          product_id?: string | null
          rating?: number
          reviewer_email?: string | null
          reviewer_name?: string
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_translations: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          language: string
          name: string | null
          product_id: string
          shop_id: string
          short_description: string | null
          source: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          language: string
          name?: string | null
          product_id: string
          shop_id: string
          short_description?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          name?: string | null
          product_id?: string
          shop_id?: string
          short_description?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bundle_offers: Json
          bundle_position: string
          category: string | null
          compare_at_price: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          digital_file_url: string | null
          display_order: number | null
          id: string
          is_digital: boolean | null
          is_featured: boolean | null
          is_published: boolean | null
          name: string
          price: number
          section_order: Json | null
          shop_id: string
          short_description: string | null
          sku: string | null
          slug: string | null
          stock_quantity: number | null
          updated_at: string | null
          variants: Json
          weight: number | null
        }
        Insert: {
          bundle_offers?: Json
          bundle_position?: string
          category?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          digital_file_url?: string | null
          display_order?: number | null
          id?: string
          is_digital?: boolean | null
          is_featured?: boolean | null
          is_published?: boolean | null
          name: string
          price?: number
          section_order?: Json | null
          shop_id: string
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          variants?: Json
          weight?: number | null
        }
        Update: {
          bundle_offers?: Json
          bundle_position?: string
          category?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          digital_file_url?: string | null
          display_order?: number | null
          id?: string
          is_digital?: boolean | null
          is_featured?: boolean | null
          is_published?: boolean | null
          name?: string
          price?: number
          section_order?: Json | null
          shop_id?: string
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          variants?: Json
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          email: string | null
          free_generations_remaining: number
          free_optimizer_used: boolean
          free_product_sheet_used: boolean
          free_video_generations_remaining: number
          free_voice_used: boolean
          full_name: string | null
          has_showcase_access: boolean | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          preferred_language: string | null
          purchased_credits: number | null
          shop_activation_paid: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          free_generations_remaining?: number
          free_optimizer_used?: boolean
          free_product_sheet_used?: boolean
          free_video_generations_remaining?: number
          free_voice_used?: boolean
          full_name?: string | null
          has_showcase_access?: boolean | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          preferred_language?: string | null
          purchased_credits?: number | null
          shop_activation_paid?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          free_generations_remaining?: number
          free_optimizer_used?: boolean
          free_product_sheet_used?: boolean
          free_video_generations_remaining?: number
          free_voice_used?: boolean
          full_name?: string | null
          has_showcase_access?: boolean | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          preferred_language?: string | null
          purchased_credits?: number | null
          shop_activation_paid?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          current_uses: number
          discount_percentage: number
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          current_uses?: number
          discount_percentage: number
          expires_at: string
          id?: string
          is_active?: boolean
          max_uses: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          current_uses?: number
          discount_percentage?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_generations: number
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          bonus_generations?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          bonus_generations?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      shop_ai_assistants: {
        Row: {
          auto_open: boolean
          conversation_language: string
          created_at: string
          custom_greeting: string | null
          enabled: boolean
          greeting_languages: string[]
          id: string
          manual_context: string | null
          name: string
          personality: string
          shop_id: string
          source_mode: string
          updated_at: string
          voice_enabled: boolean
          voice_id: string
          welcome_bubble: string | null
        }
        Insert: {
          auto_open?: boolean
          conversation_language?: string
          created_at?: string
          custom_greeting?: string | null
          enabled?: boolean
          greeting_languages?: string[]
          id?: string
          manual_context?: string | null
          name?: string
          personality?: string
          shop_id: string
          source_mode?: string
          updated_at?: string
          voice_enabled?: boolean
          voice_id?: string
          welcome_bubble?: string | null
        }
        Update: {
          auto_open?: boolean
          conversation_language?: string
          created_at?: string
          custom_greeting?: string | null
          enabled?: boolean
          greeting_languages?: string[]
          id?: string
          manual_context?: string | null
          name?: string
          personality?: string
          shop_id?: string
          source_mode?: string
          updated_at?: string
          voice_enabled?: boolean
          voice_id?: string
          welcome_bubble?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_ai_assistants_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_ai_assistants_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_collaborators: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invitation_token: string
          invited_by: string
          invited_email: string
          roles: Database["public"]["Enums"]["shop_collab_role"][]
          shop_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invitation_token: string
          invited_by: string
          invited_email: string
          roles?: Database["public"]["Enums"]["shop_collab_role"][]
          shop_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          invited_email?: string
          roles?: Database["public"]["Enums"]["shop_collab_role"][]
          shop_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_collaborators_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_collaborators_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_delivery_connections: {
        Row: {
          auto_transfer: boolean
          created_at: string
          delivery_provider_id: string
          id: string
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_transfer?: boolean
          created_at?: string
          delivery_provider_id: string
          id?: string
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_transfer?: boolean
          created_at?: string
          delivery_provider_id?: string
          id?: string
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_delivery_connections_delivery_provider_id_fkey"
            columns: ["delivery_provider_id"]
            isOneToOne: false
            referencedRelation: "delivery_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_delivery_connections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_delivery_connections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shop_secrets: {
        Row: {
          created_at: string
          facebook_access_token: string | null
          ga4_api_secret: string | null
          google_ads_conversion_id: string | null
          google_ads_conversion_label: string | null
          shop_id: string
          snapchat_access_token: string | null
          tiktok_access_token: string | null
          updated_at: string
          weekly_finance_email: string | null
          weekly_finance_email_enabled: boolean
        }
        Insert: {
          created_at?: string
          facebook_access_token?: string | null
          ga4_api_secret?: string | null
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          shop_id: string
          snapchat_access_token?: string | null
          tiktok_access_token?: string | null
          updated_at?: string
          weekly_finance_email?: string | null
          weekly_finance_email_enabled?: boolean
        }
        Update: {
          created_at?: string
          facebook_access_token?: string | null
          ga4_api_secret?: string | null
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          shop_id?: string
          snapchat_access_token?: string | null
          tiktok_access_token?: string | null
          updated_at?: string
          weekly_finance_email?: string | null
          weekly_finance_email_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shop_secrets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_secrets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_translations: {
        Row: {
          business_description: string | null
          business_name: string | null
          created_at: string
          id: string
          language: string
          seo_description: string | null
          seo_title: string | null
          shop_id: string
          source: string
          updated_at: string
        }
        Insert: {
          business_description?: string | null
          business_name?: string | null
          created_at?: string
          id?: string
          language: string
          seo_description?: string | null
          seo_title?: string | null
          shop_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          business_description?: string | null
          business_name?: string | null
          created_at?: string
          id?: string
          language?: string
          seo_description?: string | null
          seo_title?: string | null
          shop_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_translations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_visits: {
        Row: {
          id: string
          product_id: string | null
          session_id: string | null
          shop_id: string
          visited_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          session_id?: string | null
          shop_id: string
          visited_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          session_id?: string | null
          shop_id?: string
          visited_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          activation_fee_paid: boolean | null
          address: string | null
          ai_optimizer_enabled: boolean
          banner_url: string | null
          business_description: string | null
          business_name: string
          chatbot_enabled: boolean | null
          chatbot_welcome_message: string | null
          checkout_fields: Json | null
          city: string | null
          cod_delivery_rate: number | null
          commission_balance_due: number
          commission_per_order: number
          commission_rate: number | null
          commission_threshold: number
          country: string | null
          created_at: string
          currency: string | null
          custom_domain: string | null
          delivery_advisor_phone: string | null
          dns_propagation_percentage: number | null
          domain_last_check: string | null
          domain_status: string | null
          domain_verification_code: string | null
          email: string | null
          enabled_languages: string[]
          facebook_pixels: string[] | null
          facebook_test_event_code: string | null
          favicon_url: string | null
          ga4_measurement_id: string | null
          gifs_generated_count: number
          gifs_period_start: string
          google_analytics_code: string | null
          google_analytics_ids: string[] | null
          id: string
          is_activated: boolean | null
          is_published: boolean | null
          is_suspended: boolean
          logo_url: string | null
          notification_settings: Json
          order_confirmation_message: string | null
          payment_deadline: string | null
          payment_methods: string[] | null
          phone_number: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          snapchat_pixels: string[] | null
          social_proof_enabled: boolean | null
          ssl_status: string | null
          subscription_active_until: string | null
          subscription_plan: string
          subscription_started_at: string | null
          theme: string | null
          theme_config: Json | null
          tiktok_pixels: string[] | null
          total_orders: number | null
          total_sales: number | null
          tracking_enabled: boolean | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          activation_fee_paid?: boolean | null
          address?: string | null
          ai_optimizer_enabled?: boolean
          banner_url?: string | null
          business_description?: string | null
          business_name: string
          chatbot_enabled?: boolean | null
          chatbot_welcome_message?: string | null
          checkout_fields?: Json | null
          city?: string | null
          cod_delivery_rate?: number | null
          commission_balance_due?: number
          commission_per_order?: number
          commission_rate?: number | null
          commission_threshold?: number
          country?: string | null
          created_at?: string
          currency?: string | null
          custom_domain?: string | null
          delivery_advisor_phone?: string | null
          dns_propagation_percentage?: number | null
          domain_last_check?: string | null
          domain_status?: string | null
          domain_verification_code?: string | null
          email?: string | null
          enabled_languages?: string[]
          facebook_pixels?: string[] | null
          facebook_test_event_code?: string | null
          favicon_url?: string | null
          ga4_measurement_id?: string | null
          gifs_generated_count?: number
          gifs_period_start?: string
          google_analytics_code?: string | null
          google_analytics_ids?: string[] | null
          id?: string
          is_activated?: boolean | null
          is_published?: boolean | null
          is_suspended?: boolean
          logo_url?: string | null
          notification_settings?: Json
          order_confirmation_message?: string | null
          payment_deadline?: string | null
          payment_methods?: string[] | null
          phone_number?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          snapchat_pixels?: string[] | null
          social_proof_enabled?: boolean | null
          ssl_status?: string | null
          subscription_active_until?: string | null
          subscription_plan?: string
          subscription_started_at?: string | null
          theme?: string | null
          theme_config?: Json | null
          tiktok_pixels?: string[] | null
          total_orders?: number | null
          total_sales?: number | null
          tracking_enabled?: boolean | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          activation_fee_paid?: boolean | null
          address?: string | null
          ai_optimizer_enabled?: boolean
          banner_url?: string | null
          business_description?: string | null
          business_name?: string
          chatbot_enabled?: boolean | null
          chatbot_welcome_message?: string | null
          checkout_fields?: Json | null
          city?: string | null
          cod_delivery_rate?: number | null
          commission_balance_due?: number
          commission_per_order?: number
          commission_rate?: number | null
          commission_threshold?: number
          country?: string | null
          created_at?: string
          currency?: string | null
          custom_domain?: string | null
          delivery_advisor_phone?: string | null
          dns_propagation_percentage?: number | null
          domain_last_check?: string | null
          domain_status?: string | null
          domain_verification_code?: string | null
          email?: string | null
          enabled_languages?: string[]
          facebook_pixels?: string[] | null
          facebook_test_event_code?: string | null
          favicon_url?: string | null
          ga4_measurement_id?: string | null
          gifs_generated_count?: number
          gifs_period_start?: string
          google_analytics_code?: string | null
          google_analytics_ids?: string[] | null
          id?: string
          is_activated?: boolean | null
          is_published?: boolean | null
          is_suspended?: boolean
          logo_url?: string | null
          notification_settings?: Json
          order_confirmation_message?: string | null
          payment_deadline?: string | null
          payment_methods?: string[] | null
          phone_number?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          snapchat_pixels?: string[] | null
          social_proof_enabled?: boolean | null
          ssl_status?: string | null
          subscription_active_until?: string | null
          subscription_plan?: string
          subscription_started_at?: string | null
          theme?: string | null
          theme_config?: Json | null
          tiktok_pixels?: string[] | null
          total_orders?: number | null
          total_sales?: number | null
          tracking_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      showcase_analytics: {
        Row: {
          browser: string | null
          device_type: string | null
          id: string
          page_path: string | null
          referrer: string | null
          session_id: string | null
          showcase_site_id: string
          user_agent: string | null
          visited_at: string
          visitor_city: string | null
          visitor_country: string | null
          visitor_ip: string | null
        }
        Insert: {
          browser?: string | null
          device_type?: string | null
          id?: string
          page_path?: string | null
          referrer?: string | null
          session_id?: string | null
          showcase_site_id: string
          user_agent?: string | null
          visited_at?: string
          visitor_city?: string | null
          visitor_country?: string | null
          visitor_ip?: string | null
        }
        Update: {
          browser?: string | null
          device_type?: string | null
          id?: string
          page_path?: string | null
          referrer?: string | null
          session_id?: string | null
          showcase_site_id?: string
          user_agent?: string | null
          visited_at?: string
          visitor_city?: string | null
          visitor_country?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_analytics_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_galleries: {
        Row: {
          created_at: string
          id: string
          image_caption: string | null
          image_order: number | null
          image_url: string
          section_title: string | null
          section_type: string
          showcase_site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_caption?: string | null
          image_order?: number | null
          image_url: string
          section_title?: string | null
          section_type: string
          showcase_site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_caption?: string | null
          image_order?: number | null
          image_url?: string
          section_title?: string | null
          section_type?: string
          showcase_site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_galleries_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_gallery_videos: {
        Row: {
          created_at: string | null
          id: string
          section_title: string | null
          section_type: string
          showcase_site_id: string
          updated_at: string | null
          video_caption: string | null
          video_order: number | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          section_title?: string | null
          section_type: string
          showcase_site_id: string
          updated_at?: string | null
          video_caption?: string | null
          video_order?: number | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          section_title?: string | null
          section_type?: string
          showcase_site_id?: string
          updated_at?: string | null
          video_caption?: string | null
          video_order?: number | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_gallery_videos_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_sites: {
        Row: {
          about_description: string | null
          about_image_url: string | null
          about_layout: string | null
          about_title: string | null
          about_video_url: string | null
          background_color: string | null
          biography_content: string | null
          biography_image_position: string | null
          biography_image_url: string | null
          biography_title: string | null
          business_description: string | null
          business_name: string
          created_at: string
          cta_description: string | null
          cta_title: string | null
          custom_domain: string | null
          dns_propagation_percentage: number | null
          domain_last_check: string | null
          domain_status: string | null
          domain_verification_code: string | null
          features: Json | null
          font_family: string | null
          footer_color: string | null
          formation_description: string | null
          formation_image_url: string | null
          formation_price: string | null
          formation_title: string | null
          formations: Json | null
          formations_text_align: string | null
          gallery_text_position: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          hero_title_color: string | null
          hero_title_size: number | null
          hero_video_url: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          navigation_bg_color: string | null
          navigation_text_color: string | null
          og_image_url: string | null
          og_type: string | null
          owner_name: string
          owner_photo_url: string | null
          phone_number: string
          price_bg_color: string | null
          price_text_color: string | null
          primary_color: string | null
          professional_experience: Json | null
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          ssl_status: string | null
          stats_bg_color: string | null
          stats_projects_completed: number | null
          stats_satisfied_clients: number | null
          stats_show_section: boolean | null
          stats_text_color: string | null
          stats_years_experience: number | null
          subdomain: string
          text_color: string | null
          theme: string | null
          theme_mode: string | null
          twitter_card: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string
        }
        Insert: {
          about_description?: string | null
          about_image_url?: string | null
          about_layout?: string | null
          about_title?: string | null
          about_video_url?: string | null
          background_color?: string | null
          biography_content?: string | null
          biography_image_position?: string | null
          biography_image_url?: string | null
          biography_title?: string | null
          business_description?: string | null
          business_name: string
          created_at?: string
          cta_description?: string | null
          cta_title?: string | null
          custom_domain?: string | null
          dns_propagation_percentage?: number | null
          domain_last_check?: string | null
          domain_status?: string | null
          domain_verification_code?: string | null
          features?: Json | null
          font_family?: string | null
          footer_color?: string | null
          formation_description?: string | null
          formation_image_url?: string | null
          formation_price?: string | null
          formation_title?: string | null
          formations?: Json | null
          formations_text_align?: string | null
          gallery_text_position?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          hero_title_color?: string | null
          hero_title_size?: number | null
          hero_video_url?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          navigation_bg_color?: string | null
          navigation_text_color?: string | null
          og_image_url?: string | null
          og_type?: string | null
          owner_name: string
          owner_photo_url?: string | null
          phone_number: string
          price_bg_color?: string | null
          price_text_color?: string | null
          primary_color?: string | null
          professional_experience?: Json | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          ssl_status?: string | null
          stats_bg_color?: string | null
          stats_projects_completed?: number | null
          stats_satisfied_clients?: number | null
          stats_show_section?: boolean | null
          stats_text_color?: string | null
          stats_years_experience?: number | null
          subdomain: string
          text_color?: string | null
          theme?: string | null
          theme_mode?: string | null
          twitter_card?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number: string
        }
        Update: {
          about_description?: string | null
          about_image_url?: string | null
          about_layout?: string | null
          about_title?: string | null
          about_video_url?: string | null
          background_color?: string | null
          biography_content?: string | null
          biography_image_position?: string | null
          biography_image_url?: string | null
          biography_title?: string | null
          business_description?: string | null
          business_name?: string
          created_at?: string
          cta_description?: string | null
          cta_title?: string | null
          custom_domain?: string | null
          dns_propagation_percentage?: number | null
          domain_last_check?: string | null
          domain_status?: string | null
          domain_verification_code?: string | null
          features?: Json | null
          font_family?: string | null
          footer_color?: string | null
          formation_description?: string | null
          formation_image_url?: string | null
          formation_price?: string | null
          formation_title?: string | null
          formations?: Json | null
          formations_text_align?: string | null
          gallery_text_position?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          hero_title_color?: string | null
          hero_title_size?: number | null
          hero_video_url?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          navigation_bg_color?: string | null
          navigation_text_color?: string | null
          og_image_url?: string | null
          og_type?: string | null
          owner_name?: string
          owner_photo_url?: string | null
          phone_number?: string
          price_bg_color?: string | null
          price_text_color?: string | null
          primary_color?: string | null
          professional_experience?: Json | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          ssl_status?: string | null
          stats_bg_color?: string | null
          stats_projects_completed?: number | null
          stats_satisfied_clients?: number | null
          stats_show_section?: boolean | null
          stats_text_color?: string | null
          stats_years_experience?: number | null
          subdomain?: string
          text_color?: string | null
          theme?: string | null
          theme_mode?: string | null
          twitter_card?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      showcase_testimonials: {
        Row: {
          created_at: string
          display_order: number
          full_name: string
          id: string
          result_image_url: string | null
          showcase_site_id: string
          testimonial_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          full_name: string
          id?: string
          result_image_url?: string | null
          showcase_site_id: string
          testimonial_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          full_name?: string
          id?: string
          result_image_url?: string | null
          showcase_site_id?: string
          testimonial_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_testimonials_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_trash: {
        Row: {
          created_at: string
          deleted_at: string
          expires_at: string
          id: string
          item_data: Json
          item_type: string
          showcase_site_id: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          expires_at?: string
          id?: string
          item_data: Json
          item_type: string
          showcase_site_id: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string
          expires_at?: string
          id?: string
          item_data?: Json
          item_type?: string
          showcase_site_id?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showcase_trash_showcase_site_id_fkey"
            columns: ["showcase_site_id"]
            isOneToOne: false
            referencedRelation: "showcase_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_versions: {
        Row: {
          about_description: string | null
          about_image_url: string | null
          about_layout: string | null
          about_title: string | null
          business_description: string | null
          business_name: string
          created_at: string
          created_by: string
          cta_description: string | null
          cta_title: string | null
          features: Json | null
          font_family: string | null
          formation_description: string | null
          formation_image_url: string | null
          formation_price: string | null
          formation_title: string | null
          formations: Json | null
          formations_text_align: string | null
          gallery_text_position: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          logo_url: string | null
          og_image_url: string | null
          og_type: string | null
          owner_name: string
          owner_photo_url: string | null
          phone_number: string
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          showcase_site_id: string
          testimonials: Json | null
          text_color: string | null
          theme: string | null
          theme_mode: string | null
          twitter_card: string | null
          version_name: string | null
          version_number: number
          whatsapp_number: string
        }
        Insert: {
          about_description?: string | null
          about_image_url?: string | null
          about_layout?: string | null
          about_title?: string | null
          business_description?: string | null
          business_name: string
          created_at?: string
          created_by: string
          cta_description?: string | null
          cta_title?: string | null
          features?: Json | null
          font_family?: string | null
          formation_description?: string | null
          formation_image_url?: string | null
          formation_price?: string | null
          formation_title?: string | null
          formations?: Json | null
          formations_text_align?: string | null
          gallery_text_position?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          og_image_url?: string | null
          og_type?: string | null
          owner_name: string
          owner_photo_url?: string | null
          phone_number: string
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          showcase_site_id: string
          testimonials?: Json | null
          text_color?: string | null
          theme?: string | null
          theme_mode?: string | null
          twitter_card?: string | null
          version_name?: string | null
          version_number: number
          whatsapp_number: string
        }
        Update: {
          about_description?: string | null
          about_image_url?: string | null
          about_layout?: string | null
          about_title?: string | null
          business_description?: string | null
          business_name?: string
          created_at?: string
          created_by?: string
          cta_description?: string | null
          cta_title?: string | null
          features?: Json | null
          font_family?: string | null
          formation_description?: string | null
          formation_image_url?: string | null
          formation_price?: string | null
          formation_title?: string | null
          formations?: Json | null
          formations_text_align?: string | null
          gallery_text_position?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          logo_url?: string | null
          og_image_url?: string | null
          og_type?: string | null
          owner_name?: string
          owner_photo_url?: string | null
          phone_number?: string
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          showcase_site_id?: string
          testimonials?: Json | null
          text_color?: string | null
          theme?: string | null
          theme_mode?: string | null
          twitter_card?: string | null
          version_name?: string | null
          version_number?: number
          whatsapp_number?: string
        }
        Relationships: []
      }
      student_access: {
        Row: {
          access_expires_at: string | null
          access_granted_at: string | null
          course_id: string
          created_at: string | null
          enrollment_id: string
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          access_expires_at?: string | null
          access_granted_at?: string | null
          course_id: string
          created_at?: string | null
          enrollment_id: string
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          access_expires_at?: string | null
          access_granted_at?: string | null
          course_id?: string
          created_at?: string | null
          enrollment_id?: string
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_access_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          completed_at: string | null
          completion_percentage: number | null
          content_id: string | null
          course_id: string
          created_at: string | null
          id: string
          is_completed: boolean | null
          last_accessed_at: string | null
          module_id: string
          notes: string | null
          time_spent_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_percentage?: number | null
          content_id?: string | null
          course_id: string
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_accessed_at?: string | null
          module_id: string
          notes?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_percentage?: number | null
          content_id?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          last_accessed_at?: string | null
          module_id?: string
          notes?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "module_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string | null
          end_date: string | null
          id: string
          start_date: string | null
          status: string
          updated_at: string | null
          user_id: string
          video_generations_remaining: number
        }
        Insert: {
          amount?: number
          created_at?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          video_generations_remaining?: number
        }
        Update: {
          amount?: number
          created_at?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          video_generations_remaining?: number
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string
          provider: string
          reference: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string
          provider: string
          reference?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string
          provider?: string
          reference?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      shops_public: {
        Row: {
          address: string | null
          banner_url: string | null
          business_description: string | null
          business_name: string | null
          chatbot_enabled: boolean | null
          chatbot_welcome_message: string | null
          checkout_fields: Json | null
          city: string | null
          cod_delivery_rate: number | null
          country: string | null
          created_at: string | null
          currency: string | null
          custom_domain: string | null
          delivery_advisor_phone: string | null
          email: string | null
          facebook_pixels: string[] | null
          favicon_url: string | null
          google_analytics_code: string | null
          google_analytics_ids: string[] | null
          id: string | null
          is_activated: boolean | null
          is_published: boolean | null
          is_suspended: boolean | null
          logo_url: string | null
          order_confirmation_message: string | null
          payment_methods: string[] | null
          phone_number: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          snapchat_pixels: string[] | null
          social_proof_enabled: boolean | null
          theme: string | null
          theme_config: Json | null
          tiktok_pixels: string[] | null
          tracking_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          business_description?: string | null
          business_name?: string | null
          chatbot_enabled?: boolean | null
          chatbot_welcome_message?: string | null
          checkout_fields?: Json | null
          city?: string | null
          cod_delivery_rate?: number | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          delivery_advisor_phone?: string | null
          email?: string | null
          facebook_pixels?: string[] | null
          favicon_url?: string | null
          google_analytics_code?: string | null
          google_analytics_ids?: string[] | null
          id?: string | null
          is_activated?: boolean | null
          is_published?: boolean | null
          is_suspended?: boolean | null
          logo_url?: string | null
          order_confirmation_message?: string | null
          payment_methods?: string[] | null
          phone_number?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          snapchat_pixels?: string[] | null
          social_proof_enabled?: boolean | null
          theme?: string | null
          theme_config?: Json | null
          tiktok_pixels?: string[] | null
          tracking_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          business_description?: string | null
          business_name?: string | null
          chatbot_enabled?: boolean | null
          chatbot_welcome_message?: string | null
          checkout_fields?: Json | null
          city?: string | null
          cod_delivery_rate?: number | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          delivery_advisor_phone?: string | null
          email?: string | null
          facebook_pixels?: string[] | null
          favicon_url?: string | null
          google_analytics_code?: string | null
          google_analytics_ids?: string[] | null
          id?: string | null
          is_activated?: boolean | null
          is_published?: boolean | null
          is_suspended?: boolean | null
          logo_url?: string | null
          order_confirmation_message?: string | null
          payment_methods?: string[] | null
          phone_number?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          snapchat_pixels?: string[] | null
          social_proof_enabled?: boolean | null
          theme?: string | null
          theme_config?: Json | null
          tiktok_pixels?: string[] | null
          tracking_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_shop_invitation: { Args: { _token: string }; Returns: Json }
      apply_commission_payment: {
        Args: {
          p_amount: number
          p_created_by?: string
          p_notes?: string
          p_payment_method?: string
          p_shop_id: string
          p_transaction_reference: string
        }
        Returns: Json
      }
      apply_shop_activation: {
        Args: {
          p_amount?: number
          p_payment_method?: string
          p_shop_id: string
          p_transaction_reference?: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_shop_subscription: {
        Args: {
          p_amount: number
          p_payment_method?: string
          p_plan: string
          p_shop_id: string
          p_transaction_reference: string
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_expired_trash: { Args: never; Returns: undefined }
      cleanup_old_image_cache: { Args: never; Returns: undefined }
      consume_ai_credit: {
        Args: { _amount?: number; _feature: string; _user_id: string }
        Returns: Json
      }
      consume_ai_quota: {
        Args: { _feature?: string; _limit?: number; _user_id: string }
        Returns: Json
      }
      count_processing_generations: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_stale_pending_payments: { Args: never; Returns: number }
      expire_subscriptions: { Args: never; Returns: number }
      generate_api_key: { Args: never; Returns: string }
      generate_certificate_number: { Args: never; Returns: string }
      generate_domain_verification_code: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code: { Args: { user_id: string }; Returns: string }
      generate_shop_domain_verification_code: { Args: never; Returns: string }
      get_ai_quota: {
        Args: { _limit?: number; _user_id: string }
        Returns: Json
      }
      get_community_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      get_invite_email_by_token: { Args: { _token: string }; Returns: string }
      get_my_subscription_status: { Args: never; Returns: Json }
      get_next_queue_item: { Args: never; Returns: string }
      get_public_product_page: {
        Args: { p_product_slug: string; p_shop_slug: string }
        Returns: Json
      }
      get_public_shop_by_custom_domain: {
        Args: { p_domain: string }
        Returns: {
          address: string | null
          banner_url: string | null
          business_description: string | null
          business_name: string | null
          chatbot_enabled: boolean | null
          chatbot_welcome_message: string | null
          checkout_fields: Json | null
          city: string | null
          cod_delivery_rate: number | null
          country: string | null
          created_at: string | null
          currency: string | null
          custom_domain: string | null
          delivery_advisor_phone: string | null
          email: string | null
          facebook_pixels: string[] | null
          favicon_url: string | null
          google_analytics_code: string | null
          google_analytics_ids: string[] | null
          id: string | null
          is_activated: boolean | null
          is_published: boolean | null
          is_suspended: boolean | null
          logo_url: string | null
          order_confirmation_message: string | null
          payment_methods: string[] | null
          phone_number: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          snapchat_pixels: string[] | null
          social_proof_enabled: boolean | null
          theme: string | null
          theme_config: Json | null
          tiktok_pixels: string[] | null
          tracking_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
          whatsapp_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "shops_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_shop_by_slug: {
        Args: { p_slug: string }
        Returns: {
          address: string | null
          banner_url: string | null
          business_description: string | null
          business_name: string | null
          chatbot_enabled: boolean | null
          chatbot_welcome_message: string | null
          checkout_fields: Json | null
          city: string | null
          cod_delivery_rate: number | null
          country: string | null
          created_at: string | null
          currency: string | null
          custom_domain: string | null
          delivery_advisor_phone: string | null
          email: string | null
          facebook_pixels: string[] | null
          favicon_url: string | null
          google_analytics_code: string | null
          google_analytics_ids: string[] | null
          id: string | null
          is_activated: boolean | null
          is_published: boolean | null
          is_suspended: boolean | null
          logo_url: string | null
          order_confirmation_message: string | null
          payment_methods: string[] | null
          phone_number: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          snapchat_pixels: string[] | null
          social_proof_enabled: boolean | null
          theme: string | null
          theme_config: Json | null
          tiktok_pixels: string[] | null
          tracking_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
          whatsapp_number: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "shops_public"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_shop_social_proof_orders: {
        Args: { _limit?: number; _shop_id: string }
        Returns: {
          created_at: string
          customer_name: string
          product_name: string
        }[]
      }
      get_top_sellers: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          full_name: string
          shop_id: string
          slug: string
          total_orders: number
          total_sales: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shop_role: {
        Args: {
          _role: Database["public"]["Enums"]["shop_collab_role"]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
      increment_promo_usage: { Args: { promo_code: string }; Returns: boolean }
      increment_shop_gif_count: { Args: { _shop_id: string }; Returns: number }
      is_shop_collaborator: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      is_shop_owner: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      is_shop_publicly_visible: { Args: { _shop_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      prepare_shop_activation_payment: {
        Args: { p_shop_id: string; p_user_id: string }
        Returns: Json
      }
      process_referral_signup: {
        Args: { referral_code_input: string; referred_user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_app_incident: {
        Args: {
          _category: string
          _dedupe_key: string
          _description?: string
          _metadata?: Json
          _severity: string
          _title: string
        }
        Returns: {
          category: string
          created_at: string
          dedupe_key: string
          description: string | null
          detected_at: string
          id: string
          last_seen_at: string
          metadata: Json
          notified_at: string | null
          occurrence_count: number
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "app_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_community_profiles: {
        Args: { _limit?: number; _query: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      slugify: { Args: { _value: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      validate_promo_code: {
        Args: { promo_code: string }
        Returns: {
          discount_percentage: number
          is_valid: boolean
          message: string
        }[]
      }
      verify_certificate_by_number: {
        Args: { _certificate_number: string }
        Returns: {
          certificate_number: string
          certificate_url: string
          completion_date: string
          course_title: string
          student_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "founder" | "co_founder" | "delivery"
      shop_collab_role:
        | "view_orders"
        | "edit_shop"
        | "manage_expenses"
        | "manage_delivered_orders"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "founder", "co_founder", "delivery"],
      shop_collab_role: [
        "view_orders",
        "edit_shop",
        "manage_expenses",
        "manage_delivered_orders",
      ],
    },
  },
} as const
