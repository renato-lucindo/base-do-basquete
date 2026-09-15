export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
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
          resolution_kind: string | null;
          roster_entry_id: number | null;
          similarity_score: number | null;
          source_jersey_number: string;
          source_player_name: string;
          source_team_name: string;
          status: string;
          suggested_player_id: number | null;
          suggestion_kind: string;
          suggestion_payload: Json;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: never;
          import_id: number;
          resolution_kind?: string | null;
          roster_entry_id?: number | null;
          similarity_score?: number | null;
          source_jersey_number?: string;
          source_player_name: string;
          source_team_name: string;
          status?: string;
          suggested_player_id?: number | null;
          suggestion_kind?: string;
          suggestion_payload?: Json;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: never;
          import_id?: number;
          resolution_kind?: string | null;
          roster_entry_id?: number | null;
          similarity_score?: number | null;
          source_jersey_number?: string;
          source_player_name?: string;
          source_team_name?: string;
          status?: string;
          suggested_player_id?: number | null;
          suggestion_kind?: string;
          suggestion_payload?: Json;
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
          {
            foreignKeyName: "boxscore_import_player_matches_suggested_player_id_fkey";
            columns: ["suggested_player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "boxscore_import_player_matches_suggested_player_id_fkey";
            columns: ["suggested_player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
            referencedColumns: ["id"];
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
          file_size_bytes: number;
          game_id: number | null;
          id: number;
          parsed_payload: Json;
          parser_version: string;
          resolution_payload: Json | null;
          sha256: string;
          source_filename: string;
          status: string;
          storage_path: string;
          updated_at: string;
          validation_payload: Json;
        };
        Insert: {
          competition_id: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by: string;
          error_code?: string | null;
          file_size_bytes?: number;
          game_id?: number | null;
          id?: never;
          parsed_payload?: Json;
          parser_version: string;
          resolution_payload?: Json | null;
          sha256: string;
          source_filename?: string;
          status?: string;
          storage_path: string;
          updated_at?: string;
          validation_payload?: Json;
        };
        Update: {
          competition_id?: number;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          error_code?: string | null;
          file_size_bytes?: number;
          game_id?: number | null;
          id?: never;
          parsed_payload?: Json;
          parser_version?: string;
          resolution_payload?: Json | null;
          sha256?: string;
          source_filename?: string;
          status?: string;
          storage_path?: string;
          updated_at?: string;
          validation_payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "boxscore_imports_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "boxscore_imports_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "boxscore_imports_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "boxscore_imports_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "boxscore_imports_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id", "competition_id"];
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
      competition_entries: {
        Row: {
          competition_id: number;
          id: number;
          ruleset_revision_id: number;
          seed: number;
        };
        Insert: {
          competition_id: number;
          id?: never;
          ruleset_revision_id: number;
          seed: number;
        };
        Update: {
          competition_id?: number;
          id?: never;
          ruleset_revision_id?: number;
          seed?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competition_entries_ruleset_revision_id_competition_id_fkey";
            columns: ["ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_ruleset_revisions";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      competition_entry_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          competition_id: number;
          entry_id: number;
          registration_id: number;
          ruleset_revision_id: number;
        };
        Insert: {
          assigned_at?: string;
          assigned_by: string;
          competition_id: number;
          entry_id: number;
          registration_id: number;
          ruleset_revision_id: number;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          competition_id?: number;
          entry_id?: number;
          registration_id?: number;
          ruleset_revision_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competition_entry_assignments_entry_id_ruleset_revision_id_fkey";
            columns: ["entry_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_entries";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "competition_entry_assignments_registration_id_competition__fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "competition_entry_assignments_registration_id_competition__fkey";
            columns: ["registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      competition_groups: {
        Row: {
          code: string;
          competition_id: number;
          id: number;
          ruleset_revision_id: number;
          stage_id: number;
        };
        Insert: {
          code: string;
          competition_id: number;
          id?: never;
          ruleset_revision_id: number;
          stage_id: number;
        };
        Update: {
          code?: string;
          competition_id?: number;
          id?: never;
          ruleset_revision_id?: number;
          stage_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competition_groups_stage_id_ruleset_revision_id_competitio_fkey";
            columns: ["stage_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_stages";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
        ];
      };
      competition_publications: {
        Row: {
          competition_id: number;
          id: number;
          publication_kind: string;
          published_at: string;
          published_by: string | null;
          snapshot: Json;
          snapshot_hash: string;
          snapshot_schema_version: number;
          version: number;
        };
        Insert: {
          competition_id: number;
          id?: never;
          publication_kind: string;
          published_at?: string;
          published_by?: string | null;
          snapshot: Json;
          snapshot_hash: string;
          snapshot_schema_version?: number;
          version: number;
        };
        Update: {
          competition_id?: number;
          id?: never;
          publication_kind?: string;
          published_at?: string;
          published_by?: string | null;
          snapshot?: Json;
          snapshot_hash?: string;
          snapshot_schema_version?: number;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competition_publications_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "competition_publications_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
      };
      competition_round_byes: {
        Row: {
          bye_order: number;
          competition_id: number;
          entry_id: number;
          round_id: number;
          ruleset_revision_id: number;
        };
        Insert: {
          bye_order: number;
          competition_id: number;
          entry_id: number;
          round_id: number;
          ruleset_revision_id: number;
        };
        Update: {
          bye_order?: number;
          competition_id?: number;
          entry_id?: number;
          round_id?: number;
          ruleset_revision_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competition_round_byes_entry_id_ruleset_revision_id_compet_fkey";
            columns: ["entry_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_entries";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "competition_round_byes_round_id_ruleset_revision_id_compet_fkey";
            columns: ["round_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_rounds";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
        ];
      };
      competition_rounds: {
        Row: {
          capacity: number | null;
          code: string;
          competition_id: number;
          created_at: string;
          group_id: number | null;
          id: number;
          max_matchups: number | null;
          name: string;
          round_order: number;
          round_role: string | null;
          ruleset_revision_id: number | null;
          stage_id: number;
          structure_kind: string;
          updated_at: string;
        };
        Insert: {
          capacity?: number | null;
          code: string;
          competition_id: number;
          created_at?: string;
          group_id?: number | null;
          id?: never;
          max_matchups?: number | null;
          name: string;
          round_order: number;
          round_role?: string | null;
          ruleset_revision_id?: number | null;
          stage_id: number;
          structure_kind: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          code?: string;
          competition_id?: number;
          created_at?: string;
          group_id?: number | null;
          id?: never;
          max_matchups?: number | null;
          name?: string;
          round_order?: number;
          round_role?: string | null;
          ruleset_revision_id?: number | null;
          stage_id?: number;
          structure_kind?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competition_rounds_stage_competition_fkey";
            columns: ["stage_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_stages";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "round_preset_group_fkey";
            columns: ["group_id", "stage_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_groups";
            referencedColumns: ["id", "stage_id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "round_preset_stage_fkey";
            columns: ["stage_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_stages";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
        ];
      };
      competition_ruleset_revisions: {
        Row: {
          activated_at: string | null;
          competition_id: number;
          created_at: string;
          created_by: string | null;
          cloned_from_gender_division: string | null;
          cloned_from_revision_id: number | null;
          entry_count: number | null;
          gender_recompiled: boolean;
          id: number;
          preset_key: string | null;
          preset_version: number | null;
          revision_number: number;
          status: string;
          structure_kind: string;
          updated_at: string;
        };
        Insert: {
          activated_at?: string | null;
          competition_id: number;
          created_at?: string;
          created_by?: string | null;
          cloned_from_gender_division?: string | null;
          cloned_from_revision_id?: number | null;
          entry_count?: number | null;
          gender_recompiled?: boolean;
          id?: never;
          preset_key?: string | null;
          preset_version?: number | null;
          revision_number: number;
          status?: string;
          structure_kind: string;
          updated_at?: string;
        };
        Update: {
          activated_at?: string | null;
          competition_id?: number;
          created_at?: string;
          created_by?: string | null;
          cloned_from_gender_division?: string | null;
          cloned_from_revision_id?: number | null;
          entry_count?: number | null;
          gender_recompiled?: boolean;
          id?: never;
          preset_key?: string | null;
          preset_version?: number | null;
          revision_number?: number;
          status?: string;
          structure_kind?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competition_ruleset_revisions_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "competition_ruleset_revisions_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
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
      competition_slots: {
        Row: {
          competition_id: number;
          entry_id: number | null;
          id: number;
          origin_kind: string;
          round_id: number;
          ruleset_revision_id: number;
          source_matchup_id: number | null;
        };
        Insert: {
          competition_id: number;
          entry_id?: number | null;
          id?: never;
          origin_kind: string;
          round_id: number;
          ruleset_revision_id: number;
          source_matchup_id?: number | null;
        };
        Update: {
          competition_id?: number;
          entry_id?: number | null;
          id?: never;
          origin_kind?: string;
          round_id?: number;
          ruleset_revision_id?: number;
          source_matchup_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "competition_slots_entry_id_ruleset_revision_id_competition_fkey";
            columns: ["entry_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_entries";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "competition_slots_round_id_ruleset_revision_id_competition_fkey";
            columns: ["round_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_rounds";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "slot_source_matchup_fkey";
            columns: ["source_matchup_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "matchups";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
        ];
      };
      competition_stages: {
        Row: {
          code: string;
          competition_id: number;
          created_at: string;
          id: number;
          name: string;
          ruleset_revision_id: number;
          stage_kind: string | null;
          stage_order: number;
          structure_kind: string;
          track_id: number | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          competition_id: number;
          created_at?: string;
          id?: never;
          name: string;
          ruleset_revision_id: number;
          stage_kind?: string | null;
          stage_order: number;
          structure_kind: string;
          track_id?: number | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          competition_id?: number;
          created_at?: string;
          id?: never;
          name?: string;
          ruleset_revision_id?: number;
          stage_kind?: string | null;
          stage_order?: number;
          structure_kind?: string;
          track_id?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competition_stages_revision_competition_fkey";
            columns: ["ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_ruleset_revisions";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "stage_preset_track_fkey";
            columns: ["track_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_tracks";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
        ];
      };
      competition_tracks: {
        Row: {
          code: string;
          competition_id: number;
          id: number;
          ruleset_revision_id: number;
        };
        Insert: {
          code: string;
          competition_id: number;
          id?: never;
          ruleset_revision_id: number;
        };
        Update: {
          code?: string;
          competition_id?: number;
          id?: never;
          ruleset_revision_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competition_tracks_ruleset_revision_id_competition_id_fkey";
            columns: ["ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_ruleset_revisions";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      competitions: {
        Row: {
          category_id: number;
          created_at: string;
          current_publication_id: number | null;
          data_profile_id: number | null;
          data_profile_review_required: boolean;
          data_profile_validated_at: string | null;
          data_profile_validated_by: string | null;
          display_name: string;
          ends_on: string | null;
          gender_division: string | null;
          gender_division_review_required: boolean;
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
          current_publication_id?: number | null;
          data_profile_id?: number | null;
          data_profile_review_required?: boolean;
          data_profile_validated_at?: string | null;
          data_profile_validated_by?: string | null;
          display_name: string;
          ends_on?: string | null;
          gender_division?: string | null;
          gender_division_review_required?: boolean;
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
          current_publication_id?: number | null;
          data_profile_id?: number | null;
          data_profile_review_required?: boolean;
          data_profile_validated_at?: string | null;
          data_profile_validated_by?: string | null;
          display_name?: string;
          ends_on?: string | null;
          gender_division?: string | null;
          gender_division_review_required?: boolean;
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
            foreignKeyName: "competitions_current_publication_fkey";
            columns: ["current_publication_id", "id"];
            isOneToOne: false;
            referencedRelation: "competition_publications";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "competitions_data_profile_identity_fkey";
            columns: ["data_profile_id", "series_id", "category_id", "gender_division"];
            isOneToOne: false;
            referencedRelation: "active_series_category_data_profiles";
            referencedColumns: ["id", "series_id", "category_id", "gender_division"];
          },
          {
            foreignKeyName: "competitions_data_profile_identity_fkey";
            columns: ["data_profile_id", "series_id", "category_id", "gender_division"];
            isOneToOne: false;
            referencedRelation: "series_category_data_profiles";
            referencedColumns: ["id", "series_id", "category_id", "gender_division"];
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
          placement: number | null;
          registration_id: number;
          result_label: string | null;
          result_status: string;
          updated_at: string;
        };
        Insert: {
          competition_id: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: never;
          placement?: number | null;
          registration_id: number;
          result_label?: string | null;
          result_status?: string;
          updated_at?: string;
        };
        Update: {
          competition_id?: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: never;
          placement?: number | null;
          registration_id?: number;
          result_label?: string | null;
          result_status?: string;
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
            referencedRelation: "game_player_statistics";
            referencedColumns: ["game_roster_slot_id", "game_id"];
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
      game_data_domain_authority: {
        Row: {
          activated_at: string;
          activated_by: string;
          change_reason: string | null;
          domain: string;
          game_id: number;
          revision: number;
          source_type: string;
          submission_id: number;
          updated_at: string;
        };
        Insert: {
          activated_at?: string;
          activated_by: string;
          change_reason?: string | null;
          domain: string;
          game_id: number;
          revision?: number;
          source_type: string;
          submission_id: number;
          updated_at?: string;
        };
        Update: {
          activated_at?: string;
          activated_by?: string;
          change_reason?: string | null;
          domain?: string;
          game_id?: number;
          revision?: number;
          source_type?: string;
          submission_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_data_domain_authority_capability_fkey";
            columns: ["source_type", "domain"];
            isOneToOne: false;
            referencedRelation: "game_data_source_capabilities";
            referencedColumns: ["source_type", "domain"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_submission_fkey";
            columns: ["submission_id", "game_id", "source_type"];
            isOneToOne: false;
            referencedRelation: "game_data_submissions";
            referencedColumns: ["id", "game_id", "source_type"];
          },
        ];
      };
      game_data_domain_comparisons: {
        Row: {
          base_submission_id: number;
          candidate_submission_id: number;
          compared_at: string;
          compared_by: string;
          comparison_result: string;
          decided_at: string | null;
          decided_by: string | null;
          decision: string | null;
          decision_reason: string | null;
          domain: string;
          expected_authority_revision: number | null;
          expected_authority_submission_id: number | null;
          game_id: number;
          id: number;
          resolution_status: string;
        };
        Insert: {
          base_submission_id: number;
          candidate_submission_id: number;
          compared_at?: string;
          compared_by: string;
          comparison_result: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: string | null;
          decision_reason?: string | null;
          domain: string;
          expected_authority_revision?: number | null;
          expected_authority_submission_id?: number | null;
          game_id: number;
          id?: never;
          resolution_status: string;
        };
        Update: {
          base_submission_id?: number;
          candidate_submission_id?: number;
          compared_at?: string;
          compared_by?: string;
          comparison_result?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision?: string | null;
          decision_reason?: string | null;
          domain?: string;
          expected_authority_revision?: number | null;
          expected_authority_submission_id?: number | null;
          game_id?: number;
          id?: never;
          resolution_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_data_domain_comparisons_base_fkey";
            columns: ["base_submission_id", "game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_submissions";
            referencedColumns: ["id", "game_id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_candidate_fkey";
            columns: ["candidate_submission_id", "game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_submissions";
            referencedColumns: ["id", "game_id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_expected_authority_fkey";
            columns: ["expected_authority_submission_id", "game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_submissions";
            referencedColumns: ["id", "game_id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_data_domain_comparisons_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
          },
        ];
      };
      game_data_source_capabilities: {
        Row: {
          domain: string;
          precision: string;
          required_when_primary: boolean;
          source_type: string;
        };
        Insert: {
          domain: string;
          precision: string;
          required_when_primary?: boolean;
          source_type: string;
        };
        Update: {
          domain?: string;
          precision?: string;
          required_when_primary?: boolean;
          source_type?: string;
        };
        Relationships: [];
      };
      game_data_submission_snapshots: {
        Row: {
          captured_at: string;
          domain: string;
          game_id: number;
          payload: Json;
          payload_hash: string;
          submission_id: number;
        };
        Insert: {
          captured_at?: string;
          domain: string;
          game_id: number;
          payload: Json;
          payload_hash: string;
          submission_id: number;
        };
        Update: {
          captured_at?: string;
          domain?: string;
          game_id?: number;
          payload?: Json;
          payload_hash?: string;
          submission_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "game_data_submission_snapshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submission_snapshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submission_snapshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submission_snapshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_data_submission_snapshots_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submission_snapshots_submission_fkey";
            columns: ["submission_id", "game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_submissions";
            referencedColumns: ["id", "game_id"];
          },
        ];
      };
      game_data_submissions: {
        Row: {
          created_at: string;
          fallback_finalization_reason: string | null;
          fallback_finalized_at: string | null;
          fallback_finalized_by: string | null;
          game_id: number;
          id: number;
          idempotency_key: string;
          parser_version: string | null;
          payload_hash: string | null;
          reason: string | null;
          role: string;
          source_type: string;
          status: string;
          storage_object_id: string | null;
          submission_version: number;
          submitted_at: string;
          submitted_by: string | null;
          updated_at: string;
          validated_at: string | null;
          validated_by: string | null;
        };
        Insert: {
          created_at?: string;
          fallback_finalization_reason?: string | null;
          fallback_finalized_at?: string | null;
          fallback_finalized_by?: string | null;
          game_id: number;
          id?: never;
          idempotency_key: string;
          parser_version?: string | null;
          payload_hash?: string | null;
          reason?: string | null;
          role: string;
          source_type: string;
          status?: string;
          storage_object_id?: string | null;
          submission_version: number;
          submitted_at?: string;
          submitted_by?: string | null;
          updated_at?: string;
          validated_at?: string | null;
          validated_by?: string | null;
        };
        Update: {
          created_at?: string;
          fallback_finalization_reason?: string | null;
          fallback_finalized_at?: string | null;
          fallback_finalized_by?: string | null;
          game_id?: number;
          id?: never;
          idempotency_key?: string;
          parser_version?: string | null;
          payload_hash?: string | null;
          reason?: string | null;
          role?: string;
          source_type?: string;
          status?: string;
          storage_object_id?: string | null;
          submission_version?: number;
          submitted_at?: string;
          submitted_by?: string | null;
          updated_at?: string;
          validated_at?: string | null;
          validated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_data_submissions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submissions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submissions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_submissions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_data_submissions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
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
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id", "competition_id"];
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
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_periods_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_periods_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_periods_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_periods_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
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
      game_statistics: {
        Row: {
          created_at: string;
          game_id: number;
          lead_changes: number;
          source_parser_version: string;
          times_tied: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          game_id: number;
          lead_changes: number;
          source_parser_version: string;
          times_tied: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          game_id?: number;
          lead_changes?: number;
          source_parser_version?: string;
          times_tied?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_statistics_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_statistics_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_statistics_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_statistics_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_statistics_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: true;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
          },
        ];
      };
      game_team_statistics: {
        Row: {
          bench_points: number;
          created_at: string;
          fast_break_points: number;
          fast_break_points_from_turnovers: number;
          game_id: number;
          largest_lead: number;
          largest_scoring_run: number;
          points_from_turnovers: number;
          points_in_paint: number;
          points_in_paint_attempted: number;
          points_in_paint_made: number;
          points_per_possession: number;
          registration_id: number;
          second_chance_points: number;
          source_parser_version: string;
          time_leading_seconds: number;
          updated_at: string;
        };
        Insert: {
          bench_points: number;
          created_at?: string;
          fast_break_points: number;
          fast_break_points_from_turnovers: number;
          game_id: number;
          largest_lead: number;
          largest_scoring_run: number;
          points_from_turnovers: number;
          points_in_paint: number;
          points_in_paint_attempted: number;
          points_in_paint_made: number;
          points_per_possession: number;
          registration_id: number;
          second_chance_points: number;
          source_parser_version: string;
          time_leading_seconds: number;
          updated_at?: string;
        };
        Update: {
          bench_points?: number;
          created_at?: string;
          fast_break_points?: number;
          fast_break_points_from_turnovers?: number;
          game_id?: number;
          largest_lead?: number;
          largest_scoring_run?: number;
          points_from_turnovers?: number;
          points_in_paint?: number;
          points_in_paint_attempted?: number;
          points_in_paint_made?: number;
          points_per_possession?: number;
          registration_id?: number;
          second_chance_points?: number;
          source_parser_version?: string;
          time_leading_seconds?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_team_statistics_participant_fkey";
            columns: ["game_id", "registration_id"];
            isOneToOne: true;
            referencedRelation: "game_participants";
            referencedColumns: ["game_id", "registration_id"];
          },
          {
            foreignKeyName: "game_team_statistics_participant_fkey";
            columns: ["game_id", "registration_id"];
            isOneToOne: true;
            referencedRelation: "game_scores";
            referencedColumns: ["game_id", "registration_id"];
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
          matchup_game_number: number | null;
          matchup_id: number | null;
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
          matchup_game_number?: number | null;
          matchup_id?: number | null;
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
          matchup_game_number?: number | null;
          matchup_id?: number | null;
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
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_matchup_competition_fkey";
            columns: ["matchup_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "matchups";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      matchup_preparations: {
        Row: {
          competition_id: number;
          game_id: number | null;
          matchup_id: number;
          revision: number;
          scheduled_at: string | null;
          updated_at: string;
          updated_by: string;
          venue: string | null;
        };
        Insert: {
          competition_id: number;
          game_id?: number | null;
          matchup_id: number;
          revision?: number;
          scheduled_at?: string | null;
          updated_at?: string;
          updated_by: string;
          venue?: string | null;
        };
        Update: {
          competition_id?: number;
          game_id?: number | null;
          matchup_id?: number;
          revision?: number;
          scheduled_at?: string | null;
          updated_at?: string;
          updated_by?: string;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matchup_preparations_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_preparations_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_preparations_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_preparations_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_preparations_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_preparations_matchup_id_competition_id_fkey";
            columns: ["matchup_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "matchups";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      matchup_resolutions: {
        Row: {
          away_score: number;
          competition_id: number;
          game_id: number;
          home_score: number;
          loser_registration_id: number;
          matchup_id: number;
          resolved_at: string;
          resolved_by: string;
          ruleset_revision_id: number;
          source_type: string;
          submission_id: number;
          winner_registration_id: number;
        };
        Insert: {
          away_score: number;
          competition_id: number;
          game_id: number;
          home_score: number;
          loser_registration_id: number;
          matchup_id: number;
          resolved_at?: string;
          resolved_by: string;
          ruleset_revision_id: number;
          source_type: string;
          submission_id: number;
          winner_registration_id: number;
        };
        Update: {
          away_score?: number;
          competition_id?: number;
          game_id?: number;
          home_score?: number;
          loser_registration_id?: number;
          matchup_id?: number;
          resolved_at?: string;
          resolved_by?: string;
          ruleset_revision_id?: number;
          source_type?: string;
          submission_id?: number;
          winner_registration_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "matchup_resolutions_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_game_id_competition_id_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_loser_registration_id_competition_id_fkey";
            columns: ["loser_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_loser_registration_id_competition_id_fkey";
            columns: ["loser_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_matchup_id_ruleset_revision_id_competi_fkey";
            columns: ["matchup_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "matchups";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_submission_id_game_id_source_type_fkey";
            columns: ["submission_id", "game_id", "source_type"];
            isOneToOne: false;
            referencedRelation: "game_data_submissions";
            referencedColumns: ["id", "game_id", "source_type"];
          },
          {
            foreignKeyName: "matchup_resolutions_winner_registration_id_competition_id_fkey";
            columns: ["winner_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_resolutions_winner_registration_id_competition_id_fkey";
            columns: ["winner_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      matchups: {
        Row: {
          allow_side_inversion: boolean;
          away_registration_id: number | null;
          away_slot_id: number | null;
          code: string | null;
          competition_id: number;
          created_at: string;
          home_registration_id: number | null;
          home_slot_id: number | null;
          id: number;
          legacy_game_id: number | null;
          match_format: string | null;
          matchup_order: number;
          max_games: number | null;
          round_id: number;
          ruleset_revision_id: number | null;
          structure_kind: string;
          updated_at: string;
        };
        Insert: {
          allow_side_inversion?: boolean;
          away_registration_id?: number | null;
          away_slot_id?: number | null;
          code?: string | null;
          competition_id: number;
          created_at?: string;
          home_registration_id?: number | null;
          home_slot_id?: number | null;
          id?: never;
          legacy_game_id?: number | null;
          match_format?: string | null;
          matchup_order: number;
          max_games?: number | null;
          round_id: number;
          ruleset_revision_id?: number | null;
          structure_kind: string;
          updated_at?: string;
        };
        Update: {
          allow_side_inversion?: boolean;
          away_registration_id?: number | null;
          away_slot_id?: number | null;
          code?: string | null;
          competition_id?: number;
          created_at?: string;
          home_registration_id?: number | null;
          home_slot_id?: number | null;
          id?: never;
          legacy_game_id?: number | null;
          match_format?: string | null;
          matchup_order?: number;
          max_games?: number | null;
          round_id?: number;
          ruleset_revision_id?: number | null;
          structure_kind?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matchup_away_slot_fkey";
            columns: ["away_slot_id", "round_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_slots";
            referencedColumns: ["id", "round_id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_home_slot_fkey";
            columns: ["home_slot_id", "round_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_slots";
            referencedColumns: ["id", "round_id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "matchup_preset_round_fkey";
            columns: ["round_id", "ruleset_revision_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_rounds";
            referencedColumns: ["id", "ruleset_revision_id", "competition_id"];
          },
          {
            foreignKeyName: "matchups_away_registration_competition_fkey";
            columns: ["away_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "matchups_away_registration_competition_fkey";
            columns: ["away_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "matchups_home_registration_competition_fkey";
            columns: ["home_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "manual_scoresheet_prefill";
            referencedColumns: ["registration_id", "competition_id"];
          },
          {
            foreignKeyName: "matchups_home_registration_competition_fkey";
            columns: ["home_registration_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "team_registrations";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "matchups_legacy_game_id_fkey";
            columns: ["legacy_game_id"];
            isOneToOne: true;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "matchups_legacy_game_id_fkey";
            columns: ["legacy_game_id"];
            isOneToOne: true;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "matchups_legacy_game_id_fkey";
            columns: ["legacy_game_id"];
            isOneToOne: true;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "matchups_legacy_game_id_fkey";
            columns: ["legacy_game_id"];
            isOneToOne: true;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matchups_legacy_game_id_fkey";
            columns: ["legacy_game_id"];
            isOneToOne: true;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "matchups_round_competition_fkey";
            columns: ["round_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_rounds";
            referencedColumns: ["id", "competition_id"];
          },
        ];
      };
      player_honors: {
        Row: {
          competition_id: number | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          description: string | null;
          id: number;
          player_id: number;
          status: string;
          title: string;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          competition_id?: number | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          description?: string | null;
          id?: never;
          player_id: number;
          status?: string;
          title: string;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          competition_id?: number | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          description?: string | null;
          id?: never;
          player_id?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "player_honors_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "player_honors_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_honors_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_honors_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
          stat_scope: string;
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
          stat_scope?: string;
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
          stat_scope?: string;
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
            referencedRelation: "game_player_statistics";
            referencedColumns: ["game_roster_slot_id", "game_id"];
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
      player_profiles: {
        Row: {
          bio: string | null;
          birth_year: number | null;
          created_at: string;
          hand: string | null;
          height_cm: number | null;
          home_city: string | null;
          home_state: string | null;
          main_position: string | null;
          player_id: number;
          updated_at: string;
          weight_kg: number | null;
        };
        Insert: {
          bio?: string | null;
          birth_year?: number | null;
          created_at?: string;
          hand?: string | null;
          height_cm?: number | null;
          home_city?: string | null;
          home_state?: string | null;
          main_position?: string | null;
          player_id: number;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          bio?: string | null;
          birth_year?: number | null;
          created_at?: string;
          hand?: string | null;
          height_cm?: number | null;
          home_city?: string | null;
          home_state?: string | null;
          main_position?: string | null;
          player_id?: number;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "player_profiles_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_profiles_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "public_player_profiles";
            referencedColumns: ["id"];
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
          nickname: string | null;
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
          nickname?: string | null;
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
          nickname?: string | null;
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
          position: string | null;
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
          position?: string | null;
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
          position?: string | null;
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
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
      series_category_data_profiles: {
        Row: {
          activated_at: string | null;
          activated_by: string | null;
          category_id: number;
          change_reason: string | null;
          created_at: string;
          created_by: string;
          gender_division: string;
          id: number;
          primary_source: string;
          series_id: number;
          status: string;
          version: number;
        };
        Insert: {
          activated_at?: string | null;
          activated_by?: string | null;
          category_id: number;
          change_reason?: string | null;
          created_at?: string;
          created_by?: string;
          gender_division: string;
          id?: never;
          primary_source: string;
          series_id: number;
          status?: string;
          version: number;
        };
        Update: {
          activated_at?: string | null;
          activated_by?: string | null;
          category_id?: number;
          change_reason?: string | null;
          created_at?: string;
          created_by?: string;
          gender_division?: string;
          id?: never;
          primary_source?: string;
          series_id?: number;
          status?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "series_category_data_profiles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "series_category_data_profiles_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "competition_series";
            referencedColumns: ["id"];
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
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
      active_series_category_data_profiles: {
        Row: {
          activated_at: string | null;
          category_id: number | null;
          gender_division: string | null;
          id: number | null;
          primary_source: string | null;
          series_id: number | null;
          version: number | null;
        };
        Insert: {
          activated_at?: string | null;
          category_id?: number | null;
          gender_division?: string | null;
          id?: number | null;
          primary_source?: string | null;
          series_id?: number | null;
          version?: number | null;
        };
        Update: {
          activated_at?: string | null;
          category_id?: number | null;
          gender_division?: string | null;
          id?: number | null;
          primary_source?: string | null;
          series_id?: number | null;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "series_category_data_profiles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "series_category_data_profiles_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "competition_series";
            referencedColumns: ["id"];
          },
        ];
      };
      competition_boxscore_player_statistics: {
        Row: {
          advanced_games_played: number | null;
          advanced_points: number | null;
          assists: number | null;
          blocks: number | null;
          competition_id: number | null;
          defensive_rebounds: number | null;
          fouls: number | null;
          free_throw_attempted: number | null;
          free_throw_made: number | null;
          games_played: number | null;
          jersey_number: string | null;
          offensive_rebounds: number | null;
          official_points: number | null;
          player_id: number | null;
          player_name: string | null;
          player_slug: string | null;
          plus_minus: number | null;
          registration_id: number | null;
          roster_position: string | null;
          seconds_played: number | null;
          starter_appearances: number | null;
          steals: number | null;
          team_abbreviation: string | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          three_point_attempted: number | null;
          three_point_made: number | null;
          turnovers: number | null;
          two_point_attempted: number | null;
          two_point_made: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
      competition_data_coverage: {
        Row: {
          advanced_games: number | null;
          competition_id: number | null;
          data_profile_id: number | null;
          final_games: number | null;
          foul_games: number | null;
          participation_games: number | null;
          primary_source: string | null;
          scoring_games: number | null;
        };
        Relationships: [];
      };
      competition_player_statistics: {
        Row: {
          assists: number | null;
          blocks: number | null;
          competition_id: number | null;
          defensive_rebounds: number | null;
          fouls: number | null;
          free_throw_attempted: number | null;
          free_throw_made: number | null;
          games_played: number | null;
          jersey_number: string | null;
          offensive_rebounds: number | null;
          player_id: number | null;
          player_name: string | null;
          player_nickname: string | null;
          player_slug: string | null;
          plus_minus: number | null;
          points: number | null;
          registration_id: number | null;
          roster_position: string | null;
          seconds_played: number | null;
          starter_appearances: number | null;
          steals: number | null;
          team_abbreviation: string | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          three_point_attempted: number | null;
          three_point_made: number | null;
          turnovers: number | null;
          two_point_attempted: number | null;
          two_point_made: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
      competition_scoresheet_player_statistics: {
        Row: {
          competition_id: number | null;
          disqualifications: number | null;
          dnp_count: number | null;
          fouls: number | null;
          free_throw_made: number | null;
          games_played: number | null;
          jersey_number: string | null;
          player_id: number | null;
          player_name: string | null;
          player_slug: string | null;
          points: number | null;
          registration_id: number | null;
          roster_position: string | null;
          starter_appearances: number | null;
          team_abbreviation: string | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          three_point_made: number | null;
          two_point_made: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
      game_active_data_sources: {
        Row: {
          competition_id: number | null;
          domain: string | null;
          game_id: number | null;
          source_type: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_data_domain_authority_capability_fkey";
            columns: ["source_type", "domain"];
            isOneToOne: false;
            referencedRelation: "game_data_source_capabilities";
            referencedColumns: ["source_type", "domain"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_data_domain_authority_game_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
      };
      game_boxscore_player_statistics: {
        Row: {
          advanced_points: number | null;
          assists: number | null;
          blocks: number | null;
          competition_id: number | null;
          defensive_rebounds: number | null;
          did_not_play: boolean | null;
          fouls: number | null;
          free_throw_attempted: number | null;
          free_throw_made: number | null;
          game_id: number | null;
          game_number: string | null;
          game_roster_slot_id: number | null;
          has_advanced_coverage: boolean | null;
          is_starter: boolean | null;
          jersey_number: string | null;
          offensive_rebounds: number | null;
          official_points: number | null;
          player_id: number | null;
          player_name: string | null;
          player_slug: string | null;
          plus_minus: number | null;
          registration_id: number | null;
          scheduled_at: string | null;
          scoring_source_type: string | null;
          seconds_played: number | null;
          side: string | null;
          steals: number | null;
          team_abbreviation: string | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          three_point_attempted: number | null;
          three_point_made: number | null;
          turnovers: number | null;
          two_point_attempted: number | null;
          two_point_made: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
      game_data_status: {
        Row: {
          active_authority_count: number | null;
          active_sources: string[] | null;
          active_submission_count: number | null;
          competition_id: number | null;
          covered_required_domain_count: number | null;
          data_status: string | null;
          expected_primary_source: string | null;
          game_id: number | null;
          missing_domains: string[] | null;
          pending_submission_count: number | null;
          required_domain_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
            referencedRelation: "game_boxscore_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_data_status";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "game_scoresheet_player_statistics";
            referencedColumns: ["game_id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id", "competition_id"];
          },
          {
            foreignKeyName: "game_participants_game_competition_fkey";
            columns: ["game_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "legacy_unclassified_games";
            referencedColumns: ["game_id", "competition_id"];
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
      game_scoresheet_player_statistics: {
        Row: {
          competition_id: number | null;
          did_not_play: boolean | null;
          disqualifications: number | null;
          fouls: number | null;
          free_throw_made: number | null;
          game_id: number | null;
          game_number: string | null;
          game_roster_slot_id: number | null;
          is_starter: boolean | null;
          jersey_number: string | null;
          player_id: number | null;
          player_name: string | null;
          player_slug: string | null;
          points: number | null;
          registration_id: number | null;
          scheduled_at: string | null;
          side: string | null;
          team_abbreviation: string | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          three_point_made: number | null;
          two_point_made: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
      legacy_unclassified_games: {
        Row: {
          competition_id: number | null;
          game_id: number | null;
          game_number: string | null;
          matchup_id: number | null;
          review_reason: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
          {
            foreignKeyName: "games_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_matchup_competition_fkey";
            columns: ["matchup_id", "competition_id"];
            isOneToOne: false;
            referencedRelation: "matchups";
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
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          category_name: string | null;
          category_slug: string | null;
          competition_display_name: string | null;
          competition_id: number | null;
          confirmed_at: string | null;
          gender_division: string | null;
          placement: number | null;
          player_id: number | null;
          registration_id: number | null;
          result_label: string | null;
          series_name: string | null;
          series_slug: string | null;
          team_id: number | null;
          team_name: string | null;
          team_slug: string | null;
          year: number | null;
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
            referencedRelation: "competition_data_coverage";
            referencedColumns: ["competition_id"];
          },
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
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
          {
            foreignKeyName: "roster_entries_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "public_player_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      public_player_profiles: {
        Row: {
          bio: string | null;
          birth_year: number | null;
          created_at: string | null;
          full_name: string | null;
          hand: string | null;
          height_cm: number | null;
          home_city: string | null;
          home_state: string | null;
          id: number | null;
          is_active: boolean | null;
          is_public: boolean | null;
          main_position: string | null;
          nickname: string | null;
          slug: string | null;
          updated_at: string | null;
          weight_kg: number | null;
        };
        Relationships: [];
      };
      team_achievements: {
        Row: {
          category_name: string | null;
          category_slug: string | null;
          competition_display_name: string | null;
          competition_id: number | null;
          confirmed_at: string | null;
          gender_division: string | null;
          placement: number | null;
          registration_id: number | null;
          result_label: string | null;
          series_name: string | null;
          series_slug: string | null;
          team_id: number | null;
          year: number | null;
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
      admin_activate_game_data_authorities: {
        Args: {
          p_domains: string[];
          p_expected_submission_id?: number;
          p_game_id: number;
          p_reason?: string;
          p_submission_id: number;
        };
        Returns: {
          activated_at: string;
          activated_by: string;
          change_reason: string | null;
          domain: string;
          game_id: number;
          revision: number;
          source_type: string;
          submission_id: number;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "game_data_domain_authority";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      admin_apply_registration_removal: {
        Args: { p_expected_decision: string; p_reason: string; p_registration_id: number };
        Returns: Json;
      };
      admin_activate_game_data_authority: {
        Args: {
          p_domain: string;
          p_expected_submission_id?: number;
          p_game_id: number;
          p_reason?: string;
          p_submission_id: number;
        };
        Returns: {
          activated_at: string;
          activated_by: string;
          change_reason: string | null;
          domain: string;
          game_id: number;
          revision: number;
          source_type: string;
          submission_id: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "game_data_domain_authority";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_activate_series_category_data_profile: {
        Args: { p_profile_id: number };
        Returns: {
          activated_at: string | null;
          activated_by: string | null;
          category_id: number;
          change_reason: string | null;
          created_at: string;
          created_by: string;
          gender_division: string;
          id: number;
          primary_source: string;
          series_id: number;
          status: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "series_category_data_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_assign_competition_data_profile: {
        Args: { p_competition_id: number; p_profile_id: number };
        Returns: {
          category_id: number;
          created_at: string;
          current_publication_id: number | null;
          data_profile_id: number | null;
          data_profile_review_required: boolean;
          data_profile_validated_at: string | null;
          data_profile_validated_by: string | null;
          display_name: string;
          ends_on: string | null;
          gender_division: string | null;
          gender_division_review_required: boolean;
          id: number;
          published_at: string | null;
          series_id: number;
          starts_on: string | null;
          status: string;
          updated_at: string;
          year: number;
        };
        SetofOptions: {
          from: "*";
          to: "competitions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_assign_competition_entry: {
        Args: { p_entry_id: number; p_registration_id: number };
        Returns: number;
      };
      admin_claim_boxscore_upload: { Args: never; Returns: undefined };
      admin_clone_competition_ruleset: {
        Args: {
          p_allow_gender_recompile?: boolean;
          p_request_id: string;
          p_source_revision_id: number;
          p_target_competition_id: number;
        };
        Returns: Json;
      };
      admin_commit_boxscore_import: {
        Args: { p_import_id: number; p_resolution: Json };
        Returns: number;
      };
      admin_confirm_final_placement: {
        Args: {
          p_placement?: number;
          p_registration_id: number;
          p_result_label?: string;
          p_result_status: string;
        };
        Returns: {
          competition_id: number;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          id: number;
          placement: number | null;
          registration_id: number;
          result_label: string | null;
          result_status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "final_placements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_boxscore_import_draft: {
        Args: {
          p_competition_id: number;
          p_file_size_bytes: number;
          p_matches: Json;
          p_parsed_payload: Json;
          p_parser_version: string;
          p_sha256: string;
          p_source_filename: string;
          p_storage_path: string;
          p_validation_payload: Json;
        };
        Returns: number;
      };
      admin_create_competition_from_preset: {
        Args: { p_input: Json; p_request_id: string };
        Returns: number;
      };
      admin_create_manual_scoresheet: {
        Args: { p_payload: Json };
        Returns: number;
      };
      admin_create_player: {
        Args: {
          p_allow_similar?: boolean;
          p_full_name: string;
          p_nickname?: string;
        };
        Returns: {
          birth_date: string | null;
          created_at: string;
          full_name: string;
          id: number;
          is_active: boolean;
          is_public: boolean;
          nickname: string | null;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_player_with_private_profile: {
        Args: {
          p_allow_similar?: boolean;
          p_full_name: string;
          p_nickname?: string;
          p_sex: string;
        };
        Returns: {
          birth_date: string | null;
          created_at: string;
          full_name: string;
          id: number;
          is_active: boolean;
          is_public: boolean;
          nickname: string | null;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_create_series_category_data_profile: {
        Args: {
          p_category_id: number;
          p_change_reason?: string;
          p_gender_division: string;
          p_primary_source: string;
          p_series_id: number;
        };
        Returns: {
          activated_at: string | null;
          activated_by: string | null;
          category_id: number;
          change_reason: string | null;
          created_at: string;
          created_by: string;
          gender_division: string;
          id: number;
          primary_source: string;
          series_id: number;
          status: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "series_category_data_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      admin_fail_boxscore_import: {
        Args: { p_error_code: string; p_import_id: number };
        Returns: undefined;
      };
      admin_finalize_manual_fallback: {
        Args: { p_game_id: number; p_reason: string; p_submission_id: number };
        Returns: number;
      };
      admin_get_classification_backfill_report: { Args: never; Returns: Json };
      admin_get_competition_schedule: {
        Args: { p_competition_id: number };
        Returns: Json;
      };
      admin_get_game_data_backfill_report: { Args: never; Returns: Json };
      admin_get_game_data_conflict: {
        Args: { p_game_id: number };
        Returns: Json;
      };
      admin_get_player_private_profile: {
        Args: { p_player_id: number };
        Returns: {
          active_roster_entries: number;
          affected_competitions: number;
          eligibility_pending: boolean;
          full_name: string;
          player_id: number;
          roster_entries: number;
          sex: string;
        }[];
      };
      admin_get_publication_review: {
        Args: { p_competition_id: number };
        Returns: Json;
      };
      admin_get_registration_removal_decision: {
        Args: { p_registration_id: number };
        Returns: Json;
      };
      admin_list_ruleset_clone_sources: {
        Args: { p_include_other_gender?: boolean; p_target_competition_id: number };
        Returns: {
          display_name: string;
          edition_year: number;
          entry_count: number;
          gender_division: string;
          gender_mismatch: boolean;
          preset_key: string | null;
          revision_number: number;
          source_competition_id: number;
          source_kind: string;
          source_revision_id: number;
          structure_summary: Json;
        }[];
      };
      admin_prepare_matchup: {
        Args: {
          p_expected_revision: number;
          p_matchup_id: number;
          p_scheduled_at: string;
          p_venue: string;
        };
        Returns: number;
      };
      admin_publish_competition: {
        Args: {
          p_competition_id: number;
          p_confirmed: boolean;
          p_expected_version: number;
        };
        Returns: number;
      };
      admin_refresh_boxscore_team_statistics: {
        Args: {
          p_import_id: number;
          p_parsed_payload: Json;
          p_validation_payload: Json;
        };
        Returns: number;
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
          position: string | null;
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
      admin_resolve_game_data_conflict: {
        Args: {
          p_candidate_submission_id: number;
          p_decision: string;
          p_game_id: number;
          p_reason: string;
        };
        Returns: number;
      };
      admin_resolve_matchup: {
        Args: { p_expected_submission_id: number; p_matchup_id: number };
        Returns: number;
      };
      admin_review_competition_gender: {
        Args: { p_competition_id: number; p_gender_division: string };
        Returns: {
          category_id: number;
          created_at: string;
          current_publication_id: number | null;
          data_profile_id: number | null;
          data_profile_review_required: boolean;
          data_profile_validated_at: string | null;
          data_profile_validated_by: string | null;
          display_name: string;
          ends_on: string | null;
          gender_division: string | null;
          gender_division_review_required: boolean;
          id: number;
          published_at: string | null;
          series_id: number;
          starts_on: string | null;
          status: string;
          updated_at: string;
          year: number;
        };
        SetofOptions: {
          from: "*";
          to: "competitions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_search_players: {
        Args: {
          p_competition_id: number;
          p_limit?: number;
          p_query: string;
          p_registration_id?: number;
        };
        Returns: {
          conflict_registration_id: number;
          conflict_team_name: string;
          current_team_name: string;
          edition_jersey: string;
          full_name: string;
          id: number;
          nickname: string;
        }[];
      };
      admin_set_player_sex: {
        Args: { p_player_id: number; p_reason: string; p_sex: string };
        Returns: {
          eligibility_pending: boolean;
          player_id: number;
        }[];
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
      public_get_competition_publication: {
        Args: { p_competition_id: number };
        Returns: Json;
      };
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
