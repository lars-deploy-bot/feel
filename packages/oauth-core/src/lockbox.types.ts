// Auto-generated lockbox schema types
// Schema: lockbox.user_secrets
// For OAuth Core package

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  lockbox: {
    Tables: {
      user_secrets: {
        Row: {
          secret_id: string;
          clerk_id: string;
          namespace: 'provider_config' | 'oauth_tokens';
          name: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          version: number;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          secret_id?: string;
          clerk_id: string;
          namespace: 'provider_config' | 'oauth_tokens';
          name: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          version?: number;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          secret_id?: string;
          clerk_id?: string;
          namespace?: 'provider_config' | 'oauth_tokens';
          name?: string;
          ciphertext?: string;
          iv?: string;
          auth_tag?: string;
          version?: number;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_secrets_clerk_id_fkey';
            columns: ['clerk_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['user_id'];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};
