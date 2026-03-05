alter table kanban_cards
add column if not exists start_date timestamptz;
