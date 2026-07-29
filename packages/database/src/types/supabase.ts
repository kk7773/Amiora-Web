/**
 * Supabase Database Types — Amiora Diamonds
 *
 * Regenerate anytime with:
 *   pnpm supabase gen types typescript --project-id <your-project-id> \
 *     > packages/database/src/types/supabase.ts
 *
 * Includes migrations through 010_cms_shop_color_purity_catalog.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─── Enum helpers ────────────────────────────────────────────────────────────
export type MaterialType       = 'metal' | 'gem'
export type MetalPurity        = '22k' | '18k' | '14k' | '9k' | '92.5'
export type StockStatus        = 'in_stock' | 'made_to_order' | 'out_of_stock'
export type SizeType           = 'ring_us' | 'ring_eu' | 'bangle_mm' | 'chain_inch' | 'other'
export type GenderType         = 'male' | 'female' | 'other' | 'prefer_not_to_say'
export type OrderStatus        = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentMode        = 'online' | 'pay_at_store'
export type PaymentStatus      = 'pending' | 'paid' | 'failed' | 'refunded'
export type CustomRequestStatus = 'pending' | 'reviewed' | 'possible' | 'not_possible'
export type CallbackStatus     = 'pending' | 'called' | 'no_answer'
export type DemoRequestType    = 'visit_store' | 'home_visit'
export type DemoStatus         = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type NotificationType   = 'new_order' | 'custom_request' | 'callback' | 'demo_request' | 'review'
export type LiveMetal          = 'gold_999' | 'silver_999' | 'diamond_ct'
export type ProductPublishStatus = 'draft' | 'active' | 'archived'

// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {

      // ── materials ──────────────────────────────────────────────────────────
      materials: {
        Row: {
          id: string
          name: string
          type: MaterialType
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: MaterialType
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── metal_variants ─────────────────────────────────────────────────────
      metal_variants: {
        Row: {
          id: string
          material_id: string
          variant_name: string
          purities: string[]
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          variant_name: string
          purities: string[]
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── gem_variants ───────────────────────────────────────────────────────
      gem_variants: {
        Row: {
          id: string
          material_id: string
          cut_name: string
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          cut_name: string
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── live_prices ────────────────────────────────────────────────────────
      live_prices: {
        Row: {
          id: string
          metal: LiveMetal
          price_per_gram: number
          currency: string
          fetched_at: string
        }
        Insert: {
          id?: string
          metal: LiveMetal
          price_per_gram: number
          currency?: string
          fetched_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── categories ─────────────────────────────────────────────────────────
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          image_url: string | null
          is_active: boolean
          sort_order: number
          parent_id: string | null
          code: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          parent_id?: string | null
          code?: string | null
          display_order?: number
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── collections ────────────────────────────────────────────────────────
      collections: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          banner_url: string | null
          thumb_url: string | null
          is_active: boolean
          sort_order: number
          parent_id: string | null
          menu_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          banner_url?: string | null
          thumb_url?: string | null
          is_active?: boolean
          sort_order?: number
          parent_id?: string | null
          menu_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── collection_products ──────────────────────────────────────────────────
      collection_products: {
        Row: {
          collection_id: string
          product_id: string
          display_order: number
          created_at: string
        }
        Insert: {
          collection_id: string
          product_id: string
          display_order?: number
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── tags ───────────────────────────────────────────────────────────────
      tags: {
        Row: {
          id: string
          name: string
          slug: string
          color: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          color?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── product_tags ─────────────────────────────────────────────────────────
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── metal_purities ───────────────────────────────────────────────────────
      metal_purities: {
        Row: {
          id: string
          label: string
          code: string
          display_order: number
          metal: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          code: string
          display_order?: number
          metal?: string
          is_active?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── metal_colors ─────────────────────────────────────────────────────────
      metal_colors: {
        Row: {
          id: string
          label: string
          code: string
          hex: string | null
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          code: string
          hex?: string | null
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── products ───────────────────────────────────────────────────────────
      products: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          short_desc: string | null
          category_id: string | null
          collection_id: string | null
          product_number: number
          design_number: string | null
          product_code: string | null
          diamond_shape: string | null
          diamond_count: number | null
          total_diamond_wt: number | null
          diamond_color: string | null
          diamond_clarity: string | null
          size_range: string | null
          chain_lengths: Json
          metal_weight_g: number | null
          status: ProductPublishStatus
          is_featured: boolean
          is_new_arrival: boolean
          is_best_seller: boolean
          is_coming_soon: boolean
          making_charge_pct: number
          making_charge_discount_pct: number
          gem_price_discount_pct: number
          has_stone: boolean
          stone_lines: Json
          faqs: Json
          meta_title: string | null
          meta_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          short_desc?: string | null
          category_id?: string | null
          collection_id?: string | null
          product_number?: number
          design_number?: string | null
          product_code?: string | null
          diamond_shape?: string | null
          diamond_count?: number | null
          total_diamond_wt?: number | null
          diamond_color?: string | null
          diamond_clarity?: string | null
          size_range?: string | null
          chain_lengths?: Json
          metal_weight_g?: number | null
          status?: ProductPublishStatus
          is_featured?: boolean
          is_new_arrival?: boolean
          is_best_seller?: boolean
          is_coming_soon?: boolean
          making_charge_pct?: number
          making_charge_discount_pct?: number
          gem_price_discount_pct?: number
          has_stone?: boolean
          stone_lines?: Json
          faqs?: Json
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── product_color_groups ────────────────────────────────────────────────
      product_color_groups: {
        Row: {
          id: string
          product_id: string
          color_id: string
          images: string[]
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          color_id: string
          images?: string[]
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── product_variants ───────────────────────────────────────────────────
      product_variants: {
        Row: {
          id: string
          product_id: string
          color_group_id: string
          color_id: string
          purity_id: string
          sku: string
          price: number
          stock_qty: number
          metal_weight_g: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          color_group_id: string
          color_id: string
          purity_id: string
          sku: string
          price: number
          stock_qty?: number
          metal_weight_g?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── product_variant_sizes ─────────────────────────────────────────────
      product_variant_sizes: {
        Row: {
          id: string
          product_id: string
          variant_id: string
          size_label: string
          size_type: 'ring_us' | 'chain_inch'
          stock_qty: number
          price_override: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          variant_id: string
          size_label: string
          size_type: 'ring_us' | 'chain_inch'
          stock_qty?: number
          price_override?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── product_images ─────────────────────────────────────────────────────
      product_images: {
        Row: {
          id: string
          product_id: string
          url: string
          alt_text: string | null
          sort_order: number
          is_primary: boolean
          is_hover: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          url: string
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
          is_hover?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── smart_pairs ────────────────────────────────────────────────────────
      smart_pairs: {
        Row: {
          id: string
          product_id: string
          paired_product_id: string
          reason: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          product_id: string
          paired_product_id: string
          reason?: string | null
          sort_order?: number
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── user_profiles ──────────────────────────────────────────────────────
      user_profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          date_of_birth: string | null
          gender: GenderType | null
          profile_pic: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: GenderType | null
          profile_pic?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Database['public']['Tables']['user_profiles']['Insert'], 'id'>>
      }

      // ── addresses ──────────────────────────────────────────────────────────
      addresses: {
        Row: {
          id: string
          user_id: string
          label: string
          full_name: string
          phone: string
          line1: string
          line2: string | null
          city: string
          state: string
          pincode: string
          country: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label?: string
          full_name: string
          phone: string
          line1: string
          line2?: string | null
          city: string
          state: string
          pincode: string
          country?: string
          is_default?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── wishlists ──────────────────────────────────────────────────────────
      wishlists: {
        Row: {
          id: string
          user_id: string
          product_id: string
          variant_id: string | null
          added_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          variant_id?: string | null
          added_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── orders ─────────────────────────────────────────────────────────────
      orders: {
        Row: {
          id: string
          order_number: string
          user_id: string | null
          guest_email: string | null
          coupon_id: string | null
          coupon_code: string | null
          status: OrderStatus
          payment_mode: PaymentMode | null
          payment_status: PaymentStatus
          payment_ref: string | null
          subtotal: number
          making_charges: number
          tax_amount: number
          shipping_amount: number
          discount_amount: number
          total_amount: number
          shipping_address_id: string | null
          store_pickup_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number?: string
          user_id?: string | null
          guest_email?: string | null
          coupon_id?: string | null
          coupon_code?: string | null
          status?: OrderStatus
          payment_mode?: PaymentMode | null
          payment_status?: PaymentStatus
          payment_ref?: string | null
          subtotal: number
          making_charges?: number
          tax_amount?: number
          shipping_amount?: number
          discount_amount?: number
          total_amount: number
          shipping_address_id?: string | null
          store_pickup_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── order_items ────────────────────────────────────────────────────────
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          variant_id: string | null
          size_label: string | null
          product_name: string
          variant_label: string
          metal_weight_g: number | null
          gold_price_used: number | null
          making_charge: number | null
          gem_price: number | null
          unit_price: number
          quantity: number
          subtotal: number
          image_url: string | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          variant_id?: string | null
          size_label?: string | null
          product_name: string
          variant_label: string
          metal_weight_g?: number | null
          gold_price_used?: number | null
          making_charge?: number | null
          gem_price?: number | null
          unit_price: number
          quantity?: number
          subtotal: number
          image_url?: string | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── customization_requests ─────────────────────────────────────────────
      customization_requests: {
        Row: {
          id: string
          user_id: string | null
          product_id: string | null
          description: string
          reference_images: string[] | null
          status: CustomRequestStatus
          admin_reply: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          product_id?: string | null
          description: string
          reference_images?: string[] | null
          status?: CustomRequestStatus
          admin_reply?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── callback_requests ──────────────────────────────────────────────────
      callback_requests: {
        Row: {
          id: string
          user_id: string | null
          name: string
          phone: string
          preferred_time: string | null
          message: string | null
          status: CallbackStatus
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          phone: string
          preferred_time?: string | null
          message?: string | null
          status?: CallbackStatus
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── demo_requests ──────────────────────────────────────────────────────
      demo_requests: {
        Row: {
          id: string
          user_id: string | null
          request_type: DemoRequestType
          store_id: string | null
          address_id: string | null
          preferred_date: string | null
          preferred_time: string | null
          products_interest: string[] | null
          notes: string | null
          status: DemoStatus
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          request_type: DemoRequestType
          store_id?: string | null
          address_id?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          products_interest?: string[] | null
          notes?: string | null
          status?: DemoStatus
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── stores ─────────────────────────────────────────────────────────────
      stores: {
        Row: {
          id: string
          name: string
          address: string
          city: string
          state: string
          pincode: string | null
          phone: string | null
          email: string | null
          lat: number | null
          lng: number | null
          timings: Json | null
          is_active: boolean
          image_url: string | null
        }
        Insert: {
          id?: string
          name: string
          address: string
          city: string
          state: string
          pincode?: string | null
          phone?: string | null
          email?: string | null
          lat?: number | null
          lng?: number | null
          timings?: Json | null
          is_active?: boolean
          image_url?: string | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── reviews ────────────────────────────────────────────────────────────
      reviews: {
        Row: {
          id: string
          product_id: string
          user_id: string | null
          order_item_id: string | null
          rating: number
          title: string | null
          body: string | null
          images: string[] | null
          is_approved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          user_id?: string | null
          order_item_id?: string | null
          rating: number
          title?: string | null
          body?: string | null
          images?: string[] | null
          is_approved?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── testimonials ───────────────────────────────────────────────────────
      testimonials: {
        Row: {
          id: string
          name: string
          location: string | null
          avatar_url: string | null
          quote: string
          rating: number
          is_featured: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          avatar_url?: string | null
          quote: string
          rating?: number
          is_featured?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── blogs ──────────────────────────────────────────────────────────────
      blogs: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          body: string
          cover_url: string | null
          author: string
          tags: string[] | null
          is_published: boolean
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          body: string
          cover_url?: string | null
          author?: string
          tags?: string[] | null
          is_published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── notifications ──────────────────────────────────────────────────────
      notifications: {
        Row: {
          id: string
          type: NotificationType
          ref_id: string | null
          message: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: NotificationType
          ref_id?: string | null
          message: string
          is_read?: boolean
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── profiles ─────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id:         string
          email:      string | null
          full_name:  string | null
          role:       'super_admin' | 'admin'
          is_active:  boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id:         string
          email?:     string | null
          full_name?: string | null
          role?:      'super_admin' | 'admin'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── cms_tabs ──────────────────────────────────────────────────────────
      cms_tabs: {
        Row: {
          id:         string
          slug:       string
          label:      string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?:         string
          slug:        string
          label:       string
          sort_order?: number
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── admin_tab_permissions ─────────────────────────────────────────────
      admin_tab_permissions: {
        Row: {
          id:          string
          admin_id:    string
          tab_id:      string
          can_view:    boolean
          can_edit:    boolean
          assigned_by: string | null
          created_at:  string
        }
        Insert: {
          id?:          string
          admin_id:     string
          tab_id:       string
          can_view?:    boolean
          can_edit?:    boolean
          assigned_by?: string | null
          created_at?:  string
        }
        Update: Record<string, unknown>
        Relationships: [
          { foreignKeyName: 'admin_tab_permissions_admin_id_fkey'; columns: ['admin_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'admin_tab_permissions_tab_id_fkey';   columns: ['tab_id'];   referencedRelation: 'cms_tabs'; referencedColumns: ['id'] },
        ]
      }

      // ── cms_admin_permissions (legacy) ────────────────────────────────────
      cms_admin_permissions: {
        Row: {
          id:        string
          user_id:   string
          tab_slug:  string
          created_at: string
        }
        Insert: {
          id?:        string
          user_id:    string
          tab_slug:   string
          created_at?: string
        }
        Update: Record<string, unknown>
        Relationships: []
      }

      // ── admin_audit_logs ──────────────────────────────────────────────────
      admin_audit_logs: {
        Row: {
          id:          string
          admin_id:    string | null
          action:      string
          resource:    string | null
          resource_id: string | null
          meta:        Record<string, unknown> | null
          created_at:  string
        }
        Insert: {
          id?:          string
          admin_id?:    string | null
          action:       string
          resource?:    string | null
          resource_id?: string | null
          meta?:        Record<string, unknown> | null
          created_at?:  string
        }
        Update: Record<string, unknown>
        Relationships: [
          { foreignKeyName: 'admin_audit_logs_admin_id_fkey'; columns: ['admin_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      cms_user_has_tab: {
        Args: { p_slug: string }
        Returns: boolean
      }
    }

    Enums: {
      material_type: MaterialType
      stock_status: StockStatus
      order_status: OrderStatus
      payment_status: PaymentStatus
      live_metal: LiveMetal
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ─── Convenience Row type aliases ────────────────────────────────────────────
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
