
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    player_name VARCHAR(100) NOT NULL,
    game_uid VARCHAR(40) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    entry_type VARCHAR(10) NOT NULL
        CHECK (entry_type IN ('free', 'paid')),
    prize_preference VARCHAR(10) NOT NULL
        CHECK (prize_preference IN ('coins', 'cash')),
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    tournament_registrations_created_at_idx
ON tournament_registrations (created_at DESC);

CREATE INDEX IF NOT EXISTS
    tournament_registrations_status_idx
ON tournament_registrations (status);
