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
          showcase_site_id: string
          title: string
          updated_at: string | null
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
          showcase_site_id: string
          title: string
          updated_at?: string | null
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
          showcase_site_id?: string
          title?: string
          updated_at?: string | null
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
      enrollments: {
        Row: {
          amount_paid: number | null
          course_id: string
          created_at: string | null
          id: string
          payment_method: string | null
          payment_proof_url: string | null
          payment_status: string
          showcase_site_id: string
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
          showcase_site_id: string
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
          showcase_site_id?: string
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
      profiles: {
        Row: {
          country: string | null
          created_at: string | null
          email: string | null
          free_generations_remaining: number
          free_video_generations_remaining: number
          full_name: string | null
          has_showcase_access: boolean | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          purchased_credits: number | null
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          email?: string | null
          free_generations_remaining?: number
          free_video_generations_remaining?: number
          full_name?: string | null
          has_showcase_access?: boolean | null
          id: string
          onboarding_completed?: boolean
          phone?: string | null
          purchased_credits?: number | null
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          email?: string | null
          free_generations_remaining?: number
          free_video_generations_remaining?: number
          full_name?: string | null
          has_showcase_access?: boolean | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          purchased_credits?: number | null
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
          og_image_url: string | null
          og_type: string | null
          owner_name: string
          owner_photo_url: string | null
          phone_number: string
          primary_color: string | null
          professional_experience: Json | null
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
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
          og_image_url?: string | null
          og_type?: string | null
          owner_name: string
          owner_photo_url?: string | null
          phone_number: string
          primary_color?: string | null
          professional_experience?: Json | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
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
          og_image_url?: string | null
          og_type?: string | null
          owner_name?: string
          owner_photo_url?: string | null
          phone_number?: string
          primary_color?: string | null
          professional_experience?: Json | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_trash: { Args: never; Returns: undefined }
      count_processing_generations: { Args: never; Returns: number }
      generate_certificate_number: { Args: never; Returns: string }
      generate_referral_code: { Args: { user_id: string }; Returns: string }
      get_next_queue_item: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_promo_usage: { Args: { promo_code: string }; Returns: boolean }
      process_referral_signup: {
        Args: { referral_code_input: string; referred_user_id: string }
        Returns: boolean
      }
      validate_promo_code: {
        Args: { promo_code: string }
        Returns: {
          discount_percentage: number
          is_valid: boolean
          message: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "founder" | "co_founder"
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
      app_role: ["admin", "user", "founder", "co_founder"],
    },
  },
} as const
