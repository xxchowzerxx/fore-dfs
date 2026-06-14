-- Tournaments table
create table tournaments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  course text,
  dk_contest_id text,
  start_date date,
  current_round int default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Contestants (the 8 league members)
create table contestants (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  handle text not null,
  dk_entry_id text,
  total_fpts numeric default 0,
  rank int,
  created_at timestamptz default now()
);

-- Each contestant's 6 roster players
create table rosters (
  id uuid default gen_random_uuid() primary key,
  contestant_id uuid references contestants(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  player_name text not null
);

-- Live player scores (updated every 10 min during tournament)
create table player_scores (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  player_name text not null,
  fpts numeric default 0,
  position int,
  position_display text,
  to_par int default 0,
  thru int default 0,
  round_scores jsonb default '[]',
  updated_at timestamptz default now(),
  unique(tournament_id, player_name)
);

-- AI commentary per team per tournament
create table commentary (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  contestant_id uuid references contestants(id) on delete cascade,
  content text,
  prediction text,
  watch_player text,
  trend text,
  generated_at timestamptz default now(),
  unique(tournament_id, contestant_id)
);

-- Enable real-time
alter publication supabase_realtime add table player_scores;
alter publication supabase_realtime add table contestants;
alter publication supabase_realtime add table commentary;
