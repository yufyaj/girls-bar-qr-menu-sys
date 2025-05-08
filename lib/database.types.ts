export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          store_id: string
          store_code: string
          name: string
        }
        Insert: {
          store_id?: string
          store_code: string
          name: string
        }
        Update: {
          store_id?: string
          store_code?: string
          name?: string
        }
      }
      store_users: {
        Row: {
          id: string
          store_id: string
          user_id: string
          role: string
        }
        Insert: {
          id?: string
          store_id: string
          user_id: string
          role: string
        }
        Update: {
          id?: string
          store_id?: string
          user_id?: string
          role?: string
        }
      }
      seat_types: {
        Row: {
          seat_type_id: string  // UUIDだがTypeScriptでは文字列として扱う
          store_id: string
          display_name: string
          price_per_unit: number  // 時間単位あたりの料金
          time_unit_minutes: number
        }
        Insert: {
          seat_type_id?: string  // 自動生成されるため省略可能
          store_id: string
          display_name: string
          price_per_unit: number  // 時間単位あたりの料金
          time_unit_minutes?: number
        }
        Update: {
          seat_type_id?: string
          store_id?: string
          display_name?: string
          price_per_unit?: number  // 時間単位あたりの料金
          time_unit_minutes?: number
        }
      }
      tables: {
        Row: {
          table_id: string
          store_id: string
          name: string
          seat_type_id: string
        }
        Insert: {
          table_id?: string
          store_id: string
          name: string
          seat_type_id: string
        }
        Update: {
          table_id?: string
          store_id?: string
          name?: string
          seat_type_id?: string
        }
      }
      sessions: {
        Row: {
          session_id: string
          store_id: string
          table_id: string
          start_at: string
          charge_started_at: string | null
        }
        Insert: {
          session_id?: string
          store_id: string
          table_id: string
          start_at?: string
          charge_started_at?: string | null
        }
        Update: {
          session_id?: string
          store_id?: string
          table_id?: string
          start_at?: string
          charge_started_at?: string | null
        }
      }
      session_seat_events: {
        Row: {
          event_id: string
          session_id: string
          seat_type_id: string
          price_snapshot: number
          changed_at: string
        }
        Insert: {
          event_id?: string
          session_id: string
          seat_type_id: string
          price_snapshot: number
          changed_at?: string
        }
        Update: {
          event_id?: string
          session_id?: string
          seat_type_id?: string
          price_snapshot?: number
          changed_at?: string
        }
      }
      orders: {
        Row: {
          order_id: string
          store_id: string
          session_id: string
          status: string
          created_by_role: string | null
          proxy: boolean
          created_at: string
        }
        Insert: {
          order_id?: string
          store_id: string
          session_id: string
          status: string
          created_by_role?: string | null
          proxy?: boolean
          created_at?: string
        }
        Update: {
          order_id?: string
          store_id?: string
          session_id?: string
          status?: string
          created_by_role?: string | null
          proxy?: boolean
          created_at?: string
        }
      }
    }
  }
}
