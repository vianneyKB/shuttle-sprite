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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      booking_stops: {
        Row: {
          address: string
          booking_id: string
          created_at: string
          id: string
          notes: string | null
          stop_order: number
          type: Database["public"]["Enums"]["stop_type"]
        }
        Insert: {
          address: string
          booking_id: string
          created_at?: string
          id?: string
          notes?: string | null
          stop_order: number
          type: Database["public"]["Enums"]["stop_type"]
        }
        Update: {
          address?: string
          booking_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          stop_order?: number
          type?: Database["public"]["Enums"]["stop_type"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_stops_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          currency: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_phone: string
          days_of_week: string[]
          duration: number
          end_date: string | null
          id: string
          is_recurring: boolean
          passengers: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: string
          price_breakdown: Json
          special_requests: string | null
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          time: string
          total_price: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_phone: string
          days_of_week?: string[]
          duration: number
          end_date?: string | null
          id?: string
          is_recurring?: boolean
          passengers: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          price_breakdown?: Json
          special_requests?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          time: string
          total_price: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          days_of_week?: string[]
          duration?: number
          end_date?: string | null
          id?: string
          is_recurring?: boolean
          passengers?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          price_breakdown?: Json
          special_requests?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          time?: string
          total_price?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_settings: {
        Row: {
          additional_stop_fee: number
          created_at: string
          currency: string
          operator_id: string
          prices_include_tax: boolean
          tax_label: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          additional_stop_fee?: number
          created_at?: string
          currency?: string
          operator_id: string
          prices_include_tax?: boolean
          tax_label?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          additional_stop_fee?: number
          created_at?: string
          currency?: string
          operator_id?: string
          prices_include_tax?: boolean
          tax_label?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          location: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          location?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ride_requests: {
        Row: {
          created_at: string
          customer_id: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          id: string
          notes: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          passengers: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: string
          route_id: string | null
          scheduled_at: string | null
          operator_id: string | null
          vehicle_id: string | null
          assigned_at: string | null
          started_at: string | null
          completed_at: string | null
          status: Database["public"]["Enums"]["ride_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          id?: string
          notes?: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          passengers?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          route_id?: string | null
          scheduled_at?: string | null
          operator_id?: string | null
          vehicle_id?: string | null
          assigned_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          status?: Database["public"]["Enums"]["ride_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          id?: string
          notes?: string | null
          origin_lat?: number
          origin_lng?: number
          origin_name?: string
          passengers?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          route_id?: string | null
          scheduled_at?: string | null
          operator_id?: string | null
          vehicle_id?: string | null
          assigned_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          status?: Database["public"]["Enums"]["ride_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lat: number
          lng: number
          name: string
          route_id: string
          stop_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          route_id: string
          stop_order: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          route_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shuttle_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      shuttle_routes: {
        Row: {
          created_at: string
          description: string | null
          geometry: Json
          id: string
          is_active: boolean
          name: string
          operating_hours: string | null
          operator_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          geometry?: Json
          id?: string
          is_active?: boolean
          name: string
          operating_hours?: string | null
          operator_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          geometry?: Json
          id?: string
          is_active?: boolean
          name?: string
          operating_hours?: string | null
          operator_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          available: boolean
          capacity: number
          created_at: string
          features: string[]
          id: string
          image: string | null
          location: string
          make: string
          model: string
          operator_id: string
          price_per_day: number
          price_per_hour: number
          rating: number
          reviews: number
          updated_at: string
          year: number
        }
        Insert: {
          available?: boolean
          capacity: number
          created_at?: string
          features?: string[]
          id?: string
          image?: string | null
          location: string
          make: string
          model: string
          operator_id: string
          price_per_day: number
          price_per_hour: number
          rating?: number
          reviews?: number
          updated_at?: string
          year: number
        }
        Update: {
          available?: boolean
          capacity?: number
          created_at?: string
          features?: string[]
          id?: string
          image?: string | null
          location?: string
          make?: string
          model?: string
          operator_id?: string
          price_per_day?: number
          price_per_hour?: number
          rating?: number
          reviews?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_booking_price: {
        Args: {
          _days_of_week_count: number
          _duration: number
          _stop_count: number
          _vehicle_id: string
        }
        Returns: Json
      }
      create_booking: {
        Args: {
          _customer_email: string
          _customer_name: string
          _customer_phone: string
          _days_of_week?: string[]
          _duration: number
          _passengers: number
          _payment_method?: Database["public"]["Enums"]["payment_method"]
          _special_requests?: string | null
          _start_date: string
          _stops: Json
          _time: string
          _vehicle_id: string
        }
        Returns: string
      }
      get_my_ride_vehicles: {
        Args: Record<PropertyKey, never>
        Returns: {
          capacity: number
          make: string
          model: string
          vehicle_id: string
          year: number
        }[]
      }
      get_passenger_queue: {
        Args: never
        Returns: {
          destination_lat: number
          destination_lng: number
          destination_name: string
          origin_lat: number
          origin_lng: number
          origin_name: string
          request_count: number
          total_passengers: number
        }[]
      }
      dispatch_ride_request: {
        Args: {
          _id: string
          _status?: Database["public"]["Enums"]["ride_request_status"] | null
          _vehicle_id?: string | null
        }
        Returns: Database["public"]["Tables"]["ride_requests"]["Row"]
      }
      save_route_stops: {
        Args: {
          _route_id: string
          _stops: Json
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          lat: number
          lng: number
          name: string
          route_id: string
          stop_order: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "customer"
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      payment_method: "cash" | "prepay"
      ride_request_status:
        | "awaiting"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      stop_type: "pickup" | "dropoff" | "stop"
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
      app_role: ["admin", "operator", "customer"],
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      payment_method: ["cash", "prepay"],
      ride_request_status: [
        "awaiting",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      stop_type: ["pickup", "dropoff", "stop"],
    },
  },
} as const
