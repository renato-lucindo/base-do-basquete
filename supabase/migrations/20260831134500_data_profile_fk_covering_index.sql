-- Cover the complete referencing side of the versioned data-profile foreign key.

create index competitions_data_profile_identity_idx
  on public.competitions (
    data_profile_id,
    series_id,
    category_id,
    gender_division
  );

