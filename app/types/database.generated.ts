export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admin_mutation_audit: {
        Row: {
          action: string;
          entity_id: number;
          entity_type: string;
          id: number;
          metadata: Json;
          occurred_at: string;
          user_id: string;
        };
        Insert: {
          action: string;
          entity_id: number;
          entity_type: string;
          id?: never;
          metadata?: Json;
          occurred_at?: string;
          user_id?: string;
        };
        Update: {
          action?: string;
          entity_id?: number;
          entity_type?: string;
          id?: never;
          metadata?: Json;
          occurred_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      auth_audit_events: {
        Row: {
          correlation_id: string;
          event_type: string;
          id: number;
          metadata: Json;
          occurred_at: string;
          user_id: string;
        };
        Insert: {
          correlation_id: string;
          event_type: string;
          id?: never;
          metadata?: Json;
          occurred_at?: string;
          user_id?: string;
        };
        Update: {
          correlation_id?: string;
          event_type?: string;
          id?: never;
          metadata?: Json;
          occurred_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      boxscore_import_player_matches: {
        Row: {
          competition_id: number;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: number;
          import_id: number;
          roster_entry_id: number | null;
          source_player_name: string;
          source_team_name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: never;
          import_id: number;
          roster_entry_id?: number | null;
          source_player_name: string;
          source_team_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: never;
          import_id?: number;
          roster_entry_id?: number | null;
          source_player_name?: string;
          source_team_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boxscore_import_player_matches_import_competition_fkey";
            columns: ["import_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "boxscore_imports";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "boxscore_import_player_matches_roster_competition_fkey";
            columns: ["roster_entry_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "roster_entries";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      boxscore_imports: {
        Row: {
          competition_id: number;
          confirmed_at: string | null;
          created_at: string;
          created_by: string;
          error_code: string | null;
          game_id: number | null;
          id: number;
          parser_version: string;
          sha256: string;
          status: string;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by: string;
          error_code?: string | null;
          game_id?: number | null;
          id?: never;
          parser_version: string;
          sha256: string;
          status?: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          error_code?: string | null;
          game_id?: number | null;
          id?: never;
          parser_version?: string;
          sha256?: string;
          status?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boxscore_imports_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boxscore_imports_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          has_advanced_stats: boolean;
          id: number;
          is_active: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          has_advanced_stats?: boolean;
          id?: never;
          is_active?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          has_advanced_stats?: boolean;
          id?: never;
          is_active?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competition_series: {
        Row: {
          created_at: string;
          id: number;
          is_active: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          is_active?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          is_active?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competitions: {
        Row: {
          category_id: number;
          created_at: string;
          display_name: string;
          ends_on: string | null;
          id: number;
          published_at: string | null;
          series_id: number;
          starts_on: string | null;
          status: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          category_id: number;
          created_at?: string;
          display_name: string;
          ends_on?: string | null;
          id?: never;
          published_at?: string | null;
          series_id: number;
          starts_on?: string | null;
          status?: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          category_id?: number;
          created_at?: string;
          display_name?: string;
          ends_on?: string | null;
          id?: never;
          published_at?: string | null;
          series_id?: number;
          starts_on?: string | null;
          status?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competitions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitions_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "competition_series";
            referencedColumns: ["id"];
          },
        ];
      };
      final_placements: {
        Row: {
          competition_id: number;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          id: number;
          placement: number;
          registration_id: number;
          result_label: string | null;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: never;
          placement: number;
          registration_id: number;
          result_label?: string | null;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: never;
          placement?: number;
          registration_id?: number;
          result_label?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "final_placements_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "final_placements_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      foul_events: {
        Row: {
          created_at: string;
          elapsed_seconds: number | null;
          foul_code: string;
          game_id: number;
          game_roster_slot_id: number;
          id: number;
          period_number: number;
          sequence_number: number;
        };
        Insert: {
          created_at?: string;
          elapsed_seconds?: number | null;
          foul_code: string;
          game_id: number;
          game_roster_slot_id: number;
          id?: never;
          period_number: number;
          sequence_number: number;
        };
        Update: {
          created_at?: string;
          elapsed_seconds?: number | null;
          foul_code?: string;
          game_id?: number;
          game_roster_slot_id?: number;
          id?: never;
          period_number?: number;
          sequence_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "foul_events_period_fkey";
            columns: ["game_id", "period_number"];
            isOneToOne: false;
            referencedRelation: "game_periods";
            referencedColumns: ["game_id", "period_number"];
          },
          {
            foreignKeyName: "foul_events_slot_game_fkey";
            columns: ["game_roster_slot_id", "game_id"];
            isOneToOne: false;
            referencedRelation: "game_roster_slots";
            referencedColumns: ["id", "game_id"];
          },
        ];
      };
      game_participants: {
        Row: {
          competition_id: number;
          game_id: number;
          registration_id: number;
          side: string;
        };
        Insert: {
          competition_id: number;
          game_id: number;
          registration_id: number;
          side: string;
        };
        Update: {
          competition_id?: number;
          game_id?: number;
          registration_id?: number;
          side?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      game_period_scores: {
        Row: {
          game_id: number;
          period_number: number;
          points: number;
          registration_id: number;
        };
        Insert: {
          game_id: number;
          period_number: number;
          points?: number;
          registration_id: number;
        };
        Update: {
          game_id?: number;
          period_number?: number;
          points?: number;
          registration_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "game_period_scores_participant_fkey";
            columns: ["game_id", "registration_id"];
            isOneToOne: false;
            referencedRelation: "game_participants";
            referencedColumns: ["game_id", "registration_id"];
          },
          {
            foreignKeyName: "game_period_scores_participant_fkey";
            columns: ["game_id", "registration_id"];
            isOneToOne: false;
            referencedRelation: "game_scores";
            referencedColumns: ["game_id", "registration_id"];
          },
          {
            foreignKeyName: "game_period_scores_period_fkey";
            columns: ["game_id", "period_number"];
            isOneToOne: false;
            referencedRelation: "game_periods";
            referencedColumns: ["game_id", "period_number"];
          },
        ];
      };
      game_periods: {
        Row: {
          ended_at: string | null;
          game_id: number;
          period_number: number;
          started_at: string | null;
        };
        Insert: {
          ended_at?: string | null;
          game_id: number;
          period_number: number;
          started_at?: string | null;
        };
        Update: {
          ended_at?: string | null;
          game_id?: number;
          period_number?: number;
          started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_periods_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      game_roster_slots: {
        Row: {
          created_at: string;
          did_not_play: boolean;
          disqualification_reason: string | null;
          disqualified_at_period: number | null;
          game_id: number;
          id: number;
          is_applicable: boolean;
          is_captain: boolean;
          is_starter: boolean;
          jersey_number: string | null;
          registration_id: number;
          roster_entry_id: number | null;
          slot_number: number;
        };
        Insert: {
          created_at?: string;
          did_not_play?: boolean;
          disqualification_reason?: string | null;
          disqualified_at_period?: number | null;
          game_id: number;
          id?: never;
          is_applicable?: boolean;
          is_captain?: boolean;
          is_starter?: boolean;
          jersey_number?: string | null;
          registration_id: number;
          roster_entry_id?: number | null;
          slot_number: number;
        };
        Update: {
          created_at?: string;
          did_not_play?: boolean;
          disqualification_reason?: string | null;
          disqualified_at_period?: number | null;
          game_id?: number;
          id?: never;
          is_applicable?: boolean;
          is_captain?: boolean;
          is_starter?: boolean;
          jersey_number?: string | null;
          registration_id?: number;
          roster_entry_id?: number | null;
          slot_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "game_roster_slots_game_participant_fkey";
            columns: ["game_id", "registration_id"];
            isOneToOne: false;
            referencedRelation: "game_participants";
            referencedColumns: ["game_id", "registration_id"];
          },
          {
            foreignKeyName: "game_roster_slots_game_participant_fkey";
            columns: ["game_id", "registration_id"];
            isOneToOne: false;
            referencedRelation: "game_scores";
            referencedColumns: ["game_id", "registration_id"];
          },
          {
            foreignKeyName: "game_roster_slots_roster_registration_fkey";
            columns: ["roster_entry_id", "registration_id"];
            isOneToOne: false;
            referencedRelation: "roster_entries";
            referencedColumns: ["id", "registration_id"];
          },
        ];
      };
      games: {
        Row: {
          competition_id: number;
          created_at: string;
          created_by: string | null;
          ended_at: string | null;
          game_number: string | null;
          id: number;
          manual_idempotency_key: string | null;
          manual_payload_hash: string | null;
          scheduled_at: string | null;
          source: string;
          started_at: string | null;
          status: string;
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          competition_id: number;
          created_at?: string;
          created_by?: string | null;
          ended_at?: string | null;
          game_number?: string | null;
          id?: never;
          manual_idempotency_key?: string | null;
          manual_payload_hash?: string | null;
          scheduled_at?: string | null;
          source?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          competition_id?: number;
          created_at?: string;
          created_by?: string | null;
          ended_at?: string | null;
          game_number?: string | null;
          id?: never;
          manual_idempotency_key?: string | null;
          manual_payload_hash?: string | null;
          scheduled_at?: string | null;
          source?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
      };
      player_period_stats: {
        Row: {
          assists: number;
          blocks: number;
          defensive_rebounds: number;
          free_throw_attempted: number;
          free_throw_made: number;
          game_id: number;
          game_roster_slot_id: number;
          offensive_rebounds: number;
          period_number: number;
          plus_minus: number;
          points: number | null;
          seconds_played: number;
          steals: number;
          three_point_attempted: number;
          three_point_made: number;
          turnovers: number;
          two_point_attempted: number;
          two_point_made: number;
        };
        Insert: {
          assists?: number;
          blocks?: number;
          defensive_rebounds?: number;
          free_throw_attempted?: number;
          free_throw_made?: number;
          game_id: number;
          game_roster_slot_id: number;
          offensive_rebounds?: number;
          period_number: number;
          plus_minus?: number;
          points?: number | null;
          seconds_played?: number;
          steals?: number;
          three_point_attempted?: number;
          three_point_made?: number;
          turnovers?: number;
          two_point_attempted?: number;
          two_point_made?: number;
        };
        Update: {
          assists?: number;
          blocks?: number;
          defensive_rebounds?: number;
          free_throw_attempted?: number;
          free_throw_made?: number;
          game_id?: number;
          game_roster_slot_id?: number;
          offensive_rebounds?: number;
          period_number?: number;
          plus_minus?: number;
          points?: number | null;
          seconds_played?: number;
          steals?: number;
          three_point_attempted?: number;
          three_point_made?: number;
          turnovers?: number;
          two_point_attempted?: number;
          two_point_made?: number;
        };
        Relationships: [
          {
            foreignKeyName: "player_period_stats_period_fkey";
            columns: ["game_id", "period_number"];
            isOneToOne: false;
            referencedRelation: "game_periods";
            referencedColumns: ["game_id", "period_number"];
          },
          {
            foreignKeyName: "player_period_stats_slot_game_fkey";
            columns: ["game_roster_slot_id", "game_id"];
            isOneToOne: false;
            referencedRelation: "game_roster_slots";
            referencedColumns: ["id", "game_id"];
          },
        ];
      };
      players: {
        Row: {
          birth_date: string | null;
          created_at: string;
          full_name: string;
          id: number;
          is_active: boolean;
          is_public: boolean;
          slug: string;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          created_at?: string;
          full_name: string;
          id?: never;
          is_active?: boolean;
          is_public?: boolean;
          slug: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          created_at?: string;
          full_name?: string;
          id?: never;
          is_active?: boolean;
          is_public?: boolean;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roster_entries: {
        Row: {
          competition_id: number;
          created_at: string;
          id: number;
          jersey_number: string | null;
          joined_on: string | null;
          left_on: string | null;
          player_id: number;
          registration_id: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          created_at?: string;
          id?: never;
          jersey_number?: string | null;
          joined_on?: string | null;
          left_on?: string | null;
          player_id: number;
          registration_id: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          created_at?: string;
          id?: never;
          jersey_number?: string | null;
          joined_on?: string | null;
          left_on?: string | null;
          player_id?: number;
          registration_id?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_entries_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "roster_entries_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      team_registrations: {
        Row: {
          competition_id: number;
          confirmed_at: string | null;
          created_at: string;
          id: number;
          status: string;
          team_id: number;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          confirmed_at?: string | null;
          created_at?: string;
          id?: never;
          status?: string;
          team_id: number;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          confirmed_at?: string | null;
          created_at?: string;
          id?: never;
          status?: string;
          team_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_registrations_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_registrations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          abbreviation: string | null;
          created_at: string;
          id: number;
          is_active: boolean;
          is_public: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          abbreviation?: string | null;
          created_at?: string;
          id?: never;
          is_active?: boolean;
          is_public?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          abbreviation?: string | null;
          created_at?: string;
          id?: never;
          is_active?: boolean;
          is_public?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      competition_player_statistics: {
        Row: {
          assists: number | null;
          blocks: number | null;
          competition_id: number | null;
          defensive_rebounds: number | null;
          free_throw_attempted: number | null;
          free_throw_made: number | null;
          games_played: number | null;
          offensive_rebounds: number | null;
          player_id: number | null;
          player_name: string | null;
          player_slug: string | null;
          plus_minus: number | null;
          points: number | null;
          seconds_played: number | null;
          steals: number | null;
          three_point_attempted: number | null;
          three_point_made: number | null;
          turnovers: number | null;
          two_point_attempted: number | null;
          two_point_made: number | null;
        };
        Relationships: [];
      };
      game_player_statistics: {
        Row: {
          assists: number | null;
          blocks: number | null;
          competition_id: number | null;
          defensive_rebounds: number | null;
          did_not_play: boolean | null;
          fouls: number | null;
          free_throw_attempted: number | null;
          free_throw_made: number | null;
          game_id: number | null;
          game_roster_slot_id: number | null;
          jersey_number: string | null;
          offensive_rebounds: number | null;
          player_id: number | null;
          player_name: string | null;
          player_slug: string | null;
          plus_minus: number | null;
          points: number | null;
          registration_id: number | null;
          seconds_played: number | null;
          side: string | null;
          steals: number | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          three_point_attempted: number | null;
          three_point_made: number | null;
          turnovers: number | null;
          two_point_attempted: number | null;
          two_point_made: number | null;
        };
        Relationships: [];
      };
      game_scores: {
        Row: {
          competition_id: number | null;
          game_id: number | null;
          registration_id: number | null;
          score: number | null;
          side: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      manual_scoresheet_prefill: {
        Row: {
          competition_id: number | null;
          game_id: number | null;
          jersey_number: string | null;
          registration_id: number | null;
          roster_entry_id: number | null;
          slot_number: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_registrations_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
      };
      player_achievements: {
        Row: {
          competition_id: number | null;
          confirmed_at: string | null;
          placement: number | null;
          player_id: number | null;
          registration_id: number | null;
          result_label: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "final_placements_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "final_placements_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      player_jersey_history: {
        Row: {
          competition_id: number | null;
          game_id: number | null;
          jersey_number: string | null;
          player_id: number | null;
          used_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      player_primary_jerseys: {
        Row: {
          game_count: number | null;
          jersey_number: string | null;
          most_recent_use: string | null;
          player_id: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      team_achievements: {
        Row: {
          competition_id: number | null;
          confirmed_at: string | null;
          placement: number | null;
          registration_id: number | null;
          result_label: string | null;
          team_id: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "final_placements_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "final_placements_registration_competition_fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "team_registrations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_create_manual_scoresheet: {
        Args: { p_payload: Json };
        Returns: number;
      };
      admin_create_team_registration: {
        Args: { p_competition_id: number; p_team_id: number };
        Returns: {
          competition_id: number;
          confirmed_at: string | null;
          created_at: string;
          id: number;
          status: string;
          team_id: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "team_registrations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_replace_roster: {
        Args: { p_entries: Json; p_registration_id: number };
        Returns: {
          competition_id: number;
          created_at: string;
          id: number;
          jersey_number: string | null;
          joined_on: string | null;
          left_on: string | null;
          player_id: number;
          registration_id: number;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "roster_entries";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_transition_team_registration: {
        Args: { p_registration_id: number; p_status: string };
        Returns: {
          competition_id: number;
          confirmed_at: string | null;
          created_at: string;
          id: number;
          status: string;
          team_id: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "team_registrations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_current_admin: { Args: never; Returns: boolean };
      is_current_admin_aal2: { Args: never; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
