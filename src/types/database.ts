export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      experiments: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          subject: string | null;
          experiment_number: string | null;
          template_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          subject?: string | null;
          experiment_number?: string | null;
          template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          subject?: string | null;
          experiment_number?: string | null;
          template_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          experiment_id: string;
          file_path: string;
          file_type: string;
          processing_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          file_path: string;
          file_type: string;
          processing_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          file_path?: string;
          file_type?: string;
          processing_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          id: string;
          document_id: string;
          section_type: string;
          content: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          section_type: string;
          content?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          section_type?: string;
          content?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      observation_tables: {
        Row: {
          id: string;
          document_id: string;
          title: string | null;
          data_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          title?: string | null;
          data_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          title?: string | null;
          data_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calculations: {
        Row: {
          id: string;
          experiment_id: string;
          expression: string;
          inputs: Json;
          output: string | null;
          verification_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          expression: string;
          inputs?: Json;
          output?: string | null;
          verification_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          expression?: string;
          inputs?: Json;
          output?: string | null;
          verification_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          subject: string | null;
          configuration: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          subject?: string | null;
          configuration?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          subject?: string | null;
          configuration?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generated_documents: {
        Row: {
          id: string;
          experiment_id: string;
          format: string;
          file_path: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          format: string;
          file_path: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          experiment_id?: string;
          format?: string;
          file_path?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience export types
export type Experiment = Database['public']['Tables']['experiments']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type Section = Database['public']['Tables']['sections']['Row'];
export type ObservationTable = Database['public']['Tables']['observation_tables']['Row'];
export type Calculation = Database['public']['Tables']['calculations']['Row'];
export type Template = Database['public']['Tables']['templates']['Row'];
export type GeneratedDocument = Database['public']['Tables']['generated_documents']['Row'];
